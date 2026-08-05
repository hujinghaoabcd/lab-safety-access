# Lab Safety Access - 实验室安全教育与准入考试系统

## 项目简介

这是一个面向高校/科研机构的 **实验室安全教育与准入考试系统**，采用前后端分离架构，包括：

- `frontend-h5`：学生端 H5（移动优先），用于学习、考试、查看证书等
- `admin-web`：后台管理端，用于管理用户、考试、题库、证书和系统参数
- `backend`：Node.js + Express API 服务，使用 SQLite 作为持久化存储

系统围绕「学 → 考 → 证 → 准入」完整闭环，已经实现：考试中心、错题本、排行榜、合格证书、发布范围按院系/班级过滤、数据库备份与恢复等功能。

## 项目结构

```txt
lab-safety-access/
├── frontend-h5/          # 学生端 H5（Vue 3 + Vant）
├── admin-web/            # 后台管理系统（Vue 3 + Element Plus）
├── backend/              # 后端 API（Node.js + Express + SQLite）
└── README.md             # 根级说明
```

各子项目有单独的 `README.md`，详见：

- `frontend-h5/README.md` - 学生端页面、路由、接口说明
- `admin-web/README.md`   - 后台管理端模块说明
- `backend/README.md`     - API、数据库结构、部署说明
- `docs/architecture.md`  - 系统架构与模块划分
- `docs/database-schema.md` - 数据库表说明与关系图
- `docs/ops-guide.md`     - 运维操作（备份、恢复、清空）

## 关键功能概览

### 学生端（H5）

- 🔐 **登录 / 个人中心**：基于学号密码登录，支持头像上传、信息修改、密码修改
- 📝 **考试中心**：只显示当前用户所在院系/班级可参加的考试
- 📄 **考试说明**：从考试 `description` 字段逐行渲染考试须知
- ✍️ **在线考试**：支持单选、多选、判断题，后端统一判分并记录
- 📊 **考试记录 / 详情**：查看历史成绩及每题作答对错
- ❌ **错题本**：从后端 `wrong_questions` 表加载错题列表，可按题型过滤和移除
- 🏆 **排行榜**：基于考试记录统计最高分排行榜，显示自己的当前排名
- 📜 **合格证书**：从后端 `certificates` 查询证书，支持生成图片/PDF 下载

### 后台管理端

- 📊 仪表盘：用户数、考试数、题目数、通过率趋势、题目分类分布
- 👥 用户管理：导入/导出用户、批量删除、重置密码、启用/禁用
- 📝 考试管理：考试列表、手动配置题目/自动抽题、发布范围（按院系/班级）、分页
- 📚 题库管理：题目增删改查、Excel 批量导入导出
- 📋 考试记录：关键词搜索（学号/姓名）、分页、导出、删除记录
- 🏅 证书管理：证书列表、关键词搜索、撤销/重新发放、导出
- ⚙️ 系统设置：基本信息、考试参数、证书参数、安全参数
- 🗄️ 数据维护（超级管理员）：数据库 **备份并清空业务数据**、从备份文件恢复数据库

## 技术栈

- 前端：Vue 3 + TypeScript + Vite + Vant / Element Plus + Pinia + Axios
- 后端：Node.js + Express 4 + SQLite3 + JWT + Multer（文件上传）
- 架构：RESTful API，前后端通过 `/api` 代理对接

## 快速启动

### 前置要求

- Node.js >= 18
- npm >= 9

### 1. 启动后端

```bash
cd backend
npm install
npm run dev   # http://localhost:4000
```

> 首次启动时会自动创建 `backend/data/lab_safety.db` 并初始化表结构。

### 2. 启动学生端 H5

```bash
cd frontend-h5
npm install
npm run dev   # http://localhost:3000
```

### 3. 启动后台管理端

```bash
cd admin-web
npm install
npm run dev   # http://localhost:3002（视配置而定）
```

## 账号说明（示例）

> 实际账号数据以当前 SQLite 数据库为准，以下仅为典型示例：

- 学生端：`学号 + 初始密码 123456`
- 后台管理员：在 `admin-web` 登录页使用配置好的管理员账号（如：`admin / ucas1234`）。

## 数据库与运维

- 数据库文件：`backend/data/lab_safety.db`
- 备份目录：`backend/data/backups/*.db`
- 后台「系统设置 → 数据维护」提供：
  - **备份并清空数据库**：生成 `.db` 备份并清空业务表（保留院系/班级与结构），备份文件可直接下载到本地
  - **上传并恢复数据库**：用上传的 `.db` 覆盖当前数据库，操作完成后需重启后端

详细表结构和运维说明见：

- `docs/database-schema.md`
- `docs/ops-guide.md`

## 设计与扩展文档

项目附带了多份文档帮助后续维护和二次开发：

- `docs/architecture.md`：整体架构、模块划分、数据流
- `docs/backend-apis.md`：主要 API 分组与说明（用户 / 考试 / 记录 / 错题本 / 证书等）
- `docs/database-schema.md`：表结构、字段含义、外键关系
- `docs/ops-guide.md`：部署、备份与恢复、常见问题

## License

MIT

