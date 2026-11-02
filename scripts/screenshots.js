// Drives the running app (http://localhost:3000) and saves the screenshots used in the report.
// Usage: node scripts/screenshots.js   (server must be running with seeded data: npm run seed)
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
const BASE = process.env.BASE || 'http://localhost:3000';
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(OUT, name + '.png'), ...opts });
const settle = (page) => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(500));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  // ---------- Student 1 / Module 1: accounts ----------
  await page.goto(BASE + '/register.html'); await settle(page);
  await page.fill('#name', 'Neha Kulkarni');
  await page.fill('#regNo', '12345');          // invalid on purpose -> shows client-side validation
  await page.fill('#email', 'neha@');
  await page.fill('#password', 'abc');
  await page.click('button[type=submit]');
  await page.waitForTimeout(300);
  await shot(page, '01-register-validation');

  await page.fill('#regNo', '220911007');
  await page.fill('#email', 'neha@demo.edu');
  await page.fill('#phone', '9876500007');
  await page.fill('#password', 'Demo@1234');
  await page.click('button[type=submit]');
  await page.waitForURL(BASE + '/'); await settle(page);
  // log out and log in as the main demo user
  await page.click('.dropdown-toggle'); await page.click('#logout-btn'); await page.waitForURL('**/login.html');

  await page.fill('#email', 'aarav@demo.edu');
  await page.fill('#password', 'wrongpass1');
  await page.click('button[type=submit]'); await page.waitForTimeout(500);
  await shot(page, '02-login-error');
  await page.fill('#password', 'Demo@1234');
  await page.click('button[type=submit]');
  await page.waitForURL(BASE + '/'); await settle(page);

  await page.goto(BASE + '/profile.html'); await settle(page);
  await page.fill('#phone', '9876500001');
  await page.click('#profile-form button[type=submit]'); await page.waitForTimeout(400);
  await shot(page, '03-profile', { fullPage: true });

  // ---------- Student 1 / Module 2: browse + report ----------
  await page.goto(BASE + '/'); await settle(page);
  await shot(page, '04-browse-home', { fullPage: false });
  await page.fill('#f-search', 'bottle'); await page.waitForTimeout(900);
  await page.goto(BASE + '/?type=found&category=Electronics'); await settle(page);
  await shot(page, '05-browse-filtered');
  await page.goto(BASE + '/'); await settle(page);
  await page.click('[data-page="2"]'); await page.waitForTimeout(800);
  await shot(page, '06-browse-page2');

  await page.goto(BASE + '/report.html?type=found'); await settle(page);
  await page.click('#report-form button[type=submit]'); await page.waitForTimeout(300); // empty -> validation
  await page.fill('#title', 'Silver HP laptop charger');
  await page.selectOption('#category', 'Electronics');
  await page.fill('#description', '65W USB-C charger with a black cable, found plugged in near the window seats.');
  await page.fill('#location', 'Central Library');
  await page.setInputFiles('#image', path.join(__dirname, '..', 'seed-assets', 'calculator.png'));
  await page.waitForTimeout(400);
  await shot(page, '07-report-form', { fullPage: true });
  await page.click('#report-form button[type=submit]');
  await page.waitForURL('**/item.html?id=*'); await settle(page);
  await shot(page, '08-report-success');
  const newItemUrl = page.url();

  // ---------- Student 2 / Module 3: item details, claims, notifications ----------
  await page.goto(BASE + '/item.html?id=1'); await settle(page);
  await shot(page, '09-item-owner-claims', { fullPage: true });
  await page.click('[data-act="approve"] >> nth=0'); await page.waitForTimeout(600);
  await shot(page, '10-confirm-approve');
  await page.click('#confirm-ok'); await page.waitForTimeout(900);
  await shot(page, '11-claim-approved', { fullPage: true });

  await page.goto(BASE + '/notifications.html'); await settle(page);
  await shot(page, '12-notifications');

  // a different user sends a claim
  await page.click('.dropdown-toggle'); await page.click('#logout-btn'); await page.waitForURL('**/login.html');
  await page.fill('#email', 'ananya@demo.edu'); await page.fill('#password', 'Demo@1234');
  await page.click('button[type=submit]'); await page.waitForURL(BASE + '/');
  await page.goto(BASE + '/item.html?id=6'); await settle(page);
  await page.fill('#message', 'That is my Cormen textbook - my name "Ananya" is on the first page and it has yellow sticky notes.');
  await shot(page, '13-claim-form');
  await page.click('#claim-form button[type=submit]'); await page.waitForTimeout(900);
  await shot(page, '14-claim-sent');

  // approved claimant sees contact details (hoodie, item 5 -> claimed by Aarav)
  await page.click('.dropdown-toggle'); await page.click('#logout-btn'); await page.waitForURL('**/login.html');
  await page.fill('#email', 'aarav@demo.edu'); await page.fill('#password', 'Demo@1234');
  await page.click('button[type=submit]'); await page.waitForURL(BASE + '/');
  await page.goto(BASE + '/item.html?id=5'); await settle(page);
  await shot(page, '15-contact-revealed');

  // ---------- Student 2 / Module 4: dashboard + admin ----------
  await page.goto(BASE + '/dashboard.html'); await settle(page); await page.waitForTimeout(800);
  await shot(page, '16-dashboard', { fullPage: true });

  await page.click('.dropdown-toggle'); await page.click('#logout-btn'); await page.waitForURL('**/login.html');
  await page.fill('#email', 'admin@findit.edu'); await page.fill('#password', 'Admin@123');
  await page.click('button[type=submit]'); await page.waitForURL(BASE + '/');
  await page.goto(BASE + '/admin.html'); await settle(page);
  await shot(page, '17-admin-posts', { fullPage: true });
  await page.click('[data-to="removed"] >> nth=2'); await page.waitForTimeout(900);
  await shot(page, '18-admin-removed');
  await page.click('#tab-users'); await page.waitForTimeout(500);
  await shot(page, '19-admin-users');

  // mobile view of the home page
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const mp = await m.newPage();
  await mp.goto(BASE + '/'); await mp.waitForLoadState('networkidle'); await mp.waitForTimeout(500);
  await mp.screenshot({ path: path.join(OUT, '20-mobile-home.png') });

  console.log('console errors:', errors.length ? errors : 'none');
  console.log('new item url:', newItemUrl);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
