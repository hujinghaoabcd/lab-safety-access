## 系统架构概览

本项目采用 **前后端分离 + 单一后端 API 服务** 的架构，包含三个主要子系统：

- `frontend-h5`：面向学生/教职工用户的 H5 前端（移动优先）
- `admin-web`：面向管理员/教师的后台管理前端
- `backend`：统一的 Node.js + Express API 服务，负责业务逻辑与 SQLite 数据库访问

前后端通过 RESTful 接口（统一前缀 `/api`）进行通信，开发环境通过 Vite 代理到后端，生产环境建议由 Nginx 反向代理。

### 模块关系

- H5 前端：通过 `/api/auth`、`/api/user`、`/api/exam`、`/api/records`、`/api/wrongbook`、`/api/qualification` 等模块完成日常使用功能
- 管理端前端：通过 `/api/admin/*` 接口管理用户、考试、题库、证书以及数据库备份恢复
- 后端：负责认证、权限校验、业务逻辑处理、分数计算、统计、错题本记录、证书生成等

## 子系统说明

### 1. H5 前端（frontend-h5）

- 使用 Vue 3 + Vant 实现移动端 SPA 应用
- 通过 Pinia 管理用户登录态和部分业务状态
- 将所有 HTTP 请求封装在 `src/api` 下，统一处理返回结构 `{ code, message, data }`
- 主要页面：
  - `DashboardPage.vue`：显示待考试、已通过、证书数量等概览
  - `ExamCenterPage.vue`：仅显示和当前用户院系/班级匹配的考试
  - `ExamInfoPage.vue`：从 `exam.description` 逐行渲染考试说明
  - `ExamPage.vue`：完成考试作答、倒计时和提交
  - `RecordsPage.vue` / `RecordDetailPage.vue`：查看考试记录与答案详情
  - `WrongBookPage.vue`：错题本
  - `CertificatePage.vue`：证书列表与图片/PDF 导出
  - `RankingPage.vue`：排行榜
  - `ProfilePage.vue`：个人信息、头像上传、改密码
  - `AboutPage.vue` / `HelpPage.vue`：系统介绍与帮助

### 2. 管理端前端（admin-web）

- 使用 Vue 3 + Element Plus 实现管理控制台
- 通过左侧菜单组织功能模块，典型页面包括：
  - `DashboardPage.vue`：关键指标与图表
  - `UsersPage.vue`：用户列表、编辑、重置密码等
  - `ExamsPage.vue`：考试列表、基本信息表单、题目配置、发布范围配置、分页
  - `QuestionsPage.vue`：题目列表与批量导入
  - `RecordsPage.vue`：考试记录分页、删除、导出
  - `CertificatesPage.vue`：证书管理
  - `SettingsPage.vue`：系统参数 & 数据库备份/恢复
- 所有接口集中在 `src/api/admin.ts`，底层通过 `src/api/request.ts` 统一封装 Axios

### 3. 后端 API（backend）

- Node.js + Express，所有接口统一挂载在 `/api` 路径下
- 主要模块对应控制器：
  - `authController`：登录/登出、Token 生成
  - `userController`：用户资料、头像上传、密码修改、个人统计
  - `learningController`：学习资料与进度
  - `examController`：考试列表、考试详情、开始考试、提交判分
  - `recordsController`：考试记录列表、详情、统计与排行榜
  - `wrongbookController`：错题本数据读写
  - `qualificationController`：证书列表等
  - `adminController`：管理端用户/考试/题库/记录/证书/数据库维护等
- SQLite 数据库封装在 `database/db.js` 中，提供 `dbQuery / dbGet / dbRun` 三类基础访问方法，并在初始化时执行必要的字段迁移（如 `users.avatar`）。

## 数据流与核心业务流程

### 登录与鉴权

1. 前端调用 `POST /api/auth/login`，提交学号/密码
2. 后端校验账号密码，返回 `token` 和用户信息
3. 前端保存 token（Pinia + LocalStorage），后续请求均在 Header 中携带 `Authorization: Bearer <token>`
4. 后端在 `middleware/auth.js` 中统一解析 JWT，将用户信息挂到 `req.user`

### 学习 + 考试闭环

1. 学生在学习中心浏览学习资料（`/api/learning/list`），滚动或点击「已学完」上报进度（`/api/learning/progress`）
2. 在考试中心获取可参加考试列表（`/api/exam/list`），后端根据当前用户所在院系/班级和考试发布范围过滤
3. 进入考试说明页（`/api/exam/:id`），将 `description` 内容按行展示为考试须知
4. 点击开始考试（`/api/exam/start`），后端返回题目列表和考试基本信息
5. 前端完成作答，构造答案结构提交到 `/api/exam/submit`，后端：
   - 对各类型题目进行判分
   - 写入考试记录 `exam_records`
   - 将做错的题保存/更新到 `wrong_questions`
   - 根据成绩是否通过，视情况为用户生成或更新证书记录

### 错题本与证书

- 错题本页面从 `/api/wrongbook/list` 获取聚合后的错题信息（同一题多次错误会合并计数）
- 「我会了」会调用 `DELETE /api/wrongbook/:id` 删除该题的错题记录
- 证书模块 `/api/qualification/certificate` 返回当前用户已获得的证书信息，H5 端基于此渲染证书卡片，并可通过 `html2canvas + jsPDF` 导出。

### 排行榜

- 排行榜接口 `/api/records/ranking` 会统计所有用户的最高通过成绩，生成 TOP 排名，并附带当前用户的名次信息。

## 部署与运维建议（简要）

- 建议三端分离部署：
  - backend：部署为 Node 服务，建议加上反向代理与 HTTPS
  - frontend-h5 / admin-web：构建为静态资源，由 Nginx 或静态服务器托管
- SQLite 数据库文件与备份：
  - 主文件位于 `backend/data/lab_safety.db`
  - 备份位于 `backend/data/backups/`，可通过管理端「数据维护」模块生成与下载
- 更详细的部署与运维流程见 `docs/ops-guide.md`。


