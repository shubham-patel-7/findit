// MODULE 3 (Student 2): Item details, claim requests, owner approval and notifications
const router = require('express').Router();
const { db, notify } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { str } = require('../lib/validate');
const { toItem, SELECT } = require('./items');

const isAdmin = (u) => u && u.role === 'admin';

// GET /api/items/:id  -> item + what the current viewer is allowed to see / do
router.get('/items/:id', (req, res) => {
  const row = db.prepare(`${SELECT} WHERE i.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Item not found.' });

  const me = req.user;
  const isOwner = !!me && me.id === row.user_id;
  if (row.status === 'removed' && !isOwner && !isAdmin(me))
    return res.status(404).json({ error: 'Item not found.' });

  const out = { item: toItem(row), viewer: { loggedIn: !!me, isOwner, isAdmin: isAdmin(me) } };

  if (me && !isOwner) {
    const mine = db.prepare('SELECT id, message, status, created_at FROM claims WHERE item_id = ? AND claimant_id = ?').get(row.id, me.id);
    out.viewer.myClaim = mine ? { id: mine.id, message: mine.message, status: mine.status, createdAt: mine.created_at } : null;
    out.viewer.canClaim = row.status === 'open' && !mine;
    // contact details are only revealed to a claimant whose claim was approved
    if (mine && mine.status === 'approved') {
      const o = db.prepare('SELECT name, email, phone FROM users WHERE id = ?').get(row.user_id);
      out.contact = { name: o.name, email: o.email, phone: o.phone };
    }
  }

  if (isOwner || isAdmin(me)) {
    out.claims = db
      .prepare(
        `SELECT c.id, c.message, c.status, c.created_at, u.name, u.reg_no, u.email, u.phone
         FROM claims c JOIN users u ON u.id = c.claimant_id
         WHERE c.item_id = ? ORDER BY c.created_at ASC`
      )
      .all(row.id)
      .map((c) => ({
        id: c.id,
        message: c.message,
        status: c.status,
        createdAt: c.created_at,
        claimant: { name: c.name, regNo: c.reg_no },
        contact: c.status === 'approved' ? { email: c.email, phone: c.phone } : null,
      }));
  }
  res.json(out);
});

// POST /api/items/:id/claims  { message }   (Feature 5: submit a claim)
router.post('/items/:id/claims', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item || item.status === 'removed') return res.status(404).json({ error: 'Item not found.' });
  if (item.user_id === req.user.id) return res.status(400).json({ error: 'You cannot claim your own post.' });
  if (item.status !== 'open') return res.status(400).json({ error: 'This item is no longer open for claims.' });

  const message = str(req.body.message);
  if (message.length < 10 || message.length > 500)
    return res.status(400).json({ error: 'Please correct the highlighted fields.', fields: { message: 'Message must be 10-500 characters.' } });

  if (db.prepare('SELECT 1 FROM claims WHERE item_id = ? AND claimant_id = ?').get(item.id, req.user.id))
    return res.status(409).json({ error: 'You have already sent a claim for this item.' });

  const info = db.prepare('INSERT INTO claims (item_id, claimant_id, message) VALUES (?,?,?)').run(item.id, req.user.id, message);
  notify(item.user_id, `${req.user.name} sent a claim for "${item.title}".`, `/item.html?id=${item.id}`);
  res.status(201).json({ id: info.lastInsertRowid });
});

// PATCH /api/claims/:id  { action: 'approve' | 'reject' }   (Feature 6: owner decides)
router.patch('/claims/:id', requireAuth, (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found.' });
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(claim.item_id);

  if (item.user_id !== req.user.id && !isAdmin(req.user))
    return res.status(403).json({ error: 'Only the person who posted the item can decide on claims.' });
  if (claim.status !== 'pending') return res.status(400).json({ error: 'This claim has already been decided.' });

  const link = `/item.html?id=${item.id}`;
  if (req.body.action === 'approve') {
    if (item.status !== 'open') return res.status(400).json({ error: 'This item is no longer open.' });
    const owner = db.prepare('SELECT name, email, phone FROM users WHERE id = ?').get(item.user_id);

    // approve this claim, reject the rest and update the item - all or nothing
    db.transaction(() => {
      db.prepare("UPDATE claims SET status = 'approved' WHERE id = ?").run(claim.id);
      const others = db.prepare("SELECT id, claimant_id FROM claims WHERE item_id = ? AND status = 'pending' AND id != ?").all(item.id, claim.id);
      db.prepare("UPDATE claims SET status = 'rejected' WHERE item_id = ? AND status = 'pending'").run(item.id);
      db.prepare("UPDATE items SET status = 'claimed' WHERE id = ?").run(item.id);
      notify(claim.claimant_id, `Your claim for "${item.title}" was approved. Contact ${owner.name}: ${owner.email}${owner.phone ? ', ' + owner.phone : ''}.`, link);
      others.forEach((o) => notify(o.claimant_id, `Your claim for "${item.title}" was not accepted.`, link));
    })();
    return res.json({ ok: true, status: 'approved' });
  }

  if (req.body.action === 'reject') {
    db.prepare("UPDATE claims SET status = 'rejected' WHERE id = ?").run(claim.id);
    notify(claim.claimant_id, `Your claim for "${item.title}" was not accepted.`, link);
    return res.json({ ok: true, status: 'rejected' });
  }
  res.status(400).json({ error: 'Action must be "approve" or "reject".' });
});

// PATCH /api/items/:id/resolve  -> owner marks the item as returned / resolved
router.patch('/items/:id/resolve', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  if (item.user_id !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ error: 'Only the owner of the post can do this.' });
  if (!['open', 'claimed'].includes(item.status)) return res.status(400).json({ error: 'This item cannot be resolved.' });

  db.transaction(() => {
    db.prepare("UPDATE items SET status = 'resolved' WHERE id = ?").run(item.id);
    db.prepare("UPDATE claims SET status = 'rejected' WHERE item_id = ? AND status = 'pending'").run(item.id);
    const approved = db.prepare("SELECT claimant_id FROM claims WHERE item_id = ? AND status = 'approved'").get(item.id);
    if (approved) notify(approved.claimant_id, `"${item.title}" has been marked as returned. Thank you!`, `/item.html?id=${item.id}`);
  })();
  res.json({ ok: true });
});

module.exports = router;
