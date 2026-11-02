// MODULE 2 (Student 1): Report an item (with image upload) and browse / search / filter items
const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { db } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { CATEGORIES, str, likeEscape } = require('../lib/validate');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    // random file name: the user's original name is never trusted or used
    filename: (_req, file, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + EXT[file.mimetype]),
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    EXT[file.mimetype] ? cb(null, true) : cb(new Error('Only JPG, PNG or WebP images are allowed.')),
});

/** Convert a DB row to the JSON shape used by the front end. */
const toItem = (r) => ({
  id: r.id,
  type: r.type,
  title: r.title,
  description: r.description,
  category: r.category,
  location: r.location,
  dateEvent: r.date_event,
  image: r.image ? '/uploads/' + r.image : null,
  status: r.status,
  createdAt: r.created_at,
  ownerId: r.user_id,
  ownerName: r.owner_name,
  claimCount: r.claim_count,
});

const SELECT = `
  SELECT i.*, u.name AS owner_name,
         (SELECT COUNT(*) FROM claims c WHERE c.item_id = i.id) AS claim_count
  FROM items i JOIN users u ON u.id = i.user_id`;

const removeFile = (name) => name && fs.unlink(path.join(UPLOAD_DIR, name), () => {});

// GET /api/items?search=&type=&category=&status=&sort=&page=   (Feature 4: search + filter)
router.get('/', (req, res) => {
  const where = ["i.status != 'removed'"];
  const params = [];

  const search = str(req.query.search).slice(0, 80);
  if (search) {
    where.push("(i.title LIKE ? ESCAPE '\\' OR i.description LIKE ? ESCAPE '\\' OR i.location LIKE ? ESCAPE '\\')");
    const like = `%${likeEscape(search)}%`;
    params.push(like, like, like);
  }
  if (['lost', 'found'].includes(req.query.type)) {
    where.push('i.type = ?');
    params.push(req.query.type);
  }
  if (CATEGORIES.includes(req.query.category)) {
    where.push('i.category = ?');
    params.push(req.query.category);
  }
  if (['open', 'claimed', 'resolved'].includes(req.query.status)) {
    where.push('i.status = ?');
    params.push(req.query.status);
  }

  const order = req.query.sort === 'oldest' ? 'ASC' : 'DESC';
  const pageSize = 9;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const clause = ' WHERE ' + where.join(' AND ');

  const total = db.prepare('SELECT COUNT(*) AS n FROM items i' + clause).get(...params).n;
  const rows = db
    .prepare(`${SELECT}${clause} ORDER BY i.created_at ${order}, i.id ${order} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);

  res.json({ items: rows.map(toItem), total, page, pages: Math.max(1, Math.ceil(total / pageSize)) });
});

// GET /api/items/mine  -> items posted by the logged-in user
router.get('/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare(`${SELECT} WHERE i.user_id = ? AND i.status != 'removed' ORDER BY i.created_at DESC`)
    .all(req.user.id);
  res.json({ items: rows.map(toItem) });
});

// POST /api/items  multipart/form-data  (Feature 3: report a lost / found item with a photo)
router.post('/', requireAuth, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) return next(err);

    const type = str(req.body.type);
    const title = str(req.body.title);
    const description = str(req.body.description);
    const category = str(req.body.category);
    const location = str(req.body.location);
    const dateEvent = str(req.body.dateEvent);

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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateEvent) || isNaN(d) || d > today || d < yearAgo)
      fields.dateEvent = 'Enter a valid date within the last year (not in the future).';

    if (Object.keys(fields).length) {
      if (req.file) removeFile(req.file.filename);
      return res.status(400).json({ error: 'Please correct the highlighted fields.', fields });
    }

    const info = db
      .prepare(
        'INSERT INTO items (user_id, type, title, description, category, location, date_event, image) VALUES (?,?,?,?,?,?,?,?)'
      )
      .run(req.user.id, type, title, description, category, location, dateEvent, req.file ? req.file.filename : null);
    res.status(201).json({ id: info.lastInsertRowid });
  });
});

// DELETE /api/items/:id  (owner or admin)
router.delete('/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  if (item.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'You can only delete your own posts.' });
  db.prepare('DELETE FROM items WHERE id = ?').run(item.id);
  removeFile(item.image);
  res.json({ ok: true });
});

module.exports = router;
module.exports.toItem = toItem;
module.exports.SELECT = SELECT;
