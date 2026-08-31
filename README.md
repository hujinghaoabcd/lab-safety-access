# Lab Safety Access

实验室安全教育与准入考试系统，面向高校和科研机构，覆盖“学习 → 考试 → 证书 → 准入”流程。

## 项目组成

```text
lab-safety-access/
├── frontend-h5/          # 学生端：Vue 3 + Vant
├── admin-web/            # 管理端：Vue 3 + Element Plus
├── backend/              # API：Node.js + Express + SQLite
├── deploy/               # Caddy 与前端容器配置
├── docs/                 # 架构、接口、数据库和部署文档
└── docker-compose.prod.yml
```

生产环境统一入口：

- 学生端：`/`
- 后台管理端：`/admin/`
- API：`/api/`
- 健康检查：`/api/health`

## 主要功能

### 学生端

- 学号登录、个人资料和头像；
- 在线学习、学习进度；
- 考试中心、在线答题和后端判分；
- 历史记录、错题本、排行榜；
- 合格证书查看及 PDF/图片导出。

### 管理端

- 用户、院系和班级管理；
- 题库、考试、发布范围和自动抽题；
- 考试记录与证书管理；
- 公告、轮播图和学习资料管理；
- 系统参数及数据库维护。

## 安全约束

生产环境不会使用源码内置管理员账号或 JWT 密钥，启动前必须通过环境变量设置：

- `JWT_SECRET`：至少 32 位；
- `ADMIN_USERNAME`；
- `ADMIN_PASSWORD`；
- `DEFAULT_USER_PASSWORD`：至少 8 位。

学生密码使用 Node.js `scrypt` 哈希。旧数据库中的明文密码会在用户首次成功登录后自动升级为哈希，不需要停机批量迁移。

浏览器登录使用 `HttpOnly + SameSite=Strict` Cookie 保存 JWT，真实 JWT 不再返回给前端 JavaScript，也不再保存到 `localStorage`。后端仍兼容 `Authorization: Bearer ...`，供脚本、自动化测试和非浏览器客户端使用。状态修改请求同时执行来源检查，降低 CSRF 风险。

除 `/api/admin/login` 与幂等的 `/api/admin/logout` 外，管理端业务接口都要求有效的 `role=admin` JWT。数据库备份不再通过静态目录公开。

复制环境变量模板：

```bash
cp .env.example .env
```

真实 `.env`、SQLite 数据库、备份、日志和用户上传文件不得提交到 Git。

## 本地开发

要求 **Node.js 24.15–24.x**；当前 CI 与生产镜像固定使用 Node.js 24.19。

### 后端

```bash
cd backend
npm ci
npm run dev
```

默认地址：`http://localhost:4000`。

本地开发可在启动命令前设置环境变量。Linux/macOS 示例：

```bash
export JWT_SECRET="development-secret-at-least-32-characters"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="your-local-admin-password"
export DEFAULT_USER_PASSWORD="ChangeMe123!"
npm run dev
```

### 学生端

```bash
cd frontend-h5
npm ci
npm run dev
```

### 管理端

```bash
cd admin-web
npm ci
npm run dev
```

开发环境管理端默认运行在 `http://localhost:3002`，并将 `/api` 代理到后端。

## 生产部署

项目提供 Docker Compose、Caddy 自动 HTTPS 和 GitHub Actions 自动部署。

服务器首次启动：

```bash
cp .env.example .env
# 编辑 .env 后：
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

配置域名时，将 `.env` 中的 `SITE_ADDRESS` 设置为已解析到服务器的域名，Caddy 会自动申请和续期证书；只有 IP 时可使用 `SITE_ADDRESS=:80`。

完整步骤、GitHub Secrets、备份、回滚和上线检查见：

- [生产部署与自动发布](docs/deployment.md)

## CI/CD

`.github/workflows/ci-deploy.yml` 会执行：

- 后端依赖安装、JavaScript 语法检查和真实 HTTP/SQLite 回归测试；
- 学生端类型检查与生产构建；
- 管理端类型检查与生产构建；
- 高危依赖审计；
- Docker Compose 配置校验和生产后端镜像构建。

自动部署默认关闭。配置部署 Secrets 后，将仓库变量 `AUTO_DEPLOY_ENABLED` 设为 `true` 才会在 `main` 更新后发布；也可以从 Actions 页面手动触发。

## 文档

- [系统架构](docs/architecture.md)
- [后端 API](docs/backend-apis.md)
- [数据库结构](docs/database-schema.md)
- [运维说明](docs/ops-guide.md)
- [生产部署与自动发布](docs/deployment.md)
- [匿名用户导入模板](docs/templates/student-import-template.csv)

## 数据与隐私

仓库中只允许保留匿名模板，不应提交真实学生名单、手机号、邮箱、头像、证书、数据库或备份。若敏感文件曾进入 Git 历史，仅在新提交中删除并不足够，还需要清理仓库历史并评估是否需要更换相关凭据。

**当前历史清理仍是单独的维护操作。** `docs/phase2-security-stability.md` 已记录历史学生表格和旧凭据路径的遗留风险；在完成 Git 历史重写前，不应把“当前源码已删除”理解为“历史对象已经从公开仓库消失”。

## License

MIT
