/* FindIt - in-browser back end for static hosting (GitHub Pages).
   The Node/Express/SQLite server in /routes cannot run on GitHub Pages, so this file re-implements the same REST
   API in JavaScript on top of localStorage. It wraps window.fetch(): a request to "api/..." is first tried against a
   real server; if the host has no API (it answers with HTML / 404) every /api call is answered here instead.
   The front-end code (common.js, browse.js, item.js ...) is identical in both modes.
   Demo only: data lives in this browser, and password hashing/sessions are not real security. */
(function () {
  'use strict';

  const DB_KEY = 'findit.db.v1';
  const SESSION_KEY = 'findit.session.v1';
  const CATEGORIES = ['Electronics', 'ID & Cards', 'Books & Stationery', 'Clothing & Bags', 'Keys', 'Bottles & Accessories', 'Other'];
  const DAY = 86400000;
  const realFetch = window.fetch.bind(window);

  /* ---------------- mode detection ---------------- */
  const knownStatic = location.protocol === 'file:' || /\.github\.io$/i.test(location.hostname) || /[?&]local=1\b/.test(location.search);
  let mode = knownStatic ? 'local' : null; // 'local' | 'real' | null (not probed yet)
  let probing = null;

  async function detectMode() {
    if (mode) return mode;
    if (!probing) {
      probing = realFetch('api/auth/me', { credentials: 'same-origin' })
        .then((r) => { mode = (r.headers.get('content-type') || '').includes('application/json') ? 'real' : 'local'; })
        .catch(() => { mode = 'local'; });
    }
    await probing;
    return mode;
  }

  /* ---------------- tiny helpers ---------------- */
  class HttpError extends Error {
    constructor(status, error, fields) { super(error); this.status = status; this.body = fields ? { error, fields } : { error }; }
  }
  const fail = (status, error, fields) => { throw new HttpError(status, error, fields); };
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  const isRegNo = (s) => /^\d{9}$/.test(s);
  const isPhone = (s) => s === '' || /^[0-9+\-\s]{10,15}$/.test(s);
  const isStrongPassword = (s) => typeof s === 'string' && s.length >= 8 && /[A-Za-z]/.test(s) && /\d/.test(s);
  const PASSWORD_HINT = 'Use at least 8 characters, including a letter and a number.';
  const nowIso = () => new Date().toISOString();
  const daysAgo = (d, h = 0) => new Date(Date.now() - d * DAY - h * 3600000).toISOString();
  const dateOnly = (d) => daysAgo(d).slice(0, 10);

  async function hashPassword(password, salt) {
    const data = new TextEncoder().encode(salt + ':' + password);
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381; // fallback for non-secure contexts (file://): not cryptographic, demo only
    for (const b of data) h = ((h << 5) + h + b) >>> 0;
    return 'x' + h.toString(16);
  }
  const newSalt = () => Math.random().toString(36).slice(2, 12);

  /* ---------------- storage ---------------- */
  let db = null;
  function save() {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
    catch { fail(500, 'Browser storage is full. Delete some posts or use "Reset demo data" in the footer.'); }
  }
  const nextId = (table, d = db) => { d.seq[table] = (d.seq[table] || 0) + 1; return d.seq[table]; };

  /** Re-read the database for every request (another tab may have changed it); seed it on the very first visit. */
  async function load() {
    let raw = null;
    try { raw = localStorage.getItem(DB_KEY); } catch { /* storage blocked: keep the in-memory copy */ }
    if (raw) { try { const parsed = JSON.parse(raw); if (parsed && parsed.users) { db = parsed; return db; } } catch { /* corrupt -> reseed */ } }
    if (!raw && db && db.users) return db;
    db = await seedDatabase();
    save();
    return db;
  }

  async function seedDatabase() {
    const d = { seq: {}, users: [], items: [], claims: [], notifications: [] };
    const addUser = async (name, regNo, email, phone, password, role, created) => {
      const salt = newSalt();
      const u = { id: nextId('users', d), name, reg_no: regNo, email, phone, salt, password_hash: await hashPassword(password, salt), role, created_at: created };
      d.users.push(u);
      return u.id;
    };
    await addUser('Campus Admin', '000000000', 'admin@findit.edu', '', 'Admin@123', 'admin', daysAgo(45));
    const people = [
      ['Aarav Sharma', '220911001', 'aarav@demo.edu', '9876500001'],
      ['Diya Menon', '220911002', 'diya@demo.edu', '9876500002'],
      ['Rohan Iyer', '220911003', 'rohan@demo.edu', '9876500003'],
      ['Meera Nair', '220911004', 'meera@demo.edu', '9876500004'],
      ['Kabir Singh', '220911005', 'kabir@demo.edu', '9876500005'],
      ['Ananya Rao', '220911006', 'ananya@demo.edu', '9876500006'],
    ];
    const uid = [];
    for (let i = 0; i < people.length; i++) uid.push(await addUser(people[i][0], people[i][1], people[i][2], people[i][3], 'Demo@1234', 'student', daysAgo(40 - i)));

    // [owner, type, title, description, category, location, daysAgo, status, image]
    const rows = [
      [0, 'found', 'Black Casio scientific calculator', 'Casio fx-991EX with a small scratch on the cover and the initials "RK" written on the back in marker. Found on a desk after the Maths tutorial.', 'Electronics', 'Academic Block 1, Room 204', 1, 'open', 'calculator'],
      [1, 'lost', 'Blue Milton steel water bottle', '750 ml dark blue bottle with a dent near the bottom and a sticker of a mountain on the side.', 'Bottles & Accessories', 'Food Court', 2, 'open', 'bottle'],
      [2, 'found', 'Student ID card near Student Plaza', 'ID card in a transparent holder, found on the steps. Name is partly faded - the owner should be able to describe the photo.', 'ID & Cards', 'Student Plaza', 3, 'open', null],
      [0, 'lost', 'Set of keys with red keychain', 'Three keys (one hostel room key) on a red football-shaped keychain. Lost after evening practice.', 'Keys', 'Sports Complex', 3, 'open', 'keys'],
      [3, 'found', 'Grey hoodie, size M', 'Plain grey zip-up hoodie left on a chair on the second floor. Has a library receipt in the pocket.', 'Clothing & Bags', 'Central Library', 4, 'claimed', 'hoodie'],
      [4, 'lost', 'Data Structures textbook (Cormen)', 'Hardcover Introduction to Algorithms, name written on the first page and many yellow sticky notes inside.', 'Books & Stationery', 'Academic Block 5', 6, 'open', 'book'],
      [1, 'found', 'White wireless earbuds case', 'White charging case with a green silicone cover. Earbuds are inside. Handed in at the Innovation Centre front desk.', 'Electronics', 'Innovation Centre', 8, 'claimed', 'earbuds'],
      [5, 'lost', 'Black laptop sleeve (15 inch)', 'Black padded sleeve with a small blue zipper pull. Contained a charger.', 'Clothing & Bags', 'Academic Block 1', 10, 'resolved', null],
      [2, 'found', 'Spectacles in a brown case', 'Round metal-frame spectacles in a brown hard case, found on a bench outside the hostel.', 'Other', 'Hostel Block', 12, 'resolved', null],
      [3, 'lost', 'Samsung earbuds (black)', 'Black Galaxy Buds in a black case. Left earbud has a small scratch.', 'Electronics', 'Central Library', 15, 'open', null],
      [4, 'found', 'Navy blue umbrella', 'Large navy umbrella with a wooden handle. Found at the bus stop after the rain.', 'Other', 'Main Gate bus stop', 19, 'resolved', 'umbrella'],
      [0, 'lost', 'Yellow Digital Electronics notebook', 'A4 yellow spiral notebook, subject label "DE - Sem 5" on the front.', 'Books & Stationery', 'Academic Block 5', 24, 'open', null],
      [5, 'found', 'Power bank 10000 mAh', 'Black power bank with a short white cable attached.', 'Electronics', 'Food Court', 30, 'resolved', null],
      [1, 'lost', 'Brown leather wallet', 'Brown wallet with a few cards and a bus pass. No cash. Reward for return of the cards.', 'Other', 'Student Plaza', 33, 'open', 'wallet'],
    ];
    const itemIds = rows.map((r, i) => {
      const it = {
        id: nextId('items', d), user_id: uid[r[0]], type: r[1], title: r[2], description: r[3], category: r[4], location: r[5],
        date_event: dateOnly(r[6]), image: r[8] ? `seed-assets/${r[8]}.png` : null, status: r[7], created_at: daysAgo(r[6], i),
      };
      d.items.push(it);
      return it.id;
    });
    const claim = (item, claimant, message, status, created) =>
      d.claims.push({ id: nextId('claims', d), item_id: itemIds[item], claimant_id: uid[claimant], message, status, created_at: created });
    const note = (user, message, item, read, created) =>
      d.notifications.push({ id: nextId('notifications', d), user_id: uid[user], message, link: `item.html?id=${itemIds[item]}`, is_read: read, created_at: created });

    claim(0, 1, 'This is mine - the initials on the back are R.K. (Riya Kapoor, my lab partner) and the cover has a scratch near the hinge.', 'pending', daysAgo(0, 5));
    claim(0, 4, 'I think I left my calculator in room 204 yesterday. It has a green sticker inside the cover.', 'pending', daysAgo(0, 2));
    claim(3, 2, 'I found a red football keychain near the sports complex gate and handed it in at the security desk.', 'pending', daysAgo(1));
    claim(4, 0, 'The hoodie is mine, I had a library receipt for "Operating Systems" in the pocket.', 'approved', daysAgo(3));
    claim(6, 5, 'The case has a green cover and the left earbud is slightly loose. I lost it after the hackathon.', 'approved', daysAgo(6));
    claim(7, 3, 'I found it in AB1 and kept it at the department office.', 'approved', daysAgo(9));
    claim(8, 4, 'These are my spare spectacles, prescription -2.25.', 'approved', daysAgo(11));

    note(0, 'Kabir Singh sent a claim for "Black Casio scientific calculator".', 0, 0, daysAgo(0, 2));
    note(0, 'Diya Menon sent a claim for "Black Casio scientific calculator".', 0, 0, daysAgo(0, 5));
    note(0, 'Rohan Iyer sent a claim for "Set of keys with red keychain".', 3, 0, daysAgo(1));
    note(0, 'Your claim for "Grey hoodie, size M" was approved. Contact Meera Nair: meera@demo.edu, 9876500004.', 4, 1, daysAgo(2));
    note(3, 'Aarav Sharma sent a claim for "Grey hoodie, size M".', 4, 1, daysAgo(3));
    return d;
  }

  /* ---------------- data helpers (the "SQL") ---------------- */
  const userById = (id) => db.users.find((u) => u.id === id);
  const itemById = (id) => db.items.find((i) => i.id === Number(id));
  const publicUser = (u) => ({ id: u.id, name: u.name, regNo: u.reg_no, email: u.email, phone: u.phone, role: u.role, createdAt: u.created_at });
  const isAdmin = (u) => !!u && u.role === 'admin';
  const claimsOf = (itemId) => db.claims.filter((c) => c.item_id === itemId);
  const notify = (userId, message, link = null) =>
    db.notifications.push({ id: nextId('notifications'), user_id: userId, message, link, is_read: 0, created_at: nowIso() });
  const byNewest = (a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id);

  function toItem(r) {
    const owner = userById(r.user_id);
    return {
      id: r.id, type: r.type, title: r.title, description: r.description, category: r.category, location: r.location,
      dateEvent: r.date_event, image: r.image || null, status: r.status, createdAt: r.created_at,
      ownerId: r.user_id, ownerName: owner ? owner.name : 'Unknown', claimCount: claimsOf(r.id).length,
    };
  }

  function currentUser() {
    let id = null;
    try { id = Number(localStorage.getItem(SESSION_KEY)) || null; } catch { /* storage blocked */ }
    return id ? userById(id) || null : null;
  }
  function setSession(id) { try { id ? localStorage.setItem(SESSION_KEY, String(id)) : localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } }
  function requireAuth(me) { if (!me) fail(401, 'Please log in to continue.'); }
  function requireAdmin(me) { requireAuth(me); if (me.role !== 'admin') fail(403, 'Administrator access required.'); }

  /* ---------------- image upload: validate, downscale, keep as a data URL ---------------- */
  async function storeImage(file) {
    const msg = (m) => fail(400, m, { image: m });
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) msg('Only JPG, PNG or WebP images are allowed.');
    if (file.size > 3 * 1024 * 1024) msg('Image must be smaller than 3 MB.');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const scale = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.8);
    } catch { return msg('That image could not be read.'); }
    finally { URL.revokeObjectURL(url); }
  }

  /* ---------------- routes (mirror of /routes/*.js) ---------------- */
  const routes = [];
  const route = (method, pattern, handler) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:id/g, '(\\d+)') + '$'), handler });

  // ----- auth (Module 1)
  route('POST', '/auth/register', async ({ body }) => {
    const name = str(body.name), regNo = str(body.regNo), email = str(body.email).toLowerCase(), phone = str(body.phone);
    const password = typeof body.password === 'string' ? body.password : '';
    const fields = {};
    if (name.length < 2 || name.length > 60) fields.name = 'Enter your full name (2-60 characters).';
    if (!isRegNo(regNo)) fields.regNo = 'Registration number must be 9 digits.';
    if (!isEmail(email)) fields.email = 'Enter a valid email address.';
    if (!isPhone(phone)) fields.phone = 'Enter a valid phone number (10-15 digits).';
    if (!isStrongPassword(password)) fields.password = PASSWORD_HINT;
    if (Object.keys(fields).length) fail(400, 'Please correct the highlighted fields.', fields);
    if (db.users.some((u) => u.email === email)) fail(409, 'That email is already registered.', { email: 'Email already registered.' });
    if (db.users.some((u) => u.reg_no === regNo)) fail(409, 'That registration number is already registered.', { regNo: 'Registration number already registered.' });
    const salt = newSalt();
    const user = { id: nextId('users'), name, reg_no: regNo, email, phone, salt, password_hash: await hashPassword(password, salt), role: 'student', created_at: nowIso() };
    db.users.push(user);
    save();
    setSession(user.id);
    return [201, { user: publicUser(user) }];
  });

  route('POST', '/auth/login', async ({ body }) => {
    const email = str(body.email).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!isEmail(email) || !password) fail(400, 'Enter your email and password.');
    const user = db.users.find((u) => u.email === email);
    if (!user || (await hashPassword(password, user.salt)) !== user.password_hash) fail(401, 'Incorrect email or password.');
    setSession(user.id);
    return { user: publicUser(user) };
  });

  route('POST', '/auth/logout', () => { setSession(null); return { ok: true }; });

  route('GET', '/auth/me', ({ me }) => {
    if (!me) return { user: null, unread: 0 };
    return { user: publicUser(me), unread: db.notifications.filter((n) => n.user_id === me.id && !n.is_read).length };
  });

  route('PUT', '/auth/profile', ({ me, body }) => {
    requireAuth(me);
    const name = str(body.name), phone = str(body.phone);
    const fields = {};
    if (name.length < 2 || name.length > 60) fields.name = 'Enter your full name (2-60 characters).';
    if (!isPhone(phone)) fields.phone = 'Enter a valid phone number (10-15 digits).';
    if (Object.keys(fields).length) fail(400, 'Please correct the highlighted fields.', fields);
    me.name = name; me.phone = phone;
    save();
    return { user: publicUser(me) };
  });

  route('PUT', '/auth/password', async ({ me, body }) => {
    requireAuth(me);
    const { currentPassword, newPassword } = body;
    if (typeof currentPassword !== 'string' || (await hashPassword(currentPassword, me.salt)) !== me.password_hash)
      fail(400, 'Current password is incorrect.', { currentPassword: 'Current password is incorrect.' });
    if (!isStrongPassword(newPassword)) fail(400, PASSWORD_HINT, { newPassword: PASSWORD_HINT });
    me.salt = newSalt();
    me.password_hash = await hashPassword(newPassword, me.salt);
    save();
    return { ok: true };
  });

  // ----- items (Module 2)
  route('GET', '/items', ({ query }) => {
    const search = str(query.get('search')).slice(0, 80).toLowerCase();
    const type = query.get('type'), category = query.get('category'), status = query.get('status');
    let rows = db.items.filter((i) => i.status !== 'removed');
    if (search) rows = rows.filter((i) => [i.title, i.description, i.location].some((t) => t.toLowerCase().includes(search)));
    if (['lost', 'found'].includes(type)) rows = rows.filter((i) => i.type === type);
    if (CATEGORIES.includes(category)) rows = rows.filter((i) => i.category === category);
    if (['open', 'claimed', 'resolved'].includes(status)) rows = rows.filter((i) => i.status === status);
    rows.sort(byNewest);
    if (query.get('sort') === 'oldest') rows.reverse();
    const pageSize = 9;
    const page = Math.max(1, parseInt(query.get('page'), 10) || 1);
    return { items: rows.slice((page - 1) * pageSize, page * pageSize).map(toItem), total: rows.length, page, pages: Math.max(1, Math.ceil(rows.length / pageSize)) };
  });

  route('GET', '/items/mine', ({ me }) => {
    requireAuth(me);
    return { items: db.items.filter((i) => i.user_id === me.id && i.status !== 'removed').sort(byNewest).map(toItem) };
  });

  route('POST', '/items', async ({ me, body }) => {
    requireAuth(me);
    const type = str(body.type), title = str(body.title), description = str(body.description);
    const category = str(body.category), location = str(body.location), dateEvent = str(body.dateEvent);
    const fields = {};
    if (!['lost', 'found'].includes(type)) fields.type = 'Choose lost or found.';
    if (title.length < 3 || title.length > 80) fields.title = 'Title must be 3-80 characters.';
    if (description.length < 10 || description.length > 1000) fields.description = 'Description must be 10-1000 characters.';
    if (!CATEGORIES.includes(category)) fields.category = 'Choose a category.';
    if (location.length < 3 || location.length > 80) fields.location = 'Location must be 3-80 characters.';
    const d = new Date(dateEvent + 'T00:00:00');
    const today = new Date();
    const yearAgo = new Date();
    yearAgo.setFullYear(today.getFullYear() - 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateEvent) || isNaN(d) || d > today || d < yearAgo) fields.dateEvent = 'Enter a valid date within the last year (not in the future).';
    const file = body.image instanceof File && body.image.size > 0 ? body.image : null;
    let image = null;
    if (file) { try { image = await storeImage(file); } catch (e) { if (e instanceof HttpError) fields.image = e.body.error; else throw e; } }
    if (Object.keys(fields).length) fail(400, 'Please correct the highlighted fields.', fields);
    const item = { id: nextId('items'), user_id: me.id, type, title, description, category, location, date_event: dateEvent, image, status: 'open', created_at: nowIso() };
    db.items.push(item);
    save();
    return [201, { id: item.id }];
  });

  route('DELETE', '/items/:id', ({ me, match }) => {
    requireAuth(me);
    const item = itemById(match[1]);
    if (!item) fail(404, 'Item not found.');
    if (item.user_id !== me.id && me.role !== 'admin') fail(403, 'You can only delete your own posts.');
    db.items = db.items.filter((i) => i.id !== item.id);
    db.claims = db.claims.filter((c) => c.item_id !== item.id); // ON DELETE CASCADE
    save();
    return { ok: true };
  });

  // ----- item details + claims (Module 3)
  route('GET', '/items/:id', ({ me, match }) => {
    const row = itemById(match[1]);
    if (!row) fail(404, 'Item not found.');
    const isOwner = !!me && me.id === row.user_id;
    if (row.status === 'removed' && !isOwner && !isAdmin(me)) fail(404, 'Item not found.');
    const out = { item: toItem(row), viewer: { loggedIn: !!me, isOwner, isAdmin: isAdmin(me) } };
    if (me && !isOwner) {
      const mine = db.claims.find((c) => c.item_id === row.id && c.claimant_id === me.id);
      out.viewer.myClaim = mine ? { id: mine.id, message: mine.message, status: mine.status, createdAt: mine.created_at } : null;
      out.viewer.canClaim = row.status === 'open' && !mine;
      if (mine && mine.status === 'approved') { // contact details only after approval
        const o = userById(row.user_id);
        out.contact = { name: o.name, email: o.email, phone: o.phone };
      }
    }
    if (isOwner || isAdmin(me)) {
      out.claims = claimsOf(row.id).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)).map((c) => {
        const u = userById(c.claimant_id);
        return { id: c.id, message: c.message, status: c.status, createdAt: c.created_at, claimant: { name: u.name, regNo: u.reg_no }, contact: c.status === 'approved' ? { email: u.email, phone: u.phone } : null };
      });
    }
    return out;
  });

  route('POST', '/items/:id/claims', ({ me, match, body }) => {
    requireAuth(me);
    const item = itemById(match[1]);
    if (!item || item.status === 'removed') fail(404, 'Item not found.');
    if (item.user_id === me.id) fail(400, 'You cannot claim your own post.');
    if (item.status !== 'open') fail(400, 'This item is no longer open for claims.');
    const message = str(body.message);
    if (message.length < 10 || message.length > 500) fail(400, 'Please correct the highlighted fields.', { message: 'Message must be 10-500 characters.' });
    if (db.claims.some((c) => c.item_id === item.id && c.claimant_id === me.id)) fail(409, 'You have already sent a claim for this item.');
    const claim = { id: nextId('claims'), item_id: item.id, claimant_id: me.id, message, status: 'pending', created_at: nowIso() };
    db.claims.push(claim);
    notify(item.user_id, `${me.name} sent a claim for "${item.title}".`, `item.html?id=${item.id}`);
    save();
    return [201, { id: claim.id }];
  });

  route('PATCH', '/claims/:id', ({ me, match, body }) => {
    requireAuth(me);
    const claim = db.claims.find((c) => c.id === Number(match[1]));
    if (!claim) fail(404, 'Claim not found.');
    const item = itemById(claim.item_id);
    if (item.user_id !== me.id && !isAdmin(me)) fail(403, 'Only the person who posted the item can decide on claims.');
    if (claim.status !== 'pending') fail(400, 'This claim has already been decided.');
    const link = `item.html?id=${item.id}`;
    if (body.action === 'approve') {
      if (item.status !== 'open') fail(400, 'This item is no longer open.');
      const owner = userById(item.user_id);
      // approve this claim, reject the rest and update the item (saved once at the end = all or nothing)
      const others = claimsOf(item.id).filter((c) => c.status === 'pending' && c.id !== claim.id);
      claim.status = 'approved';
      others.forEach((c) => { c.status = 'rejected'; });
      item.status = 'claimed';
      notify(claim.claimant_id, `Your claim for "${item.title}" was approved. Contact ${owner.name}: ${owner.email}${owner.phone ? ', ' + owner.phone : ''}.`, link);
      others.forEach((o) => notify(o.claimant_id, `Your claim for "${item.title}" was not accepted.`, link));
      save();
      return { ok: true, status: 'approved' };
    }
    if (body.action === 'reject') {
      claim.status = 'rejected';
      notify(claim.claimant_id, `Your claim for "${item.title}" was not accepted.`, link);
      save();
      return { ok: true, status: 'rejected' };
    }
    return fail(400, 'Action must be "approve" or "reject".');
  });

  route('PATCH', '/items/:id/resolve', ({ me, match }) => {
    requireAuth(me);
    const item = itemById(match[1]);
    if (!item) fail(404, 'Item not found.');
    if (item.user_id !== me.id && !isAdmin(me)) fail(403, 'Only the owner of the post can do this.');
    if (!['open', 'claimed'].includes(item.status)) fail(400, 'This item cannot be resolved.');
    item.status = 'resolved';
    claimsOf(item.id).forEach((c) => { if (c.status === 'pending') c.status = 'rejected'; });
    const approved = claimsOf(item.id).find((c) => c.status === 'approved');
    if (approved) notify(approved.claimant_id, `"${item.title}" has been marked as returned. Thank you!`, `item.html?id=${item.id}`);
    save();
    return { ok: true };
  });

  // ----- notifications
  const toNote = (n) => ({ id: n.id, message: n.message, link: n.link, isRead: !!n.is_read, createdAt: n.created_at });
  route('GET', '/notifications', ({ me }) => {
    requireAuth(me);
    const rows = db.notifications.filter((n) => n.user_id === me.id).sort(byNewest).slice(0, 50);
    return { notifications: rows.map(toNote), unread: rows.filter((r) => !r.is_read).length };
  });
  route('PATCH', '/notifications/read-all', ({ me }) => {
    requireAuth(me);
    db.notifications.forEach((n) => { if (n.user_id === me.id) n.is_read = 1; });
    save();
    return { ok: true };
  });
  route('PATCH', '/notifications/:id/read', ({ me, match }) => {
    requireAuth(me);
    db.notifications.forEach((n) => { if (n.id === Number(match[1]) && n.user_id === me.id) n.is_read = 1; });
    save();
    return { ok: true };
  });

  // ----- stats (Module 4)
  route('GET', '/stats', () => {
    const visible = db.items.filter((i) => i.status !== 'removed');
    const resolved = db.items.filter((i) => i.status === 'resolved').length;
    const cats = {};
    visible.forEach((i) => { cats[i.category] = (cats[i.category] || 0) + 1; });
    const byCategory = Object.entries(cats).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
    const weekly = Array.from({ length: 6 }, (_, i) => ({ weeksAgo: 5 - i, lost: 0, found: 0 }));
    visible.forEach((i) => {
      const wk = Math.floor((Date.now() - new Date(i.created_at)) / (7 * DAY));
      const slot = weekly.find((w) => w.weeksAgo === wk);
      if (slot) slot[i.type] += 1;
    });
    return {
      totals: {
        items: visible.length,
        lost: visible.filter((i) => i.type === 'lost').length,
        found: visible.filter((i) => i.type === 'found').length,
        open: db.items.filter((i) => i.status === 'open').length,
        resolved,
        users: db.users.filter((u) => u.role === 'student').length,
        recoveryRate: visible.length ? Math.round((resolved / visible.length) * 100) : 0,
      },
      byCategory,
      weekly,
    };
  });

  route('GET', '/stats/me', ({ me }) => {
    requireAuth(me);
    const mine = db.items.filter((i) => i.user_id === me.id);
    const myClaims = db.claims.filter((c) => c.claimant_id === me.id).sort(byNewest).slice(0, 8);
    const incoming = db.claims
      .filter((c) => { const it = itemById(c.item_id); return it && it.user_id === me.id && c.status === 'pending' && it.status === 'open'; })
      .sort(byNewest).slice(0, 8);
    return {
      posts: mine.filter((i) => i.status !== 'removed').length,
      active: mine.filter((i) => ['open', 'claimed'].includes(i.status)).length,
      resolved: mine.filter((i) => i.status === 'resolved').length,
      claimsSent: db.claims.filter((c) => c.claimant_id === me.id).length,
      pendingIncoming: incoming.length,
      myClaims: myClaims.map((c) => { const it = itemById(c.item_id); return { id: c.id, status: c.status, createdAt: c.created_at, itemId: it.id, title: it.title, type: it.type }; }),
      incoming: incoming.map((c) => { const it = itemById(c.item_id); return { id: c.id, createdAt: c.created_at, itemId: it.id, title: it.title, claimant: userById(c.claimant_id).name }; }),
    };
  });

  // ----- admin (Module 4)
  route('GET', '/admin/items', ({ me, query }) => {
    requireAdmin(me);
    const q = str(query.get('q')).slice(0, 80).toLowerCase();
    const status = query.get('status');
    let rows = db.items.slice();
    if (q) rows = rows.filter((i) => i.title.toLowerCase().includes(q) || userById(i.user_id).name.toLowerCase().includes(q));
    if (['open', 'claimed', 'resolved', 'removed'].includes(status)) rows = rows.filter((i) => i.status === status);
    return { items: rows.sort(byNewest).slice(0, 100).map(toItem) };
  });

  route('PATCH', '/admin/items/:id', ({ me, match, body }) => {
    requireAdmin(me);
    const item = itemById(match[1]);
    if (!item) fail(404, 'Item not found.');
    if (!['removed', 'open'].includes(body.status)) fail(400, 'Status must be "removed" or "open".');
    item.status = body.status;
    notify(item.user_id, body.status === 'removed' ? `Your post "${item.title}" was removed by a moderator.` : `Your post "${item.title}" was restored by a moderator.`, body.status === 'removed' ? null : `item.html?id=${item.id}`);
    save();
    return { ok: true, status: body.status };
  });

  route('GET', '/admin/users', ({ me }) => {
    requireAdmin(me);
    return {
      users: db.users.slice().sort(byNewest).map((u) => ({ id: u.id, name: u.name, regNo: u.reg_no, email: u.email, role: u.role, posts: db.items.filter((i) => i.user_id === u.id).length, createdAt: u.created_at })),
    };
  });

  /* ---------------- fetch interception ---------------- */
  async function parseBody(init) {
    const b = init && init.body;
    if (!b) return {};
    if (b instanceof FormData) return Object.fromEntries(b.entries());
    try { return JSON.parse(b); } catch { return {}; }
  }

  // requests run one at a time so a read-modify-write on the shared database can never interleave
  let queue = Promise.resolve();
  const serialise = (fn) => { const run = queue.then(fn); queue = run.catch(() => {}); return run; };

  function handleLocal(url, init) {
    return serialise(() => handleOne(url, init));
  }

  async function handleOne(url, init) {
    const u = new URL(url, location.href);
    const path = u.pathname.slice(u.pathname.indexOf('/api/') + 4); // "/items/3"
    const method = ((init && init.method) || 'GET').toUpperCase();
    const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    try {
      await load();
      const me = currentUser();
      for (const r of routes) {
        if (r.method !== method) continue;
        const match = r.re.exec(path);
        if (!match) continue;
        const out = await r.handler({ me, match, query: u.searchParams, body: await parseBody(init) });
        return Array.isArray(out) ? json(out[0], out[1]) : json(200, out);
      }
      return json(404, { error: 'Not found.' });
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, e.body);
      console.error(e);
      return json(500, { error: 'Something went wrong in the browser database.' });
    }
  }

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!/^(\.?\/)?api\//.test(url) && !/^https?:\/\/[^/]+\/(?:[^/]+\/)?api\//.test(url)) return realFetch(input, init);
    if ((await detectMode()) === 'real') return realFetch(input, init);
    return handleLocal(url, init);
  };

  /** Used by the footer: tells the user the data is stored in the browser and lets them start over. */
  window.FINDIT_LOCAL = {
    isActive: () => mode === 'local',
    reset() {
      try { localStorage.removeItem(DB_KEY); localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
      db = null;
      location.href = 'index.html';
    },
  };
})();
