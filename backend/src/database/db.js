/**
 * SQLite database configuration, migrations, and query helpers.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const DEFAULT_DB_PATH = path.join(__dirname, '../../data/lab_safety.db');
const DB_PATH = process.env.LAB_SAFETY_DB_PATH
  ? path.resolve(process.env.LAB_SAFETY_DB_PATH)
  : DEFAULT_DB_PATH;
const DB_DIR = path.dirname(DB_PATH);

fs.mkdirSync(DB_DIR, { recursive: true });

const configureConnection = (connection) => {
  if (typeof connection.configure === 'function') {
    connection.configure('busyTimeout', 5000);
  }
};

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    logger.error('数据库连接失败', { error: err.message, path: DB_PATH });
  } else {
    logger.info('SQLite 数据库连接成功', { path: DB_PATH });
  }
});
configureConnection(db);

const queryOn = (connection, sql, params = []) => new Promise((resolve, reject) => {
  connection.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

const getOn = (connection, sql, params = []) => new Promise((resolve, reject) => {
  connection.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const runOn = (connection, sql, params = []) => new Promise((resolve, reject) => {
  connection.run(sql, params, function onRun(err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const execOn = (connection, sql) => new Promise((resolve, reject) => {
  connection.exec(sql, (err) => {
    if (err) reject(err);
    else resolve();
  });
});

const closeOn = (connection) => new Promise((resolve, reject) => {
  connection.close((err) => {
    if (err) reject(err);
    else resolve();
  });
});

const openConnection = () => new Promise((resolve, reject) => {
  const connection = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      reject(err);
      return;
    }
    configureConnection(connection);
    resolve(connection);
  });
});

const applyConnectionPragmas = async (connection) => {
  await execOn(connection, `
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
};

const ensureColumn = async (table, column, definition) => {
  const columns = await queryOn(db, `PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    logger.info(`为 ${table} 表添加 ${column} 列`);
    await runOn(db, `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

/**
 * Initialize a fresh database and apply idempotent compatibility migrations.
 * Initialization failures reject and prevent the HTTP service from starting.
 */
