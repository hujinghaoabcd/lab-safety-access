/**
 * 数据库配置与初始化模块
 * 
 * 使用 SQLite 作为数据存储，提供：
 * - 数据库连接管理
 * - 表结构初始化
 * - 常用查询方法封装
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// ============ 数据库路径配置 ============
const DB_PATH = path.join(__dirname, '../../data/lab_safety.db');
const DB_DIR = path.dirname(DB_PATH);

// 确保数据目录存在
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// ============ 创建数据库连接 ============
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    logger.error('数据库连接失败', { error: err.message, path: DB_PATH });
  } else {
    logger.info('SQLite 数据库连接成功', { path: DB_PATH });
  }
});

// 启用外键约束（运行时）
db.run('PRAGMA foreign_keys = ON');

// ============ 数据库初始化 ============
/**
 * 初始化数据库表结构
 * - 仅创建不存在的表，不会删除现有数据
 * - 包含必要的数据迁移逻辑
 */
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 初始化阶段暂时关闭外键检查，避免迁移时的约束问题
      db.run('PRAGMA foreign_keys = OFF');

      // ========== 基础配置表 ==========

      // 院系表
      db.run(`
        CREATE TABLE IF NOT EXISTS departments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 班级表
      db.run(`
        CREATE TABLE IF NOT EXISTS classes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          department_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(department_id, name)
        )
      `);

      // 系统设置表（存储 JSON 配置）
      db.run(`
        CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // ========== 用户相关表 ==========

      // 用户表
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          password TEXT NOT NULL,
          department TEXT,
          class TEXT,
          phone TEXT,
          email TEXT,
          avatar TEXT,
          status INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // ========== 考试相关表 ==========

      // 考试表
      db.run(`
        CREATE TABLE IF NOT EXISTS exams (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          duration INTEGER NOT NULL,
          total_score INTEGER NOT NULL,
          pass_score INTEGER NOT NULL,
          question_count INTEGER NOT NULL,
          status INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 题目表
      db.run(`
        CREATE TABLE IF NOT EXISTS questions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          type TEXT NOT NULL,
          category TEXT NOT NULL,
          options TEXT NOT NULL,
          answer TEXT NOT NULL,
          analysis TEXT,
          exam_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 考试发布范围表（控制哪些院系/班级可见）
      db.run(`
        CREATE TABLE IF NOT EXISTS exam_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          exam_id INTEGER NOT NULL,
          department TEXT,
          class TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(exam_id, department, class)
        )
      `);

      // 考试记录表
      db.run(`
        CREATE TABLE IF NOT EXISTS exam_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          exam_id INTEGER NOT NULL,
          score INTEGER NOT NULL,
          status TEXT NOT NULL,
          duration TEXT,
          answers TEXT,
          wrong_questions TEXT,
          submit_time DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // ========== 证书与错题表 ==========

      // 证书表
      db.run(`
        CREATE TABLE IF NOT EXISTS certificates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          certificate_no TEXT UNIQUE NOT NULL,
          user_id INTEGER NOT NULL,
          exam_id INTEGER NOT NULL,
          exam_name TEXT NOT NULL,
          score INTEGER NOT NULL,
          grade TEXT NOT NULL,
          issue_date TEXT NOT NULL,
          status INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 错题本表
      db.run(`
        CREATE TABLE IF NOT EXISTS wrong_questions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          question_id INTEGER NOT NULL,
          user_answer TEXT,
          exam_record_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // ========== 学习相关表 ==========

      // 学习资料表
      db.run(`
        CREATE TABLE IF NOT EXISTS learning_materials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          content TEXT,
          duration TEXT,
          category TEXT,
          order_num INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 学习进度表
      db.run(`
        CREATE TABLE IF NOT EXISTS learning_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          material_id INTEGER NOT NULL,
          progress INTEGER DEFAULT 0,
          study_duration INTEGER DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, material_id)
        )
      `);

      // ========== 前端展示相关表 ==========

      // 跑马灯（轮播图）表
      db.run(`
        CREATE TABLE IF NOT EXISTS banners (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          subtitle TEXT,
          color TEXT DEFAULT '#0475FA',
          order_num INTEGER DEFAULT 0,
          status INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 公告通知表
      db.run(`
        CREATE TABLE IF NOT EXISTS announcements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          order_num INTEGER DEFAULT 0,
          status INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // ========== 数据迁移 ==========

      // 为 users 表添加 avatar 列（如果不存在）
      migrateUsersTable(() => {
        // 为 learning_progress 表添加 study_duration 列（如果不存在）
        migrateLearningProgressTable(() => {
          // 重新开启外键检查
          db.run('PRAGMA foreign_keys = ON');
          logger.info('数据库表初始化完成');
          resolve();
        });
      });
    });
  });
};

/**
 * 用户表迁移：添加 avatar 列
 */
const migrateUsersTable = (callback) => {
  db.all('PRAGMA table_info(users)', (err, columns) => {
    if (err) {
      console.error('检查 users 表结构失败:', err);
      return callback();
    }
    
    const hasAvatar = (columns || []).some(col => col.name === 'avatar');
    if (hasAvatar) {
      return callback();
    }

    logger.info('为 users 表添加 avatar 列');
    db.run('ALTER TABLE users ADD COLUMN avatar TEXT', (alterErr) => {
      if (alterErr) {
        logger.error('添加 avatar 列失败', { error: alterErr.message });
      } else {
        logger.info('users 表已添加 avatar 列');
      }
      callback();
    });
  });
};

/**
 * 学习进度表迁移：添加 study_duration 列
 */
const migrateLearningProgressTable = (callback) => {
  db.all('PRAGMA table_info(learning_progress)', (err, columns) => {
    if (err) {
      logger.error('检查 learning_progress 表结构失败', { error: err.message });
      return callback();
    }
    
    const hasStudyDuration = (columns || []).some(col => col.name === 'study_duration');
    if (hasStudyDuration) {
      return callback();
    }

    logger.info('为 learning_progress 表添加 study_duration 列');
    db.run('ALTER TABLE learning_progress ADD COLUMN study_duration INTEGER DEFAULT 0', (alterErr) => {
      if (alterErr) {
        logger.error('添加 study_duration 列失败', { error: alterErr.message });
      } else {
        logger.info('learning_progress 表已添加 study_duration 列');
      }
      callback();
    });
  });
};

// ============ 数据库操作封装 ============

/**
 * 查询多条记录
 * @param {string} sql - SQL 语句
 * @param {array} params - 参数数组
 * @returns {Promise<array>}
 */
const dbQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

/**
 * 执行写操作（INSERT/UPDATE/DELETE）
 * @param {string} sql - SQL 语句
 * @param {array} params - 参数数组
 * @returns {Promise<{lastID: number, changes: number}>}
 */
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

/**
 * 查询单条记录
 * @param {string} sql - SQL 语句
 * @param {array} params - 参数数组
 * @returns {Promise<object|undefined>}
 */
const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

/**
 * 关闭数据库连接
 * @returns {Promise<void>}
 */
const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        logger.error('关闭数据库连接失败', { error: err.message });
        reject(err);
      } else {
        logger.info('数据库连接已关闭');
        resolve();
      }
    });
  });
};

// ============ 导出模块 ============
module.exports = {
  db,
  initDatabase,
  dbQuery,
  dbRun,
  dbGet,
  closeDatabase,
  DB_PATH
};
