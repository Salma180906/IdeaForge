const bcrypt = require('bcryptjs');
const db = require('../config/db');

const COMMUNITY_USERS = [
  { name: 'Aarav Kulkarni', email: 'aarav@ideaforge.org', bio: 'Hardware and robotics engineer at MIT Tech Club.', skills: 'Embedded, C++, PCB Design', interests: 'Hardware, IoT, Education' },
  { name: 'Meera Nair', email: 'meera@ideaforge.org', bio: 'Accessibility researcher and cognitive UI developer.', skills: 'React, Typography, UX Research', interests: 'Healthcare, Accessibility, EdTech' },
  { name: 'Rohan Verma', email: 'rohan@ideaforge.org', bio: 'Circular economy advocate & industrial recycling specialist.', skills: 'Supply Chain, Node.js, Logistics', interests: 'Sustainability, CleanTech' },
  { name: 'Divya Krishnan', email: 'divya@ideaforge.org', bio: 'Distributed systems & API resilience engineer.', skills: 'Go, TypeScript, Kafka', interests: 'Technology, Developer Tools' },
  { name: 'Siddharth Rao', email: 'siddharth@ideaforge.org', bio: 'Civic technologist focusing on transparent municipal governance.', skills: 'GIS, Python, React', interests: 'Social Impact, CivicTech' },
  { name: 'Kabir Sen', email: 'kabir@ideaforge.org', bio: 'Remote engineering manager exploring async workflow models.', skills: 'Product Strategy, React, GraphQL', interests: 'Productivity, Collaboration' },
  { name: 'Ananya Deshmukh', email: 'ananya@ideaforge.org', bio: 'Agricultural robotics & cold-chain supply chain engineer.', skills: 'Thermal Modeling, IoT, Python', interests: 'Sustainability, Agriculture' },
  { name: 'Vikramaditya Joshi', email: 'vikram@ideaforge.org', bio: 'Fintech compliance and automated escrow architect.', skills: 'Smart Contracts, Security, SQL', interests: 'Business, Fintech' },
];

