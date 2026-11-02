/* Shared front-end helpers: API wrapper, header/footer, formatting, validation helpers.
   Loaded on every page so header, footer and behaviour are identical across the site. */

const CATEGORIES = ['Electronics', 'ID & Cards', 'Books & Stationery', 'Clothing & Bags', 'Keys', 'Bottles & Accessories', 'Other'];
const CATEGORY_ICONS = {
  'Electronics': 'bi-phone', 'ID & Cards': 'bi-person-vcard', 'Books & Stationery': 'bi-journal-bookmark',
  'Clothing & Bags': 'bi-handbag', 'Keys': 'bi-key', 'Bottles & Accessories': 'bi-cup-straw', 'Other': 'bi-box-seam',
};

/** Escape text before putting it inside innerHTML (prevents XSS from user-written content). */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** fetch() wrapper: sends/receives JSON (or FormData) and throws an Error with .fields on failure. */
async function api(url, { method = 'GET', body } = {}) {
  const opts = { method, headers: {}, credentials: 'same-origin' };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(url, opts);
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed.');
    err.status = res.status;
    err.fields = data.fields || {};
    throw err;
  }
  return data;
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
function timeAgo(iso) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso)) / 1000));
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, secs] of units) if (s >= secs) { const n = Math.floor(s / secs); return `${n} ${name}${n > 1 ? 's' : ''} ago`; }
  return 'just now';
}

/* ---------- current user + header / footer ---------- */
let CURRENT = { user: null, unread: 0 };

async function loadSession() {
  try { CURRENT = await api('/api/auth/me'); } catch { CURRENT = { user: null, unread: 0 }; }
  return CURRENT;
}

function renderHeader() {
  const u = CURRENT.user;
  const here = location.pathname.split('/').pop() || 'index.html'; // file name, so it also works under a sub-folder such as /findit/
  const link = (href, icon, text) =>
    `<li class="nav-item"><a class="nav-link${here === href ? ' active' : ''}" href="${href}"${here === href ? ' aria-current="page"' : ''}><i class="bi ${icon} me-1" aria-hidden="true"></i>${text}</a></li>`;

  const right = u
    ? `<li class="nav-item">
         <a class="nav-link position-relative${here === 'notifications.html' ? ' active' : ''}" href="notifications.html" aria-label="Notifications${CURRENT.unread ? ', ' + CURRENT.unread + ' unread' : ''}">
           <i class="bi bi-bell" aria-hidden="true"></i><span class="d-lg-none ms-2">Notifications</span>
           ${CURRENT.unread ? `<span class="badge rounded-pill bg-danger badge-dot ms-1">${CURRENT.unread}</span>` : ''}
         </a></li>
       <li class="nav-item dropdown">
         <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false"><i class="bi bi-person-circle me-1" aria-hidden="true"></i>${esc(u.name.split(' ')[0])}</a>
         <ul class="dropdown-menu dropdown-menu-end">
           <li><a class="dropdown-item" href="profile.html">My profile</a></li>
           <li><a class="dropdown-item" href="dashboard.html">Dashboard</a></li>
           <li><hr class="dropdown-divider"></li>
           <li><button class="dropdown-item" id="logout-btn" type="button">Log out</button></li>
         </ul></li>`
    : `<li class="nav-item"><a class="nav-link${here === 'login.html' ? ' active' : ''}" href="login.html">Log in</a></li>
       <li class="nav-item ms-lg-2"><a class="btn btn-accent btn-sm mt-1 mt-lg-0" href="register.html">Sign up</a></li>`;

  document.getElementById('site-header').innerHTML = `
    <nav class="navbar navbar-expand-lg site-nav" aria-label="Main navigation">
      <div class="container">
        <a class="navbar-brand" href="index.html"><span class="brand-mark"><i class="bi bi-search-heart" aria-hidden="true"></i></span>FindIt</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav-menu" aria-controls="nav-menu" aria-expanded="false" aria-label="Toggle navigation"><span class="navbar-toggler-icon"></span></button>
        <div class="collapse navbar-collapse" id="nav-menu">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            ${link('index.html', 'bi-grid', 'Browse')}
            ${link('report.html', 'bi-plus-circle', 'Report item')}
            ${u ? link('dashboard.html', 'bi-bar-chart', 'Dashboard') : ''}
            ${u && u.role === 'admin' ? link('admin.html', 'bi-shield-check', 'Admin') : ''}
          </ul>
          <ul class="navbar-nav align-items-lg-center">${right}</ul>
        </div>
      </div>
    </nav>`;

  const out = document.getElementById('logout-btn');
  if (out) out.addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST' }); location.href = 'login.html'; });
}

