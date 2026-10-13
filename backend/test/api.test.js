const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../server');
const db = require('../config/db');

let server;
let baseUrl;

// Helper to make JSON HTTP requests against our test server
async function request(method, path, body = null, token = null) {
  const url = `${baseUrl}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, headers: res.headers, data };
}

describe('IdeaForge Enterprise API Test Suite', () => {
  let testUserToken = '';
  let testUserId = null;
  let secondUserToken = '';
  let secondUserId = null;
  let createdIdeaId = null;
  const testEmail = `test.architect.${Date.now()}@ideaforge.test`;
  const secondEmail = `test.peer.${Date.now()}@ideaforge.test`;
  const strongPassword = 'ForgeStrongPassword123!';

  before(async () => {
    // Start local ephemeral HTTP server
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    // Cleanup created test records
    try {
      if (testUserId) {
        await db.query('DELETE FROM users WHERE id IN (?, ?)', [testUserId, secondUserId]);
      }
    } catch { /* ignore cleanup error */ }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. Health Check GET / returns running status', async () => {
    const res = await request('GET', '/');
    assert.equal(res.status, 200);
    assert.equal(res.data.message, 'IdeaForge API is running');
  });

  test('2. Registration enforces strong password validation', async () => {
    const res = await request('POST', '/api/auth/register', {
      name: 'Weak Pass User',
      email: 'weak@example.com',
      password: 'weak',
    });
    assert.equal(res.status, 400);
    assert.match(res.data.message.toLowerCase(), /password/);
  });

  test('3. User Registration succeeds and stores normalized email', async () => {
    const res = await request('POST', '/api/auth/register', {
      name: 'Senior Architect',
      email: testEmail.toUpperCase(), // Test case normalization
      password: strongPassword,
    });
    assert.ok(res.status === 200 || res.status === 201);
    assert.ok(res.data.token || res.data.needsVerification !== undefined);

    // Fetch user directly from DB to verify normalization and hashed password
    const [rows] = await db.query('SELECT id, email, password_hash FROM users WHERE email = ?', [testEmail.toLowerCase()]);
    assert.equal(rows.length, 1);
    testUserId = rows[0].id;
    assert.equal(rows[0].email, testEmail.toLowerCase());
    assert.notEqual(rows[0].password_hash, strongPassword); // Must be securely hashed
    assert.ok(rows[0].password_hash.startsWith('$2'));

    // If verification was required by mailer, mark verified for subsequent authenticated tests
    await db.query('UPDATE users SET email_verified = 1 WHERE id = ?', [testUserId]);
  });

  test('4. Duplicate Registration is rejected', async () => {
    const res = await request('POST', '/api/auth/register', {
      name: 'Duplicate Architect',
      email: testEmail,
      password: strongPassword,
    });
    assert.equal(res.status, 409);
    assert.match(res.data.message.toLowerCase(), /already/);
  });

  test('5. Login rejects invalid password without exposing account existence', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: 'IncorrectPassword123!',
    });
    assert.equal(res.status, 401);
    assert.match(res.data.message.toLowerCase(), /wrong email or password/);
  });

  test('6. Login succeeds with valid credentials', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: strongPassword,
    });
    assert.equal(res.status, 200);
    assert.ok(res.data.token);
    testUserToken = res.data.token;
  });

  test('7. Register second peer user for collaborative suggestion testing', async () => {
    const res = await request('POST', '/api/auth/register', {
      name: 'Peer Contributor',
      email: secondEmail,
      password: strongPassword,
    });
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [secondEmail.toLowerCase()]);
    secondUserId = rows[0].id;
    await db.query('UPDATE users SET email_verified = 1 WHERE id = ?', [secondUserId]);

    const loginRes = await request('POST', '/api/auth/login', {
      email: secondEmail,
      password: strongPassword,
    });
    secondUserToken = loginRes.data.token;
    assert.ok(secondUserToken);
  });

  test('8. Create an evolving idea with initial version v1.0', async () => {
    const res = await request('POST', '/api/ideas', {
      title: 'Decentralized Compute Matrix',
      description: 'A fault-tolerant distributed compute fabric for AI pipelines.',
      category: 'Technology',
      tags: 'ai, compute, distributed',
      problem: 'Centralized GPU clusters create bottlenecks and high latency.',
      solution: 'Peer-to-peer compute scheduling with cryptographic verification.',
      target_users: 'AI Researchers & ML engineers',
      impact: 'Reduces distributed training costs by 65%.',
      is_published: true,
    }, testUserToken);

    assert.equal(res.status, 201);
    assert.ok(res.data.id);
    createdIdeaId = res.data.id;

    // Verify idea details and initial version
    const detailRes = await request('GET', `/api/ideas/${createdIdeaId}`);
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.data.idea.title, 'Decentralized Compute Matrix');
    assert.equal(detailRes.data.idea.current_version, 1);
    assert.equal(detailRes.data.versions.length, 1);
  });

  test('9. Update idea to generate Version v2.0 with audit trail', async () => {
    const res = await request('PUT', `/api/ideas/${createdIdeaId}`, {
      title: 'Decentralized Compute Matrix Enterprise',
      description: 'Enterprise-grade fault-tolerant distributed compute fabric.',
      category: 'Technology',
      tags: 'ai, compute, distributed, enterprise',
      problem: 'GPU clusters suffer from single points of failure.',
      solution: 'Multi-region mesh compute fabric with zero-knowledge proofs.',
      target_users: 'Global Enterprise AI Teams',
      impact: 'Eliminates cloud GPU vendor lock-in completely.',
      is_published: true,
    }, testUserToken);

    assert.equal(res.status, 200);
    assert.equal(res.data.current_version, 2);

    const detailRes = await request('GET', `/api/ideas/${createdIdeaId}`);
    assert.equal(detailRes.data.versions.length, 2);
  });

  test('10. Restore earlier Version v1.0 creates a new Version v3.0 preserving history', async () => {
    const res = await request('POST', `/api/ideas/${createdIdeaId}/restore-version`, {
      versionNo: 1,
      summary: 'Restored baseline architecture from Version 1.0',
    }, testUserToken);

    assert.equal(res.status, 200);
    assert.equal(res.data.version_no, 3);

    const detailRes = await request('GET', `/api/ideas/${createdIdeaId}`);
    assert.equal(detailRes.data.idea.current_version, 3);
    assert.equal(detailRes.data.versions.length, 3);
    // Verified that problem reverted to v1 content
    assert.equal(detailRes.data.idea.problem, 'Centralized GPU clusters create bottlenecks and high latency.');
  });

  test('11. Peer submits suggestion and idea owner accepts into Version v4.0', async () => {
    // Peer adds suggestion
    const suggRes = await request('POST', `/api/ideas/${createdIdeaId}/comments`, {
      type: 'suggestion',
      content: 'Integrate WebGPU native acceleration for browser nodes.',
    }, secondUserToken);
    assert.equal(suggRes.status, 201);
    const commentId = suggRes.data.id;

    // Idea owner accepts suggestion
    const acceptRes = await request('PATCH', `/api/comments/${commentId}/accept`, {
      updates: { solution: 'Multi-region mesh compute fabric featuring native WebGPU acceleration.' },
    }, testUserToken);

    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.data.ok, true);

    const detailRes = await request('GET', `/api/ideas/${createdIdeaId}`);
    assert.equal(detailRes.data.idea.current_version, 4);
    assert.ok(detailRes.data.contributors.some((c) => Number(c.id) === Number(secondUserId)));
  });

  test('12. Development Roadmap / Milestones CRUD', async () => {
    // Add milestone
    const addRes = await request('POST', `/api/ideas/${createdIdeaId}/milestones`, {
      title: 'WebGPU Kernel Benchmark',
      description: 'Run distributed matrix multiplication benchmarks on 100 edge nodes.',
      priority: 'high',
      due_date: '2026-12-31',
    }, testUserToken);

    assert.equal(addRes.status, 201);
    assert.ok(addRes.data.id);
    const mId = addRes.data.id;

    // Advance milestone status to completed
    const updateRes = await request('PATCH', `/api/ideas/${createdIdeaId}/milestones/${mId}`, {
      status: 'completed',
    }, testUserToken);
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.status, 'completed');

    // Retrieve roadmap list
    const listRes = await request('GET', `/api/ideas/${createdIdeaId}/milestones`);
    assert.equal(listRes.status, 200);
    assert.equal(listRes.data.length, 1);
    assert.equal(listRes.data[0].status, 'completed');
  });

  test('13. Bookmarking saves and unsaves idea', async () => {
    // Toggle bookmark on
    const b1 = await request('POST', `/api/ideas/${createdIdeaId}/bookmark`, {}, testUserToken);
    assert.equal(b1.status, 200);
    assert.equal(b1.data.bookmarked, true);

    // Check /api/me/bookmarks
    const listRes = await request('GET', '/api/me/bookmarks', null, testUserToken);
    assert.equal(listRes.status, 200);
    assert.ok(listRes.data.some((i) => i.id === createdIdeaId));

    // Toggle bookmark off
    const b2 = await request('POST', `/api/ideas/${createdIdeaId}/bookmark`, {}, testUserToken);
    assert.equal(b2.status, 200);
    assert.equal(b2.data.bookmarked, false);
  });

  test('14. Verified Analytics aggregates authentic database metrics', async () => {
    const res = await request('GET', `/api/ideas/${createdIdeaId}/analytics`);
    assert.equal(res.status, 200);
    assert.equal(res.data.currentVersion, 4);
    assert.equal(res.data.totalVersions, 4);
    assert.equal(res.data.milestones.completed, 1);
    assert.equal(res.data.milestones.total, 1);
    assert.equal(res.data.milestones.rate, 100);
    assert.equal(res.data.suggestions.accepted, 1);
  });

  test('15. Public Profile calculates database-backed reputation score', async () => {
    const res = await request('GET', `/api/users/${secondUserId}`);
    assert.equal(res.status, 200);
    // Peer has 1 accepted suggestion = 25 points
    assert.ok(res.data.user.reputation >= 25);
    assert.equal(res.data.user.stats.acceptedSuggestions, 1);
  });
});
