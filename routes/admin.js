// MODULE 4 (Student 2): Admin moderation panel (Feature 8)
const router = require('express').Router();
const { db, notify } = require('../lib/db');
const { requireAdmin } = require('../lib/auth');
const { str, likeEscape } = require('../lib/validate');
const { toItem, SELECT } = require('./items');

router.use(requireAdmin); // every route below is admin-only (checked on the server, not just hidden in the UI)

// GET /api/admin/items?q=&status=   -> every item, including removed ones
router.get('/items', (req, res) => {
  const where = [];
  const params = [];
  const q = str(req.query.q).slice(0, 80);
  if (q) {
    where.push("(i.title LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\')");
    params.push(`%${likeEscape(q)}%`, `%${likeEscape(q)}%`);
  }
  if (['open', 'claimed', 'resolved', 'removed'].includes(req.query.status)) {
    where.push('i.status = ?');
    params.push(req.query.status);
  }
  const clause = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`${SELECT}${clause} ORDER BY i.created_at DESC LIMIT 100`).all(...params);
  res.json({ items: rows.map(toItem) });
});

// PATCH /api/admin/items/:id  { status: 'removed' | 'open' }  (hide a post, or restore it)
router.patch('/items/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  const { status } = req.body;
  if (!['removed', 'open'].includes(status)) return res.status(400).json({ error: 'Status must be "removed" or "open".' });

  db.prepare('UPDATE items SET status = ? WHERE id = ?').run(status, item.id);
  notify(
    item.user_id,
    status === 'removed'
      ? `Your post "${item.title}" was removed by a moderator.`
      : `Your post "${item.title}" was restored by a moderator.`,
    status === 'removed' ? null : `/item.html?id=${item.id}`
  );
  res.json({ ok: true, status });
});

// GET /api/admin/users
router.get('/users', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.reg_no, u.email, u.role, u.created_at,
              (SELECT COUNT(*) FROM items i WHERE i.user_id = u.id) AS posts
       FROM users u ORDER BY u.created_at DESC`
    )
    .all();
  res.json({
    users: rows.map((u) => ({ id: u.id, name: u.name, regNo: u.reg_no, email: u.email, role: u.role, posts: u.posts, createdAt: u.created_at })),
  });
});

module.exports = router;
