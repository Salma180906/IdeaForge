// Adds security and feature tables and columns safely. Safe to run many times.
//   npm run migrate
const db = require('../config/db');

async function hasColumn(table, column) {
  const [r] = await db.query(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [table, column]
  );
  return r.length > 0;
}

async function hasIndex(table, indexName) {
  const [r] = await db.query(
    'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
    [table, indexName]
  );
  return r.length > 0;
}

async function migrate() {
  console.log('Running database migrations...');

  // 1. User security and profile columns
  const userColumns = [
    ['email_verified', 'TINYINT(1) NOT NULL DEFAULT 1'],
    ['two_factor', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['token_version', 'INT NOT NULL DEFAULT 0'],
    ['has_password', 'TINYINT(1) NOT NULL DEFAULT 1'],
    ['google_id', 'VARCHAR(64) NULL'],
    ['github_id', 'VARCHAR(64) NULL'],
    ['discord_id', 'VARCHAR(64) NULL'],
    ['totp_secret', 'VARCHAR(255) NULL'],
    ['totp_enabled', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['totp_last', 'BIGINT NOT NULL DEFAULT 0'],
    ['backup_codes', 'TEXT NULL'],
    ['avatar_url', 'VARCHAR(500) NULL'],
  ];

  for (const [name, def] of userColumns) {
    if (!(await hasColumn('users', name))) {
      await db.query(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
      console.log(`Added users.${name}`);
    }
  }

  for (const col of ['google_id', 'github_id', 'discord_id']) {
    if (!(await hasIndex('users', `uq_${col}`))) {
      await db.query(`ALTER TABLE users ADD UNIQUE INDEX uq_${col} (${col})`);
      console.log(`Added index uq_${col} on users`);
    }
  }

  // 2. Idea columns
  const ideaColumns = [
    ['is_archived', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ];

  for (const [name, def] of ideaColumns) {
    if (!(await hasColumn('ideas', name))) {
      await db.query(`ALTER TABLE ideas ADD COLUMN ${name} ${def}`);
      console.log(`Added ideas.${name}`);
    }
  }

  if (!(await hasIndex('ideas', 'idx_ideas_category'))) {
    await db.query('ALTER TABLE ideas ADD INDEX idx_ideas_category (category)');
  }
  if (!(await hasIndex('ideas', 'idx_ideas_published_updated'))) {
    await db.query('ALTER TABLE ideas ADD INDEX idx_ideas_published_updated (is_published, updated_at)');
  }

  // 3. Security tables
  await db.query(`CREATE TABLE IF NOT EXISTS otp_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_otp_user (user_id, purpose),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS security_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(40) NOT NULL,
    ip VARCHAR(64) DEFAULT '',
    agent VARCHAR(200) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_events_user (user_id, id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // 4. Idea Roadmaps / Milestones table
  await db.query(`CREATE TABLE IF NOT EXISTS idea_milestones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    idea_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    status ENUM('todo', 'in_progress', 'completed') DEFAULT 'todo',
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    due_date DATE NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_milestones_idea (idea_id),
    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // 5. Bookmarks table
  await db.query(`CREATE TABLE IF NOT EXISTS bookmarks (
    user_id INT NOT NULL,
    idea_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, idea_id),
    INDEX idx_bookmarks_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
  )`);

  console.log('Database migrations completed successfully.');
}

module.exports = migrate;
if (require.main === module) {
  migrate().then(() => process.exit(0)).catch((e) => {
    console.error('Migration failed:', e.message);
    process.exit(1);
  });
}
