// Builds the static site for GitHub Pages:  node scripts/build-pages.js  ->  dist/
// dist/ = everything in public/ + the sample photos used by the in-browser demo data (js/local-api.js).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

fs.mkdirSync(dist, { recursive: true });
for (const f of fs.readdirSync(dist)) fs.rmSync(path.join(dist, f), { recursive: true, force: true }); // clear contents (the folder itself may be in use)
fs.cpSync(path.join(root, 'public'), dist, { recursive: true });
fs.cpSync(path.join(root, 'seed-assets'), path.join(dist, 'seed-assets'), { recursive: true });
fs.writeFileSync(path.join(dist, '.nojekyll'), ''); // publish files as they are

console.log('Static site written to dist/');
