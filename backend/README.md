# 实验室安全教育与准入考试系统 - 后端 API 服务（backend）

## 1. 概述

`backend` 是整个系统的 **统一 API 服务**，负责：

- 用户认证、用户资料、头像上传
- 学习资料列表与学习进度
- 考试列表、考试说明、开始考试、提交判分
- 错题本、考试记录、排行榜
- 准入证书、资格查询
- 管理端的考试配置、题库、考试记录、证书管理
- 数据库备份、清空和恢复

技术栈：**Node.js + Express + SQLite3 + JWT**。

## 2. 项目结构

```txt
backend/
├── src/
│   ├── app.js             # Express 入口，挂载中间件和路由
│   ├── controllers/       # 业务控制器（按模块拆分）
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── learningController.js
│   │   ├── examController.js
│   │   ├── recordsController.js
│   │   ├── wrongbookController.js
│   │   ├── qualificationController.js
│   │   └── adminController.js
│   ├── routes/            # 路由定义，按前缀分模块
│   │   ├── auth.js
│   │   ├── user.js
│   │   ├── learning.js
│   │   ├── exam.js
│   │   ├── records.js
│   │   ├── wrongbook.js
│   │   ├── qualification.js
│   │   └── admin.js
│   ├── middleware/
│   │   └── auth.js        # JWT 认证中间件
│   ├── database/
│   │   ├── db.js          # SQLite 连接、通用查询方法、自动迁移
│   │   └── init.js        # 可选初始化脚本
│   ├── utils/
│   │   ├── response.js    # 统一返回格式（success / error）
│   │   └── mockData.js    # 早期 mock 工具（当前已不再使用）
│   └── ...
├── data/
│   ├── lab_safety.db      # 主数据库文件
│   └── backups/           # 通过后台生成的数据库备份
├── uploads/
│   └── avatars/           # 用户头像文件
├── package.json
└── README.md
```

## 3. 启动与配置

### 3.1 环境要求

- Node.js >= 18
- npm >= 9

### 3.2 安装依赖

```bash
cd backend
npm install
```

### 3.3 启动开发环境

```bash
npm run dev
```

默认监听：`http://localhost:4000`。

> 首次启动时，会自动在 `data/lab_safety.db` 创建数据库文件并执行必要的 **表结构迁移**（例如自动新增 `users.avatar` 字段）。

### 3.4 生产启动

```bash
npm start
```

建议在生产环境中使用 `pm2`、`systemd` 等进程管理工具守护进程。

### 3.5 环境变量（可选）

常见环境变量：

- `PORT`：服务端口，默认 `4000`
- `JWT_SECRET`：JWT 密钥（也可以在 `middleware/auth.js` 中配置默认值）

## 4. 统一响应格式

所有业务接口通过 `utils/response.js` 输出统一 JSON：

```json
{
  "code": 0,
  "message": "操作成功",
  "data": {}
}
```

- `code`：数字，0 表示成功，其它表示错误
- `message`：提示信息
- `data`：具体业务数据

前端只需要统一判断 `code === 0` 即可。

## 5. 主要 API 分组概览

> 这里只给出主要路由分组和核心接口，详细字段说明可参考根目录 `docs/backend-apis.md`。

### 5.1 认证模块 `/api/auth`

| 方法 | 路径       | 说明           | 认证 |
|------|------------|----------------|------|
| POST | /login     | 用户登录       | 否   |
| POST | /logout    | 用户登出       | 是   |

### 5.2 用户模块 `/api/user`

| 方法 | 路径                | 说明             | 认证 |
|------|---------------------|------------------|------|
| GET  | /profile            | 获取当前用户信息 | 是   |
| PUT  | /profile            | 更新用户资料     | 是   |
| PUT  | /profile/password   | 修改密码         | 是   |
| POST | /profile/avatar     | 上传头像         | 是   |
| GET  | /profile/stats      | 个人统计（考试数/通过数/证书数） | 是 |

### 5.3 学习模块 `/api/learning`