const initDatabase = async () => {
  await execOn(db, `
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(department_id, name),
      FOREIGN KEY (department_id) REFERENCES departments(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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
      status INTEGER DEFAULT 1 CHECK (status IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      duration INTEGER NOT NULL CHECK (duration > 0),
      total_score INTEGER NOT NULL CHECK (total_score > 0),
      pass_score INTEGER NOT NULL CHECK (pass_score >= 0),
      question_count INTEGER NOT NULL DEFAULT 0 CHECK (question_count >= 0),
      status INTEGER DEFAULT 0 CHECK (status IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exam_id) REFERENCES exams(id)
        ON UPDATE CASCADE ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS exam_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      department TEXT,
      class TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(exam_id, department, class),
      FOREIGN KEY (exam_id) REFERENCES exams(id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exam_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      exam_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      status TEXT NOT NULL,
      duration TEXT,
      answers TEXT,
      wrong_questions TEXT,
      submit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY (exam_id) REFERENCES exams(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_no TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      exam_id INTEGER NOT NULL,
      exam_name TEXT NOT NULL,
      score INTEGER NOT NULL,
      grade TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      status INTEGER DEFAULT 1 CHECK (status IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY (exam_id) REFERENCES exams(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS wrong_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      user_answer TEXT,
      exam_record_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (exam_record_id) REFERENCES exam_records(id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS learning_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      content TEXT,
      duration TEXT,
      category TEXT,
      order_num INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS learning_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      study_duration INTEGER DEFAULT 0 CHECK (study_duration >= 0),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, material_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES learning_materials(id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subtitle TEXT,
      color TEXT DEFAULT '#0475FA',
      order_num INTEGER DEFAULT 0,
      status INTEGER DEFAULT 1 CHECK (status IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      order_num INTEGER DEFAULT 0,
      status INTEGER DEFAULT 1 CHECK (status IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await ensureColumn('users', 'avatar', 'TEXT');
  await ensureColumn('learning_progress', 'study_duration', 'INTEGER DEFAULT 0');
  await ensureColumn('exams', 'category', 'TEXT');

  // Retain the newest active certificate if legacy data contains duplicates.
  await runOn(db, `
    UPDATE certificates
       SET status = 0
     WHERE status = 1
       AND id NOT IN (
         SELECT MAX(id)
           FROM certificates
          WHERE status = 1
          GROUP BY user_id, exam_id
       )
  `);

  await execOn(db, `
    CREATE INDEX IF NOT EXISTS idx_exam_records_user_exam
      ON exam_records(user_id, exam_id);
    CREATE INDEX IF NOT EXISTS idx_exam_records_submit_time
      ON exam_records(submit_time DESC);
    CREATE INDEX IF NOT EXISTS idx_questions_exam
      ON questions(exam_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_exam
      ON exam_assignments(exam_id);
    CREATE INDEX IF NOT EXISTS idx_wrong_questions_user_question
      ON wrong_questions(user_id, question_id);
    CREATE INDEX IF NOT EXISTS idx_learning_progress_user
      ON learning_progress(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_active_certificate_user_exam
      ON certificates(user_id, exam_id) WHERE status = 1;
    INSERT OR IGNORE INTO schema_migrations(version, name)
      VALUES (1, 'baseline_schema_and_indexes');
  `);

  const foreignKeyIssues = await queryOn(db, 'PRAGMA foreign_key_check');
  if (foreignKeyIssues.length) {
    logger.warn('数据库存在历史外键不一致数据', {
      issueCount: foreignKeyIssues.length,
      sample: foreignKeyIssues.slice(0, 10)
    });
  }

  logger.info('数据库表初始化完成', { path: DB_PATH });
};

const dbQuery = (sql, params = []) => queryOn(db, sql, params);
const dbRun = (sql, params = []) => runOn(db, sql, params);
const dbGet = (sql, params = []) => getOn(db, sql, params);
const dbExec = (sql) => execOn(db, sql);

/**
 * Execute a callback in a dedicated SQLite transaction connection. A separate
 * connection prevents unrelated request queries from being inserted between
 * BEGIN and COMMIT on the shared application connection.
 */
const withTransaction = async (callback, { mode = 'IMMEDIATE' } = {}) => {
  const normalizedMode = String(mode).toUpperCase();
  if (!['DEFERRED', 'IMMEDIATE', 'EXCLUSIVE'].includes(normalizedMode)) {
    throw new Error('不支持的事务模式');
  }

  const connection = await openConnection();
  const tx = {
    query: (sql, params = []) => queryOn(connection, sql, params),
    get: (sql, params = []) => getOn(connection, sql, params),
    run: (sql, params = []) => runOn(connection, sql, params),
    exec: (sql) => execOn(connection, sql)
  };

  try {
    await applyConnectionPragmas(connection);
    await runOn(connection, `BEGIN ${normalizedMode} TRANSACTION`);
    const result = await callback(tx);
    await runOn(connection, 'COMMIT');
    return result;
  } catch (err) {
    try {
      await runOn(connection, 'ROLLBACK');
    } catch (_) {
      // Preserve the original failure.
    }
    throw err;
  } finally {
    await closeOn(connection);
  }
};

const checkDatabase = async () => {
  const row = await dbGet('SELECT 1 AS ok');
  return Boolean(row && row.ok === 1);
};

const closeDatabase = () => closeOn(db).then(() => {
  logger.info('SQLite 数据库连接已关闭');
});

module.exports = {
  db,
  initDatabase,
  dbQuery,
  dbRun,
  dbGet,
  dbExec,
  withTransaction,
  checkDatabase,
  closeDatabase,
  DB_PATH
};
