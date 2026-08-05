/**
 * SQLite configuration, migrations, backup, and Promise-compatible helpers.
 *
 * Node 24's built-in SQLite binding removes the node-sqlite3 native build
 * chain while preserving the asynchronous controller contract.
 */

const { DatabaseSync, backup } = require('node:sqlite');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const logger = require('../utils/logger');
const { migrations } = require('./migrations');

const DEFAULT_DB_PATH = path.join(__dirname, '../../data/lab_safety.db');
const DB_PATH = process.env.LAB_SAFETY_DB_PATH
  ? path.resolve(process.env.LAB_SAFETY_DB_PATH)
  : DEFAULT_DB_PATH;
const DB_DIR = path.dirname(DB_PATH);
const BACKUP_DIR = path.join(DB_DIR, 'backups');
const BACKUP_RETENTION = Math.min(
  50,
  Math.max(1, Number.parseInt(process.env.DB_BACKUP_RETENTION || '10', 10) || 10)
);

fs.mkdirSync(DB_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const createConnection = (databasePath = DB_PATH, options = {}) => {
  const connection = new DatabaseSync(databasePath, {
    timeout: 5000,
    enableForeignKeyConstraints: true,
    enableDoubleQuotedStringLiterals: false,
    allowExtension: false,
    readBigInts: false,
    returnArrays: false,
    ...options
  });
  connection.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
  return connection;
};

const db = createConnection();
logger.info('SQLite 数据库连接成功', { path: DB_PATH, driver: 'node:sqlite' });

const bind = (statement, method, params = []) => {
  const values = Array.isArray(params) ? params : [params];
  return statement[method](...values);
};

const toPlainRow = (row) => {
  if (!row || typeof row !== 'object') return row;
  return Object.fromEntries(Object.entries(row));
};

const normalizeRunResult = (result) => ({
  lastID: Number(result.lastInsertRowid || 0),
  changes: Number(result.changes || 0)
});

const queryOn = async (connection, sql, params = []) => (
  bind(connection.prepare(sql), 'all', params).map(toPlainRow)
);

const getOn = async (connection, sql, params = []) => (
  toPlainRow(bind(connection.prepare(sql), 'get', params))
);

const runOn = async (connection, sql, params = []) => (
  normalizeRunResult(bind(connection.prepare(sql), 'run', params))
);

const execOn = async (connection, sql) => {
  connection.exec(sql);
};

const tableExistsOn = async (connection, tableName) => {
  const row = await getOn(
    connection,
    "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName]
  );
  return Boolean(row && row.present === 1);
};

const withConnectionTransaction = async (
  connection,
  callback,
  { mode = 'IMMEDIATE' } = {}
) => {
  const normalizedMode = String(mode).toUpperCase();
  if (!['DEFERRED', 'IMMEDIATE', 'EXCLUSIVE'].includes(normalizedMode)) {
    throw new Error('不支持的事务模式');
  }

  const tx = {
    query: (sql, params = []) => queryOn(connection, sql, params),
    get: (sql, params = []) => getOn(connection, sql, params),
    run: (sql, params = []) => runOn(connection, sql, params),
    exec: (sql) => execOn(connection, sql)
  };

  connection.exec(`BEGIN ${normalizedMode} TRANSACTION`);
  try {
    const result = await callback(tx);
    connection.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      if (connection.isTransaction) connection.exec('ROLLBACK');
    } catch (_) {
      // Preserve the original error.
    }
    throw err;
  }
};

const sha256File = async (filePath) => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  stream.on('error', reject);
  stream.on('data', (chunk) => hash.update(chunk));
  stream.on('end', () => resolve(hash.digest('hex')));
});

const compactTimestamp = () => new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, 'Z');

const safeReason = (reason) => String(reason || 'manual')
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 40) || 'manual';

const verifyDatabaseFile = async (filePath) => {
  const resolved = path.resolve(filePath);
  const stat = await fs.promises.stat(resolved);
  if (!stat.isFile() || stat.size < 100) {
    throw new Error('数据库文件为空或无效');
  }

  const verificationDb = createConnection(resolved, { readOnly: true });
  try {
    const quickCheckRows = bind(verificationDb.prepare('PRAGMA quick_check'), 'all', []);
    const quickCheck = quickCheckRows.map((row) => Object.values(row)[0]);
    if (quickCheck.length !== 1 || quickCheck[0] !== 'ok') {
      throw new Error(`SQLite quick_check 失败：${quickCheck.join('; ')}`);
    }

    const foreignKeyIssues = bind(
      verificationDb.prepare('PRAGMA foreign_key_check'),
      'all',
      []
    ).map(toPlainRow);
    return {
      valid: true,
      sizeBytes: stat.size,
      foreignKeyIssues
    };
  } finally {
    verificationDb.close();
  }
};

const pruneBackups = async () => {
  const entries = await fs.promises.readdir(BACKUP_DIR, { withFileTypes: true });
  const backups = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.db')) continue;
    const filePath = path.join(BACKUP_DIR, entry.name);
    const stat = await fs.promises.stat(filePath);
    backups.push({ filePath, name: entry.name, mtimeMs: stat.mtimeMs });
  }

  backups.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const oldBackup of backups.slice(BACKUP_RETENTION)) {
    await fs.promises.rm(oldBackup.filePath, { force: true });
    await fs.promises.rm(`${oldBackup.filePath}.sha256`, { force: true });
  }
};

