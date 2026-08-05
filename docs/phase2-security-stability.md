# 第二阶段：依赖安全、数据库迁移与生产稳定性

## 1. 阶段目标

本阶段位于核心业务正确性整改和 UI 重构之间，目标是让系统具备可维护、可审计、可备份和可恢复的生产基础，而不是增加页面功能。

本阶段完成：

1. 清除已知高风险或长期无人维护的核心运行时依赖；
2. 建立顺序执行、只执行一次的数据库迁移机制；
3. 在迁移和人工维护前创建一致性 SQLite 备份；
4. 将数据库恢复改为停机、校验、原子替换；
5. 将导入、抽题、配置和删除等高风险操作纳入事务；
6. 拆除包含旧硬编码凭据、明文密码和危险数据库逻辑的单体控制器；
7. 扫描完整 Git 历史中的个人数据文件和弱凭据路径；
8. 使用真实 HTTP、SQLite 和 XLSX 文件执行回归测试；
9. 将类型检查、生产构建和高危依赖审计设为阻塞 CI。

## 2. 运行时与依赖变化

### 2.1 Node.js 24

后端、CI 和生产镜像统一使用 Node.js 24，三个 `package.json` 将受支持版本限定为：

```text
>=24.15.0 <25
```

Node.js 大版本或关键小版本升级后，必须重新执行全部 API 测试、数据库迁移测试、两个前端类型检查、生产构建和 Docker 镜像构建。

### 2.2 SQLite

移除 `sqlite3` npm 原生扩展，使用 Node.js 自带的 `node:sqlite`：

- `DatabaseSync` 负责短小、确定性的数据库操作；
- 关键事务使用独立连接；
- 外键检查始终开启；
- WAL、busy timeout 和同步级别在启动时配置；
- 查询结果转换为普通 JavaScript 对象，保持原接口兼容；
- 备份使用 SQLite 在线备份 API，不直接复制正在写入的数据库文件。

项目固定 Node.js 24 运行范围，并通过真实数据库回归测试和生产镜像构建降低运行时升级风险。

### 2.3 Excel

移除没有可用安全修复版本的 `xlsx`，统一使用 ExcelJS：

- 只接受 `.xlsx`；
- 限制文件大小、工作表数量、行数和列数；
- 拒绝公式单元格；
- 拒绝重复或空表头；
- 限制单次导入错误明细数量；
- 导出时防止电子表格公式注入；
- 用户、题库、考试记录和证书使用同一套受限工具。

### 2.4 上传与前端依赖

- Multer 升级到 2.x，并限制文件数、字段数、分段数和字段大小；
- PDF 上传落盘后验证 `%PDF-` 文件签名；
- Axios、jsPDF、Vite、Vue、Vue Router、Element Plus、ECharts 和 TypeScript 工具链升级；
- 学生端传递依赖固定到已修复的 DOMPurify、Lodash 和 Lodash-ES；
- 管理端传递依赖中的 Picomatch 升级到安全补丁版本；
- 后端、学生端和管理端高危依赖审计均为阻塞步骤；
- 学生端与管理端 `vue-tsc --noEmit` 均为阻塞步骤。

## 3. 数据库迁移

迁移定义位于：

```text
backend/src/database/migrations.js
```

已执行版本记录在：

```sql
schema_migrations(version, name, applied_at)
```

迁移规则：

1. 按版本号从小到大执行；
2. 每个版本只执行一次；
3. 每个版本在独立事务中执行；
4. 失败时回滚该版本并停止启动；
5. 生产数据库存在旧业务表且有待执行迁移时，先自动备份；
6. 启动后执行 `PRAGMA foreign_key_check`；
7. 不允许业务接口临时关闭外键检查。

查看状态：

```bash
cd backend
npm run db:status
```

手动执行：

```bash
cd backend
npm run db:migrate
```

管理员 API：

```text
GET /api/admin/db/migrations
```

正常生产启动也会自动执行待处理迁移。手动命令用于部署前副本演练和诊断。

## 4. 数据库备份

每份应用备份：

- 通过 SQLite 在线备份 API 生成；
- 使用 `PRAGMA quick_check` 验证；
- 执行 `PRAGMA foreign_key_check`；
- 计算 SHA-256；
- 写入同名 `.sha256` 文件；
- 文件权限设置为 `0600`；
- 元数据记录在 `database_backups`；
- 根据 `DB_BACKUP_RETENTION` 保留最近 1–50 份。

默认保留：

```dotenv
DB_BACKUP_RETENTION=10
```

Docker 持久卷内路径：

```text
/app/data/backups/
```

管理接口：

```text
POST /api/admin/db/backup
POST /api/admin/db/backup-clear
GET  /api/admin/db/backups
GET  /api/db-backups/:filename
```

兼容接口 `backup-clear` 现在只创建备份，不再清空数据库。以上接口均要求管理员 JWT。

命令行：

```bash
cd backend
npm run db:backup
npm run db:verify -- /path/to/backup.db
```

## 5. 离线恢复

在线上传并覆盖正在使用的 SQLite 文件已停用：

```text
POST /api/admin/db/restore → 409
```

Docker 生产恢复流程：

