## 后端主要 API 说明（概要）

> 说明：这里只做分组与核心接口的概览，方便快速理解；具体入参/出参可以直接查看对应 `controller` 与前端调用代码。

---

## 1. 认证模块 `/api/auth`

- `POST /api/auth/login`
  - 功能：用户登录
  - 入参：`studentId`（或用户名）、`password`
  - 出参：`token`、`userInfo`

- `POST /api/auth/logout`
  - 功能：登出（前端清除 token 即可，接口可选）

---

## 2. 用户模块 `/api/user`

- `GET /api/user/profile`
  - 功能：获取当前登录用户信息
  - 出参：学号、姓名、院系、班级、手机号、邮箱、头像地址等

- `PUT /api/user/profile`
  - 功能：修改当前用户基本资料（手机号、邮箱等）

- `PUT /api/user/profile/password`
  - 功能：修改密码
  - 入参：`oldPassword`、`newPassword`

- `POST /api/user/profile/avatar`
  - 功能：上传头像
  - 入参：`multipart/form-data`，字段名 `avatar`
  - 说明：文件保存到 `uploads/avatars`，数据库记录相对路径

- `GET /api/user/profile/stats`
  - 功能：获取个人统计信息
  - 出参：`examCount`、`passCount`、`certCount` 等

---

## 3. 学习模块 `/api/learning`

- `GET /api/learning/list`
  - 功能：获取学习资料列表

- `GET /api/learning/:id`
  - 功能：获取学习资料详情

- `POST /api/learning/progress`
  - 功能：上报学习进度
  - 入参：`materialId`、`progress`（0-100）

---

## 4. 考试模块 `/api/exam`

- `GET /api/exam/list`
  - 功能：获取当前用户可参与的考试列表
  - 逻辑：基于用户所属院系/班级与 `exam_assignments` 中的发布范围过滤

- `GET /api/exam/:id`
  - 功能：获取单个考试详情
  - 出参：名称、时长、题目数量、总分、及格分、`description`（多行说明）

- `POST /api/exam/start`
  - 功能：开始考试，返回试题与基本信息
  - 入参：`examId`
  - 出参：题目数组（含题干、题型、选项、分值等）

- `POST /api/exam/submit`
  - 功能：提交试卷并判分
  - 入参：`examId`、`answers`（按题目 ID 映射的作答信息）、`duration`（字符串）
  - 逻辑：
    - 对每题进行判定，统计正确数、错误数和总分
    - 写入 `exam_records`，记录原始作答详情
    - 将错题写入/更新 `wrong_questions`
    - 如分数达到及格线，为用户创建或更新证书

---

## 5. 记录与排行榜模块 `/api/records`

- `GET /api/records/list`
  - 功能：获取当前用户的考试记录列表
  - 出参：考试名称、得分、是否通过、用时、提交时间等

- `GET /api/records/:id`
  - 功能：获取单条考试记录详情
  - 出参：每道题目的题干、选项、正确答案、用户答案、对错标记

- `GET /api/records/stats`
  - 功能：总体统计
  - 出参：总考试次数、通过次数、最高分等

- `GET /api/records/ranking`
  - 功能：排行榜
  - 逻辑：按「每个用户的最高通过成绩」排序，取前 N 条（如前 100），同时返回当前用户的名次和分数

---

## 6. 错题本模块 `/api/wrongbook`

- `GET /api/wrongbook/list`
  - 功能：获取当前用户的错题列表（按题目聚合）
  - 出参：题目内容、题型、选项、正确答案、解析、错题次数、最近错误时间等

- `DELETE /api/wrongbook/:id`
  - 功能：删除某一题的所有错题记录（表示“我会了”）

---

## 7. 准入与证书模块 `/api/qualification`

- `GET /api/qualification/status`
  - 功能：查询用户的准入状态（可以基于考试和证书情况计算）

- `GET /api/qualification/certificate`
  - 功能：获取当前用户的证书列表
  - 出参：证书编号、考试名称、分数、等级、发放日期等

---

## 8. 管理端模块 `/api/admin`

> 管理端接口较多，仅列出关键大类。

### 8.1 用户管理

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
- 以及重置密码、批量导入/导出等（如有）

### 8.2 考试管理

- `GET /api/admin/exams`：分页查询考试列表
- `POST /api/admin/exams`：新建考试
- `PUT /api/admin/exams/:id`：更新考试信息
- `DELETE /api/admin/exams/:id`：删除考试（视需求）
- `POST /api/admin/exams/:id/questions/config`：配置考试题目（支持自动抽题 + 手动调整）
- `POST /api/admin/exams/:id/assignments`：设置考试发布范围（院系 + 班级）

### 8.3 题库管理

- `GET /api/admin/questions`
- `POST /api/admin/questions`
- `PUT /api/admin/questions/:id`
- `DELETE /api/admin/questions/:id`
- 批量导入接口（如从 Excel 导入）

### 8.4 考试记录管理

- `GET /api/admin/records`：分页查询考试记录
- `DELETE /api/admin/records/:id`：删除单条记录（会级联清理相关错题等）
- 导出接口：按条件导出为 Excel/CSV

### 8.5 证书管理

- `GET /api/admin/certificates`：证书列表
- `PUT /api/admin/certificates/:id`：修改状态（撤销/重新发放）
- 导出接口：导出证书数据

### 8.6 数据库维护

- `POST /api/admin/db/backup-clear`
  - 功能：备份并清空业务数据
  - 出参：`downloadUrl`，可直接在浏览器中下载 `.db` 备份文件

- `POST /api/admin/db/restore`
  - 功能：从上传的 `.db` 文件恢复数据库
  - 注意：恢复后建议重启后端服务

---

## 9. 统一错误处理与返回格式

所有接口均使用统一的 `success()` / `error()` 响应封装，非 0 的 `code` 表示业务异常或参数错误，HTTP 状态码一般仍为 `200`，后端内部严重错误时可能返回 `500`。

前端推荐的处理模式：

1. 先判断 HTTP 是否成功
2. 再判断 JSON 中的 `code` 是否为 `0`
3. 根据 `message` 给出用户提示


