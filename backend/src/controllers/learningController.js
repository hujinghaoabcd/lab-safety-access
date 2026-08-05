const { dbQuery, dbGet, dbRun } = require('../database/db');
const { success, error } = require('../utils/response');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const path = require('path');
const fs = require('fs');

/**
 * 获取学习资料列表
 */
const getList = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const materials = await dbQuery(
      'SELECT * FROM learning_materials ORDER BY order_num ASC, created_at DESC'
    );

    // 获取用户的学习进度
    const progressRecords = await dbQuery(
      'SELECT material_id, progress FROM learning_progress WHERE user_id = ?',
      [userId]
    );

    const progressMap = {};
    progressRecords.forEach(r => {
      progressMap[r.material_id] = r.progress;
    });

    const list = materials.map(item => {
      const progress = progressMap[item.id] || 0;
      let status = 'not_started';
      if (progress >= 100) {
        status = 'completed';
      } else if (progress > 0) {
        status = 'in_progress';
      }

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

    success(res, list, '获取成功');
  } catch (err) {
    console.error('获取学习资料列表错误:', err);
    error(res, '获取学习资料列表失败', 500);
  }
};

/**
 * 获取学习资料详情
 */
const getDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const material = await dbGet('SELECT * FROM learning_materials WHERE id = ?', [id]);

    if (!material) {
      return error(res, '学习资料不存在', 404);
    }

    const progressRecord = await dbGet(
      'SELECT progress FROM learning_progress WHERE user_id = ? AND material_id = ?',
      [userId, id]
    );

    const progress = progressRecord ? progressRecord.progress : 0;

    success(res, {
      id: material.id,
      title: material.title,
      description: material.description,
      content: material.content,
      duration: material.duration,
      category: material.category,
      progress
    }, '获取成功');
  } catch (err) {
    console.error('获取学习资料详情错误:', err);
    error(res, '获取学习资料详情失败', 500);
  }
};

/**
 * 记录学习进度
 */
const recordProgress = async (req, res) => {
  try {
    const { id, progress } = req.body;
    const userId = req.user.id;

    if (!id || progress === undefined) {
      return error(res, '参数错误', 400);
    }

    const material = await dbGet('SELECT * FROM learning_materials WHERE id = ?', [id]);
    if (!material) {
      return error(res, '学习资料不存在', 404);
    }

    // 获取当前进度
    const currentRecord = await dbGet(
      'SELECT progress FROM learning_progress WHERE user_id = ? AND material_id = ?',
      [userId, id]
    );

    const currentProgress = currentRecord ? currentRecord.progress : 0;
    const newProgress = Math.min(Math.max(progress, currentProgress), 100);

    // 更新或插入进度
    if (currentRecord) {
      await dbRun(
        'UPDATE learning_progress SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND material_id = ?',
        [newProgress, userId, id]
      );
    } else {
      await dbRun(
        'INSERT INTO learning_progress (user_id, material_id, progress) VALUES (?, ?, ?)',
        [userId, id, newProgress]
      );
    }

    success(res, { progress: newProgress }, '进度已更新');
  } catch (err) {
    console.error('记录学习进度错误:', err);
    error(res, '记录学习进度失败', 500);
  }
};

/**
 * PDF 代理接口 - 解决 CORS 跨域问题
 */
const proxyPdf = async (req, res) => {
  try {
    const { url: pdfUrl } = req.query;
    
    if (!pdfUrl) {
      return error(res, '缺少 PDF URL 参数', 400);
    }

    // 验证 URL 格式
    let parsedUrl;
    try {
      parsedUrl = new URL(pdfUrl);
    } catch (err) {
      return error(res, '无效的 PDF URL', 400);
    }

    // 只允许 http 和 https 协议
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return error(res, '不支持的协议', 400);
    }

    // 使用对应的模块获取 PDF
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    const proxyReq = client.request(options, (proxyRes) => {
      // 如果状态码不是 200，返回错误
      if (proxyRes.statusCode !== 200) {
        return error(res, `获取 PDF 失败: ${proxyRes.statusCode}`, proxyRes.statusCode);
      }

      // 设置响应头
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/pdf');
      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
      }
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(200);

      // 流式传输 PDF 数据
      proxyRes.pipe(res);
      
      proxyRes.on('error', (err) => {
        console.error('PDF 流传输错误:', err);
        if (!res.headersSent) {
          error(res, 'PDF 传输失败', 500);
        }
      });
    });

    proxyReq.on('error', (err) => {
      console.error('PDF 代理请求错误:', err);
      error(res, '获取 PDF 失败: ' + err.message, 500);
    });

    proxyReq.end();
  } catch (err) {
    console.error('PDF 代理错误:', err);
    error(res, 'PDF 代理失败', 500);
  }
};

