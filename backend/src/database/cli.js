#!/usr/bin/env node

const path = require('node:path');

const main = async () => {
  const command = String(process.argv[2] || 'status').toLowerCase();

  if (command === 'restore') {
    const source = process.argv[3];
    if (!source) throw new Error('用法：npm run db:restore -- /path/to/backup.db');
    const { restoreDatabaseOffline } = require('./offlineRestore');
    const result = await restoreDatabaseOffline(source);
    console.log(`数据库已恢复：${result.restoredPath}`);
    return;
  }

  const {
    initDatabase,
    runMigrations,
    getMigrationStatus,
    createDatabaseBackup,
    verifyDatabaseFile,
    closeDatabase
  } = require('./db');

  try {
    if (command === 'status') {
      const status = await getMigrationStatus();
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    if (command === 'migrate') {
      const status = await runMigrations({ backupBefore: true });
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    if (command === 'backup') {
      await initDatabase();
      const result = await createDatabaseBackup({ reason: 'manual' });
      console.log(JSON.stringify({
        filename: result.filename,
        path: result.path,
        sha256: result.sha256,
        sizeBytes: result.sizeBytes
      }, null, 2));
      return;
    }

    if (command === 'verify') {
      const target = process.argv[3];
      if (!target) throw new Error('用法：npm run db:verify -- /path/to/database.db');
      const result = await verifyDatabaseFile(path.resolve(target));
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    throw new Error(`未知数据库命令：${command}`);
  } finally {
    await closeDatabase();
  }
};

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
