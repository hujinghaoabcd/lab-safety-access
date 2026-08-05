const { initDatabase, closeDatabase } = require('./db');

// 初始化数据库
initDatabase()
  .then(() => {
    console.log('✅ 数据库初始化完成');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ 数据库初始化失败:', err);
    process.exit(1);
  });

