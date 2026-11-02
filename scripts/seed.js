// Fills the database with demo users, posts, claims and notifications.   Usage: npm run seed
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db } = require('../lib/db');

if (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'student'").get().n > 0 && !process.argv.includes('--force')) {
  console.log('Database already has students. Re-run with --force to wipe and re-seed.');
  process.exit(0);
}
db.exec('DELETE FROM notifications; DELETE FROM claims; DELETE FROM items; DELETE FROM users WHERE role = \'student\';');

const UPLOADS = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });
const daysAgo = (d, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();
const dateOnly = (d) => daysAgo(d).slice(0, 10);

// ---- users (password for all demo students: Demo@1234) ----
const hash = bcrypt.hashSync('Demo@1234', 10);
const people = [
  ['Aarav Sharma', '220911001', 'aarav@demo.edu', '9876500001'],
  ['Diya Menon', '220911002', 'diya@demo.edu', '9876500002'],
  ['Rohan Iyer', '220911003', 'rohan@demo.edu', '9876500003'],
  ['Meera Nair', '220911004', 'meera@demo.edu', '9876500004'],
  ['Kabir Singh', '220911005', 'kabir@demo.edu', '9876500005'],
  ['Ananya Rao', '220911006', 'ananya@demo.edu', '9876500006'],
];
const insUser = db.prepare('INSERT INTO users (name, reg_no, email, phone, password_hash, created_at) VALUES (?,?,?,?,?,?)');
const uid = people.map((p, i) => insUser.run(p[0], p[1], p[2], p[3], hash, daysAgo(40 - i)).lastInsertRowid);

// ---- items: [owner, type, title, description, category, location, daysAgo, status, image] ----
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

const insItem = db.prepare(
  'INSERT INTO items (user_id, type, title, description, category, location, date_event, image, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
);
const itemIds = rows.map((r, i) => {
  let image = null;
  if (r[8]) {
    image = `seed-${r[8]}.png`;
    fs.copyFileSync(path.join(__dirname, '..', 'seed-assets', r[8] + '.png'), path.join(UPLOADS, image));
  }
  return insItem.run(uid[r[0]], r[1], r[2], r[3], r[4], r[5], dateOnly(r[6]), image, r[7], daysAgo(r[6], i)).lastInsertRowid;
});

// ---- claims & notifications ----
const insClaim = db.prepare('INSERT INTO claims (item_id, claimant_id, message, status, created_at) VALUES (?,?,?,?,?)');
const insNote = db.prepare('INSERT INTO notifications (user_id, message, link, is_read, created_at) VALUES (?,?,?,?,?)');
const link = (n) => `/item.html?id=${itemIds[n]}`;

insClaim.run(itemIds[0], uid[1], 'This is mine - the initials on the back are R.K. (Riya Kapoor, my lab partner) and the cover has a scratch near the hinge.', 'pending', daysAgo(0, 5));
insClaim.run(itemIds[0], uid[4], 'I think I left my calculator in room 204 yesterday. It has a green sticker inside the cover.', 'pending', daysAgo(0, 2));
insClaim.run(itemIds[3], uid[2], 'I found a red football keychain near the sports complex gate and handed it in at the security desk.', 'pending', daysAgo(1));
insClaim.run(itemIds[4], uid[0], 'The hoodie is mine, I had a library receipt for "Operating Systems" in the pocket.', 'approved', daysAgo(3));
insClaim.run(itemIds[6], uid[5], 'The case has a green cover and the left earbud is slightly loose. I lost it after the hackathon.', 'approved', daysAgo(6));
insClaim.run(itemIds[7], uid[3], 'I found it in AB1 and kept it at the department office.', 'approved', daysAgo(9));
insClaim.run(itemIds[8], uid[4], 'These are my spare spectacles, prescription -2.25.', 'approved', daysAgo(11));

insNote.run(uid[0], 'Kabir Singh sent a claim for "Black Casio scientific calculator".', link(0), 0, daysAgo(0, 2));
insNote.run(uid[0], 'Diya Menon sent a claim for "Black Casio scientific calculator".', link(0), 0, daysAgo(0, 5));
insNote.run(uid[0], 'Rohan Iyer sent a claim for "Set of keys with red keychain".', link(3), 0, daysAgo(1));
insNote.run(uid[0], 'Your claim for "Grey hoodie, size M" was approved. Contact Meera Nair: meera@demo.edu, 9876500004.', link(4), 1, daysAgo(2));
insNote.run(uid[3], 'Aarav Sharma sent a claim for "Grey hoodie, size M".', link(4), 1, daysAgo(3));

console.log(`Seeded ${people.length} students, ${rows.length} items. Demo login: aarav@demo.edu / Demo@1234  |  admin: admin@findit.edu / Admin@123`);
