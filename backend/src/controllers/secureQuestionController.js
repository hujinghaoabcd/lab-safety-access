const { dbQuery, withTransaction } = require('../database/db');
const { readWorksheetRows, createWorkbookBuffer } = require('../utils/spreadsheet');
const { success, error } = require('../utils/response');

const VALID_TYPES = new Set(['单选题', '多选题', '判断题']);
const MAX_IMPORT_ROWS = 5000;
const MAX_EXPORT_ROWS = 50_000;

const normalizeAnswer = (type, answer) => {
  const text = String(answer ?? '').trim();
  if (!text) throw new Error('正确答案不能为空');

  if (type === '判断题') {
    if (['正确', '对', 'true', 'TRUE', '1'].includes(text)) return '正确';
    if (['错误', '错', 'false', 'FALSE', '0'].includes(text)) return '错误';
    throw new Error('判断题答案必须是“正确”或“错误”');
  }

  const letters = text
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .split('')
    .filter(Boolean);
  const normalized = [...new Set(letters)].sort().join('');
  if (!normalized) throw new Error('答案必须使用选项字母，例如 A 或 AC');
  if (type === '单选题' && normalized.length !== 1) {
    throw new Error('单选题必须且只能有一个正确答案');
  }
  return normalized;
};

const parseOptions = (row, type) => {
  if (type === '判断题') return ['正确', '错误'];

  const raw = String(row['选项'] ?? row.options ?? row.Options ?? '').trim();
  let options = [];

  if (raw) {
    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) options = parsed;
      } catch (_) {
        throw new Error('选项 JSON 格式无效');
      }
    } else {
      options = raw
        .split('|')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.replace(/^\s*[A-Z][.．、,，:\s]+/i, '').trim());
    }
  } else {
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
      const value = String(
        row[`选项${letter}`] ?? row[letter] ?? row[letter.toLowerCase()] ?? ''
      ).trim();
      if (value) options.push(value);
    }
  }

  options = options.map((value) => String(value).trim()).filter(Boolean);
  if (options.length < 2) throw new Error(`${type}至少需要两个选项`);
  if (options.length > 26) throw new Error('选项不能超过 26 个');
  if (new Set(options).size !== options.length) throw new Error('题目选项不能重复');
  return options;
};

const normalizeQuestionRow = (row) => {
  const content = String(row['题目内容'] ?? row.content ?? row.Content ?? '').trim();
  const type = String(row['题目类型'] ?? row.type ?? row.Type ?? '').trim();
  const category = String(row['题目分类'] ?? row.category ?? row.Category ?? '').trim();
  const analysis = String(row['答案解析'] ?? row.analysis ?? row.Analysis ?? '').trim();

  if (!content) throw new Error('题目内容不能为空');
  if (content.length > 5000) throw new Error('题目内容不能超过 5000 个字符');
  if (!VALID_TYPES.has(type)) throw new Error('题目类型必须是单选题、多选题或判断题');
  if (!category) throw new Error('题目分类不能为空');
  if (category.length > 100) throw new Error('题目分类不能超过 100 个字符');
  if (analysis.length > 10_000) throw new Error('答案解析不能超过 10000 个字符');

  const options = parseOptions(row, type);
  const answer = normalizeAnswer(
    type,
    row['正确答案'] ?? row.answer ?? row.Answer
  );

  const maxLetter = String.fromCharCode(64 + options.length);
  if (type !== '判断题' && [...answer].some((letter) => letter > maxLetter)) {
    throw new Error(`正确答案超出已有选项范围 A-${maxLetter}`);
  }

  return { content, type, category, options, answer, analysis: analysis || null };
};

