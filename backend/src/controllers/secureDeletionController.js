const { withTransaction } = require('../database/db');
const { success, error } = require('../utils/response');

class DeletionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const normalizeIds = (values, max = 1000) => {
  if (!Array.isArray(values)) throw new DeletionError('请选择要删除的数据');
  const ids = [...new Set(values
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0))];
  if (!ids.length) throw new DeletionError('请选择要删除的数据');
  if (ids.length > max) throw new DeletionError(`单次最多删除 ${max} 条数据`, 413);
  return ids;
};

const audit = async (tx, req, action, targetType, targetId, detail = null) => {
  await tx.run(
    `INSERT INTO operation_audit_logs
      (actor_type, actor_id, action, target_type, target_id, outcome, detail, ip)
     VALUES ('admin', ?, ?, ?, ?, 'success', ?, ?)`,
    [
      String(req.user && req.user.id || 'admin'),
      action,
      targetType,
      String(targetId),
      detail ? JSON.stringify(detail) : null,
      String(req.ip || '').slice(0, 100) || null
    ]
  );
};

const syncExamCounts = async (tx, examIds) => {
  for (const examId of [...new Set(examIds.map(Number).filter(Boolean))]) {
    const count = await tx.get(
      'SELECT COUNT(*) AS count FROM exam_questions WHERE exam_id = ?',
      [examId]
    );
    await tx.run(
      'UPDATE exams SET question_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [Number(count.count || 0), examId]
    );
  }
};

const deleteUser = async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(userId) || userId <= 0) return error(res, '用户 ID 无效', 400);

  try {
    await withTransaction(async (tx) => {
      const user = await tx.get('SELECT id, student_id AS studentId FROM users WHERE id = ?', [userId]);
      if (!user) throw new DeletionError('用户不存在', 404);

      await tx.run('DELETE FROM wrong_questions WHERE user_id = ?', [userId]);
      await tx.run('DELETE FROM learning_progress WHERE user_id = ?', [userId]);
      await tx.run('DELETE FROM certificates WHERE user_id = ?', [userId]);
      await tx.run('DELETE FROM exam_records WHERE user_id = ?', [userId]);
      await tx.run('DELETE FROM users WHERE id = ?', [userId]);
      await audit(tx, req, 'user.delete', 'user', userId, { studentId: user.studentId });
    });
    return success(res, null, '删除成功');
  } catch (err) {
    if (err instanceof DeletionError) return error(res, err.message, err.status);
    console.error('删除用户失败:', err);
    return error(res, '删除用户失败', 500);
  }
};

const batchDeleteUsers = async (req, res) => {
  try {
    const ids = normalizeIds(req.body && req.body.ids);
    const result = await withTransaction(async (tx) => {
      const placeholders = ids.map(() => '?').join(',');
      const existing = await tx.query(
        `SELECT id FROM users WHERE id IN (${placeholders})`,
        ids
      );
      const existingIds = existing.map((row) => row.id);
      if (!existingIds.length) throw new DeletionError('所选用户不存在', 404);
      const actualPlaceholders = existingIds.map(() => '?').join(',');

      await tx.run(
        `DELETE FROM wrong_questions WHERE user_id IN (${actualPlaceholders})`,
        existingIds
      );
      await tx.run(
        `DELETE FROM learning_progress WHERE user_id IN (${actualPlaceholders})`,
        existingIds
      );
      await tx.run(
        `DELETE FROM certificates WHERE user_id IN (${actualPlaceholders})`,
        existingIds
      );
      await tx.run(
        `DELETE FROM exam_records WHERE user_id IN (${actualPlaceholders})`,
        existingIds
      );
      await tx.run(
        `DELETE FROM users WHERE id IN (${actualPlaceholders})`,
        existingIds
      );
      await audit(tx, req, 'user.batch_delete', 'user', existingIds.join(','), {
        count: existingIds.length
      });
      return { deletedCount: existingIds.length };
    });
    return success(res, result, `成功删除 ${result.deletedCount} 个用户`);
  } catch (err) {
    if (err instanceof DeletionError) return error(res, err.message, err.status);
    console.error('批量删除用户失败:', err);
    return error(res, '批量删除用户失败', 500);
  }
};

const deleteExam = async (req, res) => {
  const examId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(examId) || examId <= 0) return error(res, '考试 ID 无效', 400);

  try {
    const result = await withTransaction(async (tx) => {
      const exam = await tx.get('SELECT id, name FROM exams WHERE id = ?', [examId]);
      if (!exam) throw new DeletionError('考试不存在', 404);

      const recordCount = await tx.get(
        'SELECT COUNT(*) AS count FROM exam_records WHERE exam_id = ?',
        [examId]
      );
      const questionCount = await tx.get(
        'SELECT COUNT(*) AS count FROM exam_questions WHERE exam_id = ?',
        [examId]
      );

      // Questions are reusable. Deleting an exam removes only this exam's
      // mapping; it must never delete or detach the shared question bank row.
      await tx.run(
        `DELETE FROM wrong_questions
          WHERE exam_record_id IN (SELECT id FROM exam_records WHERE exam_id = ?)`,
        [examId]
      );
      await tx.run('DELETE FROM certificates WHERE exam_id = ?', [examId]);
      await tx.run('DELETE FROM exam_records WHERE exam_id = ?', [examId]);
      await tx.run('DELETE FROM exam_assignments WHERE exam_id = ?', [examId]);
      await tx.run('DELETE FROM exam_questions WHERE exam_id = ?', [examId]);
      await tx.run('DELETE FROM exams WHERE id = ?', [examId]);
      await audit(tx, req, 'exam.delete', 'exam', examId, {
        name: exam.name,
        recordCount: Number(recordCount.count || 0),
        releasedQuestionCount: Number(questionCount.count || 0)
      });

      return {
        deletedRecordCount: Number(recordCount.count || 0),
        releasedQuestionCount: Number(questionCount.count || 0)
      };
    });
    return success(res, result, '考试已删除，题库题目已保留');
  } catch (err) {
    if (err instanceof DeletionError) return error(res, err.message, err.status);
    console.error('删除考试失败:', err);
    return error(res, '删除考试失败', 500);
  }
};

