const { dbQuery, dbGet, dbRun } = require('../database/db');
const { success, error } = require('../utils/response');
const { URL } = require('url');
const path = require('path');
const fs = require('fs');

/**
 * 学生端学习资料读取。
 *
 * 学习进度、学习时长和远程 PDF 代理的写入/网络逻辑统一由
 * secureLearningController 提供；本控制器不再保留旧的重复实现，避免
 * 后续路由重构时误接回已淘汰的非原子进度更新或开放式 PDF 代理。
 */
const getList = async (req, res) => {
  try {
    const userId = req.user.id;
    const materials = await dbQuery(
      'SELECT * FROM learning_materials ORDER BY order_num ASC, created_at DESC'
    );
    const progressRecords = await dbQuery(
      'SELECT material_id, progress FROM learning_progress WHERE user_id = ?',
      [userId]
    );

    const progressMap = {};
    progressRecords.forEach((record) => {
      progressMap[record.material_id] = record.progress;
    });

    const list = materials.map((item) => {
      const progress = progressMap[item.id] || 0;
      let status = 'not_started';
      if (progress >= 100) status = 'completed';
      else if (progress > 0) status = 'in_progress';

      return {
        id: item.id,
        title: item.title,
        description: item.description,
        content: item.content,
        duration: item.duration,
        category: item.category,
        order: item.order_num,
        progress,
        status
      };
    });

    return success(res, list, '获取成功');
  } catch (err) {
    console.error('获取学习资料列表错误:', err);
    return error(res, '获取学习资料列表失败', 500);
  }
};

const getDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const material = await dbGet('SELECT * FROM learning_materials WHERE id = ?', [id]);
    if (!material) return error(res, '学习资料不存在', 404);

    const progressRecord = await dbGet(
      'SELECT progress FROM learning_progress WHERE user_id = ? AND material_id = ?',
      [req.user.id, id]
    );

    return success(res, {
      id: material.id,
      title: material.title,
      description: material.description,
      content: material.content,
      duration: material.duration,
      category: material.category,
      progress: progressRecord ? progressRecord.progress : 0
    }, '获取成功');
  } catch (err) {
    console.error('获取学习资料详情错误:', err);
    return error(res, '获取学习资料详情失败', 500);
  }
};

const validateMaterialContent = (content) => {
  const text = String(content || '').trim();
  if (!text) throw new Error('标题和 PDF 文件不能为空');

  if (/^https?:\/\//i.test(text)) {
    let parsed;
    try {
      parsed = new URL(text);
    } catch (_) {
      throw new Error('PDF 链接格式无效');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('PDF 链接必须是 http 或 https 协议');
    }
    if (!text.toLowerCase().includes('.pdf')) {
      throw new Error('链接必须是 PDF 文件');
    }
    return text;
  }

  if (!text.toLowerCase().endsWith('.pdf')) {
    throw new Error('文件必须是 PDF 格式');
  }
  return text;
};

/** 管理员：获取学习资料列表（带分页和搜索） */
const adminGetList = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, keyword = '', category = '' } = req.query;
    const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const parsedPageSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 10));
    const offset = (parsedPage - 1) * parsedPageSize;

    let query = 'SELECT * FROM learning_materials WHERE 1=1';
    const params = [];

    if (keyword) {
      query += ' AND (title LIKE ? OR description LIKE ?)';
      const keywordPattern = `%${keyword}%`;
      params.push(keywordPattern, keywordPattern);
    }
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY order_num ASC, created_at DESC';
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await dbGet(countQuery, params);

    query += ' LIMIT ? OFFSET ?';
    const materials = await dbQuery(query, [...params, parsedPageSize, offset]);

    return success(res, {
      list: materials,
      total: countResult ? Number(countResult.total || 0) : 0,
      page: parsedPage,
      pageSize: parsedPageSize
    }, '获取成功');
  } catch (err) {
    console.error('获取学习资料列表错误:', err);
    return error(res, '获取学习资料列表失败', 500);
  }
};

