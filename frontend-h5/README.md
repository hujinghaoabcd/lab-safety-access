# 实验室安全教育与准入考试系统 - H5 学生端（frontend-h5）

## 1. 项目简介

`frontend-h5` 是面向学生和普通教职工的 **移动端 Web 前端**，支持在手机浏览器中完成学习、考试、查看成绩和证书等操作。主要功能包括：

- 登录与个人中心（头像上传、资料编辑、修改密码）
- 首页概览（待学习、待考试、已通过、证书数量）
- 学习中心（学习资料）
- 考试中心、考试说明、在线答题
- 考试记录与详情
- 错题本
- 排行榜
- 合格证书
- 关于系统 & 帮助说明

## 2. 技术栈

- **框架**：Vue 3 + TypeScript
- **构建工具**：Vite 5
- **UI 框架**：Vant 4
- **路由**：Vue Router 4
- **状态管理**：Pinia
- **HTTP**：Axios（统一封装在 `api/request.ts`）
- **样式**：vw 自适应 + 全局样式表

## 3. 目录结构

```txt
frontend-h5/
├── src/
│   ├── api/              # API 封装
│   │   ├── auth.ts       # 登录、用户信息、头像、密码等
│   │   ├── exam.ts       # 考试、记录、错题本、证书等
│   │   ├── learning.ts   # 学习资料
│   │   ├── request.ts    # axios 实例与拦截器
│   │   └── index.ts      # 聚合导出
│   ├── assets/           # 静态资源（logo、证书背景等）
│   ├── components/       # 通用组件（如通用卡片等，按需扩展）
│   ├── layouts/          # 页面布局（如带底部 TabBar 的布局）
│   ├── router/
│   │   └── index.ts      # 路由表与守卫
│   ├── stores/           # Pinia 状态
│   │   ├── user.ts       # 当前用户信息与 token
│   │   ├── exam.ts       # 考试相关临时状态
│   │   └── index.ts
│   ├── styles/
│   │   └── global.css    # 全局样式、主题色与 vw 适配
│   ├── utils/
│   │   └── index.ts      # 工具函数（时间格式化等）
│   ├── views/            # 页面组件
│   │   ├── LoginPage.vue
│   │   ├── DashboardPage.vue
│   │   ├── LearningPage.vue
│   │   ├── ExamCenterPage.vue
│   │   ├── ExamInfoPage.vue
│   │   ├── ExamPage.vue
│   │   ├── ExamResultPage.vue
│   │   ├── RecordsPage.vue
│   │   ├── RecordDetailPage.vue
│   │   ├── WrongBookPage.vue
│   │   ├── CertificatePage.vue
│   │   ├── RankingPage.vue
│   │   ├── ProfilePage.vue
│   │   ├── HelpPage.vue
│   │   └── AboutPage.vue
│   ├── App.vue
│   └── main.ts
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 4. 页面与路由

| 路径          | 页面              | 说明 |
|---------------|-------------------|------|
| `/login`      | 登录              | 学号+密码登录 |
| `/dashboard`  | 首页              | 展示待考试/已通过/证书数量入口 |
| `/learning`   | 学习中心          | 安全教育学习资料 |
| `/exam-center`| 考试中心          | 根据用户院系/班级过滤后的考试列表 |
| `/exam-info`  | 考试说明          | 按行展示后端 `description` 中的考试须知 |
| `/exam`       | 在线考试          | 单选、多选、判断题作答，自动倒计时 |
| `/exam-result`| 考试结果          | 提交后展示得分、对错统计等 |
| `/records`    | 考试记录          | 历史考试记录列表 |
| `/record/:id` | 考试详情          | 单次考试答题详情（逐题显示对错） |
| `/wrongbook`  | 错题本            | 错题列表，支持题型过滤、移除错题 |
| `/certificate`| 合格证书          | 已获得证书列表，支持查看与生成图片/PDF |
| `/ranking`    | 排行榜            | 从 `/api/records/ranking` 获取分数排行榜 |
| `/profile`    | 个人中心          | 基本信息、修改密码、上传头像、统计信息 |
| `/help`       | 帮助说明          | 使用说明与常见问题 |
| `/about`      | 关于系统          | 系统简介、功能说明、联系信息等 |

## 5. 启动与构建

### 5.1 环境要求

- Node.js >= 18
- npm >= 9

### 5.2 安装依赖

```bash
cd frontend-h5
npm install
```

### 5.3 启动开发服务器

```bash
npm run dev
```

默认访问地址：`http://localhost:3000`

### 5.4 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录，可通过 Nginx / 静态服务器托管。

### 5.5 预览生产构建

```bash
npm run preview
```

## 6. API 代理与后端对接

开发环境下，所有 `/api` 开头的请求都会代理到后端（默认 `http://localhost:4000`），在 `vite.config.ts` 中配置类似：

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:4000',
      changeOrigin: true
    }
  }
}
```

`src/api/request.ts` 对 Axios 实例做了统一封装：

- 自动附加 `Authorization: Bearer <token>` 头
- 统一处理 `code` 和 `message`
- 将实际数据透传给调用方（`resp.data`）

## 7. 样式与适配

- 使用 `vw` 作为主要单位，适配 375px 宽度设计稿
- 全局主题色、字体大小在 `styles/global.css` 中统一管理
- 使用 Vant 组件的移动端交互（弹窗、Toast、表单等）

## 8. 与后端的关键交互

- 登录后，将 token 和用户基本信息存入 Pinia 的 `userStore`
- 首页统计数据来自：
  - `/api/exam/list`（待考试/已通过数量）
  - `/api/user/profile/stats`（证书数量等）
- 头像上传：`POST /api/user/profile/avatar`，前端使用 `<input type="file">` + `FormData`
- 错题本、考试记录、证书、排行榜等页面都直接调用对应的 REST API

## 9. 测试账号说明

具体账号以当前数据库为准，通常为：

- 学号：如 `2020xxxxxx`
- 初始密码：`123456`

可通过后台管理端批量导入或手动新增用户。

## License

MIT

