const { dbQuery } = require('../database/db');
const { createWorkbookBuffer, safeSpreadsheetText } = require('../utils/spreadsheet');
const { success, error } = require('../utils/response');

const MAX_EXPORT_ROWS = 50_000;

const createWorkbookPayload = async (rows, columns, sheetName, filenamePrefix) => {
  const buffer = await createWorkbookBuffer({ rows, columns, sheetName });
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return {
    fileName: `${filenamePrefix}_${timestamp}.xlsx`,
    base64: buffer.toString('base64'),
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
      index: index + 1,
      recordId: row.id,
      studentId: safeSpreadsheetText(row.studentId),
      studentName: safeSpreadsheetText(row.studentName),
      department: safeSpreadsheetText(row.department),
      className: safeSpreadsheetText(row.className),
      examName: safeSpreadsheetText(row.examName),
      score: row.score,
      totalScore: row.totalScore,
      percentage: row.totalScore > 0
        ? Math.round((row.score / row.totalScore) * 1000) / 10
        : 0,
      status: row.status,
      duration: safeSpreadsheetText(row.duration),
      submitTime: safeSpreadsheetText(row.submitTime)
    }));

    const columns = [
      { header: '序号', key: 'index', width: 10 },
      { header: '记录ID', key: 'recordId', width: 12 },
      { header: '学号', key: 'studentId', width: 20 },
      { header: '姓名', key: 'studentName', width: 16 },
      { header: '院系', key: 'department', width: 24 },
      { header: '班级', key: 'className', width: 20 },
      { header: '考试名称', key: 'examName', width: 28 },
      { header: '得分', key: 'score', width: 10 },
      { header: '总分', key: 'totalScore', width: 10 },
      { header: '百分制成绩', key: 'percentage', width: 14 },
      { header: '状态', key: 'status', width: 12 },
      { header: '用时', key: 'duration', width: 16 },
      { header: '提交时间', key: 'submitTime', width: 22 }
    ];

    return success(
      res,
      await createWorkbookPayload(data, columns, '考试记录', '考试记录导出'),
      '导出成功'
    );
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
      index: index + 1,
      certificateNo: safeSpreadsheetText(row.certificateNo),
      studentId: safeSpreadsheetText(row.studentId),
      studentName: safeSpreadsheetText(row.studentName),
      department: safeSpreadsheetText(row.department),
      className: safeSpreadsheetText(row.className),
      examName: safeSpreadsheetText(row.examName),
      score: row.score,
      grade: row.grade,
      issueDate: safeSpreadsheetText(row.issueDate),
      status: Number(row.status) === 1 ? '有效' : '已撤销'
    }));

    const columns = [
      { header: '序号', key: 'index', width: 10 },
      { header: '证书编号', key: 'certificateNo', width: 28 },
      { header: '学号', key: 'studentId', width: 20 },
      { header: '姓名', key: 'studentName', width: 16 },
      { header: '院系', key: 'department', width: 24 },
      { header: '班级', key: 'className', width: 20 },
      { header: '考试名称', key: 'examName', width: 28 },
      { header: '分数', key: 'score', width: 10 },
      { header: '等级', key: 'grade', width: 12 },
      { header: '发证日期', key: 'issueDate', width: 16 },
      { header: '状态', key: 'status', width: 12 }
    ];

    return success(
      res,
      await createWorkbookPayload(data, columns, '证书', '证书导出'),
      '导出成功'
    );
  } catch (err) {
    console.error('导出证书错误:', err);
    return error(res, '导出证书失败', 500);
  }
};

module.exports = {
  exportRecords,
  exportCertificates,
  safeSpreadsheetText,
  createWorkbookPayload
};
