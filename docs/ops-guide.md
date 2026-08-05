## 运维与部署说明（Ops Guide）

本文档面向运维人员与系统管理员，主要介绍系统的部署方式、数据库备份恢复方案以及常见问题排查。

---

## 1. 部署架构建议

### 1.1 组件划分

- **后端 API（backend）**
  - Node.js + Express 服务
  - 暴露 `/api/*` 接口（认证、考试、记录、错题、证书、管理端接口等）
  - 访问 SQLite 数据库文件 `backend/data/lab_safety.db`

- **学生端 H5（frontend-h5）**
  - 构建后的静态资源（HTML/CSS/JS）
  - 部署在 Nginx 或其他静态服务器上
  - 通过浏览器访问，如 `https://exam.example.com`

- **后台管理端（admin-web）**
  - 同样是构建后的静态资源
  - 可以部署在另一个站点（如 `https://admin.exam.example.com`），也可与 H5 共用一个域名下不同路径

### 1.2 推荐部署拓扑

- Nginx 反向代理：
  - `/` 或 `/h5` → 指向 H5 静态资源
  - `/admin` → 指向后台管理静态资源
  - `/api` → 反向代理到 Node.js 后端（如 `http://127.0.0.1:4000`）
- 后端服务使用 `pm2`、`systemd` 等守护

---

## 2. 启动命令汇总

### 2.1 后端（backend）

```bash
cd backend
npm install
npm run dev   # 开发环境
# 或
npm start     # 生产环境（需自行用 pm2 / systemd 守护）
```

默认监听 `http://0.0.0.0:4000`（可通过 `PORT` 环境变量调整）。

### 2.2 学生端 H5（frontend-h5）

**开发：**

```bash
cd frontend-h5
npm install
npm run dev
```

**构建 + 部署：**

```bash
npm run build
# 将 dist/ 目录上传至 Web 服务器
```

### 2.3 后台管理端（admin-web）

**开发：**

```bash
cd admin-web
npm install
npm run dev
```

**构建 + 部署：**

```bash
npm run build
# 将 dist/ 目录上传至 Web 服务器
```

---

## 3. 数据库备份、清空与恢复

系统内置了 **数据库备份和恢复功能**，便于管理员在不接触服务器命令行的情况下进行运维。

### 3.1 数据库文件位置

- 主数据库文件：`backend/data/lab_safety.db`
- 备份目录：`backend/data/backups/`

> 所有业务数据（用户、考试、记录、证书、错题本等）都存储在该文件中。

### 3.2 通过后台界面操作

在后台管理系统 `SettingsPage` → 「数据维护」标签页中，可以进行：

- **数据库备份与清空**
  - 点击按钮后，后台会：
    1. 将当前 `lab_safety.db` 复制到 `data/backups/` 目录，文件名中包含时间戳
    2. 返回一个 `downloadUrl`，前端会在新窗口打开，实现备份文件下载
    3. 清空业务数据表（如用户、考试、题目、考试记录、错题、证书等），保留系统结构和基础数据（例如院系/班级）

- **从备份恢复数据库**
  - 选择一个 `.db` 文件上传（通常是之前备份下载的文件）
  - 后端会：
    1. 先对当前数据库再做一份备份（命名为 `lab_safety_before_restore_xxx.db`）
    2. 然后用上传的 `.db` 文件覆盖 `lab_safety.db`
  - 建议操作完成后重启后端服务

### 3.3 手工备份/恢复

如果具备服务器访问权限，也可以直接操作文件：

- 备份：

```bash
cd backend/data
cp lab_safety.db lab_safety_backup_YYYYMMDD.db
```

- 恢复：

```bash
cd backend/data
cp lab_safety_backup_YYYYMMDD.db lab_safety.db
```

> 恢复后需重启 backend 进程。

---

## 4. 日志与问题排查

### 4.1 后端日志

- 开发环境：直接在控制台查看 `npm run dev` 输出
- 生产环境：建议：
  - 使用 `pm2 logs` 或重定向日志到文件
  - 添加 `console.log` 以输出关键操作（例如判分详情、错误堆栈）

常见错误示例：

- `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`
  - 某些批量操作已在代码中使用事务和临时关闭外键约束进行处理
  - 若在其它操作中出现，通常与删除顺序或脏数据有关

- `SQLITE_ERROR: no such column: avatar`
  - 数据库版本较旧，尚未添加新字段
  - 解决：确保运行的是带有自动迁移逻辑的最新代码，并在启动时成功执行到 `db.js` 的迁移函数；或手动执行相应 `ALTER TABLE` 语句

### 4.2 前端排查

- 使用浏览器开发者工具（F12）查看：
  - Network：确认请求 URL、状态码、返回 JSON 是否正常
  - Console：查看 JS 报错栈信息
- 确认：
  - `/api` 代理是否正确指向后端地址
  - 请求头中是否包含正确的 `Authorization` token

---

## 5. 磁盘空间不足（ENOSPC）处理

在开发或部署环境中，如果遇到类似：

```text
npm ERR! nospc ENOSPC: no space left on device, write
```

说明系统磁盘空间不足，可能原因包括：

- `node_modules` 目录过多
- 数据库备份文件占用较大空间
- 其他无关文件占满磁盘

解决建议：

1. 删除不再使用的项目或 `node_modules` 目录，重新 `npm install`
2. 清理旧的数据库备份（`backend/data/backups/*.db`）
3. 使用系统磁盘清理工具释放空间

---

## 6. 安全建议

- **JWT 秘钥**：
  - 在生产环境使用强随机值配置 `JWT_SECRET` 环境变量
- **接口访问控制**：
  - 对 `/api/admin/*` 接口启用更严格的权限控制（仅管理员角色）
- **HTTPS 部署**：
  - 建议通过 Nginx 或其他 Web 服务器配置 HTTPS，防止登录密码与 Token 明文传输
- **定期备份**：
  - 建议定期（例如每日/每周）自动备份 `lab_safety.db` 到安全位置

---

## 7. 常见场景流程

### 7.1 新学期初始化

1. 从旧库导出或清理上一届数据（按学校实际需求）
2. 使用「数据库备份与清空」功能：
   - 备份当前库 → 清空业务数据
3. 导入新学期的院系、班级、学生信息
4. 在后台创建新考试并配置题目、发布范围

### 7.2 误操作后恢复

1. 管理员误删了大量考试记录或用户
2. 如有近期 `.db` 备份：
   - 在后台「从备份恢复」上传备份文件
   - 或在服务器上直接覆盖 `lab_safety.db`
3. 重启后端服务，确认数据恢复情况


