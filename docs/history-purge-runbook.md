# Git 敏感历史清理维护手册

## 1. 目的

当前源代码已经移除已知个人数据文件、旧固定管理员凭据和弱 JWT 回退值，但这些对象仍可从部分 Git 历史到达。该维护操作用于重写源码分支和标签历史，清除：

1. `admin-web/src/assets/Student-2021-10-03.xlsx` 的历史对象；
2. 已确认的旧管理员固定密码文本；
3. 旧认证代码中的弱 JWT / 管理员密码字面量回退。

该操作会改变历史提交 SHA，属于破坏性仓库维护，不应与普通功能开发同时执行。

## 2. 明确边界

维护脚本：

```text
scripts/purge-sensitive-history.sh
```

脚本只选择：

- `refs/heads/*` 源码分支；
- `refs/tags/*` 标签。

明确排除：

```text
refs/heads/deploy-artifacts
```

`deploy-artifacts` 是部署产物分支，不参与源码历史重写，避免破坏现有发布下载链。

GitHub 服务端的 `refs/pull/*`、缓存提交视图和已有 fork/clone 不由普通 force push 自动清除。源码 refs 清理完成后，如仍需彻底删除 GitHub 服务端缓存或 PR 引用中的历史对象，应联系 GitHub Support 处理 sensitive-data removal。

## 3. 执行前条件

必须全部满足：

- [ ] 当前正常开发 PR 已合并或关闭；
- [ ] Phase 3 会话安全 PR 已完成最终 CI 并已决定是否合并；
- [ ] 生产环境已准备新的 `JWT_SECRET`；
- [ ] 生产管理员密码已更换为从未在该仓库历史中出现的新值；
- [ ] 若旧值曾复用于其他系统，其他系统也已完成轮换；
- [ ] 已通知仍持有旧 clone 的开发者：维护结束后必须重新 clone，不能直接把旧历史 push 回服务器；
- [ ] 已保存一份只读镜像备份用于灾难恢复，并限制其访问权限；
- [ ] 仓库所有者已明确批准执行历史重写和 force push。

## 4. 非破坏性本地演练

从全新目录开始：

```bash
git clone --mirror https://github.com/hujinghaoabcd/lab-safety-access.git lab-safety-access.git
cd lab-safety-access.git
```

安装 `git-filter-repo`：

```bash
python3 -m pip install --user git-filter-repo
```

从已审核的维护分支取得脚本，放到镜像仓库外或临时路径执行。首次执行**不要**设置强制推送确认变量：

```bash
bash /path/to/purge-sensitive-history.sh
```

预期结果：

```text
Post-rewrite verification: sensitive_path_objects=0, suspected_secret_paths=0
Local rewrite and verification succeeded.
Remote refs were NOT modified.
```

同时确认：

```bash
git rev-parse refs/heads/deploy-artifacts
```

在重写前后保持一致。

本地演练失败时，不得进入远端推送阶段。

## 5. 正式维护窗口

正式执行必须再次使用**全新 mirror clone**，不能复用演练后的目录：

```bash
git clone --mirror https://github.com/hujinghaoabcd/lab-safety-access.git lab-safety-access-cleanup.git
cd lab-safety-access-cleanup.git
```

完成同样的依赖准备后，只有在仓库所有者明确确认时，设置双重开关：

```bash
CONFIRM_HISTORY_REWRITE=YES \
ALLOW_FORCE_PUSH=YES \
bash /path/to/purge-sensitive-history.sh
```

脚本会先完成本地重写和验证；只有验证结果为零风险对象时，才逐个 force-push 已选择的源码分支和标签。

## 6. 推送后立即验证

重新 clone，不使用任何旧工作副本：

```bash
git clone https://github.com/hujinghaoabcd/lab-safety-access.git verify-clean
cd verify-clean
bash scripts/scan-sensitive-history.sh history-audit
```

预期：

```text
sensitive_path_objects=0
suspected_secret_paths=0
```

随后重新执行完整 CI，至少确认：

- 后端全部 API / SQLite / migration 测试通过；
- 后端、学生端、管理端依赖审计通过；
- 两个前端类型检查和生产构建通过；
- Docker Compose 校验通过；
- 生产后端镜像构建通过。

## 7. GitHub 服务端残留

即使所有普通源码分支和标签已经重写，以下位置仍可能保留旧对象：

- 已关闭或仍打开 PR 的服务端 `refs/pull/*`；
- GitHub 缓存的旧 commit 页面；
- fork；
- 他人的本地 clone；
- CI artifact 或外部备份。

对于个人数据或凭据历史清理，force push 之后应按 GitHub sensitive-data removal 流程联系 GitHub Support，请求清理缓存引用和不可自行修改的 PR refs。旧 clone 应废弃并重新 clone；禁止把旧 refs 再推回仓库。

## 8. 回滚原则

历史重写不存在普通 `git revert`。灾难恢复只能依赖维护前保存的受限镜像备份。

如果正式推送后发现代码历史重写错误：

1. 立即停止所有开发和自动部署；
2. 不允许任何旧 clone 自行 push；
3. 使用受限镜像备份确定恢复 refs；
4. 经仓库所有者批准后再执行恢复性 force push；
5. 重新运行完整历史审计和 CI。

## 9. 维护完成标准

只有同时满足以下条件，P0 Git 历史问题才可标记为完成：

- [ ] 普通源码分支和标签的敏感历史扫描为 0；
- [ ] `deploy-artifacts` 未被意外改写；
- [ ] 新 clone 的完整 CI 通过；
- [ ] 生产 JWT 密钥和管理员密码已轮换；
- [ ] 旧 clone 已废弃；
- [ ] 必要时 GitHub Support 已处理缓存/PR refs；
- [ ] 维护后的新 `main` SHA 已记录到项目交接文档。
