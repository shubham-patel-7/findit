// MODULE 3 (Student 2): Notifications
const router = require('express').Router();
const { db } = require('../lib/db');
const { requireAuth } = require('../lib/auth');

const toNote = (n) => ({ id: n.id, message: n.message, link: n.link, isRead: !!n.is_read, createdAt: n.created_at });

// GET /api/notifications
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50').all(req.user.id);
  res.json({ notifications: rows.map(toNote), unread: rows.filter((r) => !r.is_read).length });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