function renderFooter() {
  const demo = window.FINDIT_LOCAL && window.FINDIT_LOCAL.isActive();
  document.getElementById('site-footer').innerHTML = `
    <div class="site-footer py-4"><div class="container d-flex flex-column flex-md-row justify-content-between gap-2 small">
      <span><strong class="text-white">FindIt</strong> &middot; Campus Lost &amp; Found, MIT Manipal</span>
      <span>Web Technology project (ICT 3131) &middot; Built with HTML5, CSS3, JavaScript${demo ? ' &middot; <span title="Posts, claims and accounts are saved in this browser (localStorage)">Demo mode</span> &middot; <button type="button" class="btn btn-link btn-sm p-0 align-baseline link-light" id="reset-demo">Reset demo data</button>' : ', Node.js &amp; SQLite'}</span>
    </div></div>`;
  const reset = document.getElementById('reset-demo');
  if (reset) reset.addEventListener('click', () => { if (confirm('Delete everything you added in this browser and restore the sample data?')) window.FINDIT_LOCAL.reset(); });
}

/** Every page calls this first. opts.login = page needs a logged-in user, opts.admin = admin only. */
async function initPage(opts = {}) {
  await loadSession();
  renderHeader();
  renderFooter();
  if (opts.login && !CURRENT.user) { location.href = 'login.html?next=' + encodeURIComponent(location.pathname + location.search); return false; }
  if (opts.admin && (!CURRENT.user || CURRENT.user.role !== 'admin')) { location.href = 'index.html'; return false; }
  return true;
}

/* ---------- small UI helpers ---------- */
function showAlert(el, message, type = 'danger') {
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.hidden = false;
}

/** Show server-side field errors next to the matching inputs (Bootstrap .is-invalid). */
function showFieldErrors(form, fields = {}) {
  form.querySelectorAll('.is-invalid').forEach((i) => i.classList.remove('is-invalid'));
  Object.entries(fields).forEach(([name, msg]) => {
    const input = form.elements[name];
    if (!input) return;
    const target = input.length && !input.tagName ? input[0] : input;
    target.classList.add('is-invalid');
    const fb = target.parentElement.querySelector('.invalid-feedback') || form.querySelector(`[data-feedback="${name}"]`);
    if (fb) fb.textContent = msg;
  });
}

/** Client-side validation using the browser Constraint Validation API + Bootstrap styles. */
function validateForm(form) {
  form.classList.add('was-validated');
  form.querySelectorAll('.is-invalid').forEach((i) => i.classList.remove('is-invalid'));
  if (!form.checkValidity()) {
    const first = form.querySelector(':invalid');
    if (first) first.focus();
    return false;
  }
  return true;
}

function itemCard(it) {
  const icon = CATEGORY_ICONS[it.category] || 'bi-box-seam';
  const img = it.image
    ? `<img src="${esc(it.image)}" alt="Photo of ${esc(it.title)}" loading="lazy">`
    : `<i class="bi ${icon}" aria-hidden="true"></i>`;
  return `
    <div class="col-sm-6 col-lg-4">
      <article class="item-card">
        <div class="thumb">${img}<span class="badge badge-${it.type}">${it.type === 'lost' ? 'Lost' : 'Found'}</span></div>
        <div class="card-body p-3">
          <h3 class="h6 mb-1"><a class="stretched-link" href="item.html?id=${it.id}">${esc(it.title)}</a></h3>
          <p class="item-meta mb-2"><i class="bi bi-geo-alt" aria-hidden="true"></i> ${esc(it.location)} &middot; ${fmtDate(it.dateEvent + 'T00:00:00')}</p>
          <p class="mb-0 small text-truncate-2">${esc(it.description.length > 90 ? it.description.slice(0, 90) + '…' : it.description)}</p>
        </div>
        <div class="card-footer bg-white border-0 pt-0 pb-3 px-3 d-flex justify-content-between align-items-center">
          <span class="badge badge-status-${it.status} text-capitalize">${it.status}</span>
          <span class="item-meta"><i class="bi ${icon}" aria-hidden="true"></i> ${esc(it.category)}</span>
        </div>
      </article>
    </div>`;
}
