const XLSX = require('xlsx');
const { dbQuery } = require('../database/db');
const { success, error } = require('../utils/response');

const MAX_EXPORT_ROWS = 50_000;

const safeSpreadsheetText = (value) => {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

const createWorkbookPayload = (rows, sheetName, filenamePrefix) => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return {
    fileName: `${filenamePrefix}_${timestamp}.xlsx`,
    base64,
    rowCount: rows.length
  };
};

const exportRecords = async (req, res) => {
  try {
    const keyword = String(req.query.keyword || '').trim();
    const status = String(req.query.status || '').trim();
    const examName = String(req.query.examName || '').trim();
    const where = ['1=1'];
    const params = [];

    if (keyword) {
      where.push('(u.student_id LIKE ? OR u.name LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (status) {
      where.push('er.status = ?');
      params.push(status);
    }
    if (examName) {
      where.push('e.name LIKE ?');
      params.push(`%${examName}%`);
    }

    const rows = await dbQuery(
      `SELECT
         er.id,
         u.student_id AS studentId,
         u.name AS studentName,
         u.department,
         u.class AS className,
         e.name AS examName,
         er.score,
         e.total_score AS totalScore,
         er.status,
         er.duration,
         er.submit_time AS submitTime
       FROM exam_records er
       JOIN users u ON u.id = er.user_id
       JOIN exams e ON e.id = er.exam_id
       WHERE ${where.join(' AND ')}
       ORDER BY er.submit_time DESC, er.id DESC
       LIMIT ?`,
      [...params, MAX_EXPORT_ROWS + 1]
    );
    if (rows.length > MAX_EXPORT_ROWS) {
      return error(res, `单次最多导出 ${MAX_EXPORT_ROWS} 条记录，请缩小筛选范围`, 413);
    }

    const data = rows.map((row, index) => ({
      序号: index + 1,
      记录ID: row.id,
      学号: safeSpreadsheetText(row.studentId),
      姓名: safeSpreadsheetText(row.studentName),
      院系: safeSpreadsheetText(row.department),
      班级: safeSpreadsheetText(row.className),
      考试名称: safeSpreadsheetText(row.examName),
      得分: row.score,
      总分: row.totalScore,
      百分制成绩: row.totalScore > 0
        ? Math.round((row.score / row.totalScore) * 1000) / 10
        : 0,
      状态: row.status,
      用时: safeSpreadsheetText(row.duration),
      提交时间: safeSpreadsheetText(row.submitTime)
    }));

    return success(res, createWorkbookPayload(data, '考试记录', '考试记录导出'), '导出成功');
  } catch (err) {
    console.error('导出考试记录错误:', err);
    return error(res, '导出考试记录失败', 500);
  }
};

const exportCertificates = async (req, res) => {
  try {
    const keyword = String(req.query.keyword || '').trim();
    const examName = String(req.query.examName || '').trim();
    const grade = String(req.query.grade || '').trim();
    const statusText = String(req.query.status ?? '').trim();
    const where = ['1=1'];
    const params = [];

    if (keyword) {
      where.push('(c.certificate_no LIKE ? OR u.student_id LIKE ? OR u.name LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (examName) {
      where.push('c.exam_name LIKE ?');
      params.push(`%${examName}%`);
    }
    if (grade) {
      where.push('c.grade = ?');
      params.push(grade);
    }
    if (statusText !== '') {
      if (!['0', '1'].includes(statusText)) return error(res, '证书状态参数无效', 400);
      where.push('c.status = ?');
      params.push(Number(statusText));
    }

    const rows = await dbQuery(
      `SELECT
         c.id,
         c.certificate_no AS certificateNo,
         u.student_id AS studentId,
         u.name AS studentName,
         u.department,
         u.class AS className,
         c.exam_name AS examName,
         c.score,
         c.grade,
         c.issue_date AS issueDate,
         c.status
       FROM certificates c
       JOIN users u ON u.id = c.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY c.issue_date DESC, c.id DESC
       LIMIT ?`,
      [...params, MAX_EXPORT_ROWS + 1]
    );
    if (rows.length > MAX_EXPORT_ROWS) {
      return error(res, `单次最多导出 ${MAX_EXPORT_ROWS} 条证书，请缩小筛选范围`, 413);
    }

    const data = rows.map((row, index) => ({
      序号: index + 1,
      证书编号: safeSpreadsheetText(row.certificateNo),
      学号: safeSpreadsheetText(row.studentId),
      姓名: safeSpreadsheetText(row.studentName),
      院系: safeSpreadsheetText(row.department),
      班级: safeSpreadsheetText(row.className),
      考试名称: safeSpreadsheetText(row.examName),
      分数: row.score,
      等级: row.grade,
      发证日期: safeSpreadsheetText(row.issueDate),
      状态: Number(row.status) === 1 ? '有效' : '已撤销'
    }));

    return success(res, createWorkbookPayload(data, '证书', '证书导出'), '导出成功');
  } catch (err) {
    console.error('导出证书错误:', err);
    return error(res, '导出证书失败', 500);
  }
};

module.exports = {
  exportRecords,
  exportCertificates,
  safeSpreadsheetText
};