const adminCreate = async (req, res) => {
  try {
    const { title, description, content, duration, category, orderNum } = req.body;
    if (!String(title || '').trim() || !content) {
      return error(res, '标题和 PDF 文件不能为空', 400);
    }

    const validatedContent = validateMaterialContent(content);
    const result = await dbRun(
      'INSERT INTO learning_materials (title, description, content, duration, category, order_num) VALUES (?, ?, ?, ?, ?, ?)',
      [String(title).trim(), description || '', validatedContent, duration || '', category || '', orderNum || 0]
    );
    return success(res, { id: result.lastID }, '创建成功');
  } catch (err) {
    if (/PDF|文件必须|标题和/.test(err.message || '')) return error(res, err.message, 400);
    console.error('创建学习资料错误:', err);
    return error(res, '创建学习资料失败', 500);
  }
};

const adminUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, content, duration, category, orderNum } = req.body;
    const material = await dbGet('SELECT id FROM learning_materials WHERE id = ?', [id]);
    if (!material) return error(res, '学习资料不存在', 404);
    if (title !== undefined && !String(title).trim()) return error(res, '标题不能为空', 400);

    const updates = [];
    const params = [];
    if (title !== undefined) {
      updates.push('title = ?');
      params.push(String(title).trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      params.push(validateMaterialContent(content));
    }
    if (duration !== undefined) {
      updates.push('duration = ?');
      params.push(duration);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (orderNum !== undefined) {
      updates.push('order_num = ?');
      params.push(orderNum);
    }

    if (!updates.length) return error(res, '没有要更新的字段', 400);
    params.push(id);
    await dbRun(`UPDATE learning_materials SET ${updates.join(', ')} WHERE id = ?`, params);
    return success(res, {}, '更新成功');
  } catch (err) {
    if (/PDF|文件必须/.test(err.message || '')) return error(res, err.message, 400);
    console.error('更新学习资料错误:', err);
    return error(res, '更新学习资料失败', 500);
  }
};

const adminDelete = async (req, res) => {
  try {
    const { id } = req.params;
    const material = await dbGet('SELECT id FROM learning_materials WHERE id = ?', [id]);
    if (!material) return error(res, '学习资料不存在', 404);

    await dbRun('DELETE FROM learning_progress WHERE material_id = ?', [id]);
    await dbRun('DELETE FROM learning_materials WHERE id = ?', [id]);
    return success(res, {}, '删除成功');
  } catch (err) {
    console.error('删除学习资料错误:', err);
    return error(res, '删除学习资料失败', 500);
  }
};

const adminBatchDelete = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return error(res, '请选择要删除的学习资料', 400);
    }

    const placeholders = ids.map(() => '?').join(',');
    await dbRun(`DELETE FROM learning_progress WHERE material_id IN (${placeholders})`, ids);
    await dbRun(`DELETE FROM learning_materials WHERE id IN (${placeholders})`, ids);
    return success(res, {}, '批量删除成功');
  } catch (err) {
    console.error('批量删除学习资料错误:', err);
    return error(res, '批量删除学习资料失败', 500);
  }
};

/**
 * 管理员上传学习资料 PDF。文件继续通过 /api/uploads 公开访问，这是本项目
 * 当前明确保留的产品行为；上传签名校验仍由 admin 路由中间件负责。
 */
const adminUploadPdf = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return error(res, '未接收到文件', 400);

    const mime = file.mimetype || '';
    const originalName = file.originalname || '';
    if (!mime.includes('pdf') && !originalName.toLowerCase().endsWith('.pdf')) {
      if (file.path && fs.existsSync(file.path)) fs.unlink(file.path, () => {});
      return error(res, '只支持上传 PDF 文件', 400);
    }

    const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads');
    const absolutePath = path.resolve(file.path);
    let relativePath = path.relative(uploadsRoot, absolutePath);
    relativePath = relativePath.split(path.sep).join('/');
    const fileUrl = `/api/uploads/${relativePath}`;

    return success(res, { url: fileUrl, name: originalName }, '上传成功');
  } catch (err) {
    console.error('上传学习资料 PDF 错误:', err);
    return error(res, '上传失败', 500);
  }
};

module.exports = {
  getList,
  getDetail,
  adminGetList,
  adminCreate,
  adminUpdate,
  adminDelete,
  adminBatchDelete,
  adminUploadPdf,
  validateMaterialContent
};
