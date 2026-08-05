# 生产部署与自动发布

本项目使用 Docker Compose 部署：

- `web`：Caddy + 学生端静态文件 + 后台静态文件
- `backend`：Node.js / Express / SQLite
- 学生端：`/`
- 后台管理端：`/admin/`
- API：`/api/`
- 上传资源：`/uploads/`

当 `SITE_ADDRESS` 配置为已解析到服务器的域名时，Caddy 会自动申请并续期 HTTPS 证书。

## 1. 服务器要求

推荐 Ubuntu 22.04/24.04 或其他支持 Docker Engine 的 Linux 发行版。

服务器需要：

- Docker Engine
- Docker Compose v2（命令为 `docker compose`）
- `rsync`
- `curl`
- 对外开放 TCP 80、443；启用 HTTP/3 时再开放 UDP 443
- 一个具有 Docker 权限的非 root 部署用户

示例安装后检查：

```bash
docker --version
docker compose version
rsync --version
```

## 2. 首次创建部署目录

```bash
sudo mkdir -p /opt/lab-safety-access
sudo chown -R "$USER":"$USER" /opt/lab-safety-access
cd /opt/lab-safety-access
```

第一次代码同步完成后，在服务器上创建 `.env`：

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

必须填写：

```dotenv
# 只有 IP、暂不启用 HTTPS：
SITE_ADDRESS=:80

# 有域名并已解析到服务器：
# SITE_ADDRESS=safety.example.edu

JWT_SECRET=<至少32位随机字符串>
ADMIN_USERNAME=<管理员用户名>
ADMIN_PASSWORD=<高强度管理员密码>
ADMIN_DISPLAY_NAME=系统管理员
DEFAULT_USER_PASSWORD=<至少8位的临时初始密码>
CORS_ORIGINS=
LOG_LEVEL=info
```

生成 JWT 密钥：

```bash
openssl rand -hex 32
```

不要把服务器 `.env` 提交到 Git，也不要通过聊天、Issue 或日志发送真实密钥。

## 3. 手动首次启动

在服务器部署目录执行：

```bash
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

检查状态：

```bash
docker compose --env-file .env -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.prod.yml logs -f --tail=200
```

健康检查：

```bash
curl -fsS http://127.0.0.1/api/health
```

使用域名时：

```bash
curl -fsS https://safety.example.edu/api/health
```

## 4. GitHub Actions 自动部署

工作流文件：`.github/workflows/ci-deploy.yml`。

每个 Pull Request 和 `main` 分支提交都会执行：

1. 后端依赖安装和 JavaScript 语法检查；
2. 学生端生产构建；
3. 后台管理端生产构建；
4. Docker Compose 配置校验。

只有满足以下任一条件才会部署：

- 仓库变量 `AUTO_DEPLOY_ENABLED` 设置为 `true`，并向 `main` 推送；
- 在 Actions 页面手动运行 `CI and Deploy`，并将 `deploy` 设为 `true`。

### GitHub Actions Secrets

在仓库 `Settings → Secrets and variables → Actions → Secrets` 中添加：

| Secret | 示例 | 说明 |
|---|---|---|
| `DEPLOY_HOST` | `203.0.113.10` | 服务器 IP 或 SSH 域名 |
| `DEPLOY_PORT` | `22` | SSH 端口，可省略时使用 22 |
| `DEPLOY_USER` | `deploy` | 具有 Docker 权限的部署用户 |
| `DEPLOY_PATH` | `/opt/lab-safety-access` | 服务器部署目录 |
| `DEPLOY_SSH_KEY` | 私钥全文 | 仅用于该服务器的部署私钥 |

建议创建专用 SSH 密钥：

```bash
ssh-keygen -t ed25519 -C "github-actions-lab-safety" -f ~/.ssh/lab_safety_deploy
ssh-copy-id -i ~/.ssh/lab_safety_deploy.pub deploy@your-server
```

把私钥 `~/.ssh/lab_safety_deploy` 的完整内容放入 `DEPLOY_SSH_KEY`，公钥只放到服务器部署用户的 `~/.ssh/authorized_keys`。

### 开启自动部署

在 `Settings → Secrets and variables → Actions → Variables` 中添加：

```text
AUTO_DEPLOY_ENABLED=true
```

未设置或不等于 `true` 时，推送 `main` 只执行 CI，不会连接服务器。

## 5. 持久化数据

Compose 使用命名卷保存：

- `backend_data`：SQLite 数据库及数据库备份；
- `backend_uploads`：头像、PDF 等上传文件；
- `backend_logs`：后端日志；
- `caddy_data`：TLS 证书和 Caddy 状态；
- `caddy_config`：Caddy 运行配置。

重新构建、更新容器或同步源码不会删除这些卷。

查看卷：

```bash
docker volume ls | grep lab-safety-access
```

严禁在日常部署中执行 `docker compose down -v`，该命令会删除持久卷。

## 6. 数据库备份

创建离线备份目录：

```bash
mkdir -p ~/lab-safety-backups
```

从命名卷导出 SQLite 数据库：

```bash
docker compose --env-file .env -f docker-compose.prod.yml exec -T backend \
  sh -c 'cat /app/data/lab_safety.db' \
  > ~/lab-safety-backups/lab_safety_$(date +%F_%H-%M-%S).db
```

验证文件头：

```bash
head -c 16 ~/lab-safety-backups/lab_safety_*.db
```

应显示 `SQLite format 3`。

建议由服务器定时任务每日备份，并将备份复制到另一台主机或对象存储。应用内“备份并清空”属于高风险业务操作，不能代替日常灾备。

## 7. 更新与回滚

自动部署通过 `rsync` 同步已通过 CI 的源码，然后运行：

```bash
docker compose --env-file .env -f docker-compose.prod.yml up -d --build --remove-orphans
```

代码回滚方式：

1. 在 GitHub 将错误提交 revert；
2. 合并到 `main`；
3. 自动部署重新构建上一版代码。

数据库结构或数据发生变化时，应先恢复数据库备份，再回滚代码。当前项目迁移机制仍较简单，后续应引入带版本号、可回滚的数据库迁移表。

## 8. 域名与 HTTPS

将域名 A/AAAA 记录指向服务器后，把服务器 `.env` 改为：

```dotenv
SITE_ADDRESS=safety.example.edu
```

然后重启：

```bash
docker compose --env-file .env -f docker-compose.prod.yml up -d
```

Caddy 会自动处理证书申请和续期。证书申请要求公网能够访问服务器的 80/443 端口。

## 9. 上线前检查

- [ ] 已设置随机 `JWT_SECRET`，长度至少 32 位；
- [ ] 已设置独立的管理员用户名和高强度密码；
- [ ] 已设置至少 8 位的用户临时密码；
- [ ] 仓库和服务器中不存在真实学生 Excel、数据库或备份文件；
- [ ] 80/443 端口已配置防火墙；
- [ ] SSH 禁止密码登录，仅允许密钥；
- [ ] 已验证数据库备份能够恢复；
- [ ] 已确认 `/api/admin/*` 无令牌时返回 401；
- [ ] 已确认学生端、后台、上传文件和健康检查可访问；
- [ ] 已建立日志和磁盘空间监控。
