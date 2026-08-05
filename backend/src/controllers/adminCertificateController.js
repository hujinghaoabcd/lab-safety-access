const crypto = require('node:crypto');
const { dbQuery, dbGet, withTransaction } = require('../database/db');
const { success, error } = require('../utils/response');

class CertificateError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const certificateNumber = () => (
  `UCAS-LS-${new Date().getFullYear()}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`
);

const gradeFromScore = (score, totalScore) => {
  const percentage = totalScore > 0 ? (score / totalScore) * 100 : 0;
  if (percentage >= 90) return '优秀';
  if (percentage >= 80) return '良好';
  return '及格';
};

const serialize = (row) => ({
  id: row.id,
  certificateNo: row.certificateNo ?? row.certificate_no,
  userId: row.userId ?? row.user_id,
  examId: row.examId ?? row.exam_id,
  examName: row.examName ?? row.exam_name,
  score: row.score,
  grade: row.grade,
  issueDate: row.issueDate ?? row.issue_date,
  status: Number(row.status),
  createdAt: row.createdAt ?? row.created_at,
  studentName: row.studentName,
  studentId: row.studentId,
  department: row.department,
  class: row.className ?? row.class
});

const getCertificates = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || '10', 10) || 10));
    const where = ['1=1'];
    const params = [];
    const keyword = String(req.query.keyword || '').trim();
    const examName = String(req.query.examName || '').trim();
    const grade = String(req.query.grade || '').trim();
    const status = String(req.query.status ?? '').trim();

    if (keyword) {
      where.push('(u.name LIKE ? OR u.student_id LIKE ? OR c.certificate_no LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (examName) {
      where.push('c.exam_name LIKE ?');
      params.push(`%${examName}%`);
    }
    if (grade) {
      if (!['优秀', '良好', '及格'].includes(grade)) return error(res, '证书等级参数无效', 400);
      where.push('c.grade = ?');
      params.push(grade);
    }
    if (status !== '') {
      if (!['0', '1'].includes(status)) return error(res, '证书状态参数无效', 400);
      where.push('c.status = ?');
      params.push(Number(status));
    }

    const count = await dbGet(
      `SELECT COUNT(*) AS count
         FROM certificates c
         JOIN users u ON u.id = c.user_id
        WHERE ${where.join(' AND ')}`,
      params
    );
    const rows = await dbQuery(
      `SELECT c.id,
              c.certificate_no AS certificateNo,
              c.user_id AS userId,
              c.exam_id AS examId,
              c.exam_name AS examName,
              c.score,
              c.grade,
              c.issue_date AS issueDate,
              c.status,
              c.created_at AS createdAt,
              u.name AS studentName,
              u.student_id AS studentId,
              u.department,
              u.class AS className
         FROM certificates c
         JOIN users u ON u.id = c.user_id
        WHERE ${where.join(' AND ')}
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    return success(res, {
      list: rows.map(serialize),
      total: Number(count.count || 0),
      page,
      pageSize
    });
  } catch (err) {
    console.error('获取证书列表错误:', err);
    return error(res, '获取证书列表失败', 500);
  }
};

const issueCertificate = async (req, res) => {
  try {
    const result = await withTransaction(async (tx) => {
      const userId = Number.parseInt(req.body && req.body.userId, 10);
      const examId = Number.parseInt(req.body && req.body.examId, 10);
      if (!Number.isInteger(userId) || userId <= 0) throw new CertificateError('用户 ID 无效');
      if (!Number.isInteger(examId) || examId <= 0) throw new CertificateError('考试 ID 无效');

      const user = await tx.get(
        'SELECT id, name, student_id AS studentId, department, class FROM users WHERE id = ?',
        [userId]
      );
      if (!user) throw new CertificateError('用户不存在', 404);
      const exam = await tx.get(
        `SELECT id, name, total_score AS totalScore, pass_score AS passScore
           FROM exams WHERE id = ?`,
        [examId]
      );
      if (!exam) throw new CertificateError('考试不存在', 404);

      const requestedScore = req.body && req.body.score;
      const score = requestedScore === undefined || requestedScore === null || requestedScore === ''
        ? Number(exam.passScore)
        : Number(requestedScore);
      if (!Number.isFinite(score) || score < 0 || score > Number(exam.totalScore)) {
        throw new CertificateError(`分数必须在 0–${exam.totalScore} 之间`);
      }
      if (score < Number(exam.passScore)) {
        throw new CertificateError(`证书分数不能低于及格线 ${exam.passScore}`);
      }

      const existing = await tx.get(
        'SELECT id FROM certificates WHERE user_id = ? AND exam_id = ? AND status = 1',
        [userId, examId]
      );
      if (existing) throw new CertificateError('该用户已有此考试的有效证书', 409);

      const computedGrade = gradeFromScore(score, Number(exam.totalScore));
      const requestedGrade = String(req.body && req.body.grade || '').trim();
      if (requestedGrade && !['优秀', '良好', '及格'].includes(requestedGrade)) {
        throw new CertificateError('证书等级无效');
      }
      if (requestedGrade && requestedGrade !== computedGrade) {
        throw new CertificateError(`证书等级应为“${computedGrade}”，不能与分数矛盾`);
      }

      const number = certificateNumber();
      const issueDate = new Date().toISOString().slice(0, 10);
      const inserted = await tx.run(
        `INSERT INTO certificates
          (certificate_no, user_id, exam_id, exam_name, score, grade, issue_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [number, userId, examId, exam.name, score, computedGrade, issueDate]
      );
      await tx.run(
        `INSERT INTO operation_audit_logs
          (actor_type, actor_id, action, target_type, target_id, outcome, detail, ip)
         VALUES ('admin', ?, 'certificate.issue', 'certificate', ?, 'success', ?, ?)`,
        [
          String(req.user.id),
          String(inserted.lastID),
          JSON.stringify({ userId, examId, score, grade: computedGrade }),
          String(req.ip || '').slice(0, 100) || null
        ]
      );
      return tx.get(
        `SELECT c.*, u.name AS studentName, u.student_id AS studentId,
                u.department, u.class
           FROM certificates c
           JOIN users u ON u.id = c.user_id
          WHERE c.id = ?`,
        [inserted.lastID]
      );
    });
    return success(res, serialize(result), '证书发放成功');
  } catch (err) {
    if (err instanceof CertificateError) return error(res, err.message, err.status);
    console.error('手动发放证书错误:', err);
    return error(res, '发放证书失败', 500);
  }
};