/**
 * 记录学习时长
 */
const recordDuration = async (req, res) => {
  try {
    const { id, duration } = req.body;
    const userId = req.user.id;

    if (!id || duration === undefined) {
      return error(res, '参数错误', 400);
    }

    // 确保 id 是数字类型
    const materialId = parseInt(id, 10);
    if (isNaN(materialId)) {
      return error(res, '学习资料 ID 无效', 400);
    }

    const material = await dbGet('SELECT * FROM learning_materials WHERE id = ?', [materialId]);
    if (!material) {
      return error(res, '学习资料不存在', 404);
    }

    // 获取当前记录
    const currentRecord = await dbGet(
      'SELECT study_duration FROM learning_progress WHERE user_id = ? AND material_id = ?',
      [userId, materialId]
    );

    const currentDuration = currentRecord ? (currentRecord.study_duration || 0) : 0;
    const newDuration = currentDuration + duration; // 累加学习时长

    // 更新或插入进度
    if (currentRecord) {
      await dbRun(
        'UPDATE learning_progress SET study_duration = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND material_id = ?',
        [newDuration, userId, materialId]
      );
    } else {
      await dbRun(
        'INSERT INTO learning_progress (user_id, material_id, progress, study_duration) VALUES (?, ?, 0, ?)',
        [userId, materialId, newDuration]
      );
    }

    success(res, { duration: newDuration }, '学习时长已更新');
  } catch (err) {
    console.error('记录学习时长错误:', err);
    error(res, '记录学习时长失败', 500);
  }
};

/**
 * 管理员：获取学习资料列表（带分页和搜索）
 */
const adminGetList = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, keyword = '', category = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

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

    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await dbGet(countQuery, params);
    const total = countResult ? countResult.total : 0;

    // 获取分页数据
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const materials = await dbQuery(query, params);

    success(res, {
      list: materials,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }, '获取成功');
  } catch (err) {
    console.error('获取学习资料列表错误:', err);
    error(res, '获取学习资料列表失败', 500);
  }
};

/**
 * 管理员：创建学习资料
 */
const adminCreate = async (req, res) => {
  try {
    const { title, description, content, duration, category, orderNum } = req.body;

    if (!title || !content) {
      return error(res, '标题和 PDF 文件不能为空', 400);
    }

    // content 既可以是外部 PDF 链接，也可以是本地上传后的访问路径（如：/api/uploads/learning/xxx.pdf）
    const isHttpUrl = /^https?:\/\//i.test(content);
    if (isHttpUrl) {
      // 外部链接：做严格 URL 校验
      try {
        const url = new URL(content);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return error(res, 'PDF 链接必须是 http 或 https 协议', 400);
        }
        if (!content.toLowerCase().includes('.pdf')) {
          return error(res, '链接必须是 PDF 文件', 400);
        }
      } catch (err) {
        return error(res, 'PDF 链接格式无效', 400);
      }
    } else {
      // 本地上传文件：只校验后缀
      if (!content.toLowerCase().endsWith('.pdf')) {
        return error(res, '文件必须是 PDF 格式', 400);
      }
    }

    const result = await dbRun(
      'INSERT INTO learning_materials (title, description, content, duration, category, order_num) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description || '', content, duration || '', category || '', orderNum || 0]
    );

    success(res, { id: result.lastID }, '创建成功');
  } catch (err) {
    console.error('创建学习资料错误:', err);
    error(res, '创建学习资料失败', 500);
  }
};

