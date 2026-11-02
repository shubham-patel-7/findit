/* MODULE 4 (Student 2) - Admin panel: moderate posts, list users (admin only; re-checked on the server) */
(async () => {
  if (!(await initPage({ admin: true }))) return;

  const body = document.getElementById('items-body');
  const q = document.getElementById('a-q');
  const status = document.getElementById('a-status');
  const pageAlert = document.getElementById('page-alert');

  async function loadItems() {
    const params = new URLSearchParams();
    if (q.value.trim()) params.set('q', q.value.trim());
    if (status.value) params.set('status', status.value);
    const { items } = await api('/api/admin/items?' + params);
    body.innerHTML = items.length
      ? items.map((i) => `
        <tr>
          <td><a href="/item.html?id=${i.id}" class="fw-semibold">${esc(i.title)}</a><div class="item-meta">${esc(i.category)} &middot; ${esc(i.location)}</div></td>
          <td><span class="badge badge-${i.type}">${i.type}</span></td>
          <td>${esc(i.ownerName)}</td>
          <td><span class="badge badge-status-${i.status} text-capitalize">${i.status}</span></td>
          <td class="text-end">${i.status === 'removed'
            ? `<button class="btn btn-sm btn-outline-success" data-id="${i.id}" data-to="open">Restore</button>`
            : `<button class="btn btn-sm btn-outline-danger" data-id="${i.id}" data-to="removed">Remove</button>`}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" class="text-center text-muted py-4">No posts match.</td></tr>';
  }

  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    b.disabled = true;
    try {
      await api('/api/admin/items/' + b.dataset.id, { method: 'PATCH', body: { status: b.dataset.to } });
      showAlert(pageAlert, b.dataset.to === 'removed' ? 'Post removed. The author has been notified.' : 'Post restored.', 'success');
      loadItems();
    } catch (err) { showAlert(pageAlert, err.message); b.disabled = false; }
  });

  let timer;
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadItems, 300); });
  status.addEventListener('change', loadItems);
  document.getElementById('admin-filter').addEventListener('submit', (e) => { e.preventDefault(); loadItems(); });

  async function loadUsers() {
    const { users } = await api('/api/admin/users');
    document.getElementById('users-body').innerHTML = users.map((u) => `
      <tr><td>${esc(u.name)}</td><td>${esc(u.regNo)}</td><td class="text-break">${esc(u.email)}</td>
      <td><span class="badge ${u.role === 'admin' ? 'text-bg-dark' : 'text-bg-light border'} text-capitalize">${u.role}</span></td>
      <td class="text-end">${u.posts}</td><td>${fmtDate(u.createdAt)}</td></tr>`).join('');
  }

  loadItems();
  loadUsers();
})();
