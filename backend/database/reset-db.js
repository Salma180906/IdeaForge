const db = require('../config/db');

async function resetDb() {
  console.log('Resetting IdeaForge database records to a clean state (keeping all table schemas intact)...\n');
  try {
    await db.query('SET FOREIGN_KEY_CHECKS = 0');

    const tables = [
      'bookmarks',
      'idea_milestones',
      'notifications',
      'otp_codes',
      'security_events',
      'votes',
      'follows',
      'comments',
      'idea_versions',
      'ideas',
      'users',
    ];

    for (const table of tables) {
      try {
        await db.query(`TRUNCATE TABLE \`${table}\``);
        console.log(`✓ Cleared table & reset ID counter: ${table}`);
      } catch (err) {
        try {
          await db.query(`DELETE FROM \`${table}\``);
          console.log(`✓ Emptied table: ${table}`);
        } catch (e) {
          console.log(`- Skipped ${table}: ${e.message}`);
        }
      }
    }

    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\nSuccess: All user accounts and records have been cleanly wiped! Table structures and app logic are 100% intact.');
    process.exit(0);
  } catch (err) {
    console.error('Error during database reset:', err.message);
    process.exit(1);
  }
}

resetDb();