/**
 * 管理员：更新学习资料
 */
const adminUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, content, duration, category, orderNum } = req.body;

    const material = await dbGet('SELECT * FROM learning_materials WHERE id = ?', [id]);
    if (!material) {
      return error(res, '学习资料不存在', 404);
    }

    if (title !== undefined && !title) {
      return error(res, '标题不能为空', 400);
    }

    if (content !== undefined) {
      const isHttpUrl = /^https?:\/\//i.test(content);
      if (isHttpUrl) {
        // 外部链接：严格校验
        try {
          const url = new URL(content);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return error(res, 'PDF 链接必须是 http 或 https 协议', 400);
          }
          if (!content.toLowerCase().includes('.pdf')) {
            return error(res, '链接必须是 PDF 文件', 400);
          }
        } catch (err) {
          return error(res, 'PDF 链接格式无效', 400);
        }
      } else {
        // 本地上传文件：只校验后缀
        if (!content.toLowerCase().endsWith('.pdf')) {
          return error(res, '文件必须是 PDF 格式', 400);
        }
      }
    }

    // 构建更新字段
    const updates = [];
    const params = [];
    
    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      params.push(content);
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
    
    if (updates.length === 0) {
      return error(res, '没有要更新的字段', 400);
    }
    
    params.push(id);
    await dbRun(
      `UPDATE learning_materials SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    success(res, {}, '更新成功');
  } catch (err) {
    console.error('更新学习资料错误:', err);
    error(res, '更新学习资料失败', 500);
  }
};

/**
 * 管理员：删除学习资料
 */
const adminDelete = async (req, res) => {
  try {
    const { id } = req.params;

    const material = await dbGet('SELECT * FROM learning_materials WHERE id = ?', [id]);
    if (!material) {
      return error(res, '学习资料不存在', 404);
    }

    // 删除学习资料及相关进度记录
    await dbRun('DELETE FROM learning_progress WHERE material_id = ?', [id]);
    await dbRun('DELETE FROM learning_materials WHERE id = ?', [id]);

    success(res, {}, '删除成功');
  } catch (err) {
    console.error('删除学习资料错误:', err);
    error(res, '删除学习资料失败', 500);
  }
};

/**
 * 管理员：批量删除学习资料
 */
const adminBatchDelete = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return error(res, '请选择要删除的学习资料', 400);
    }

    const placeholders = ids.map(() => '?').join(',');
    
    // 删除学习进度记录
    await dbRun(`DELETE FROM learning_progress WHERE material_id IN (${placeholders})`, ids);
    // 删除学习资料
    await dbRun(`DELETE FROM learning_materials WHERE id IN (${placeholders})`, ids);

    success(res, {}, '批量删除成功');
  } catch (err) {
    console.error('批量删除学习资料错误:', err);
    error(res, '批量删除学习资料失败', 500);
  }
};

/**
 * 管理员：上传学习资料 PDF 文件
 * 使用 /api/uploads 静态目录对外提供访问
 */
const adminUploadPdf = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return error(res, '未接收到文件', 400);
    }

    // 基本类型校验
    const mime = file.mimetype || '';
    const originalName = file.originalname || '';
    if (
      !mime.includes('pdf') &&
      !originalName.toLowerCase().endsWith('.pdf')
    ) {
      // 删除已保存的非 PDF 文件
      if (file.path && fs.existsSync(file.path)) {
        fs.unlink(file.path, () => {});
      }
      return error(res, '只支持上传 PDF 文件', 400);
    }

    // 生成对外访问 URL
    // multer 的 diskStorage 已经将文件保存到 uploads/learning 目录
    // 这里需要从绝对路径推算出相对路径
    const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads');
    const absolutePath = path.resolve(file.path);
    let relativePath = path.relative(uploadsRoot, absolutePath);
    // 统一使用正斜杠
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
  recordProgress,
  recordDuration,
  proxyPdf,
  adminGetList,
  adminCreate,
  adminUpdate,
  adminDelete,
  adminBatchDelete,
  adminUploadPdf
};
