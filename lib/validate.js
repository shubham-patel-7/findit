// Server-side validation helpers. The browser also validates, but the server never trusts it.
const CATEGORIES = [
  'Electronics',
  'ID & Cards',
  'Books & Stationery',
  'Clothing & Bags',
  'Keys',
  'Bottles & Accessories',
  'Other',
];

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const isRegNo = (s) => /^\d{9}$/.test(s);
const isPhone = (s) => s === '' || /^[0-9+\-\s]{10,15}$/.test(s);
// at least 8 chars, one letter and one digit
const isStrongPassword = (s) => typeof s === 'string' && s.length >= 8 && /[A-Za-z]/.test(s) && /\d/.test(s);

/** Escape % and _ so user text can be used safely inside a LIKE pattern. */
const likeEscape = (s) => s.replace(/[\\%_]/g, (m) => '\\' + m);

module.exports = { CATEGORIES, str, isEmail, isRegNo, isPhone, isStrongPassword, likeEscape };
