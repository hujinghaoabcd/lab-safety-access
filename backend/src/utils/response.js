/**
 * 统一响应格式
 */

const { localizeTimestampFields } = require('./time');

const success = (res, data = null, message = '操作成功') => {
  res.json({
    code: 0,
    message,
    data: localizeTimestampFields(data)
  });
};

const error = (res, message = '操作失败', code = 400) => {
  res.status(code).json({
    code,
    message,
    data: null
  });
};

const paginate = (res, list, total, page, pageSize, message = '获取成功') => {
  res.json({
    code: 0,
    message,
    data: {
      list: localizeTimestampFields(list),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  });
};

module.exports = {
  success,
  error,
  paginate
};

