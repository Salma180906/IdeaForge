// Prints all stored records in the cloud MySQL database (users, ideas, versions, comments, security events).
// Run anytime from the backend folder:  npm run view-db
const db = require('../config/db');

(async () => {
  console.log('\n==============================================================');
  console.log('  IDEAFORGE CLOUD DATABASE RECORDS (Aiven MySQL: defaultdb)');
  console.log('==============================================================\n');

  const [users] = await db.query(
    'SELECT id, name, email, email_verified, has_password, google_id IS NOT NULL AS google, github_id IS NOT NULL AS github, created_at FROM users ORDER BY id ASC'
  );
  console.log(`--- 1. USERS (${users.length} stored accounts) ---`);
  console.table(users);

  const [ideas] = await db.query(
    'SELECT id, owner_id, title, category, stage, current_version, is_published, views, created_at FROM ideas ORDER BY id ASC'
  );
  console.log(`\n--- 2. IDEAS (${ideas.length} stored ideas) ---`);
  if (ideas.length) console.table(ideas);
  else console.log('(No user-created ideas in DB yet — Explore page uses frontend mock showcase data until you publish an idea)');

  const [versions] = await db.query(
    'SELECT id, idea_id, version_no, title, change_summary, created_by, created_at FROM idea_versions ORDER BY id ASC'
  );
  console.log(`\n--- 3. IDEA VERSIONS (${versions.length} stored versions) ---`);
  if (versions.length) console.table(versions);

  const [comments] = await db.query(
    'SELECT id, idea_id, user_id, type, status, LEFT(content, 50) AS preview, created_at FROM comments ORDER BY id ASC'
  );
  console.log(`\n--- 4. COMMENTS & SUGGESTIONS (${comments.length} stored) ---`);
  if (comments.length) console.table(comments);

  const [events] = await db.query(
    'SELECT id, user_id, type, ip, created_at FROM security_events ORDER BY id DESC LIMIT 15'
  );
  console.log(`\n--- 5. LATEST SECURITY & LOGIN EVENTS (Last ${events.length}) ---`);
  if (events.length) console.table(events);

  process.exit(0);
})().catch((err) => {
  console.error('Database query error:', err.message);
  process.exit(1);
});
