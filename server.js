// FindIt - Campus Lost & Found. Entry point (Express 5 + SQLite).
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { attachUser } = require('./lib/auth');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// static front end + uploaded photos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'), { fallthrough: false }));

// API
app.use('/api', attachUser);
app.use('/api/auth', require('./routes/auth')); //          Student 1
app.use('/api/items', require('./routes/items')); //        Student 1
app.use('/api', require('./routes/claims')); //             Student 2
app.use('/api/notifications', require('./routes/notifications')); // Student 2
app.use('/api/stats', require('./routes/stats')); //        Student 2
app.use('/api/admin', require('./routes/admin')); //        Student 2
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// central error handler (upload problems, malformed JSON, ...)
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be smaller than 3 MB.' : 'Upload failed.';
    return res.status(400).json({ error: msg, fields: { image: msg } });
  }
  if (err.message && err.message.startsWith('Only JPG')) return res.status(400).json({ error: err.message, fields: { image: err.message } });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON.' });
  if (err.status === 404 || err.code === 'ENOENT') return res.status(404).send('Not found');
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`FindIt running at http://localhost:${PORT}`));
}
module.exports = app;
