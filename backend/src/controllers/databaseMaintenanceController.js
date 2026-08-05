const { createDatabaseBackup, getMigrationStatus, dbQuery } = require('../database/db');
const { success, error } = require('../utils/response');

const createBackup = async (_req, res) => {
  try {
    const backup = await createDatabaseBackup({ reason: 'admin_manual' });
    return success(res, {
      filename: backup.filename,
      sha256: backup.sha256,
      sizeBytes: backup.sizeBytes,
      downloadUrl: `/api/database-backups/${encodeURIComponent(backup.filename)}`,
      foreignKeyIssueCount: backup.foreignKeyIssues.length
    }, '数据库备份已创建；在线清空操作已取消');
  } catch (err) {
    console.error('创建数据库备份失败:', err);
    return error(res, '创建数据库备份失败', 500);
  }
};

const listBackups = async (_req, res) => {
  try {
    const rows = await dbQuery(`
      SELECT filename, reason, sha256, size_bytes AS sizeBytes,
             created_at AS createdAt
        FROM database_backups
       ORDER BY created_at DESC, id DESC
       LIMIT 100
    `);
    return success(res, rows.map((row) => ({
      ...row,
      downloadUrl: `/api/database-backups/${encodeURIComponent(row.filename)}`
    })));
  } catch (err) {
    console.error('获取数据库备份列表失败:', err);
    return error(res, '获取数据库备份列表失败', 500);
  }
};

const migrationStatus = async (_req, res) => {
  try {
    return success(res, await getMigrationStatus());
  } catch (err) {
    console.error('获取数据库迁移状态失败:', err);
    return error(res, '获取数据库迁移状态失败', 500);
  }
};

const rejectOnlineRestore = (_req, res) => error(
  res,
  '为防止数据库损坏，在线恢复已停用。请停止后端容器后使用 npm run db:restore 执行校验恢复。',
  409
);

module.exports = {
  createBackup,
  listBackups,
  migrationStatus,
  rejectOnlineRestore
};