const COMMUNITY_IDEAS = [
  {
    authorEmail: 'aarav@ideaforge.org',
    title: 'Smart Campus Hardware & Lab Kit Ledger',
    description: 'Peer-to-peer campus lending network for microcontrollers, oscilloscopes, and robotics kits with conflict-free slot booking and photo escrow.',
    category: 'Education',
    tags: 'campus,hardware,iot,students',
    stage: 'evolved',
    current_version: 5,
    views: 420,
    problem: 'Engineering students spend ₹8,000–₹15,000 per semester on specialized sensors, FPGA boards, and lab kits that sit idle in hostel drawers once a course project finishes.',
    solution: 'A verified campus-only equipment exchange with 48-hour slot reservations, QR locker handoffs, multi-angle return photo verification, and a department reputation score.',
    target_users: 'Undergraduate engineering students, robotics clubs, and university electronics labs.',
    impact: 'Cuts student hardware expenses by 72% across 3 pilot departments and triples utilization of existing lab inventory.',
    versions: [
      { version_no: 1, title: 'Campus Microcontroller Lending Board', description: 'A simple listing board where students post spare Arduino and Raspberry Pi kits.', problem: 'Students buy expensive boards they use for one semester.', solution: 'A shared directory where students list hardware.', target_users: 'Undergraduate students.', impact: 'Reduces duplicate hardware purchases.', change_summary: 'Initial concept' },
      { version_no: 2, title: 'Smart Campus Hardware & Lab Kit Ledger', description: 'Added conflict-free 48-hour reservation slots.', problem: 'Informal borrowing leads to scheduling collisions.', solution: 'A shared ledger with 48-hour calendar reservation windows.', target_users: 'Engineering students.', impact: 'Eliminates booking collisions.', change_summary: 'Added 48-hour reservation windows' },
      { version_no: 3, title: 'Smart Campus Hardware & Lab Kit Ledger', description: 'Integrated return condition photo escrow.', problem: 'Lenders worry about damaged pins and lost accessories.', solution: 'Mandatory check-in and return macro photo escrow.', target_users: 'Students and labs.', impact: 'Protects hardware owners.', change_summary: 'Added return photo escrow' },
      { version_no: 4, title: 'Smart Campus Hardware & Lab Kit Ledger', description: 'Added reputation staking and QR locker handoffs.', problem: 'Students miss each other between class breaks.', solution: 'Department QR smart lockers and trust staking score.', target_users: 'Faculty and student clubs.', impact: 'Streamlines handoffs.', change_summary: 'Added QR lockers and trust score' },
      { version_no: 5, title: 'Smart Campus Hardware & Lab Kit Ledger', description: 'Peer-to-peer campus lending network with slot booking and photo escrow.', problem: 'Unutilized equipment across faculties.', solution: 'Multi-department campus grid with inventory synchronization.', target_users: 'Undergraduates and lab technicians.', impact: 'Triples lab utilization.', change_summary: 'Multi-department expansion' },
    ],
  },
  {
    authorEmail: 'meera@ideaforge.org',
    title: 'NeuroRead: Adaptive Dyslexia & ADHD Study Companion',
    description: 'Dynamic typography rendering engine that modulates letter kerning, bionic saccade weighting, and paragraph line clamping in real-time based on reader focus telemetry.',
    category: 'Healthcare',
    tags: 'accessibility,neurodiversity,education,ai',
    stage: 'prototype',
    current_version: 4,
    views: 310,
    problem: 'Over 20% of STEM students navigate dyslexia or ADHD. Static PDFs cause severe visual crowding, phonological tracking fatigue, and 3x longer study sessions.',
    solution: 'A browser extension and web workspace that parses academic documents into variable font weight gradients with automated audio-sync read-along.',
    target_users: 'Neurodivergent students, educators, and academic institutions.',
    impact: 'Demonstrated 41% comprehension gain and 2.4x reading endurance across pilot university cohort.',
    versions: [
      { version_no: 1, title: 'Dyslexia Friendly PDF Reader', description: 'OpenDyslexic font reader for PDFs.', problem: 'Static text fatigue.', solution: 'Custom font replacement.', target_users: 'Students with dyslexia.', impact: 'Minor legibility boost.', change_summary: 'Initial concept' },
      { version_no: 2, title: 'Adaptive Contrast Reader', description: 'Added tint overlays and line guides.', problem: 'Visual tracking slips.', solution: 'Bionic reading saccade highlighting.', target_users: 'ADHD and dyslexic readers.', impact: 'Reduces visual drift.', change_summary: 'Added saccade guide' },
      { version_no: 3, title: 'NeuroRead Study Companion', description: 'Added focus telemetry and pacing audio.', problem: 'Students lose attention after 15 minutes.', solution: 'Micro-break prompts and audio-anchor.', target_users: 'STEM students.', impact: '35% comprehension lift.', change_summary: 'Added audio-anchor' },
      { version_no: 4, title: 'NeuroRead: Adaptive Dyslexia & ADHD Study Companion', description: 'Real-time eye-tracking calibration and automated academic document decomposition.', problem: 'Dense mathematical formulas break standard readers.', solution: 'LaTeX-aware token expansion and bionic gradient text.', target_users: 'University students and researchers.', impact: '41% comprehension gain.', change_summary: 'LaTeX token expansion' },
    ],
  },
  {
    authorEmail: 'rohan@ideaforge.org',
    title: 'CircularCraft: Micro-Factory Industrial Scrap Exchange',
    description: 'B2B reverse-logistics marketplace connecting small metal fabricators, timber mills, and acrylic workshops to artisan creators for offcut reclamation.',
    category: 'Sustainability',
    tags: 'sustainability,manufacturing,circular-economy',
    stage: 'refining',
    current_version: 3,
    views: 245,
    problem: 'Fabrication workshops produce 15–25% offcut scrap that is sold below raw material cost or dumped into landfills due to lack of local aggregation.',
    solution: 'Automated dimension logging via smartphone photos, aggregated micro-freight routes, and standardized grade certificates for architectural offcuts.',
    target_users: 'Precision laser cutting shops, custom furniture makers, design students, and craft studios.',
    impact: 'Diverts 4.2 tons of high-grade aluminum and walnut offcuts monthly while providing fabricators 3x higher scrap return.',
    versions: [
      { version_no: 1, title: 'Scrap Timber & Metal Board', description: 'Craigslist-style listing board for scrap materials.', problem: 'Workshops discard high-value scraps.', solution: 'Classifieds board for scrap buyers.', target_users: 'Local hobbyists.', impact: 'Prevents occasional landfilling.', change_summary: 'Initial concept' },
      { version_no: 2, title: 'CircularCraft Aggregator', description: 'Added smartphone photo dimension estimation.', problem: 'Buyers cannot verify offcut dimensions without visiting.', solution: 'ArUco marker camera dimension estimation.', target_users: 'Fabricators and makers.', impact: 'Cuts site inspection friction.', change_summary: 'Added photo dimensioning' },
      { version_no: 3, title: 'CircularCraft: Micro-Factory Industrial Scrap Exchange', description: 'Reverse-logistics aggregation and certified material grades.', problem: 'Transport costs exceed individual scrap batch values.', solution: 'Shared milk-run freight collection routes.', target_users: 'Production workshops and architects.', impact: '4.2 tons diverted monthly.', change_summary: 'Added route aggregation' },
    ],
  },
  {
    authorEmail: 'divya@ideaforge.org',
    title: 'ZeroDrift: API Contract & Schema Regression Sentinel',
    description: 'Autonomous microservice test harness that synthesizes realistic consumer payloads from Git PR diffs and detects breaking schema regressions before deployment.',
    category: 'Technology',
    tags: 'devops,api,testing,microservices',
    stage: 'prototype',
    current_version: 4,
    views: 520,
    problem: 'Fast-moving engineering teams break downstream consumers through subtle semantic field mutations, nullability drift, and enum deprecations that unit tests miss.',
    solution: 'Zero-config proxy and GitHub action that extracts OpenAPI contracts from live runtime traffic and runs automated fuzz tests against staging branches.',
    target_users: 'Backend platform teams, DevOps engineers, and distributed microservice architectures.',
    impact: 'Reduced production API regressions by 89% across 14 engineering squads.',
    versions: [
      { version_no: 1, title: 'OpenAPI Spec Checker', description: 'CLI linter that flags breaking OpenAPI changes.', problem: 'Developers push unversioned API changes.', solution: 'Git hook that compares OpenAPI YAML files.', target_users: 'Backend devs.', impact: 'Catches obvious schema breaks.', change_summary: 'Initial CLI linter' },
      { version_no: 2, title: 'ZeroDrift Traffic Analyzer', description: 'Captures runtime payloads to synthesize contracts.', problem: 'Handwritten OpenAPI specs drift from code reality.', solution: 'eBPF proxy that generates live contract specs.', target_users: 'Platform teams.', impact: 'Eliminates spec manual upkeep.', change_summary: 'Added runtime synthesis' },
      { version_no: 3, title: 'ZeroDrift CI Gatekeeper', description: 'Automated staging branch consumer simulation.', problem: 'PRs pass tests but break client services in staging.', solution: 'Synthetic shadow traffic playback against pull requests.', target_users: 'DevOps engineers.', impact: '75% fewer staging collisions.', change_summary: 'Shadow traffic playback' },
      { version_no: 4, title: 'ZeroDrift: API Contract & Schema Regression Sentinel', description: 'Production-ready consumer driven contract sentinel with automated schema migration safety audits.', problem: 'Silent nullability regressions and enum shifts.', solution: 'Automated client SDK mutation tests and backward compatibility score.', target_users: 'Microservice organizations.', impact: '89% regression reduction.', change_summary: 'SDK mutation tests' },
    ],
  },
  {
    authorEmail: 'siddharth@ideaforge.org',
    title: 'CivicPulse: Photo-Verified Ward Infrastructure Bounties',
    description: 'Civic accountability ledger allowing municipal residents to pool community micro-bounties for road repairs, streetlight fixes, and park maintenance with GPS photo proof.',
    category: 'Social Impact',
    tags: 'civic,infrastructure,community,governance',
    stage: 'refining',
    current_version: 3,
    views: 390,
    problem: 'Potholes, broken streetlights, and sanitation hazards linger for months because municipal complaint redressal portals lack public accountability and funding transparency.',
    solution: 'A map-first civic escrow platform where citizens upvote hazards, stake micro-pledges, and municipal contractors claim rewards with dual-timestamped proof.',
    target_users: 'Resident welfare associations, municipal contractors, and local ward councillors.',
    impact: 'Accelerated municipal pothole resolution time from 42 days to 72 hours across 2 pilot wards.',
    versions: [
      { version_no: 1, title: 'Pothole Tracker', description: 'Community map where citizens drop pins on road hazards.', problem: 'Potholes go unrecorded.', solution: 'Google Maps pin drop reporting.', target_users: 'Residents.', impact: 'Public awareness.', change_summary: 'Initial map board' },
      { version_no: 2, title: 'CivicPulse Ward Registry', description: 'Added ward councillor tags and resolution time tracking.', problem: 'Complaints are ignored with no SLA.', solution: 'Public ward leaderboards and automated escalation alerts.', target_users: 'Citizens and ward officials.', impact: 'Doubled response rate.', change_summary: 'Added ward leaderboards' },
      { version_no: 3, title: 'CivicPulse: Photo-Verified Ward Infrastructure Bounties', description: 'Community micro-escrow bounties with dual-timestamped photographic resolution verification.', problem: 'Contractor payment disputes and lack of verification.', solution: 'Geotagged before/after photo verification and automated contractor payout.', target_users: 'RWAs and verified contractors.', impact: 'Resolution in 72 hours.', change_summary: 'Added photographic escrow' },
    ],
  },
  {
    authorEmail: 'kabir@ideaforge.org',
    title: 'DeepWork OS: Async Context Handoff for Distributed Teams',
    description: 'Smart terminal & editor plugin that captures architectural decisions, branch state, and open research tabs into high-fidelity context handoff bundles for global teams.',
    category: 'Productivity',
    tags: 'productivity,remote-work,developer-tools',
    stage: 'exploring',
    current_version: 2,
    views: 280,
    problem: 'Global remote teams lose 45–90 minutes daily reconstructing mental context after timezone handoffs due to fragmented Slack pings, PR comments, and undocumented mental models.',
    solution: 'A 60-second end-of-day workflow that packages active diffs, local stack traces, open documentation bookmarks, and audio memos into an interactive sprint briefing.',
    target_users: 'Distributed engineering teams across overlapping timezones.',
    impact: 'Saved an average of 4.2 hours per engineer weekly during handoffs.',
    versions: [
      { version_no: 1, title: 'Daily Standup Snippet Tool', description: 'CLI tool to dump Git commit messages into markdown.', problem: 'Typing standups is tedious.', solution: 'Automated git log extraction.', target_users: 'Developers.', impact: 'Saves 5 minutes daily.', change_summary: 'Initial CLI' },
      { version_no: 2, title: 'DeepWork OS: Async Context Handoff for Distributed Teams', description: 'High-fidelity context bundles with terminal state, active tabs, and AI executive summaries.', problem: 'Timezone gap handoff friction.', solution: 'One-click bundle generation with AI audio briefing.', target_users: 'Distributed engineering teams.', impact: 'Saves 4.2 hours weekly.', change_summary: 'Added AI context bundling' },
    ],
  },
  {
    authorEmail: 'ananya@ideaforge.org',
    title: 'ColdChain Micro: Solar Phase-Change Crates for Smallholder Farmers',
    description: 'Passive evaporative phase-change storage pods powered by recycled solar thermal cells, preserving perishable fruit and dairy for 7 days without grid electricity.',
    category: 'Sustainability',
    tags: 'agriculture,solarpower,cleantech,hardware',
    stage: 'evolved',
    current_version: 5,
    views: 610,
    problem: 'Smallholder farmers lose 35–40% of fresh horticultural harvest to post-harvest heat degradation before reaching regional mandis due to lack of off-grid refrigeration.',
    solution: 'Modular insulated crates utilizing eco-friendly paraffin phase-change tiles recharged daily by lightweight 40W solar collectors, maintaining 6°C–10°C.',
    target_users: 'Smallholder farmer collectives, rural milk cooperatives, and organic agricultural exporters.',
    impact: 'Boosted smallholder net monthly income by 38% and reduced produce spoilage to under 4%.',
    versions: [
      { version_no: 1, title: 'Solar Clay Cooler', description: 'Earthen pot cooler for vegetables.', problem: 'Vegetables rot in hot weather.', solution: 'Evaporative clay container.', target_users: 'Rural households.', impact: '2 days extra shelf life.', change_summary: 'Initial clay design' },
      { version_no: 2, title: 'Insulated Battery Cooler', description: '12V lead-acid battery fan cooler.', problem: 'Batteries degrade rapidly in field conditions.', solution: 'Phase change material tiles.', target_users: 'Farmers.', impact: 'Eliminated batteries.', change_summary: 'Replaced batteries with PCM' },
      { version_no: 3, title: 'Solar Thermal Recharger', description: 'Direct solar recharging rack for thermal tiles.', problem: 'Regenerating PCM in remote fields.', solution: 'Reflective solar concentration tube.', target_users: 'Farming cooperatives.', impact: 'Zero electricity requirement.', change_summary: 'Added solar thermal rack' },
      { version_no: 4, title: 'IoT ColdChain Sensor Pod', description: 'Added Bluetooth temperature logger and expiry predictor.', problem: 'Buyers dispute whether crate broke cold-chain.', solution: 'Tamper-proof temperature log certificate.', target_users: 'Agricultural exporters.', impact: 'Enables premium pricing.', change_summary: 'Added Bluetooth logger' },
      { version_no: 5, title: 'ColdChain Micro: Solar Phase-Change Crates for Smallholder Farmers', description: 'Modular 25kg interlocking crates with solar phase-change tiles and certified provenance telemetry.', problem: 'Transportation vibration damage and heat leakage.', solution: 'Shock-isolated food-grade rotational molded HDPE crates with 7-day thermal autonomy.', target_users: 'Farmer Producer Organizations (FPOs).', impact: 'Spoilage reduced from 38% to 3.8%.', change_summary: 'Industrial production prototype' },
    ],
  },
  {
    authorEmail: 'vikram@ideaforge.org',
    title: 'InvoiceShield: Instant MSME Escrow & Milestone Factoring',
    description: 'Decentralized milestone factoring platform enabling micro-enterprises to receive 80% immediate invoice financing upon cryptographically signed client delivery receipts.',
    category: 'Business',
    tags: 'fintech,escrow,msme,business,cashflow',
    stage: 'concept',
    current_version: 1,
    views: 185,
    problem: 'MSMEs suffer from 90–120 day corporate payment cycles, forcing viable small vendors into predatory working-capital debt or operational shutdowns.',
    solution: 'Smart contract escrow linked to digital e-way bills and buyer cryptographic signatures, unlocking competitive liquidity from accredited non-bank lenders.',
    target_users: 'MSME vendors, freelance development studios, and non-bank institutional liquidity providers.',
    impact: 'Shortens effective cash realization cycle from 92 days to under 6 hours.',
    versions: [
      { version_no: 1, title: 'InvoiceShield: Instant MSME Escrow & Milestone Factoring', description: 'Cryptographic milestone escrow and instant invoice financing protocol.', problem: '90-day delayed payment cycles cripple micro-enterprises.', solution: 'E-way bill verified escrow with immediate 80% liquidity disbursement.', target_users: 'MSMEs and corporate buyers.', impact: 'Unlocks working capital in 6 hours.', change_summary: 'Initial concept thesis' },
    ],
  },
];

