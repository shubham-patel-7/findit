// JWT-in-httpOnly-cookie authentication middleware
const jwt = require('jsonwebtoken');
const { db } = require('./db');

const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const COOKIE = 'findit_token';
const WEEK = 7 * 24 * 60 * 60 * 1000;

function setAuthCookie(res, userId) {
  const token = jwt.sign({ id: userId }, SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true, // not readable from JavaScript -> protects the token from XSS
    sameSite: 'lax', // basic CSRF protection
    secure: process.env.NODE_ENV === 'production',
    maxAge: WEEK,
  });
}

const clearAuthCookie = (res) => res.clearCookie(COOKIE);

/** Loads req.user (or null) from the cookie on every API request. */
function attachUser(req, _res, next) {
  req.user = null;
  const token = req.cookies && req.cookies[COOKIE];
  if (token) {
    try {
      const { id } = jwt.verify(token, SECRET);
      req.user = db.prepare('SELECT id, name, reg_no, email, phone, role, created_at FROM users WHERE id = ?').get(id) || null;
    } catch {
      /* invalid / expired token -> treated as logged out */
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  next();
}

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  regNo: u.reg_no,
  email: u.email,
  phone: u.phone,
  role: u.role,
  createdAt: u.created_at,
});

module.exports = { setAuthCookie, clearAuthCookie, attachUser, requireAuth, requireAdmin, publicUser };
