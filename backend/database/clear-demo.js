// Removes the demo accounts from `npm run seed` and everything they created.
// Real accounts are never touched. Run it once on your live database:
//   npm run clear-demo
const db = require('../config/db');

const DEMO = ['salma@ideaforge.com', 'arjun@ideaforge.com', 'priya@ideaforge.com', 'karthik@ideaforge.com'];

(async () => {
  const [found] = await db.query('SELECT id, email FROM users WHERE email IN (?)', [DEMO]);
  if (!found.length) { console.log('No demo accounts found. Nothing to remove.'); process.exit(0); }
  const ids = found.map((u) => u.id);
  const [[ideas]] = await db.query('SELECT COUNT(*) AS n FROM ideas WHERE owner_id IN (?)', [ids]);
  await db.query('DELETE FROM users WHERE id IN (?)', [ids]); // ideas, versions, comments, votes... go with them
  console.log(`Removed ${found.length} demo accounts (${found.map((u) => u.email).join(', ')}) and ${ideas.n} demo ideas.`);
  process.exit(0);
})().catch((e) => { console.error('Could not remove demo data:', e.message); process.exit(1); });