| 方法 | 路径     | 说明           | 认证 |
|------|----------|----------------|------|
| GET  | /list    | 学习资料列表   | 是   |
| GET  | /:id     | 学习资料详情   | 是   |
| POST | /progress| 上报学习进度   | 是   |

### 5.4 考试模块 `/api/exam`

| 方法 | 路径      | 说明                         | 认证 |
|------|-----------|------------------------------|------|
| GET  | /list     | 当前用户可见考试列表         | 是   |
| GET  | /:id      | 单个考试详情（含 description）| 是  |
| POST | /start    | 开始考试，返回题目列表       | 是   |
| POST | /submit   | 提交试卷，统一判分并写入记录 | 是   |

### 5.5 考试记录与排行榜 `/api/records`

| 方法 | 路径        | 说明                     | 认证 |
|------|-------------|--------------------------|------|
| GET  | /list       | 当前用户考试记录列表     | 是   |
| GET  | /:id        | 单条考试记录详情         | 是   |
| GET  | /stats      | 总考试次数、通过次数等   | 是   |
| GET  | /ranking    | 最高成绩排行榜 + 自己名次| 是   |

### 5.6 错题本 `/api/wrongbook`

| 方法 | 路径   | 说明                 | 认证 |
|------|--------|----------------------|------|
| GET  | /list  | 当前用户错题汇总列表 | 是   |
| DELETE | /:id | 删除某道题的全部错题记录 | 是 |

### 5.7 准入与证书 `/api/qualification`

| 方法 | 路径         | 说明             | 认证 |
|------|--------------|------------------|------|
| GET  | /status      | 准入状态（可扩展）| 是  |
| GET  | /certificate | 当前用户证书列表 | 是   |

### 5.8 管理端接口 `/api/admin`

管理端接口较多，包括：用户、考试、题库、记录、证书、数据库维护等，主要路由有：

- `/api/admin/users/*`
- `/api/admin/exams/*`
- `/api/admin/questions/*`
- `/api/admin/records/*`
- `/api/admin/certificates/*`
- `/api/admin/db/backup-clear`（备份并清空数据）
- `/api/admin/db/restore`（从上传文件恢复数据库）

详情可结合 `admin-web` 代码和 `docs/backend-apis.md` 查看。

## 6. 数据库与迁移

- 数据库文件位置：`data/lab_safety.db`
- 备份文件位置：`data/backups/*.db`
- 在 `database/db.js` 中实现自动迁移，例如：
  - 检查 `users` 表是否存在 `avatar` 字段，不存在则自动 `ALTER TABLE` 添加

核心数据库操作封装为：

- `dbQuery(sql, params)`：返回多行
- `dbGet(sql, params)`：返回单行
- `dbRun(sql, params)`：执行写操作

更详细的表结构说明见根目录 `docs/database-schema.md`。

## 7. 静态资源与上传

- 用户头像上传目录：`uploads/avatars`
- 静态访问路径：
  - `/uploads/*`
  - `/api/uploads/*`（方便前端通过代理访问）

例如数据库中存储 `avatars/u111_xxx.png`，前端可用：`/api/uploads/avatars/u111_xxx.png` 访问。

## 8. 数据库备份与恢复

通过管理端设置页触发：

- `POST /api/admin/db/backup-clear`
  - 动作：复制当前 `lab_safety.db` 到 `data/backups/` 生成带时间戳的备份文件
  - 返回：可直接下载的 `downloadUrl`
  - 之后清空业务数据表（保留院系、班级表和表结构）

- `POST /api/admin/db/restore`（表单上传 `file` 字段）
  - 动作：先备份当前数据库，再用上传的 `.db` 文件覆盖
  - 建议：恢复后重启 backend

详细操作流程见根目录 `docs/ops-guide.md`。

## 9. 安全与注意事项

- 建议在生产环境中：
  - 使用强随机的 `JWT_SECRET`
  - 通过 HTTPS 暴露接口
  - 严格限制 `/api/admin/*` 接口权限（仅管理员角色可访问）
- SQLite 数据库文件建议定期复制备份

## License

MIT

