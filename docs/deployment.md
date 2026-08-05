# 生产部署与恢复指南

本文档描述当前生产链路：GitHub Actions 在托管运行器上完成测试和镜像构建，将镜像包拆成可续传分片发布到 `deploy-artifacts` 分支；服务器定时下载、逐片校验、加载镜像、执行数据库迁移并健康检查。服务器不编译前端、不执行 npm 安装，也不需要 GitHub SSH 私钥。

## 1. 生产拓扑

```text
GitHub main
    │
    ├─ 后端语法与真实 API/SQLite 测试
    ├─ 学生端与管理端生产构建
    ├─ Compose 校验与后端镜像构建
    └─ 生产镜像构建
          │
          ├─ 16 MiB 分片
          ├─ 每片 SHA-256
          └─ 完整包 SHA-256
                │
                ▼
       deploy-artifacts 分支
                │
                ▼
 lab-safety-update.timer（服务器）
                │
                ├─ 断点续传
                ├─ 完整性校验
                ├─ docker load
                ├─ docker compose up
                ├─ 数据库自动迁移
                ├─ /api/health
                └─ 失败恢复上一镜像标签
```

## 2. 服务器要求

当前已验证配置：

- CentOS Stream 9；
- x86_64；
- 2 核、约 2 GB 内存；
- 2 GB swap；
- Docker Engine 与 Compose 插件；
- `/opt/lab-safety-access`；
- TCP 80；
- 域名上线时还需 TCP/UDP 443。

建议：

- 系统盘至少保留 15 GB；
- Docker 日志使用 `local` 驱动；
- 腾讯云防火墙与本机 firewalld 同时检查；
- 正式公网开放前完成依赖审计和 Git 历史清理。

## 3. 首次安装

在服务器普通用户下执行：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/hujinghaoabcd/lab-safety-access/main/deploy/bootstrap-centos9.sh)
```

该脚本负责：

- 创建 swap；
- 使用国内镜像安装 Docker；
- 创建 `/opt/lab-safety-access/.env`；
- 生成随机 JWT 密钥；
- 收集管理员账号、管理员密码和学生默认密码；
- 配置 Docker 日志；
- 开放本机 HTTP 防火墙。

随后安装无密钥分片更新器：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/hujinghaoabcd/lab-safety-access/main/deploy/install-pull-deployer.sh)
```

检查定时器：

```bash
sudo systemctl status lab-safety-update.timer --no-pager
sudo systemctl list-timers lab-safety-update.timer --no-pager
```

## 4. 生产环境变量

服务器文件：

```text
/opt/lab-safety-access/.env
```

最低配置：

```dotenv
SITE_ADDRESS=:80
JWT_SECRET=<至少 32 字节随机值>
ADMIN_USERNAME=<管理员用户名>
ADMIN_PASSWORD=<至少 12 位独立密码>
ADMIN_DISPLAY_NAME=系统管理员
DEFAULT_USER_PASSWORD=<至少 8 位临时密码>
MAX_EXAM_ATTEMPTS=3
DB_BACKUP_RETENTION=10
CORS_ORIGINS=
LOG_LEVEL=info
```

生成新 JWT 密钥：

```bash
openssl rand -hex 32
```

历史代码中曾存在固定管理员密码和弱 JWT 默认值，因此生产环境必须使用全新值，不能复用历史示例。

保护环境文件：

```bash
sudo chown root:root /opt/lab-safety-access/.env
sudo chmod 600 /opt/lab-safety-access/.env
```

## 5. GitHub 自动发布

仓库变量：

```text
AUTO_DEPLOY_ENABLED=true
```

启用后，`main` 的每次成功推送都会发布新分片。未通过阻塞测试、构建或 Compose 校验的提交不会发布。

当前分片发布不需要：

```text
DEPLOY_HOST
DEPLOY_USER
DEPLOY_PORT
DEPLOY_SSH_KEY
```

## 6. 服务器更新

定时器每约 5 分钟检查一次。立即检查：

```bash
sudo systemctl start --no-block lab-safety-update.service
```

实时日志：

```bash
sudo journalctl -fu lab-safety-update.service
```

典型过程：

```text
Reading deployment manifest
Downloading chunk 1/N
Verifying all downloaded chunks
Loading verified Docker images
Starting release
Release <sha> is healthy
```

下载中断后，已校验分片保留在：

```text
/var/cache/lab-safety-release/<commit-sha>/
```

下一次执行会跳过已验证分片。

## 7. 部署后检查

