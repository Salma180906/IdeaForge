const db = require('../config/db');

const emailArg = process.argv[2];

if (!emailArg) {
  console.log('Usage: node database/delete-user.js <email>');
  console.log('Example: node database/delete-user.js mathinasalma@gmail.com');
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();

(async () => {
  const [users] = await db.query('SELECT id, name, email FROM users WHERE email = ?', [email]);
  if (!users.length) {
    console.log(`No user found with email: ${email}`);
    process.exit(0);
  }

  const user = users[0];
  await db.query('DELETE FROM users WHERE id = ?', [user.id]);
  console.log(`Successfully deleted user "${user.name}" (${user.email}) and all associated ideas/comments.`);
  process.exit(0);
})().catch((err) => {
  console.error('Error deleting user:', err.message);
  process.exit(1);
});