const createDatabaseBackup = async ({ reason = 'manual' } = {}) => {
  const reasonSlug = safeReason(reason);
  const temporaryPath = path.join(
    BACKUP_DIR,
    `.lab_safety_${reasonSlug}_${compactTimestamp()}_${crypto.randomBytes(4).toString('hex')}.tmp`
  );

  await backup(db, temporaryPath, { rate: 100 });
  const verification = await verifyDatabaseFile(temporaryPath);
  const sha256 = await sha256File(temporaryPath);
  const filename = `lab_safety_${reasonSlug}_${compactTimestamp()}_${sha256.slice(0, 8)}.db`;
  const finalPath = path.join(BACKUP_DIR, filename);

  await fs.promises.rename(temporaryPath, finalPath);
  await fs.promises.writeFile(
    `${finalPath}.sha256`,
    `${sha256}  ${filename}\n`,
    { mode: 0o600 }
  );
  await fs.promises.chmod(finalPath, 0o600);

  if (await tableExistsOn(db, 'database_backups')) {
    await runOn(
      db,
      `INSERT OR REPLACE INTO database_backups
        (filename, reason, sha256, size_bytes)
       VALUES (?, ?, ?, ?)`,
      [filename, reasonSlug, sha256, verification.sizeBytes]
    );
  }

  await pruneBackups();
  logger.info('数据库备份创建完成', {
    filename,
    reason: reasonSlug,
    sizeBytes: verification.sizeBytes,
    foreignKeyIssueCount: verification.foreignKeyIssues.length
  });

  return {
    filename,
    path: finalPath,
    sha256,
    sizeBytes: verification.sizeBytes,
    foreignKeyIssues: verification.foreignKeyIssues
  };
};

const getMigrationStatus = async () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const appliedRows = await queryOn(
    db,
    'SELECT version, name, applied_at AS appliedAt FROM schema_migrations ORDER BY version'
  );
  const appliedVersions = new Set(appliedRows.map((row) => Number(row.version)));
  const pending = migrations
    .filter((migration) => !appliedVersions.has(migration.version))
    .map(({ version, name }) => ({ version, name }));
  return { applied: appliedRows, pending };
};

const hasApplicationTables = async () => {
  const row = await getOn(
    db,
    `SELECT COUNT(*) AS count
       FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND name <> 'schema_migrations'`
  );
  return Number(row.count || 0) > 0;
};

const runMigrations = async ({ backupBefore = true } = {}) => {
  const status = await getMigrationStatus();
  if (!status.pending.length) return status;

  if (backupBefore && await hasApplicationTables()) {
    await createDatabaseBackup({ reason: 'pre_migration' });
  }

  for (const pendingMigration of status.pending) {
    const migration = migrations.find((item) => item.version === pendingMigration.version);
    if (!migration) throw new Error(`找不到迁移版本 ${pendingMigration.version}`);

    await withConnectionTransaction(db, async (tx) => {
      await migration.up(tx);
      await tx.run(
        'INSERT INTO schema_migrations(version, name) VALUES (?, ?)',
        [migration.version, migration.name]
      );
    }, { mode: 'EXCLUSIVE' });

    logger.info('数据库迁移完成', {
      version: migration.version,
      name: migration.name
    });
  }

  return getMigrationStatus();
};

const initDatabase = async () => {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
  `);

  await runMigrations({ backupBefore: process.env.NODE_ENV !== 'test' });

  const foreignKeyIssues = await queryOn(db, 'PRAGMA foreign_key_check');
  if (foreignKeyIssues.length) {
    logger.warn('数据库存在历史外键不一致数据', {
      issueCount: foreignKeyIssues.length,
      sample: foreignKeyIssues.slice(0, 10)
    });
  }

  logger.info('数据库迁移与初始化完成', { path: DB_PATH });
};

const dbQuery = (sql, params = []) => queryOn(db, sql, params);
const dbRun = (sql, params = []) => runOn(db, sql, params);
const dbGet = (sql, params = []) => getOn(db, sql, params);
const dbExec = (sql) => execOn(db, sql);

const withTransaction = async (callback, options = {}) => {
  const connection = createConnection();
  try {
    return await withConnectionTransaction(connection, callback, options);
  } finally {
    connection.close();
  }
};

const checkDatabase = async () => {
  const row = await dbGet('SELECT 1 AS ok');
  return Boolean(row && row.ok === 1);
};

const closeDatabase = async () => {
  if (db.isOpen) db.close();
  logger.info('SQLite 数据库连接已关闭');
};

module.exports = {
  db,
  initDatabase,
  runMigrations,
  getMigrationStatus,
  createDatabaseBackup,
  verifyDatabaseFile,
  dbQuery,
  dbRun,
  dbGet,
  dbExec,
  withTransaction,
  checkDatabase,
  closeDatabase,
  DB_PATH,
  BACKUP_DIR,
  toPlainRow
};
