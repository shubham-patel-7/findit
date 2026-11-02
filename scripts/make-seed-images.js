// One-off helper (needs the server running on :3000): renders simple illustrated placeholder photos for the demo data (seed-assets/*.png)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');
const items = [
  ['calculator', 'bi-calculator', '#1f2f55', '#3b5ba9'],
  ['bottle', 'bi-cup-straw', '#0b7a6b', '#27b39e'],
  ['keys', 'bi-key-fill', '#8a5a00', '#e0a21b'],
  ['hoodie', 'bi-handbag-fill', '#444b5e', '#7d869c'],
  ['book', 'bi-book-fill', '#7a1f3a', '#c24566'],
  ['earbuds', 'bi-headphones', '#4b3b8f', '#8a73d8'],
  ['umbrella', 'bi-umbrella-fill', '#17496b', '#3f8fc2'],
  ['wallet', 'bi-wallet2', '#5a3d20', '#a8743f'],
];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  for (const [name, icon, c1, c2] of items) {
    // write a temp page next to the icon font so the file:// font URL resolves
    const tmp = path.join(root, 'public', '_tmp-seed.html');
    fs.writeFileSync(tmp, `<link rel="stylesheet" href="/vendor/icons/bootstrap-icons.min.css">
      <body style="margin:0;width:800px;height:500px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,${c1},${c2})">
      <i class="bi ${icon}" style="font-size:260px;color:rgba(255,255,255,.92)"></i></body>`);
    await page.goto('http://localhost:3000/_tmp-seed.html');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(root, 'seed-assets', name + '.png') });
  }
  fs.rmSync(path.join(root, 'public', '_tmp-seed.html'), { force: true });
  await browser.close();
})();
