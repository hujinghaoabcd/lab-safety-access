const { dbQuery, dbGet } = require('../database/db');
const { success, error } = require('../utils/response');

/**
 * 获取准入状态（已废弃，保留兼容性）
 */
const getStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 从证书中获取准入状态
    const certificates = await dbQuery(`
      SELECT 
        c.*,
        e.name as examName
      FROM certificates c
      JOIN exams e ON c.exam_id = e.id
      WHERE c.user_id = ? AND c.status = 1
      ORDER BY c.issue_date DESC
    `, [userId]);

    const now = new Date();
    const list = certificates.map(cert => {
      const expireDate = new Date(cert.issue_date);
      expireDate.setFullYear(expireDate.getFullYear() + 1);
      
      let status = 'qualified';
      if (expireDate < now) {
        status = 'expired';
      }

      return {
        id: cert.id,
        labName: cert.exam_name,
        labType: cert.exam_name,
        status,
        qualifiedDate: cert.issue_date,
        expireDate: expireDate.toISOString().split('T')[0],
        examScore: cert.score
      };
    });

    const stats = {
      total: list.length,
      qualified: list.filter(q => q.status === 'qualified').length,
      pending: 0,
      expired: list.filter(q => q.status === 'expired').length
    };

    success(res, { list, stats }, '获取成功');
  } catch (err) {
    console.error('获取准入状态错误:', err);
    error(res, '获取准入状态失败', 500);
  }
};

/**
 * 获取证书列表
 */
const getCertificates = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 获取证书，同时关联考试记录获取真实考试日期
    const certificates = await dbQuery(`
      SELECT 
        c.*,
        e.name as examName,
        (
          SELECT er.submit_time 
          FROM exam_records er 
          WHERE er.user_id = c.user_id 
            AND er.exam_id = c.exam_id 
            AND er.status = '通过'
          ORDER BY er.submit_time DESC 
          LIMIT 1
        ) as examDate
      FROM certificates c
      JOIN exams e ON c.exam_id = e.id
      WHERE c.user_id = ? AND c.status = 1
      ORDER BY c.issue_date DESC
    `, [userId]);

    // 获取用户信息
    const user = await dbGet('SELECT name, student_id, department, class FROM users WHERE id = ?', [userId]);

    const list = certificates.map(cert => {
      const expireDate = new Date(cert.issue_date);
      expireDate.setFullYear(expireDate.getFullYear() + 1);

      // 格式化考试日期（从考试记录中获取，如果没有则用发证日期）
      let examDateStr = cert.issue_date;
      if (cert.examDate) {
        // submit_time 格式可能是 "2025-01-01 10:30:00" 或 ISO 格式
        examDateStr = cert.examDate.split(' ')[0].split('T')[0];
      }

      return {
        id: cert.id,
        certificateNo: cert.certificate_no,
        examName: cert.exam_name,
        examDate: examDateStr,
        score: cert.score,
        grade: cert.grade,
        issueDate: cert.issue_date,
        expireDate: expireDate.toISOString().split('T')[0],
        studentName: user ? user.name : '',
        studentId: user ? user.student_id : '',
        department: user ? user.department : '',
        class: user ? user.class : ''
      };
    });

    success(res, list, '获取成功');
  } catch (err) {
    console.error('获取证书列表错误:', err);
    error(res, '获取证书列表失败', 500);
  }
};

module.exports = {
  getStatus,
  getCertificates
};
