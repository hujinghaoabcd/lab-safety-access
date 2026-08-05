# 第二阶段：依赖安全、数据库迁移与生产稳定性

## 1. 阶段目标

本阶段位于核心业务正确性整改和 UI 重构之间，目标不是增加页面，而是让系统具备可维护、可审计、可备份和可恢复的生产基础。

本阶段覆盖：

1. 清除已知高风险或长期无人维护的运行时依赖；
2. 建立顺序执行、只执行一次的数据库迁移机制；
3. 在迁移和人工操作前创建一致性 SQLite 备份；
4. 将在线数据库恢复改为停机、校验、原子替换；
5. 将导入、抽题和删除等高风险操作纳入事务；
6. 拆除包含旧硬编码凭据、明文密码和危险数据库逻辑的单体控制器；
7. 扫描完整 Git 历史中的个人数据文件和弱凭据；
8. 使用真实 HTTP、SQLite 和 XLSX 文件执行回归测试。

## 2. 运行时与依赖变化

### 2.1 Node.js

后端、CI 和生产镜像统一使用 Node.js 24 LTS。`package.json` 将受支持版本限定为：

```text
>=24.15.0 <25
```

不要在 Node.js 20、22 或未来的 25 上跳过验证直接部署。

### 2.2 SQLite

移除 `sqlite3` npm 原生扩展，使用 Node.js 24 自带的 `node:sqlite`：

- `DatabaseSync` 负责短小、确定性的数据库操作；
- 每个关键事务使用独立连接；
- 外键检查始终开启；
- WAL 与 busy timeout 在启动时配置；
- 查询结果转换成普通 JavaScript 对象，保持原接口兼容；
- 备份使用 SQLite 在线备份 API，不再直接复制正在写入的数据库文件。

当前 `node:sqlite` 在 Node.js 文档中的稳定性仍不是最高等级，因此项目固定 Node.js 24 的具体大版本，并通过完整回归测试和生产镜像构建降低升级风险。升级 Node.js 小版本后仍必须重新运行 CI 和恢复演练。

### 2.3 Excel

移除没有可用修复版本的 `xlsx`，统一使用 ExcelJS：

- 仅接受 `.xlsx`；
- 限制文件大小、工作表行数和列数；
- 拒绝公式单元格；
- 拒绝重复或空表头；
- 限制单次导入错误明细数量；
- 导出时防止公式注入；
- 用户、题库、考试记录和证书导入导出使用同一套工具。

### 2.4 上传中间件与前端依赖

- Multer 升级到 2.x，并限制文件数、字段数、分段数和字段大小；
- PDF 上传在落盘后验证 `%PDF-` 文件签名；
- Axios、jsPDF、Vite、Vue、Vue Router、Element Plus、ECharts 和 TypeScript 工具链升级；
- 依赖审计保留在 CI；完成剩余兼容修复后，高危审计将改为阻塞步骤。

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
3. 每个版本在独立 `EXCLUSIVE` 事务中执行；
4. 失败时回滚该版本并停止启动；
5. 生产环境存在旧业务表且有待执行迁移时，先自动备份；
6. 启动后执行 `PRAGMA foreign_key_check`；
7. 不允许业务接口临时关闭外键检查。

### 3.1 查看迁移状态

本地或一次性维护容器中执行：

```bash
cd backend
npm run db:status
```

管理员 API：

```text
GET /api/admin/db/migrations
```

### 3.2 手动执行迁移

```bash
cd backend
npm run db:migrate
```

正常生产启动也会自动执行待处理迁移。手动命令主要用于部署前演练和诊断。

## 4. 数据库备份

### 4.1 备份特性

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

备份位于持久卷内：

```text
/app/data/backups/
```

### 4.2 管理端创建备份

```text
POST /api/admin/db/backup
```

兼容旧管理端按钮：

```text
POST /api/admin/db/backup-clear
```

旧接口现在只备份，不再清空数据库。

查看备份：

```text
GET /api/admin/db/backups
```

下载备份：

```text
GET /api/db-backups/:filename
```

以上接口都要求管理员 JWT。

### 4.3 命令行创建和验证

```bash
cd backend
npm run db:backup
npm run db:verify -- /path/to/backup.db
```

## 5. 离线恢复

在线上传并覆盖正在使用的 SQLite 文件已永久停用：

