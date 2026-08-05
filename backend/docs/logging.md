# 日志功能说明

## 概述

项目使用 `winston` 作为日志库，提供统一的日志记录功能。

## 日志级别

- **error**: 错误日志（会单独记录到 error.log）
- **warn**: 警告日志
- **info**: 信息日志（默认级别）
- **debug**: 调试日志

## 日志文件位置

所有日志文件存储在 `backend/logs/` 目录：

- `error.log` - 仅错误日志
- `combined.log` - 所有级别日志
- `exceptions.log` - 未捕获的异常
- `rejections.log` - 未处理的 Promise 拒绝

## 使用方法

### 基本用法

```javascript
const logger = require('./utils/logger');

// 错误日志
logger.error('操作失败', { userId: 123, error: err.message });

// 警告日志
logger.warn('资源不足', { memory: '80%' });

// 信息日志
logger.info('用户登录成功', { userId: 123, ip: '192.168.1.1' });

// 调试日志
logger.debug('查询参数', { params: req.query });
```

### 专用日志方法

```javascript
// HTTP 请求日志
logger.http('GET /api/users', { ip: req.ip, statusCode: 200 });

// 数据库操作日志
logger.db('执行查询', { sql: 'SELECT * FROM users' });
```

## 环境变量配置

- `LOG_LEVEL`: 设置日志级别（默认: `info`）
  - 可选值: `error`, `warn`, `info`, `debug`
  
- `NODE_ENV`: 环境模式
  - `production`: 仅输出到文件
  - 其他: 同时输出到控制台和文件

## 日志轮转

- 单个日志文件最大 5MB
- 保留最近 5 个文件
- 自动按日期分割

## 示例

```javascript
// 在控制器中使用
const logger = require('../utils/logger');

exports.getUsers = async (req, res) => {
  try {
    logger.info('获取用户列表', { query: req.query });
    const users = await dbQuery('SELECT * FROM users');
    logger.debug('查询结果', { count: users.length });
    success(res, users);
  } catch (err) {
    logger.error('获取用户列表失败', { 
      error: err.message, 
      stack: err.stack 
    });
    error(res, '获取失败', 500);
  }
};
```

