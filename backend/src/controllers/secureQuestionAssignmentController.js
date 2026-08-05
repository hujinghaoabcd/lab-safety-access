const crypto = require('node:crypto');
const { withTransaction } = require('../database/db');
const { success, error } = require('../utils/response');

class QuestionAssignmentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const normalizeIds = (values) => {
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0))];
};

const shuffle = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const balancedTake = (candidates, count, selectedSet) => {
  const grouped = new Map();
  for (const candidate of candidates) {
    if (selectedSet.has(candidate.id)) continue;
    const category = candidate.category || '未分类';
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(candidate);
  }

  const queues = shuffle([...grouped.values()]).map((group) => shuffle(group));
  const selected = [];
  while (selected.length < count && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      if (selected.length >= count) break;
      const candidate = queue.shift();
      if (!candidate || selectedSet.has(candidate.id)) continue;
      selected.push(candidate);
      selectedSet.add(candidate.id);
    }
  }
  return selected;
};

const configExamQuestions = async (req, res) => {
  const examId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(examId) || examId <= 0) return error(res, '考试 ID 无效', 400);

  const addIds = normalizeIds(req.body && req.body.addIds);
  const removeIds = normalizeIds(req.body && req.body.removeIds);
  const overlap = addIds.filter((id) => removeIds.includes(id));
  if (overlap.length) return error(res, '同一道题不能同时添加和移除', 400);
  if (addIds.length + removeIds.length > 5000) {
    return error(res, '单次最多调整 5000 道题目', 413);
  }

  try {
    const result = await withTransaction(async (tx) => {
      const exam = await tx.get('SELECT id FROM exams WHERE id = ?', [examId]);
      if (!exam) throw new QuestionAssignmentError('考试不存在', 404);

      if (addIds.length) {
        const placeholders = addIds.map(() => '?').join(',');
        const found = await tx.query(
          `SELECT id, exam_id AS examId
             FROM questions
            WHERE id IN (${placeholders})`,
          addIds
        );
        if (found.length !== addIds.length) {
          throw new QuestionAssignmentError('部分待添加题目不存在', 404);
        }
        const conflicts = found.filter(
          (question) => question.examId && Number(question.examId) !== examId
        );
        if (conflicts.length) {
          throw new QuestionAssignmentError(
            `有 ${conflicts.length} 道题已属于其他考试，不能直接抢占`,
            409
          );
        }
      }

      if (removeIds.length) {
        const placeholders = removeIds.map(() => '?').join(',');
        await tx.run(
          `UPDATE questions
              SET exam_id = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE exam_id = ? AND id IN (${placeholders})`,
          [examId, ...removeIds]
        );
      }

      if (addIds.length) {
        const placeholders = addIds.map(() => '?').join(',');
        await tx.run(
          `UPDATE questions
              SET exam_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id IN (${placeholders})
              AND (exam_id IS NULL OR exam_id = 0 OR exam_id = ?)`,
          [examId, ...addIds, examId]
        );
      }

      const count = await tx.get(
        'SELECT COUNT(*) AS count FROM questions WHERE exam_id = ?',
        [examId]
      );
      await tx.run(
        'UPDATE exams SET question_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [Number(count.count || 0), examId]
      );
      return { questionCount: Number(count.count || 0) };
    });

    return success(res, result, '题目配置已保存');
  } catch (err) {
    if (err instanceof QuestionAssignmentError) return error(res, err.message, err.status);
    console.error('配置考试题目失败:', err);
    return error(res, '题目配置失败', 500);
  }
};

const autoSelectQuestions = async (req, res) => {
  const examId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(examId) || examId <= 0) return error(res, '考试 ID 无效', 400);

  try {
    const result = await withTransaction(async (tx) => {
      const exam = await tx.get(
        'SELECT id, question_count AS questionCount FROM exams WHERE id = ?',
        [examId]
      );
      if (!exam) throw new QuestionAssignmentError('考试不存在', 404);

      const requestedTarget = req.body && req.body.targetCount;
      const targetCount = requestedTarget === undefined
        ? Number(exam.questionCount || 50)
        : Number.parseInt(requestedTarget, 10);
      if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 500) {
        throw new QuestionAssignmentError('自动抽题数量必须是 1–500 的整数');
      }

      const candidates = await tx.query(
        `SELECT id, type, category
           FROM questions
          WHERE exam_id IS NULL OR exam_id = 0 OR exam_id = ?`,
        [examId]
      );
      if (candidates.length < targetCount) {
        throw new QuestionAssignmentError(
          `可用题目只有 ${candidates.length} 道，无法抽取 ${targetCount} 道`,
          409
        );
      }

      const ratios = [
        { type: '单选题', count: Math.floor(targetCount * 0.5) },
        { type: '多选题', count: Math.floor(targetCount * 0.3) }
      ];
      ratios.push({
        type: '判断题',
        count: targetCount - ratios.reduce((sum, item) => sum + item.count, 0)
      });

      const selectedSet = new Set();
      const selected = [];
      for (const ratio of ratios) {
        selected.push(...balancedTake(
          candidates.filter((candidate) => candidate.type === ratio.type),
          ratio.count,
          selectedSet
        ));
      }

      if (selected.length < targetCount) {
        selected.push(...balancedTake(
          candidates,
          targetCount - selected.length,
          selectedSet
        ));
      }
      if (selected.length < targetCount) {
        throw new QuestionAssignmentError('题库题型结构不足，无法完成自动抽题', 409);
      }

      const selectedIds = selected.slice(0, targetCount).map((question) => question.id);
      await tx.run(
        'UPDATE questions SET exam_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE exam_id = ?',
        [examId]
      );
      const placeholders = selectedIds.map(() => '?').join(',');
      await tx.run(
        `UPDATE questions
            SET exam_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id IN (${placeholders})`,
        [examId, ...selectedIds]
      );
      await tx.run(
        'UPDATE exams SET question_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [selectedIds.length, examId]
      );

      const statsRows = await tx.query(
        `SELECT type, COUNT(*) AS count
           FROM questions
          WHERE exam_id = ?
          GROUP BY type`,
        [examId]
      );
      const stats = Object.fromEntries(
        statsRows.map((row) => [row.type, Number(row.count || 0)])
      );

      return {
        questionCount: selectedIds.length,
        targetCount,
        stats
      };
    });

    return success(res, result, `自动抽题完成，已抽取 ${result.questionCount} 道题目`);
  } catch (err) {
    if (err instanceof QuestionAssignmentError) return error(res, err.message, err.status);
    console.error('自动抽题失败:', err);
    return error(res, '自动抽题失败', 500);
  }
};

module.exports = {
  configExamQuestions,
  autoSelectQuestions,
  normalizeIds,
  balancedTake
};
