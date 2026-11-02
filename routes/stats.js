// MODULE 4 (Student 2): Dashboard statistics (Feature 7)
const router = require('express').Router();
const { db } = require('../lib/db');
const { requireAuth } = require('../lib/auth');

// GET /api/stats  -> campus-wide numbers used by the charts (public, no personal data)
router.get('/', (_req, res) => {
  const count = (sql, ...p) => db.prepare(sql).get(...p).n;
  const visible = "status != 'removed'";

  const total = count(`SELECT COUNT(*) AS n FROM items WHERE ${visible}`);
  const resolved = count("SELECT COUNT(*) AS n FROM items WHERE status = 'resolved'");

  const byCategory = db
    .prepare(`SELECT category, COUNT(*) AS count FROM items WHERE ${visible} GROUP BY category ORDER BY count DESC`)
    .all();

  // last 6 weeks, oldest first; week 0 = the most recent 7 days
  const weekly = Array.from({ length: 6 }, (_, i) => ({ weeksAgo: 5 - i, lost: 0, found: 0 }));
  db.prepare(
    `SELECT CAST((julianday('now') - julianday(created_at)) / 7 AS INTEGER) AS wk, type, COUNT(*) AS n
     FROM items WHERE ${visible} GROUP BY wk, type`
  )
    .all()
    .forEach((r) => {
      const slot = weekly.find((w) => w.weeksAgo === r.wk);
      if (slot) slot[r.type] = r.n;
    });

  res.json({
    totals: {
      items: total,
      lost: count(`SELECT COUNT(*) AS n FROM items WHERE type='lost' AND ${visible}`),
      found: count(`SELECT COUNT(*) AS n FROM items WHERE type='found' AND ${visible}`),
      open: count("SELECT COUNT(*) AS n FROM items WHERE status = 'open'"),
      resolved,
      users: count("SELECT COUNT(*) AS n FROM users WHERE role = 'student'"),
      recoveryRate: total ? Math.round((resolved / total) * 100) : 0,
    },
    byCategory,
    weekly,
  });
});

// GET /api/stats/me  -> numbers for the logged-in user's personal dashboard
router.get('/me', requireAuth, (req, res) => {
  const id = req.user.id;
  const one = (sql, ...p) => db.prepare(sql).get(...p).n;
  const myClaims = db
    .prepare(
      `SELECT c.id, c.status, c.created_at, i.id AS item_id, i.title, i.type
       FROM claims c JOIN items i ON i.id = c.item_id
       WHERE c.claimant_id = ? ORDER BY c.created_at DESC LIMIT 8`
    )
    .all(id);
  const incoming = db
    .prepare(
      `SELECT c.id, c.created_at, i.id AS item_id, i.title, u.name AS claimant
       FROM claims c JOIN items i ON i.id = c.item_id JOIN users u ON u.id = c.claimant_id
       WHERE i.user_id = ? AND c.status = 'pending' AND i.status = 'open' ORDER BY c.created_at DESC LIMIT 8`
    )
    .all(id);

  res.json({
    posts: one("SELECT COUNT(*) AS n FROM items WHERE user_id = ? AND status != 'removed'", id),
    active: one("SELECT COUNT(*) AS n FROM items WHERE user_id = ? AND status IN ('open','claimed')", id),
    resolved: one("SELECT COUNT(*) AS n FROM items WHERE user_id = ? AND status = 'resolved'", id),
    claimsSent: one('SELECT COUNT(*) AS n FROM claims WHERE claimant_id = ?', id),
    pendingIncoming: incoming.length,
    myClaims: myClaims.map((c) => ({ id: c.id, status: c.status, createdAt: c.created_at, itemId: c.item_id, title: c.title, type: c.type })),
    incoming: incoming.map((c) => ({ id: c.id, createdAt: c.created_at, itemId: c.item_id, title: c.title, claimant: c.claimant })),
  });
});

module.exports = router;
