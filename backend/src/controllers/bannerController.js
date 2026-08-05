const { dbQuery, dbGet, dbRun } = require('../database/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * 获取跑马灯列表（H5前端使用，仅返回启用的）
 */
exports.getBanners = async (req, res) => {
  try {
    const banners = await dbQuery(`
      SELECT id, title, subtitle, color, order_num as orderNum
      FROM banners
      WHERE status = 1
      ORDER BY order_num ASC, created_at DESC
    `);
    
    success(res, banners || [], '获取成功');
  } catch (err) {
    logger.error('获取跑马灯列表失败', { error: err.message });
    error(res, '获取跑马灯列表失败', 500);
  }
};

/**
 * 获取所有跑马灯（后台管理使用）
 */
exports.getAllBanners = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status } = req.query;
    
    let whereSql = 'WHERE 1=1';
    const params = [];
    
    if (status !== undefined && status !== '') {
      whereSql += ' AND status = ?';
      params.push(parseInt(status, 10));
    }
    
    // 总数
    const countRow = await dbGet(`SELECT COUNT(*) as count FROM banners ${whereSql}`, params);
    const total = countRow ? countRow.count || 0 : 0;
    
    // 分页查询
    const limit = parseInt(pageSize, 10);
    const offset = (parseInt(page, 10) - 1) * limit;
    const banners = await dbQuery(`
      SELECT id, title, subtitle, color, order_num as orderNum, status, created_at as createdAt, updated_at as updatedAt
      FROM banners
      ${whereSql}
      ORDER BY order_num ASC, created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    
    success(res, {
      list: banners || [],
      total,
      page: parseInt(page, 10),
      pageSize: limit
    });
  } catch (err) {
    logger.error('获取跑马灯列表失败', { error: err.message });
    error(res, '获取跑马灯列表失败', 500);
  }
};

/**
 * 创建跑马灯
 */
exports.createBanner = async (req, res) => {
  try {
    const { title, subtitle, color, orderNum, status } = req.body;
    
    if (!title) {
      return error(res, '标题不能为空', 400);
    }
    
    const result = await dbRun(
      `INSERT INTO banners (title, subtitle, color, order_num, status)
       VALUES (?, ?, ?, ?, ?)`,
      [title, subtitle || '', color || '#0475FA', orderNum || 0, status !== undefined ? status : 1]
    );
    
    const banner = await dbGet('SELECT * FROM banners WHERE id = ?', [result.lastID]);
    success(res, {
      id: banner.id,
      title: banner.title,
      subtitle: banner.subtitle,
      color: banner.color,
      orderNum: banner.order_num,
      status: banner.status
    }, '创建成功');
  } catch (err) {
    logger.error('创建跑马灯失败', { error: err.message });
    error(res, '创建跑马灯失败', 500);
  }
};

/**
 * 更新跑马灯
 */
exports.updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, color, orderNum, status } = req.body;
    
    const updateFields = [];
    const updateValues = [];
    
    if (title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(title);
    }
    if (subtitle !== undefined) {
      updateFields.push('subtitle = ?');
      updateValues.push(subtitle);
    }
    if (color !== undefined) {
      updateFields.push('color = ?');
      updateValues.push(color);
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
      `UPDATE banners SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    const banner = await dbGet('SELECT * FROM banners WHERE id = ?', [id]);
    success(res, {
      id: banner.id,
      title: banner.title,
      subtitle: banner.subtitle,
      color: banner.color,
      orderNum: banner.order_num,
      status: banner.status
    }, '更新成功');
  } catch (err) {
    logger.error('更新跑马灯失败', { error: err.message });
    error(res, '更新跑马灯失败', 500);
  }
};

/**
 * 删除跑马灯
 */
exports.deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM banners WHERE id = ?', [id]);
    success(res, null, '删除成功');
  } catch (err) {
    logger.error('删除跑马灯失败', { error: err.message });
    error(res, '删除跑马灯失败', 500);
  }
};