async function run() {
  console.log('--- Seeding Community Ideas into Database ---');
  const dummyHash = await bcrypt.hash('IdeaForge@123', 10);

  // 1. Ensure users exist
  const emailToId = {};
  for (const u of COMMUNITY_USERS) {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [u.email]);
    if (existing.length > 0) {
      emailToId[u.email] = existing[0].id;
    } else {
      const [ins] = await db.query(
        'INSERT INTO users (name, email, password_hash, bio, skills, interests, email_verified) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [u.name, u.email, dummyHash, u.bio, u.skills, u.interests]
      );
      emailToId[u.email] = ins.insertId;
      console.log(`Created community author: ${u.name} (id: ${ins.insertId})`);
    }
  }

  // 2. Ensure ideas exist
  for (const idea of COMMUNITY_IDEAS) {
    const ownerId = emailToId[idea.authorEmail];
    if (!ownerId) continue;

    const [existingIdea] = await db.query('SELECT id FROM ideas WHERE title = ?', [idea.title]);
    if (existingIdea.length > 0) {
      console.log(`Idea already in DB: "${idea.title}" (id: ${existingIdea[0].id})`);
      continue;
    }

    const [r] = await db.query(
      `INSERT INTO ideas (owner_id, title, description, category, tags, problem, solution, target_users, impact, stage, current_version, is_published, views)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        ownerId,
        idea.title,
        idea.description,
        idea.category,
        idea.tags,
        idea.problem,
        idea.solution,
        idea.target_users,
        idea.impact,
        idea.stage,
        idea.current_version,
        idea.views,
      ]
    );

    const ideaId = r.insertId;
    console.log(`Created Idea: "${idea.title}" -> id: ${ideaId}`);

    // Insert versions
    for (const v of idea.versions) {
      await db.query(
        `INSERT INTO idea_versions (idea_id, version_no, title, description, problem, solution, target_users, impact, change_summary, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ideaId,
          v.version_no,
          v.title,
          v.description,
          v.problem,
          v.solution,
          v.target_users,
          v.impact,
          v.change_summary,
          ownerId,
        ]
      );
    }

    // Add 2-3 initial votes from other community members
    const voterEmails = Object.keys(emailToId).filter((e) => e !== idea.authorEmail).slice(0, 3);
    for (const vEmail of voterEmails) {
      const vId = emailToId[vEmail];
      await db.query('INSERT IGNORE INTO votes (user_id, idea_id) VALUES (?, ?)', [vId, ideaId]);
    }
  }

  console.log('Community Ideas Seeded Successfully!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Error seeding community ideas:', err);
  process.exit(1);
});