```bash
cd /opt/lab-safety-access

sudo docker compose --env-file .env -f docker-compose.prod.yml stop backend

sudo docker compose --env-file .env -f docker-compose.prod.yml run --rm --no-deps \
  -e CONFIRM_OFFLINE_RESTORE=YES \
  backend \
  npm run db:restore -- /app/data/backups/<backup-file>.db

sudo docker compose --env-file .env -f docker-compose.prod.yml up -d backend web
curl -fsS http://127.0.0.1/api/health
```

恢复程序会验证来源数据库、拒绝外键错误、为当前数据库创建 `pre_restore` 备份、删除旧 WAL/SHM、原子替换主库，并对恢复后的数据库再次验证。

恢复后仍需人工核对管理员登录、用户数、考试数、题目数、近期考试记录、证书状态和上传文件。

## 6. 高风险业务操作

### 6.1 导入

用户和题库 XLSX 导入在独立事务中执行。格式错误会记录为失败行；系统级错误会回滚整个事务。

用户导入：

- 新用户密码必须满足密码规则；
- 密码立即使用 scrypt 哈希；
- 覆盖已有用户时，空密码不会重置原密码；
- 最多导入 5000 行。

题库导入：

- 验证题型、选项、答案和选项范围；
- 多选答案去重并排序；
- 判断题答案统一为“正确/错误”；
- 最多导入 5000 行。

### 6.2 自动抽题与手工配置

- 不关闭外键检查；
- 检测题目是否已属于其他考试；
- 不允许抢占其他考试的题目；
- 题库不足时返回 409，原配置不变；
- 抽题、绑定和题量同步在同一事务中完成。

### 6.3 删除

用户、考试、题目和考试记录删除均在事务中执行，任一步失败都会整体回滚。

删除考试时：

- 删除考试记录、证书和发布范围；
- 将题目解除绑定并退回题库；
- 不再直接删除题目；
- 写入 `operation_audit_logs`。

院系或班级仍被引用时返回 409。院系和班级重命名会同步更新用户和考试发布范围。

## 7. 管理控制器拆分

旧 `adminController.js` 曾同时包含固定管理员密码、明文用户密码、旧 XLSX、callback SQLite、关闭外键检查、在线数据库覆盖及多个不相关业务域。

活动路由已按业务域拆分到独立控制器，旧文件已物理删除。CI 会阻止以下风险重新进入当前源代码：

- 恢复旧单体控制器；
- 再次依赖 `xlsx` 或 `sqlite3`；
- 写回历史固定管理员密码；
- 为 JWT 或管理员密码设置弱硬编码回退值。

## 8. Git 历史审计

运行：

```bash
bash scripts/scan-sensitive-history.sh history-audit
```

脚本扫描全部可达分支和标签，但不会输出文件内容或匹配到的密钥值。

已确认历史仍包含：

1. `admin-web/src/assets/Student-2021-10-03.xlsx`；
2. 旧管理员控制器中的固定密码路径；
3. 旧认证代码中的弱 JWT 默认值路径。

当前源代码已经移除这些内容，但删除当前文件不能清除 Git 历史对象。彻底清理需要使用 `git filter-repo` 重写相关分支和标签并强制推送。该操作会改变提交哈希、影响未合并分支、部署引用和已有克隆，因此必须在独立维护窗口执行，并在执行前得到仓库所有者明确确认。

历史清理前：

- 仓库不能视为已彻底去除个人数据；
- 历史管理员密码和弱 JWT 默认值必须视为已泄露；
- 生产环境必须使用全新的管理员密码和 JWT 密钥；
- 其他系统若复用过相关值，必须一并轮换。

## 9. 自动化验证

第二阶段 CI 当前阻塞验证：

- 当前源代码风险回归检查；
- 后端 JavaScript 语法检查；
- 26 项真实 HTTP、SQLite、迁移和领域规则测试；
- 后端运行时高危依赖审计；
- 学生端依赖安装、类型检查、生产构建和高危审计；
- 管理端依赖安装、类型检查、生产构建和高危审计；
- Docker Compose 生产配置校验；
- Node.js 24 后端生产镜像构建。

专项场景包括迁移幂等、备份哈希与下载、用户和题库 XLSX 导入、公式拒绝、密码哈希、自动抽题回滚、考试删除后题目保留、组织重命名传播、设置白名单、证书状态流转、历史答题快照及最终外键完整性。

完整 Git 历史审计当前为可见告警并上传脱敏报告，不阻塞本 PR；原因是清除历史需要单独维护窗口，而不是普通代码合并。

## 10. 合并前验收

已由 CI 自动完成：

- [x] 后端全部测试通过；
- [x] 学生端类型检查与生产构建通过；
- [x] 管理端类型检查与生产构建通过；
- [x] Docker Compose 校验通过；
- [x] 后端生产镜像构建通过；
- [x] 后端、学生端和管理端高危依赖审计通过；
- [x] 当前源代码风险回归检查通过；
- [x] 历史审计报告已生成并确认遗留对象范围。

合并或生产发布前仍需人工完成：

- [ ] 在生产数据库副本上演练迁移、备份和离线恢复；
- [ ] 确认服务器 `.env` 使用全新的 `JWT_SECRET` 与管理员密码；
- [ ] 确认数据库持久卷及备份目录有足够磁盘空间；
- [ ] 安排 Git 历史重写维护窗口，或书面接受暂时保留历史对象的风险。