```text
POST /api/admin/db/restore → 409
```

原因：正在运行的连接、WAL 文件、迁移版本和并发请求会让在线替换存在损坏或部分恢复风险。

### 5.1 Docker 生产恢复

在 `/opt/lab-safety-access` 执行：

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

恢复程序会：

1. 验证来源数据库；
2. 拒绝存在外键错误的来源；
3. 为当前数据库创建 `pre_restore` 备份；
4. 将来源复制到临时文件并再次验证；
5. 删除旧 WAL/SHM；
6. 原子替换主数据库；
7. 对恢复后的数据库再次验证。

恢复成功后仍需人工验证：

- 管理员登录；
- 用户数、考试数、题目数；
- 最近考试记录；
- 证书状态；
- 上传文件是否仍存在。

## 6. 高风险业务操作

### 6.1 导入

用户和题库 XLSX 导入运行在独立事务中。单行格式错误会记录为失败行；系统错误会回滚整个事务。

用户导入：

- 新用户密码必须满足密码规则；
- 密码立即哈希；
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
- 不允许“抢占”其他考试的题目；
- 题库不足时返回 409，原配置不变；
- 抽题、绑定和题量同步在同一个事务中完成。

### 6.3 删除

用户、考试、题目和考试记录删除都在事务中执行。

删除考试时：

- 删除考试记录、证书和发布范围；
- 将题目解除绑定并退回题库；
- 不再直接删除题目；
- 写入 `operation_audit_logs`。

院系或班级仍被用户、班级或考试发布范围引用时，返回 409，不允许产生悬空文本引用。院系和班级重命名会同步更新用户与考试发布范围。

## 7. 管理控制器拆分

原 `adminController.js` 同时包含：

- 固定管理员密码；
- 明文用户密码；
- 旧 XLSX；
- callback SQLite；
- 关闭外键检查；
- 在线数据库覆盖；
- 多个不相关业务域。

活动路由已经拆分到独立控制器。原文件只保留空兼容模块，不再包含任何业务实现，后续确认没有外部引用后可物理删除。

## 8. Git 历史审计

脚本：

```bash
bash scripts/scan-sensitive-history.sh history-audit
```

脚本扫描全部可达分支和标签，但不会输出文件内容或匹配到的密钥值。

已确认历史中存在：

1. `admin-web/src/assets/Student-2021-10-03.xlsx`；
2. 旧管理员控制器中的固定密码；
3. 旧认证代码中的弱 JWT 默认值。

当前分支删除文件或删除代码不能从 Git 历史中移除这些对象。彻底清理必须使用 `git filter-repo` 重写所有相关分支和标签，然后强制推送。该操作会改变提交哈希、影响未合并分支和已发布部署引用，因此必须在独立维护窗口执行，并在执行前得到明确确认。

历史清理之前：

- 不应将仓库视为已彻底去除个人数据；
- 历史管理员密码和弱 JWT 默认值必须视为已经泄露；
- 生产环境必须使用全新的管理员密码和 JWT 密钥；
- 任何复用过该密码或密钥的其他系统都必须轮换。

## 9. 自动化验证

第二阶段新增或扩展以下测试：

- 迁移只执行一次；
- 备份、哈希、校验、列表和下载；
- 用户 XLSX 导入与密码哈希；
- 公式单元格拒绝；
- 题库导入、答案标准化和 ExcelJS 导出；
- 自动抽题失败回滚；
- 删除考试后题目保留；
- 管理控制器拆分后的响应兼容；
- 院系和班级重命名传播；
- 设置字段白名单和范围校验；
- 证书发放、重复保护、撤销和重新发放；
- 管理端考试详情读取历史快照；
- 最终外键完整性；
- 生产后端 Docker 镜像构建。

## 10. 合并前验收

- [ ] 后端全部测试通过；
- [ ] 学生端生产构建通过；
- [ ] 管理端生产构建通过；
- [ ] Docker Compose 校验通过；
- [ ] 后端生产镜像构建通过；
- [ ] 三个项目高危依赖审计无未解释问题；
- [ ] 历史审计报告已人工确认；
- [ ] 已决定历史重写时间窗口；
- [ ] 在数据库副本上演练迁移、备份和恢复；
- [ ] PR 合并前再次确认服务器 `.env` 中已配置全新密钥。
