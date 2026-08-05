const DEFAULT_MAX_ATTEMPTS = 3;

class ExamAccessError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'ExamAccessError';
    this.statusCode = statusCode;
  }
}

const getMaxExamAttempts = () => {
  const parsed = Number.parseInt(process.env.MAX_EXAM_ATTEMPTS || '', 10);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 20) return parsed;
  return DEFAULT_MAX_ATTEMPTS;
};

const normalizeId = (value, label = 'ID') => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== String(value).trim()) {
    throw new ExamAccessError(`${label} 无效`, 400);
  }
  return parsed;
};

const getExamAccess = async (database, userIdValue, examIdValue) => {
  const userId = normalizeId(userIdValue, '用户 ID');
  const examId = normalizeId(examIdValue, '考试 ID');
  const row = await database.get(
    `SELECT
       e.*,
       u.department AS user_department,
       u.class AS user_class,
       (SELECT COUNT(*) FROM exam_assignments a WHERE a.exam_id = e.id) AS assignment_count,
       (SELECT COUNT(*)
          FROM exam_assignments a
         WHERE a.exam_id = e.id
           AND (a.department IS NULL OR a.department = '' OR a.department = COALESCE(u.department, ''))
           AND (a.class IS NULL OR a.class = '' OR a.class = COALESCE(u.class, ''))
       ) AS assignment_match_count,
       (SELECT COUNT(*)
          FROM exam_records er
         WHERE er.user_id = u.id AND er.exam_id = e.id
       ) AS attempts,
       (SELECT COUNT(*)
          FROM exam_records er
         WHERE er.user_id = u.id AND er.exam_id = e.id AND er.status = '通过'
       ) AS passed_count
     FROM exams e
     JOIN users u ON u.id = ? AND u.status = 1
     WHERE e.id = ?`,
    [userId, examId]
  );

  if (!row) {
    const user = await database.get('SELECT id FROM users WHERE id = ? AND status = 1', [userId]);
    if (!user) throw new ExamAccessError('用户不存在或已被禁用', 401);
    throw new ExamAccessError('考试不存在', 404);
  }

  return {
    ...row,
    id: examId,
    attempts: Number(row.attempts || 0),
    passed: Number(row.passed_count || 0) > 0,
    assignmentAllowed:
      Number(row.assignment_count || 0) === 0
      || Number(row.assignment_match_count || 0) > 0
  };
};

const assertExamAvailable = async (
  database,
  userId,
  examId,
  {
    requirePublished = true,
    enforceAttempts = true,
    allowAfterPass = false
  } = {}
) => {
  const access = await getExamAccess(database, userId, examId);

  if (requirePublished && Number(access.status) !== 1) {
    throw new ExamAccessError('考试未发布或已下架', 404);
  }
  if (!access.assignmentAllowed) {
    throw new ExamAccessError('当前用户不在该考试的发布范围内', 403);
  }
  if (!allowAfterPass && access.passed) {
    throw new ExamAccessError('该考试已通过，无需重复提交', 409);
  }
  if (enforceAttempts && access.attempts >= getMaxExamAttempts()) {
    throw new ExamAccessError('已达到最大考试次数', 409);
  }

  return access;
};

module.exports = {
  DEFAULT_MAX_ATTEMPTS,
  ExamAccessError,
  getMaxExamAttempts,
  normalizeId,
  getExamAccess,
  assertExamAvailable
};