const revokeCertificate = async (req, res) => {
  const certificateId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(certificateId) || certificateId <= 0) return error(res, '证书 ID 无效', 400);

  try {
    const result = await withTransaction(async (tx) => {
      const certificate = await tx.get('SELECT * FROM certificates WHERE id = ?', [certificateId]);
      if (!certificate) throw new CertificateError('证书不存在', 404);
      if (Number(certificate.status) === 0) throw new CertificateError('证书已经撤销', 409);
      await tx.run('UPDATE certificates SET status = 0 WHERE id = ?', [certificateId]);
      await tx.run(
        `INSERT INTO operation_audit_logs
          (actor_type, actor_id, action, target_type, target_id, outcome, ip)
         VALUES ('admin', ?, 'certificate.revoke', 'certificate', ?, 'success', ?)`,
        [String(req.user.id), String(certificateId), String(req.ip || '').slice(0, 100) || null]
      );
      return tx.get('SELECT * FROM certificates WHERE id = ?', [certificateId]);
    });
    return success(res, serialize(result), '证书已撤销');
  } catch (err) {
    if (err instanceof CertificateError) return error(res, err.message, err.status);
    console.error('撤销证书错误:', err);
    return error(res, '撤销证书失败', 500);
  }
};

const reissueCertificate = async (req, res) => {
  const certificateId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(certificateId) || certificateId <= 0) return error(res, '证书 ID 无效', 400);

  try {
    const result = await withTransaction(async (tx) => {
      const certificate = await tx.get('SELECT * FROM certificates WHERE id = ?', [certificateId]);
      if (!certificate) throw new CertificateError('证书不存在', 404);
      if (Number(certificate.status) === 1) throw new CertificateError('证书当前已经有效', 409);
      const otherActive = await tx.get(
        `SELECT id FROM certificates
          WHERE user_id = ? AND exam_id = ? AND status = 1 AND id <> ?`,
        [certificate.user_id, certificate.exam_id, certificateId]
      );
      if (otherActive) throw new CertificateError('该用户已有同考试的其他有效证书', 409);

      const issueDate = new Date().toISOString().slice(0, 10);
      await tx.run(
        'UPDATE certificates SET status = 1, issue_date = ? WHERE id = ?',
        [issueDate, certificateId]
      );
      await tx.run(
        `INSERT INTO operation_audit_logs
          (actor_type, actor_id, action, target_type, target_id, outcome, ip)
         VALUES ('admin', ?, 'certificate.reissue', 'certificate', ?, 'success', ?)`,
        [String(req.user.id), String(certificateId), String(req.ip || '').slice(0, 100) || null]
      );
      return tx.get('SELECT * FROM certificates WHERE id = ?', [certificateId]);
    });
    return success(res, serialize(result), '证书已重新发放');
  } catch (err) {
    if (err instanceof CertificateError) return error(res, err.message, err.status);
    console.error('重新发放证书错误:', err);
    return error(res, '重新发放证书失败', 500);
  }
};

module.exports = {
  getCertificates,
  issueCertificate,
  revokeCertificate,
  reissueCertificate,
  gradeFromScore,
  certificateNumber,
  serialize
};
