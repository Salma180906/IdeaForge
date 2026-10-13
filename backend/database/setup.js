// Creates all tables in the database named in your .env file.
// Works on your own computer and on cloud databases such as Aiven.
//   npm run setup-db
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const migrate = require('./migrate');

async function setup() {
  let sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Cloud databases already come with a database, so skip these two lines.
  sql = sql.replace(/CREATE DATABASE[^;]*;/i, '').replace(/USE\s+[^;]*;/i, '');
  const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
  for (const statement of statements) await db.query(statement);
  await migrate();
  const [tables] = await db.query('SHOW TABLES');
  console.log(`Done. ${tables.length} tables are ready in database "${process.env.DB_NAME}".`);
  process.exit(0);
}

setup().catch((err) => {
  console.error('Could not create tables:', err.message);
  process.exit(1);
});
