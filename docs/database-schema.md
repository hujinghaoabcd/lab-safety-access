## 数据库结构概览（SQLite）

> 实际表结构以 `backend/data/lab_safety.db` 为准，这里给出逻辑上的字段与关系说明，方便理解与维护。

---

## 1. 核心业务表

### 1.1 `users` 用户表

- `id`：主键
- `student_id`：学号或工号（唯一）
- `name`：姓名
- `password`：密码（目前为明文或简单加密，生产环境建议改为哈希）
- `department`：院系名称（字符串）
- `class`：班级名称（字符串）
- `phone`：手机号码
- `email`：邮箱
- `avatar`：头像相对路径（如 `avatars/u111_xxx.png`）
- `status`：状态（1 启用 / 0 禁用）

> 说明：院系和班级使用名称而不是外键，方便与现有导入数据兼容。

### 1.2 `exams` 考试表

- `id`：主键
- `name`：考试名称
- `description`：考试说明（多行文本，每行一条规则）
- `duration`：考试时长（单位：分钟）
- `total_score`：试卷总分
- `pass_score`：及格分数
- `question_count`：目标题目数量（用于提示配置情况）
- `status`：状态（1 生效 / 0 停用）

### 1.3 `questions` 题目表

- `id`：主键
- `content`：题干
- `type`：题型（`单选题` / `多选题` / `判断题`）
- `category`：分类（如 `通用安全`、`化学安全` 等）
- `options`：选项 JSON 数组（单选/多选题用，例如 `["A. ...","B. ..."]`）
- `answer`：标准答案（单选/多选存 A/B/C/D 组合；判断题存 `正确` 或 `错误`）
- `analysis`：解析说明
- （可选）`exam_id`：某些场景中绑定到特定考试

> 实际上题目和考试的关系更多通过配置表维护（见后端实现）。

### 1.4 `exam_records` 考试记录表

- `id`：主键
- `user_id`：用户 ID
- `exam_id`：考试 ID
- `score`：本次得分
- `status`：`通过` / `未通过`
- `duration`：完成时长（字符串，如 `30分20秒`）
- `detail`：JSON 字符串，记录每题作答详情（题目 ID、用户答案、正确答案、是否正确）
- `wrong_questions`：JSON 字符串，记录错题 ID 数组
- `submit_time`：提交时间（`YYYY-MM-DD HH:mm:ss`）

### 1.5 `certificates` 证书表

- `id`：主键
- `certificate_no`：证书编号
- `user_id`：用户 ID
- `exam_id`：考试 ID
- `exam_name`：考试名称（冗余字段，方便展示/导出）
- `score`：成绩
- `grade`：等级（如 `优秀`、`良好`、`及格` 等）
- `issue_date`：发证日期（`YYYY-MM-DD`）
- `status`：状态（1 有效 / 0 已撤销）

### 1.6 `wrong_questions` 错题表

- `id`：主键
- `user_id`：用户 ID
- `question_id`：题目 ID
- `user_answer`：用户当次作答（字符串）
- `exam_record_id`：对应的考试记录 ID
- `created_at`：出错时间

> 显示错题本列表时，通常对该表按 `user_id + question_id` 聚合统计，计算 `wrongCount` 和 `lastWrongTime`。

### 1.7 学习相关表 `learning_materials` / `learning_progress`

**`learning_materials`：学习资料**

- `id`：主键
- `title`：标题
- `description`：简介
- `content`：正文内容
- `duration`：建议学习时长
- `category`：分类（如基础安全/化学安全等）
- `order_num`：排序号

**`learning_progress`：学习进度**

- `id`：主键
- `user_id`：用户 ID
- `material_id`：学习资料 ID
- `progress`：进度百分比（0-100）

---

## 2. 发布范围与院系班级

### 2.1 `departments` 院系表

- `id`：主键
- `name`：院系名称

### 2.2 `classes` 班级表

- `id`：主键
- `name`：班级名称
- `department_id`：所属院系 ID

> H5 与后台管理端中，发布范围选择时会先选院系，然后按 `department_id` 过滤班级。

### 2.3 `exam_assignments` 考试发布范围

- `id`：主键
- `exam_id`：考试 ID
- `department`：院系名称（冗余，方便直接比较）
- `class`：班级名称（冗余）

> 当前实现中，考试列表 `/api/exam/list` 会基于当前用户的 `department` + `class` 与此表匹配来确定可见考试。

---

## 3. 主要外键与关系（逻辑上）

- `users (1) -- (N) exam_records`：一名用户有多条考试记录
- `exams (1) -- (N) exam_records`：一场考试对应多条考试记录
- `users (1) -- (N) certificates`：一名用户可以有多张证书
- `exams (1) -- (N) certificates`：一场考试可以对应多张证书
- `users (1) -- (N) wrong_questions`：一名用户可以在多道题上出错
- `questions (1) -- (N) wrong_questions`：一道题可以被多名用户做错
- `users (1) -- (N) learning_progress`：一名用户对应多条学习进度
- `learning_materials (1) -- (N) learning_progress`
- `departments (1) -- (N) classes`
- `exams (1) -- (N) exam_assignments`

> 在 SQLite 中，有的外键约束通过 `FOREIGN KEY` 显式声明，有的仅在业务逻辑中保证一致性（尤其是使用名称冗余的字段）。

---

## 4. 迁移与扩展

### 4.1 自动迁移示例

在 `database/db.js` 中包含了一些「轻量迁移」逻辑，例如：

- 检查 `users` 表是否存在 `avatar` 字段，不存在则执行：
  - `ALTER TABLE users ADD COLUMN avatar TEXT;`

这种方式适合简单的字段新增。更复杂的迁移（如字段拆分、类型变更）建议通过单独脚本或手工 SQL 完成。

### 4.2 新增字段建议

1. 先在开发环境手工执行 `ALTER TABLE` 观察效果
2. 更新相关 `controller` 中的 SQL 语句
3. 再将迁移逻辑以「幂等」方式（多次执行无副作用）加入 `db.js` 初始化流程

---

## 5. 备份与恢复说明

- 所有数据都存储在 `backend/data/lab_safety.db` 中
- 后台管理端的「数据维护」模块提供两类操作：
  - **备份并清空**：复制当前 `.db` 文件到 `data/backups/` 目录并生成下载链接，然后清空业务表（保留院系/班级与表结构）
  - **从备份恢复**：上传一个 `.db` 文件替换当前数据库（操作前会自动对当前库做一次备份）
- 这些操作都在 `adminController` 中实现，具体逻辑可直接查看对应代码。

---

## 6. 常见问题提示

- **外键约束错误（SQLITE_CONSTRAINT: FOREIGN KEY failed）**
  - 常见于删除记录或重置数据时
  - 当前实现中，在某些批量操作里会暂时关闭 `PRAGMA foreign_keys` 以避免报错，并由业务逻辑保证一致性

- **字段不存在（no such column: avatar）**
  - 表示数据库版本较老，需要确保已运行最新代码，使 `db.js` 中的自动迁移逻辑执行一次
  - 或手工执行对应 `ALTER TABLE` 语句