const deleteQuestion = async (req, res) => {
  const questionId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(questionId) || questionId <= 0) return error(res, '题目 ID 无效', 400);

  try {
    await withTransaction(async (tx) => {
      const question = await tx.get('SELECT id FROM questions WHERE id = ?', [questionId]);
      if (!question) throw new DeletionError('题目不存在', 404);

      const mappings = await tx.query(
        'SELECT exam_id AS examId FROM exam_questions WHERE question_id = ?',
        [questionId]
      );
      const affectedExamIds = mappings.map((row) => row.examId);

      await tx.run('DELETE FROM wrong_questions WHERE question_id = ?', [questionId]);
      await tx.run('DELETE FROM exam_questions WHERE question_id = ?', [questionId]);
      await tx.run('DELETE FROM questions WHERE id = ?', [questionId]);
      await syncExamCounts(tx, affectedExamIds);
      await audit(tx, req, 'question.delete', 'question', questionId, { affectedExamIds });
    });
    return success(res, null, '删除成功');
  } catch (err) {
    if (err instanceof DeletionError) return error(res, err.message, err.status);
    console.error('删除题目失败:', err);
    return error(res, '删除题目失败', 500);
  }
};

const batchDeleteQuestions = async (req, res) => {
  try {
    const ids = normalizeIds(req.body && req.body.ids, 5000);
    const result = await withTransaction(async (tx) => {
      const placeholders = ids.map(() => '?').join(',');
      const questions = await tx.query(
        `SELECT id FROM questions WHERE id IN (${placeholders})`,
        ids
      );
      if (!questions.length) throw new DeletionError('所选题目不存在', 404);
      const actualIds = questions.map((row) => row.id);
      const actualPlaceholders = actualIds.map(() => '?').join(',');
      const mappings = await tx.query(
        `SELECT DISTINCT exam_id AS examId
           FROM exam_questions
          WHERE question_id IN (${actualPlaceholders})`,
        actualIds
      );
      const affectedExamIds = mappings.map((row) => row.examId);

      await tx.run(
        `DELETE FROM wrong_questions WHERE question_id IN (${actualPlaceholders})`,
        actualIds
      );
      await tx.run(
        `DELETE FROM exam_questions WHERE question_id IN (${actualPlaceholders})`,
        actualIds
      );
      await tx.run(
        `DELETE FROM questions WHERE id IN (${actualPlaceholders})`,
        actualIds
      );
      await syncExamCounts(tx, affectedExamIds);
      await audit(tx, req, 'question.batch_delete', 'question', actualIds.join(','), {
        count: actualIds.length,
        affectedExamIds
      });
      return { deleted: actualIds.length };
    });
    return success(res, result, `已删除 ${result.deleted} 条题目`);
  } catch (err) {
    if (err instanceof DeletionError) return error(res, err.message, err.status);
    console.error('批量删除题目失败:', err);
    return error(res, '批量删除题目失败', 500);
  }
};

const deleteRecord = async (req, res) => {
  const recordId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(recordId) || recordId <= 0) return error(res, '记录 ID 无效', 400);

  try {
    const result = await withTransaction(async (tx) => {
      const record = await tx.get(
        `SELECT id, user_id AS userId, exam_id AS examId, status
           FROM exam_records
          WHERE id = ?`,
        [recordId]
      );
      if (!record) throw new DeletionError('考试记录不存在', 404);

      await tx.run('DELETE FROM wrong_questions WHERE exam_record_id = ?', [recordId]);
      await tx.run('DELETE FROM exam_records WHERE id = ?', [recordId]);

      const remainingPass = await tx.get(
        `SELECT 1 AS present
           FROM exam_records
          WHERE user_id = ? AND exam_id = ? AND status = '通过'
          LIMIT 1`,
        [record.userId, record.examId]
      );

      let revokedCertificate = false;
      if (!remainingPass) {
        const revokeResult = await tx.run(
          `UPDATE certificates
              SET status = 0
            WHERE user_id = ? AND exam_id = ? AND status = 1`,
          [record.userId, record.examId]
        );
        revokedCertificate = Number(revokeResult.changes || 0) > 0;
      }

      await audit(tx, req, 'exam_record.delete', 'exam_record', recordId, {
        userId: record.userId,
        examId: record.examId,
        revokedCertificate
      });
      return { revokedCertificate };
    });
    return success(
      res,
      result,
      result.revokedCertificate
        ? '删除考试记录成功，对应证书已同步撤销'
        : '删除考试记录成功'
    );
  } catch (err) {
    if (err instanceof DeletionError) return error(res, err.message, err.status);
    console.error('删除考试记录失败:', err);
    return error(res, '删除考试记录失败', 500);
  }
};

module.exports = {
  deleteUser,
  batchDeleteUsers,
  deleteExam,
  deleteQuestion,
  batchDeleteQuestions,
  deleteRecord,
  normalizeIds,
  syncExamCounts
};
