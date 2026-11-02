// MODULE 1 (Student 1): User accounts - register, login, logout, profile, change password
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { db } = require('../lib/db');
const { setAuthCookie, clearAuthCookie, requireAuth, publicUser } = require('../lib/auth');
const { str, isEmail, isRegNo, isPhone, isStrongPassword } = require('../lib/validate');

const PASSWORD_HINT = 'Use at least 8 characters, including a letter and a number.';

// POST /api/auth/register  { name, regNo, email, phone, password }
router.post('/register', (req, res) => {
  const name = str(req.body.name);
  const regNo = str(req.body.regNo);
  const email = str(req.body.email).toLowerCase();
  const phone = str(req.body.phone);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  const fields = {};
  if (name.length < 2 || name.length > 60) fields.name = 'Enter your full name (2-60 characters).';
  if (!isRegNo(regNo)) fields.regNo = 'Registration number must be 9 digits.';
  if (!isEmail(email)) fields.email = 'Enter a valid email address.';
  if (!isPhone(phone)) fields.phone = 'Enter a valid phone number (10-15 digits).';
  if (!isStrongPassword(password)) fields.password = PASSWORD_HINT;
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Please correct the highlighted fields.', fields });

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email))
    return res.status(409).json({ error: 'That email is already registered.', fields: { email: 'Email already registered.' } });
  if (db.prepare('SELECT 1 FROM users WHERE reg_no = ?').get(regNo))
    return res.status(409).json({ error: 'That registration number is already registered.', fields: { regNo: 'Registration number already registered.' } });

  const hash = bcrypt.hashSync(password, 10); // passwords are never stored in plain text
  const info = db
    .prepare('INSERT INTO users (name, reg_no, email, phone, password_hash) VALUES (?,?,?,?,?)')
    .run(name, regNo, email, phone, hash);
  setAuthCookie(res, info.lastInsertRowid);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user: publicUser(user) });
});

// POST /api/auth/login  { email, password }
router.post('/login', (req, res) => {
  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!isEmail(email) || !password) return res.status(400).json({ error: 'Enter your email and password.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // same message for "no such user" and "wrong password" so accounts cannot be probed
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Incorrect email or password.' });

  setAuthCookie(res, user.id);
  res.json({ user: publicUser(user) });
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me  -> { user: {...} | null, unread }
router.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null, unread: 0 });
  const unread = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).n;
  res.json({ user: publicUser(req.user), unread });
});

// PUT /api/auth/profile  { name, phone }
router.put('/profile', requireAuth, (req, res) => {
  const name = str(req.body.name);
  const phone = str(req.body.phone);
  const fields = {};
  if (name.length < 2 || name.length > 60) fields.name = 'Enter your full name (2-60 characters).';
  if (!isPhone(phone)) fields.phone = 'Enter a valid phone number (10-15 digits).';
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Please correct the highlighted fields.', fields });

  db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name, phone, req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

// PUT /api/auth/password  { currentPassword, newPassword }
router.put('/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (typeof currentPassword !== 'string' || !bcrypt.compareSync(currentPassword, row.password_hash))
    return res.status(400).json({ error: 'Current password is incorrect.', fields: { currentPassword: 'Current password is incorrect.' } });
  if (!isStrongPassword(newPassword))
    return res.status(400).json({ error: PASSWORD_HINT, fields: { newPassword: PASSWORD_HINT } });

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