const importQuestions = async (req, res) => {
  if (!req.file) return error(res, '请上传 XLSX 文件', 400);

  try {
    const rows = await readWorksheetRows(req.file.buffer, {
      maxRows: MAX_IMPORT_ROWS,
      maxColumns: 30,
      maxBytes: 10 * 1024 * 1024
    });
    if (!rows.length) return error(res, 'Excel 文件为空', 400);

    const result = { success: 0, failed: 0, errors: [] };
    await withTransaction(async (tx) => {
      for (let index = 0; index < rows.length; index += 1) {
        try {
          const question = normalizeQuestionRow(rows[index]);
          await tx.run(
            `INSERT INTO questions
              (content, type, category, options, answer, analysis, exam_id)
             VALUES (?, ?, ?, ?, ?, ?, NULL)`,
            [
              question.content,
              question.type,
              question.category,
              JSON.stringify(question.options),
              question.answer,
              question.analysis
            ]
          );
          result.success += 1;
        } catch (rowError) {
          result.failed += 1;
          if (result.errors.length < 200) {
            result.errors.push(`第 ${index + 2} 行：${rowError.message}`);
          }
        }
      }
    });

    return success(
      res,
      result,
      `导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`
    );
  } catch (err) {
    if (/Excel|工作表|列标题|不允许使用公式|最多|不能超过/.test(err.message || '')) {
      return error(res, err.message, 400);
    }
    console.error('导入题目失败:', err);
    return error(res, '批量导入失败', 500);
  }
};

const exportQuestions = async (req, res) => {
  try {
    const { ids, keyword, category, type } = req.query;
    const where = ['1=1'];
    const params = [];

    if (ids) {
      const parsedIds = String(ids)
        .split(',')
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value > 0)
        .slice(0, 5000);
      if (parsedIds.length) {
        where.push(`id IN (${parsedIds.map(() => '?').join(',')})`);
        params.push(...parsedIds);
      }
    }
    if (keyword) {
      where.push('content LIKE ?');
      params.push(`%${String(keyword).trim()}%`);
    }
    if (category) {
      where.push('category = ?');
      params.push(String(category).trim());
    }
    if (type) {
      where.push('type = ?');
      params.push(String(type).trim());
    }

    const rows = await dbQuery(
      `SELECT id, content, type, category, options, answer, analysis, exam_id AS examId
         FROM questions
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC, id DESC
        LIMIT ?`,
      [...params, MAX_EXPORT_ROWS + 1]
    );
    if (rows.length > MAX_EXPORT_ROWS) {
      return error(res, `单次最多导出 ${MAX_EXPORT_ROWS} 道题，请缩小筛选范围`, 413);
    }

    const data = rows.map((question, index) => {
      let options = [];
      try {
        const parsed = JSON.parse(question.options || '[]');
        if (Array.isArray(parsed)) options = parsed;
      } catch (_) {
        options = [];
      }
      return {
        index: index + 1,
        id: question.id,
        content: question.content,
        type: question.type,
        category: question.category,
        options: options
          .map((option, optionIndex) => `${String.fromCharCode(65 + optionIndex)}.${option}`)
          .join('|'),
        answer: question.answer,
        analysis: question.analysis || '',
        examId: question.examId || ''
      };
    });

    const buffer = await createWorkbookBuffer({
      sheetName: '题目',
      rows: data,
      columns: [
        { header: '序号', key: 'index', width: 10 },
        { header: '题目ID', key: 'id', width: 12 },
        { header: '题目内容', key: 'content', width: 50 },
        { header: '题目类型', key: 'type', width: 14 },
        { header: '题目分类', key: 'category', width: 18 },
        { header: '选项', key: 'options', width: 60 },
        { header: '正确答案', key: 'answer', width: 14 },
        { header: '答案解析', key: 'analysis', width: 50 },
        { header: '所属考试ID', key: 'examId', width: 16 }
      ]
    });

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return success(res, {
      fileName: `题库导出_${timestamp}.xlsx`,
      base64: buffer.toString('base64'),
      rowCount: rows.length
    }, '导出成功');
  } catch (err) {
    console.error('导出题目失败:', err);
    return error(res, '导出题目失败', 500);
  }
};

module.exports = {
  importQuestions,
  exportQuestions,
  normalizeQuestionRow,
  normalizeAnswer,
  parseOptions
};
