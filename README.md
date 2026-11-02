# FindIt – Campus Lost & Found

A full-stack web app where MIT Manipal students report lost or found items, search the board, send claims
and get the item back. Built for the **Web Technology (ICT 3131)** project.

**Stack:** HTML5 · CSS3 · Bootstrap 5.3 · vanilla JavaScript · Node.js · Express 5 · SQLite (better-sqlite3) · Chart.js

## Run it

```bash
npm install
npm run seed      # optional: demo users, posts, claims
npm start         # http://localhost:3000
npm test          # API tests
```

Demo logins (after `npm run seed`): `aarav@demo.edu` / `Demo@1234` (student) and `admin@findit.edu` / `Admin@123` (admin).
Change the admin password with `ADMIN_PASSWORD=... npm start` before the first run, and set `JWT_SECRET` in production.

## Live demo (GitHub Pages)

The same front end also runs as a **static site** on GitHub Pages. GitHub Pages cannot run Node.js, so
`public/js/local-api.js` re-implements the REST API in the browser (data is saved in `localStorage`, photos are
down-scaled and stored as data URLs). The page code (`common.js`, `browse.js`, `item.js` ...) is identical in both
modes: on startup the app probes `api/auth/me`; if the host answers with JSON (the Express server) it uses the real
back end, otherwise it uses the in-browser one. Sample data is created on the first visit
(`aarav@demo.edu` / `Demo@1234`, admin `admin@findit.edu` / `Admin@123`); use **Reset demo data** in the footer to start over.

```bash
npm run build:pages   # writes the static site to dist/
npm run preview       # build + serve dist/ on http://localhost:8080
```

Pushing to `main` deploys `dist/` through `.github/workflows/pages.yml`.

Theme: "Wine & Noir" (wine `#7b1230`, black `#0e0b0d`), defined as CSS variables at the top of `public/css/style.css`.

## Features and division of work

| # | Feature | Pages | Built by |
|---|---------|-------|----------|
| 1 | Register / login / logout (bcrypt + JWT cookie) | `register.html`, `login.html` | Student 1 |
| 2 | Profile, change password, manage own posts | `profile.html` | Student 1 |
| 3 | Report a lost/found item with photo upload | `report.html` | Student 1 |
| 4 | Search, filter, sort and paginate items | `index.html` | Student 1 |
| 5 | Item details + send a claim | `item.html` | Student 2 |
| 6 | Owner approves/rejects claims, contact reveal, notifications | `item.html`, `notifications.html` | Student 2 |
| 7 | Dashboard with live charts (Chart.js) | `dashboard.html` | Student 2 |
| 8 | Admin moderation (remove/restore posts, user list) | `admin.html` | Student 2 |

Back end: `routes/auth.js`, `routes/items.js` (Student 1); `routes/claims.js`, `routes/notifications.js`, `routes/stats.js`, `routes/admin.js` (Student 2).
Shared: `lib/`, `server.js`, `public/css/style.css`, `public/js/common.js`.

## Folder structure

```
server.js            Express entry point
lib/                 db (SQLite schema), auth middleware, validation
routes/              REST API (JSON / multipart)
public/              HTML pages, css/, js/, vendor/ (Bootstrap, icons, Chart.js)
scripts/             seed.js, screenshots.js
tests/api.test.js    API tests (node --test)
docs/screenshots/    screenshots used in the report
```
