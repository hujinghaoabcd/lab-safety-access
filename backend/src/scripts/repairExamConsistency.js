const {
  initDatabase,
  dbRun,
  dbQuery,
  closeDatabase
} = require('../database/db');

const main = async () => {
  await initDatabase();

  const orphanedBefore = await dbQuery(
    `SELECT c.id, c.certificate_no AS certificateNo,
            c.user_id AS userId, c.exam_id AS examId
       FROM certificates c
      WHERE c.status = 1
        AND NOT EXISTS (
          SELECT 1
            FROM exam_records er
           WHERE er.user_id = c.user_id
             AND er.exam_id = c.exam_id
             AND er.status = '通过'
        )
      ORDER BY c.id`
  );

  const revoked = await dbRun(
    `UPDATE certificates
        SET status = 0
      WHERE status = 1
        AND NOT EXISTS (
          SELECT 1
            FROM exam_records er
           WHERE er.user_id = certificates.user_id
             AND er.exam_id = certificates.exam_id
             AND er.status = '通过'
        )`
  );

  await dbRun(`
    UPDATE exams
       SET question_count = (
         SELECT COUNT(*)
           FROM exam_questions eq
          WHERE eq.exam_id = exams.id
       ),
           updated_at = CURRENT_TIMESTAMP
  `);

  const examCounts = await dbQuery(
    `SELECT e.id, e.name,
            e.question_count AS questionCount,
            (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) AS mappedCount
       FROM exams e
      ORDER BY e.id`
  );

  console.log('=== Exam consistency repair ===');
  console.log(`Revoked orphan certificates: ${Number(revoked.changes || 0)}`);
  if (orphanedBefore.length) console.table(orphanedBefore);
  console.log('Exam question counts:');
  console.table(examCounts);
  console.log('Repair complete.');
};

main()
  .catch((err) => {
    console.error('[repair failed]', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeDatabase();
    } catch (_) {}
  });
