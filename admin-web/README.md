# 实验室安全教育考试系统 - 后台管理端（admin-web）

## 1. 项目介绍

`admin-web` 是面向教务、实验室管理员和系统管理员的 **后台管理平台**，用于：

- 维护院系、班级、用户信息
- 管理学习资料、试题、考试与发布范围
- 查看和导出考试记录
- 管理准入证书
- 执行数据库备份、清空和恢复等运维操作

界面基于 Element Plus，风格偏管理系统，支持表格分页、条件筛选、导出等典型后台功能。

## 2. 技术栈

- **Vue 3 + TypeScript**
- **Vite** 构建工具
- **Element Plus** 组件库
- **Vue Router 4**
- **Pinia** 状态管理
- **Axios** HTTP 请求
- **Sass (SCSS)** 全局样式与主题扩展
- （可选）**ECharts** 做图表展示

## 3. 目录结构

```txt
admin-web/
├── src/
│   ├── api/             # 管理端 API 封装（admin.ts / request.ts）
│   ├── assets/          # 静态资源（logo、图片、示例 Excel 等）
│   ├── layouts/         # 布局组件（如左侧菜单 + 顶部导航）
│   ├── router/          # 路由与菜单配置
│   ├── styles/          # 全局样式（global.scss 等）
│   ├── views/           # 主要页面
│   │   ├── DashboardPage.vue      # 仪表盘
│   │   ├── UsersPage.vue          # 用户管理
│   │   ├── ExamsPage.vue          # 考试管理 + 题目配置 + 发布范围
│   │   ├── QuestionsPage.vue      # 题库管理
│   │   ├── RecordsPage.vue        # 考试记录管理
│   │   ├── CertificatesPage.vue   # 证书管理
│   │   ├── SettingsPage.vue       # 系统设置 + 数据维护（备份/恢复）
│   │   ├── ManagementPage.vue     # 其他管理入口
│   │   └── LoginPage.vue          # 登录页
│   ├── App.vue
│   └── main.ts
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 4. 功能模块说明

- **仪表盘 Dashboard**
  - 展示用户数量、考试数量、通过率等汇总指标
  - 可扩展图表展示（按院系/班级统计等）

- **用户管理 UsersPage**
  - 用户列表分页展示，支持搜索、筛选
  - 新增/编辑用户（学号、姓名、院系、班级等）
  - 启用/禁用用户、重置密码
  - 支持导入/导出（按项目需要扩展）

- **考试管理 ExamsPage**
  - 考试列表分页展示，支持搜索和筛选
  - 新建/编辑考试（名称、时长、总分、及格分数、题目数量、description 等）
  - 题目配置：
    - 题库选择（支持按分类、题型筛选，分页）
    - 已选题目区域（支持筛选、分页）
    - 显示当前题目数量与目标数量，并在超过时高亮提示
  - 发布范围配置：
    - 按院系过滤班级
    - 多选班级后发布考试
  - 支持上下架/启用禁用考试

- **题库管理 QuestionsPage**
  - 题目列表，支持按题型、分类筛选
  - 新增/编辑单选、多选、判断题
  - 支持批量导入题目（可基于 Excel 模板）

- **考试记录 RecordsPage**
  - 显示考试记录列表（支持关键词搜索、时间筛选、分页）
  - 可查看单条记录详情（配合 H5 查看题目明细）
  - 支持删除记录、导出记录数据

- **证书管理 CertificatesPage**
  - 证书列表分页展示
  - 按用户、考试关键词搜索
  - 可进行证书撤销、重新发放、导出等操作

- **系统设置 SettingsPage**
  - 基本配置（系统名称、LOGO 等）
  - 考试规则默认文本、证书模板等（可按需要扩展）
  - **数据维护**：
    - 「数据库备份与清空」：调用 `/api/admin/db/backup-clear`，生成备份并清空业务数据，可以点击下载 `.db` 文件
    - 「从备份恢复数据库」：通过 `el-upload` 上传 `.db` 文件，调用 `/api/admin/db/restore` 恢复

## 5. 启动与构建

### 5.1 安装依赖

```bash
cd admin-web
npm install
```

### 5.2 启动开发环境

```bash
npm run dev
```

默认访问地址：`http://localhost:3002`（视 `vite.config.ts` 而定）。

### 5.3 构建生产版本

```bash
npm run build
```

生成的静态资源在 `dist/` 目录，可使用 Nginx / 静态服务器部署。

## 6. 与后端的对接

- 所有接口通过 `src/api/request.ts` 统一封装 Axios 实例
- 管理端接口统一以 `/api/admin/*` 为前缀（例如 `/api/admin/exams`、`/api/admin/db/backup-clear`）
- 开发环境使用 Vite 的 dev server 代理，将 `/api` 转发到后端（默认 `http://localhost:4000`）

## 7. 登录与权限

- 默认管理员账号在数据库中配置（例如：`admin / admin123`，以当前数据库为准）
- 登录成功后，Token 保存在前端（通常为 LocalStorage / Pinia）
- 所有管理端接口都应携带 `Authorization: Bearer <token>`

## 8. 注意事项

1. 启动本项目前，请确认 `backend` 服务已启动且 `/api/admin/*` 可访问
2. 数据库备份与恢复功能会直接操作 SQLite 文件，生产环境使用前需做好额外备份
3. 如需调整端口或代理目标，请修改 `vite.config.ts` 中的 `server.proxy` 配置

## License

MIT
