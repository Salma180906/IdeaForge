// Fills the database with demo users, ideas, versions and comments.
// Run once after creating the tables:  npm run seed
const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function seed() {
  await require('./migrate')();
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['otp_codes', 'security_events', 'notifications', 'follows', 'votes', 'comments', 'idea_versions', 'ideas', 'users']) {
    await db.query(`TRUNCATE TABLE ${t}`);
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1');

  const hash = await bcrypt.hash('password123', 10);
  const users = [
    ['Salma', 'salma@ideaforge.com', 'Full-stack learner who loves building collaborative products.', 'React, Node.js, MySQL', 'EdTech, AI, Social Impact'],
    ['Arjun Mehta', 'arjun@ideaforge.com', 'Product-minded developer working on sustainability tech.', 'Python, Data, UI Design', 'Sustainability, Business'],
    ['Priya Nair', 'priya@ideaforge.com', 'Final-year student interested in healthcare and accessibility.', 'Figma, React, Research', 'Healthcare, Education'],
    ['Karthik R', 'karthik@ideaforge.com', 'Backend engineer who enjoys logistics and marketplace problems.', 'Java, Node.js, SQL', 'Business, Productivity'],
  ];
  for (const u of users) {
    await db.query('INSERT INTO users (name, email, password_hash, bio, skills, interests) VALUES (?,?,?,?,?,?)',
      [u[0], u[1], hash, u[2], u[3], u[4]]);
  }
  // user ids: 1 Salma, 2 Arjun, 3 Priya, 4 Karthik

  // Each idea: owner, title, description, category, tags, stage, fields, versions[]
  const ideas = [
    {
      owner: 1, title: 'Smart Campus Resource Sharing', category: 'Education',
      tags: 'campus,sharing,students', desc: 'A platform where students lend and borrow lab equipment, books and study spaces inside a campus.',
      problem: 'Students buy expensive equipment they use once, while the same items sit idle with others.',
      solutionParts: ["A campus-only marketplace where students lend and borrow lab equipment, books and study spaces.", "Borrowers book fixed time slots so two students never collide on the same item.", "A trust score based on on-time returns decides how many items a student can hold at once."],
      target: 'Undergraduate and postgraduate students, department labs, and student clubs.',
      impact: 'Reduces student spending and makes better use of existing campus resources.',
      versions: [
        [1, 1, 'Initial concept'],
        [2, 3, 'Added time-slot booking so two students never collide on the same item'],
        [3, 1, 'Added a trust score based on on-time returns'],
      ],
    },
    {
      owner: 2, title: 'Waste-to-Value Marketplace', category: 'Sustainability',
      tags: 'waste,recycling,marketplace', desc: 'Small businesses list leftover material so other makers can buy it as raw input.',
      problem: 'Workshops and restaurants throw away material that other small businesses could use.',
      solutionParts: ["A listing platform with photo upload and weight-based pricing for leftover material.", "Buyers schedule a pickup window with the seller so nobody needs their own vehicle."],
      target: 'Small manufacturers, cafes, artisans and recycling groups.',
      impact: 'Cuts landfill waste and gives small businesses a second income source.',
      versions: [
        [1, 2, 'Initial concept'],
        [2, 4, 'Added pickup scheduling after logistics feedback'],
      ],
    },
    {
      owner: 3, title: 'AI-Based Skill Gap Navigator', category: 'Education',
      tags: 'ai,careers,learning', desc: 'Compares a student\'s skills with real job descriptions and builds a learning path.',
      problem: 'Students do not know which specific skills separate them from the roles they want.',
      solutionParts: ["Paste a target job description and get a report of the skills you are missing.", "Upload a resume first so the report starts from your real skills.", "Each missing skill links to a free course or practice resource.", "A weekly check-in tracker turns the report into a week-by-week learning plan."],
      target: 'Final-year students and early-career job seekers.',
      impact: 'Helps students spend study time on skills that employers actually ask for.',
      versions: [
        [1, 3, 'Initial concept'],
        [2, 1, 'Added a resume upload step so the gap report starts from real data'],
        [3, 2, 'Added free-resource recommendations for each missing skill'],
        [4, 3, 'Added a progress tracker with weekly check-ins'],
      ],
    },
    {
      owner: 4, title: 'Community Tool Library', category: 'Social Impact',
      tags: 'community,tools,sharing', desc: 'Neighbourhood library where people borrow tools like drills and ladders instead of buying them.',
      problem: 'Most households own tools they use only a few times a year.',
      solutionParts: ["A local catalogue with borrow requests, deposits and a volunteer-run pickup point."],
      target: 'Apartment communities and neighbourhood associations.',
      impact: 'Saves money and builds stronger local communities.',
      versions: [[1, 4, 'Initial concept']],
    },
    {
      owner: 1, title: 'Local Problem Solver', category: 'Social Impact',
      tags: 'civic,community,reporting', desc: 'Residents report local issues and nearby volunteers or skilled people offer to fix them.',
      problem: 'Small local problems like broken streetlights or blocked drains have no fast, visible route to being solved.',
      solutionParts: ["A map-based board where residents report issues and nearby volunteers claim them.", "An issue can only be closed after the fixer uploads a photo as proof."],
      target: 'Residents, ward volunteers and local councils.',
      impact: 'Faster fixes and more visible civic participation.',
      versions: [[1, 1, 'Initial concept'], [2, 2, 'Added photo proof before an issue can be marked closed']],
    },
  ];

  for (const i of ideas) {
    const cur = i.versions[i.versions.length - 1][0];
    const stages = ['concept', 'exploring', 'refining', 'prototype', 'evolved'];
    const [r] = await db.query(
      `INSERT INTO ideas (owner_id, title, description, category, tags, problem, solution, target_users, impact,
       stage, current_version, is_published, views) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?)`,
      [i.owner, i.title, i.desc, i.category, i.tags, i.problem, i.solutionParts.join(' '), i.target, i.impact,
       stages[Math.min(cur - 1, 4)], cur, 40 + cur * 25]);
    for (const [no, by, summary] of i.versions) {
      await db.query(
        `INSERT INTO idea_versions (idea_id, version_no, title, description, problem, solution, target_users, impact, change_summary, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [r.insertId, no, i.title, i.desc, i.problem, i.solutionParts.slice(0, no).join(' '), i.target, i.impact, summary, by]);
    }
  }

  // Comments and suggestions (idea ids are 1..5 in insertion order)
  const comments = [
    [1, 2, 'suggestion', 'Add time-slot booking so two students never collide on the same item.', 'accepted'],
    [1, 4, 'comment', 'Have you thought about damaged equipment? A small deposit might solve it.', 'none'],
    [1, 3, 'suggestion', 'Show item photos taken at return time so condition disputes are easy to settle.', 'pending'],
    [2, 4, 'suggestion', 'Pickup scheduling would make this workable for small businesses without vehicles.', 'accepted'],
    [3, 1, 'suggestion', 'Let users upload a resume so the gap report starts from real data.', 'accepted'],
    [3, 4, 'comment', 'The weekly plan is the strongest part. Keep it short and specific.', 'none'],
    [4, 2, 'comment', 'Insurance for power tools could be a blocker. Worth checking with a local association.', 'none'],
    [5, 3, 'suggestion', 'Require a photo before an issue can be closed to avoid fake closures.', 'accepted'],
  ];
  for (const c of comments) {
    await db.query('INSERT INTO comments (idea_id, user_id, type, content, status) VALUES (?,?,?,?,?)', c);
  }

  // Votes and follows
  const votes = [[2,1],[3,1],[4,1],[1,2],[3,2],[1,3],[2,3],[4,3],[1,4],[3,4],[2,5],[1,5],[4,5]];
  for (const v of votes) await db.query('INSERT INTO votes (user_id, idea_id) VALUES (?,?)', v);
  const follows = [[1,3],[1,2],[2,1],[3,1],[4,3]];
  for (const f of follows) await db.query('INSERT INTO follows (user_id, idea_id) VALUES (?,?)', f);

  // A few notifications for Salma (user 1)
  const notes = [
    [1, 1, 'Arjun Mehta suggested an improvement to "Smart Campus Resource Sharing"'],
    [1, 1, 'Priya Nair suggested an improvement to "Smart Campus Resource Sharing"'],
    [1, 3, '"AI-Based Skill Gap Navigator" evolved to Version 4'],
    [1, 1, 'Karthik R voted for "Smart Campus Resource Sharing"'],
  ];
  for (const n of notes) await db.query('INSERT INTO notifications (user_id, idea_id, message) VALUES (?,?,?)', n);

  console.log('Seed complete. Login with salma@ideaforge.com / password123');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
