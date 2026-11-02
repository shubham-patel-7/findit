/* MODULE 1 (Student 1) - Profile page: edit details, change password, list/delete own posts */
(async () => {
  if (!(await initPage({ login: true }))) return;
  const u = CURRENT.user;

  document.getElementById('p-regNo').textContent = u.regNo;
  document.getElementById('p-email').textContent = u.email;
  document.getElementById('p-since').textContent = fmtDate(u.createdAt);

  const profileForm = document.getElementById('profile-form');
  profileForm.elements.name.value = u.name;
  profileForm.elements.phone.value = u.phone || '';

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const box = document.getElementById('profile-alert');
    box.hidden = true;
    if (!validateForm(profileForm)) return;
    try {
      const { user } = await api('/api/auth/profile', { method: 'PUT', body: Object.fromEntries(new FormData(profileForm)) });
      CURRENT.user = user; renderHeader();
      showAlert(box, 'Profile updated.', 'success');
    } catch (err) { showAlert(box, err.message); showFieldErrors(profileForm, err.fields); }
  });

  const pwForm = document.getElementById('password-form');
  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const box = document.getElementById('pw-alert');
    box.hidden = true;
    if (!validateForm(pwForm)) return;
    try {
      await api('/api/auth/password', { method: 'PUT', body: Object.fromEntries(new FormData(pwForm)) });
      pwForm.reset(); pwForm.classList.remove('was-validated');
      showAlert(box, 'Password changed.', 'success');
    } catch (err) { showAlert(box, err.message); showFieldErrors(pwForm, err.fields); }
  });

  // ---- my posts ----
  const list = document.getElementById('my-posts');
  async function loadPosts() {
    const { items } = await api('/api/items/mine');
    if (!items.length) { list.innerHTML = '<p class="text-muted mb-0">You have not posted anything yet.</p>'; return; }
    list.innerHTML = `<div class="list-group list-group-flush">${items.map((i) => `
      <div class="list-group-item px-0 d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <div>
          <span class="badge badge-${i.type} me-1">${i.type === 'lost' ? 'Lost' : 'Found'}</span>
          <a href="/item.html?id=${i.id}" class="fw-semibold">${esc(i.title)}</a>
          <div class="item-meta">${esc(i.location)} &middot; posted ${timeAgo(i.createdAt)}</div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <span class="badge badge-status-${i.status} text-capitalize">${i.status}</span>
          <button class="btn btn-outline-danger btn-sm" data-del="${i.id}" data-title="${esc(i.title)}" aria-label="Delete post ${esc(i.title)}"><i class="bi bi-trash" aria-hidden="true"></i></button>
        </div>
      </div>`).join('')}</div>`;
  }
  list.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b || !confirm(`Delete "${b.dataset.title}"? This also removes its claims.`)) return;
    try { await api('/api/items/' + b.dataset.del, { method: 'DELETE' }); loadPosts(); }
    catch (err) { alert(err.message); }
  });
  loadPosts();
})();