```bash
cd /opt/lab-safety-access
sudo docker compose --env-file .env -f docker-compose.prod.yml ps
sudo docker compose --env-file .env -f docker-compose.prod.yml logs --tail=200 backend
curl -fsS http://127.0.0.1/api/health
```

预期健康响应包含：

```json
{
  "code": 0,
  "data": {
    "status": "healthy",
    "database": "ready"
  }
}
```

访问地址：

```text
学生端：http://<服务器IP>/
管理端：http://<服务器IP>/admin/
健康检查：http://<服务器IP>/api/health
```

## 8. 自动回滚边界

更新器在新版本健康检查失败时，会重新启动上一镜像标签。该回滚能够恢复应用镜像，但数据库迁移通常是向前兼容、不可由镜像标签自动撤销。

因此：

- 每次生产迁移前由应用自动创建 `pre_migration` 备份；
- 数据库结构发生破坏性变化时，迁移必须采用兼容窗口；
- 数据库需要回退时使用离线恢复，不要只切换镜像标签。

查看当前镜像标签：

```bash
sudo cat /opt/lab-safety-access/.current-image-tag
```

查看本机镜像：

```bash
sudo docker images 'lab-safety-*'
```

## 9. 数据库备份

管理端创建备份：

```text
POST /api/admin/db/backup
```

服务器命令行：

```bash
cd /opt/lab-safety-access
sudo docker compose --env-file .env -f docker-compose.prod.yml exec backend npm run db:backup
```

查看备份列表：

```text
GET /api/admin/db/backups
```

备份位于 `backend_data` 卷的：

```text
/app/data/backups/
```

每份备份包含 SHA-256 校验文件，且已经通过 SQLite `quick_check`。

## 10. 数据库离线恢复

在线恢复接口已停用。恢复前必须停止后端：

```bash
cd /opt/lab-safety-access
sudo docker compose --env-file .env -f docker-compose.prod.yml stop backend
```

执行恢复：

```bash
sudo docker compose --env-file .env -f docker-compose.prod.yml run --rm --no-deps \
  -e CONFIRM_OFFLINE_RESTORE=YES \
  backend \
  npm run db:restore -- /app/data/backups/<backup-file>.db
```

重新启动：

```bash
sudo docker compose --env-file .env -f docker-compose.prod.yml up -d backend web
curl -fsS http://127.0.0.1/api/health
```

恢复程序会验证来源、创建恢复前备份、清除旧 WAL/SHM、原子替换并再次验证。

## 11. 域名与 HTTPS

将 `.env` 中：

```dotenv
SITE_ADDRESS=:80
```

改为：

```dotenv
SITE_ADDRESS=exam.example.edu
```

然后：

1. 域名 A 记录指向服务器公网 IP；
2. 开放 TCP 80、TCP 443、UDP 443；
3. 重新启动 Web 服务；
4. Caddy 自动申请和续签证书。

```bash
cd /opt/lab-safety-access
sudo docker compose --env-file .env -f docker-compose.prod.yml up -d web
```

## 12. 常见故障

### 分片长时间没有进度

```bash
sudo journalctl -u lab-safety-update.service -n 200 --no-pager
sudo du -sh /var/cache/lab-safety-release/* 2>/dev/null
```

停止当前任务不会删除已下载分片：

```bash
sudo systemctl stop lab-safety-update.service
```

### 后端不健康

```bash
sudo docker compose --env-file /opt/lab-safety-access/.env \
  -f /opt/lab-safety-access/docker-compose.prod.yml \
  logs --tail=300 backend
```

重点检查：

- 环境变量缺失；
- 数据库迁移失败；
- 数据库外键不一致；
- 数据卷权限；
- 磁盘空间。

### 磁盘不足

```bash
df -h
sudo docker system df
sudo docker image prune -f
```

不要直接删除 `backend_data`、`backend_uploads` 或 Caddy 数据卷。

## 13. 上线前检查

- [ ] GitHub Actions 全绿；
- [ ] 依赖高危审计清零或有书面例外；
- [ ] Git 历史中的学生 Excel 和旧凭据已安排清理；
- [ ] 生产管理员密码和 JWT 密钥已轮换；
- [ ] 迁移在数据库副本上演练；
- [ ] 手工备份可下载并通过校验；
- [ ] 离线恢复完成一次演练；
- [ ] `/api/health` 正常；
- [ ] 学生端和管理端主流程人工验收；
- [ ] 腾讯云和本机防火墙规则符合预期；
- [ ] 正式公网使用域名和 HTTPS。
