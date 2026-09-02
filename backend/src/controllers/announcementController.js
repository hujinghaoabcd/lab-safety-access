const { dbQuery, dbGet, dbRun } = require('../database/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * 获取公告（学生端使用）。默认保持原有行为只返回第一条启用公告；
 * desktop 首页通过 ?all=1 获取全部启用公告，避免展示前端写死的假数据。
 */
exports.getAnnouncements = async (req, res) => {
  try {
    if (String(req.query.all || '') === '1') {
      const announcements = await dbQuery(`
        SELECT id, content, order_num as orderNum, created_at as createdAt
        FROM announcements
        WHERE status = 1
        ORDER BY order_num ASC, created_at DESC
      `);
      return success(res, announcements || [], '获取成功');
    }

    const announcements = await dbQuery(`
      SELECT id, content, order_num as orderNum
      FROM announcements
      WHERE status = 1
      ORDER BY order_num ASC, created_at DESC
      LIMIT 1
    `);

    success(res, announcements && announcements.length > 0 ? announcements[0].content : '', '获取成功');
  } catch (err) {
    logger.error('获取公告失败', { error: err.message });
    error(res, '获取公告失败', 500);
  }
};

/**
 * 获取所有公告（后台管理使用）
 */
exports.getAllAnnouncements = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status } = req.query;

    let whereSql = 'WHERE 1=1';
    const params = [];

    if (status !== undefined && status !== '') {
      whereSql += ' AND status = ?';
      params.push(parseInt(status, 10));
    }

    const countRow = await dbGet(`SELECT COUNT(*) as count FROM announcements ${whereSql}`, params);
    const total = countRow ? countRow.count || 0 : 0;

    const limit = parseInt(pageSize, 10);
    const offset = (parseInt(page, 10) - 1) * limit;
    const announcements = await dbQuery(`
      SELECT id, content, order_num as orderNum, status, created_at as createdAt, updated_at as updatedAt
      FROM announcements
      ${whereSql}
      ORDER BY order_num ASC, created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    success(res, {
      list: announcements || [],
      total,
      page: parseInt(page, 10),
      pageSize: limit
    });
  } catch (err) {
    logger.error('获取公告列表失败', { error: err.message });
    error(res, '获取公告列表失败', 500);
  }
};

/**
 * 创建公告
 */
exports.createAnnouncement = async (req, res) => {
  try {
    const { content, orderNum, status } = req.body;

    if (!content || !content.trim()) {
      return error(res, '公告内容不能为空', 400);
    }

    const result = await dbRun(
      `INSERT INTO announcements (content, order_num, status)
       VALUES (?, ?, ?)`,
      [content.trim(), orderNum || 0, status !== undefined ? status : 1]
    );

    const announcement = await dbGet('SELECT * FROM announcements WHERE id = ?', [result.lastID]);
    success(res, {
      id: announcement.id,
      content: announcement.content,
      orderNum: announcement.order_num,
      status: announcement.status
    }, '创建成功');
  } catch (err) {
    logger.error('创建公告失败', { error: err.message });
    error(res, '创建公告失败', 500);
  }
};

/**
 * 更新公告
 */
exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, orderNum, status } = req.body;

    const updateFields = [];
    const updateValues = [];

    if (content !== undefined) {
      if (!content.trim()) {
        return error(res, '公告内容不能为空', 400);
      }
      updateFields.push('content = ?');
      updateValues.push(content.trim());
    }
    if (orderNum !== undefined) {
      updateFields.push('order_num = ?');
      updateValues.push(orderNum);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      return error(res, '没有要更新的字段', 400);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    await dbRun(
      `UPDATE announcements SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const announcement = await dbGet('SELECT * FROM announcements WHERE id = ?', [id]);
    success(res, {
      id: announcement.id,
      content: announcement.content,
      orderNum: announcement.order_num,
      status: announcement.status
    }, '更新成功');
  } catch (err) {
    logger.error('更新公告失败', { error: err.message });
    error(res, '更新公告失败', 500);
  }
};

/**
 * 删除公告
 */
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM announcements WHERE id = ?', [id]);
    success(res, null, '删除成功');
  } catch (err) {
    logger.error('删除公告失败', { error: err.message });
    error(res, '删除公告失败', 500);
  }
};
