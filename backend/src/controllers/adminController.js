// Retired in phase 2.
//
// Administrator routes are split across focused controllers:
// dashboard, users, exams, questions, records, certificates, settings,
// organizations, database maintenance, and atomic destructive operations.
// Keeping this empty module temporarily avoids breaking external development
// imports while ensuring no hardcoded credentials, plaintext-password paths,
// deprecated XLSX code, unsafe restore logic, or callback-only SQLite code
// remains in the current source tree.

module.exports = Object.freeze({});
