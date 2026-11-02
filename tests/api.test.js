// API smoke tests: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// use a throw-away database + uploads folder so tests never touch real data
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'findit-test-'));
process.env.UPLOAD_DIR = path.join(process.env.DATA_DIR, 'uploads');
const app = require('../server');

let base;
let server;
test.before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }));
test.after(() => server.close());

/** tiny client that remembers the auth cookie */
function client() {
  let cookie = '';
  return async (method, url, body) => {
    const headers = cookie ? { cookie } : {};
    let payload = body;
    if (body && !(body instanceof FormData)) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(base + url, { method, headers, body: payload });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
}
const user = (n) => ({ name: 'Test User ' + n, regNo: '23091100' + n, email: `t${n}@test.edu`, phone: '9999999999', password: 'Passw0rd' + n });

test('register validates input on the server', async () => {
  const c = client();
  const bad = await c('POST', '/api/auth/register', { name: 'A', regNo: '12', email: 'nope', password: 'short' });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.fields.name && bad.body.fields.regNo && bad.body.fields.email && bad.body.fields.password);
});

test('register, duplicate, login, me, logout', async () => {
  const c = client();
  assert.equal((await c('POST', '/api/auth/register', user(1))).status, 201);
  assert.equal((await c('GET', '/api/auth/me')).body.user.email, 't1@test.edu');
  assert.equal((await client()('POST', '/api/auth/register', user(1))).status, 409);
  const other = client();
  assert.equal((await other('POST', '/api/auth/login', { email: 't1@test.edu', password: 'wrong' })).status, 401);
  assert.equal((await other('POST', '/api/auth/login', { email: 't1@test.edu', password: 'Passw0rd1' })).status, 200);
});

test('items need login; create, search, filter', async () => {
  const anon = client();
  assert.equal((await anon('POST', '/api/items', new FormData())).status, 401);

  const c = client();
  await c('POST', '/api/auth/register', user(2));
  const fd = new FormData();
  const today = new Date().toISOString().slice(0, 10);
  Object.entries({ type: 'found', title: 'Red umbrella', description: 'Found near the library entrance.', category: 'Other', location: 'Central Library', dateEvent: today }).forEach(([k, v]) => fd.append(k, v));
  fd.append('image', new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), 'x.png');
  const made = await c('POST', '/api/items', fd);
  assert.equal(made.status, 201);

  assert.equal((await anon('GET', '/api/items?search=umbrella')).body.total, 1);
  assert.equal((await anon('GET', '/api/items?search=umbrella&type=lost')).body.total, 0);
  assert.equal((await anon('GET', '/api/items?search=100%25')).body.total, 0); // % is escaped, not a wildcard

  const bad = new FormData(); bad.append('type', 'found');
  assert.equal((await c('POST', '/api/items', bad)).status, 400);

  const txt = new FormData();
  Object.entries({ type: 'found', title: 'Bad file', description: 'This has a bad file type.', category: 'Other', location: 'Somewhere', dateEvent: today }).forEach(([k, v]) => txt.append(k, v));
  txt.append('image', new Blob(['hello'], { type: 'text/plain' }), 'x.txt');
  assert.equal((await c('POST', '/api/items', txt)).status, 400);
});

test('claim workflow: claim -> notify -> approve -> contact revealed', async () => {
  const owner = client(); const claimer = client(); const third = client();
  await owner('POST', '/api/auth/register', user(3));
  await claimer('POST', '/api/auth/register', user(4));
  await third('POST', '/api/auth/register', user(5));

  const fd = new FormData();
  const today = new Date().toISOString().slice(0, 10);
  Object.entries({ type: 'found', title: 'Blue pen set', description: 'A set of blue pens in a pouch.', category: 'Books & Stationery', location: 'AB1', dateEvent: today }).forEach(([k, v]) => fd.append(k, v));
  const { body: { id } } = await owner('POST', '/api/items', fd);

  assert.equal((await owner('POST', `/api/items/${id}/claims`, { message: 'my own item please' })).status, 400); // cannot claim own
  assert.equal((await claimer('POST', `/api/items/${id}/claims`, { message: 'short' })).status, 400);
  const c1 = await claimer('POST', `/api/items/${id}/claims`, { message: 'These are my pens, they have a name tag.' });
  assert.equal(c1.status, 201);
  assert.equal((await claimer('POST', `/api/items/${id}/claims`, { message: 'These are my pens, again.' })).status, 409);
  assert.equal((await third('POST', `/api/items/${id}/claims`, { message: 'I think they are my pens too.' })).status, 201);

  assert.equal((await owner('GET', '/api/notifications')).body.unread, 2);

  // before approval the claimant cannot see contact details; a stranger cannot decide
  assert.equal((await claimer('GET', `/api/items/${id}`)).body.contact, undefined);
  assert.equal((await third('PATCH', `/api/claims/${c1.body.id}`, { action: 'approve' })).status, 403);

  assert.equal((await owner('PATCH', `/api/claims/${c1.body.id}`, { action: 'approve' })).status, 200);
  const view = (await claimer('GET', `/api/items/${id}`)).body;
  assert.equal(view.item.status, 'claimed');
  assert.equal(view.contact.email, 't3@test.edu');
  assert.equal((await third('GET', `/api/items/${id}`)).body.viewer.myClaim.status, 'rejected'); // others auto-rejected

  assert.equal((await owner('PATCH', `/api/items/${id}/resolve`)).status, 200);
  assert.equal((await owner('GET', `/api/items/${id}`)).body.item.status, 'resolved');
});

test('stats are public; admin routes are admin-only', async () => {
  const anon = client();
  const s = await anon('GET', '/api/stats');
  assert.equal(s.status, 200);
  assert.equal(s.body.weekly.length, 6);
  assert.equal((await anon('GET', '/api/admin/items')).status, 401);

  const student = client();
  await student('POST', '/api/auth/register', user(6));
  assert.equal((await student('GET', '/api/admin/users')).status, 403);

  const admin = client();
  await admin('POST', '/api/auth/login', { email: 'admin@findit.edu', password: 'Admin@123' });
  const items = await admin('GET', '/api/admin/items');
  assert.equal(items.status, 200);
  const target = items.body.items[0];
  assert.equal((await admin('PATCH', `/api/admin/items/${target.id}`, { status: 'removed' })).status, 200);
  assert.equal((await anon('GET', `/api/items/${target.id}`)).status, 404); // hidden from the public
  assert.equal((await admin('PATCH', `/api/admin/items/${target.id}`, { status: 'open' })).status, 200);
});
