// SQLite connection, schema and helpers (shared by both team members)
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dir, { recursive: true });

const db = new Database(path.join(dir, process.env.DB_FILE || 'findit.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  reg_no        TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('lost','found')),
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  category    TEXT NOT NULL,
  location    TEXT NOT NULL,
  date_event  TEXT NOT NULL,
  image       TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','resolved','removed')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);

CREATE TABLE IF NOT EXISTS claims (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id      INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  claimant_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (item_id, claimant_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  link       TEXT,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);
`);

// Make sure there is always one administrator account (change the password after first login).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@findit.edu';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
if (!db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) {
  db.prepare(
    "INSERT INTO users (name, reg_no, email, phone, password_hash, role) VALUES (?,?,?,?,?, 'admin')"
  ).run('Campus Admin', '000000000', ADMIN_EMAIL, '', bcrypt.hashSync(ADMIN_PASSWORD, 10));
}

/** Create an in-app notification for a user. */
function notify(userId, message, link = null) {
  db.prepare('INSERT INTO notifications (user_id, message, link) VALUES (?,?,?)').run(userId, message, link);
}

module.exports = { db, notify };
