const ensureColumn = async (tx, table, column, definition) => {
  const columns = await tx.query(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    await tx.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

const migrations = [
  {
    version: 1,
    name: 'baseline_schema',
    up: async (tx) => {
      await tx.exec(`
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
    }
  },
  {
    version: 2,
    name: 'compatibility_columns_and_indexes',
    up: async (tx) => {
      await ensureColumn(tx, 'users', 'avatar', 'TEXT');
      await ensureColumn(tx, 'learning_progress', 'study_duration', 'INTEGER DEFAULT 0');
      await ensureColumn(tx, 'exams', 'category', 'TEXT');

      await tx.run(`
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

      await tx.exec(`
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
      `);
    }
  },
  {
    version: 3,
    name: 'maintenance_and_audit_metadata',
    up: async (tx) => {
      await tx.exec(`
        CREATE TABLE IF NOT EXISTS database_backups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT UNIQUE NOT NULL,
          reason TEXT NOT NULL,
          sha256 TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS operation_audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_type TEXT NOT NULL,
          actor_id TEXT,
          action TEXT NOT NULL,
          target_type TEXT,
          target_id TEXT,
          outcome TEXT NOT NULL,
          detail TEXT,
          ip TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_operation_audit_created
          ON operation_audit_logs(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_operation_audit_action
          ON operation_audit_logs(action, created_at DESC);
      `);
    }
  }
];

module.exports = {
  migrations,
  ensureColumn
};
