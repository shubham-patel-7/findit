/* MODULE 3 (Student 2) - Notifications page */
(async () => {
  if (!(await initPage({ login: true }))) return;
  const list = document.getElementById('list');
  const markAll = document.getElementById('mark-all');

  async function load() {
    const { notifications, unread } = await api('/api/notifications');
    markAll.disabled = unread === 0;
    if (!notifications.length) { list.innerHTML = '<p class="p-4 mb-0 text-center text-muted"><i class="bi bi-bell-slash display-5 d-block mb-2" aria-hidden="true"></i>You have no notifications yet.</p>'; return; }
    list.innerHTML = notifications.map((n) => {
      const body = `<div><div>${esc(n.message)}</div><div class="item-meta">${timeAgo(n.createdAt)}</div></div>`;
      const icon = `<i class="bi ${n.isRead ? 'bi-bell' : 'bi-bell-fill'}" aria-hidden="true"></i>`;
      return n.link
        ? `<a class="note text-decoration-none text-reset${n.isRead ? '' : ' unread'}" href="${esc(n.link)}" data-id="${n.id}">${icon}${body}</a>`
        : `<div class="note${n.isRead ? '' : ' unread'}">${icon}${body}</div>`;
    }).join('');
  }

  // opening a notification marks it as read
  list.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-id]');
    // keepalive lets the request finish even though the page is about to navigate away
    if (a) fetch(`/api/notifications/${a.dataset.id}/read`, { method: 'PATCH', keepalive: true, credentials: 'same-origin' });
  });
  markAll.addEventListener('click', async () => {
    await api('/api/notifications/read-all', { method: 'PATCH' });
    CURRENT.unread = 0; renderHeader(); load();
  });
  load();
})();
