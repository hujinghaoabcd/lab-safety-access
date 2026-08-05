const { DatabaseSync, backup } = require('node:sqlite');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_DB_PATH = path.join(__dirname, '../../data/lab_safety.db');
const DB_PATH = process.env.LAB_SAFETY_DB_PATH
  ? path.resolve(process.env.LAB_SAFETY_DB_PATH)
  : DEFAULT_DB_PATH;
const DB_DIR = path.dirname(DB_PATH);
const BACKUP_DIR = path.join(DB_DIR, 'backups');

const verify = (filePath) => {
  const resolved = path.resolve(filePath);
  const stat = fs.statSync(resolved);
  if (!stat.isFile() || stat.size < 100) throw new Error('数据库文件为空或无效');

  const connection = new DatabaseSync(resolved, {
    readOnly: true,
    timeout: 5000,
    enableForeignKeyConstraints: true,
    enableDoubleQuotedStringLiterals: false,
    allowExtension: false
  });
  try {
    const quick = connection.prepare('PRAGMA quick_check').all()
      .map((row) => Object.values(row)[0]);
    if (quick.length !== 1 || quick[0] !== 'ok') {
      throw new Error(`SQLite quick_check 失败：${quick.join('; ')}`);
    }
    const foreignKeyIssues = connection.prepare('PRAGMA foreign_key_check').all();
    if (foreignKeyIssues.length) {
      throw new Error(`数据库存在 ${foreignKeyIssues.length} 条外键错误，拒绝恢复`);
    }
    return { sizeBytes: stat.size };
  } finally {
    connection.close();
  }
};

const compactTimestamp = () => new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, 'Z');

const restoreDatabaseOffline = async (sourcePath) => {
  if (process.env.CONFIRM_OFFLINE_RESTORE !== 'YES') {
    throw new Error('恢复前必须停止后端服务，并设置 CONFIRM_OFFLINE_RESTORE=YES');
  }

  const source = path.resolve(sourcePath || '');
  if (!source || source === DB_PATH) throw new Error('必须提供独立的数据库备份文件');
  verify(source);

  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const lockPath = path.join(DB_DIR, '.offline-restore.lock');
  const lockFd = fs.openSync(lockPath, 'wx', 0o600);

  try {
    if (fs.existsSync(DB_PATH)) {
      const current = new DatabaseSync(DB_PATH, {
        timeout: 5000,
        enableForeignKeyConstraints: true,
        enableDoubleQuotedStringLiterals: false,
        allowExtension: false
      });
      const backupName = `lab_safety_pre_restore_${compactTimestamp()}_${crypto.randomBytes(4).toString('hex')}.db`;
      try {
        await backup(current, path.join(BACKUP_DIR, backupName));
      } finally {
        current.close();
      }
    }

    const temporary = path.join(
      DB_DIR,
      `.restore-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`
    );
    fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(temporary, 0o600);
    verify(temporary);

    fs.rmSync(`${DB_PATH}-wal`, { force: true });
    fs.rmSync(`${DB_PATH}-shm`, { force: true });
    fs.renameSync(temporary, DB_PATH);
    verify(DB_PATH);

    return { restoredPath: DB_PATH };
  } finally {
    fs.closeSync(lockFd);
    fs.rmSync(lockPath, { force: true });
  }
};

module.exports = {
  restoreDatabaseOffline,
  verify
};
