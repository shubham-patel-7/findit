/* MODULE 4 (Student 2) - Dashboard: personal tiles + Chart.js charts from /api/stats */
(async () => {
  if (!(await initPage({ login: true }))) return;

  const tile = (icon, label, value, extra = '') =>
    `<div class="col-6 col-lg-3"><div class="stat-tile"><div class="label"><i class="bi ${icon} me-1" aria-hidden="true"></i>${label}</div><div class="value">${value}${extra}</div></div></div>`;

  const [me, stats] = await Promise.all([api('/api/stats/me'), api('/api/stats')]);

  document.getElementById('my-tiles').innerHTML =
    tile('bi-card-list', 'My posts', me.posts) +
    tile('bi-hourglass-split', 'Still active', me.active) +
    tile('bi-check2-circle', 'Resolved', me.resolved) +
    tile('bi-inbox', 'Claims to review', me.pendingIncoming);

  const t = stats.totals;
  document.getElementById('campus-tiles').innerHTML =
    tile('bi-search', 'Lost reports', t.lost) +
    tile('bi-hand-thumbs-up', 'Found reports', t.found) +
    tile('bi-people', 'Students', t.users) +
    tile('bi-graph-up-arrow', 'Recovery rate', t.recoveryRate, '<small class="fs-6">%</small>');

  // ---- tables ----
  const empty = (msg) => `<p class="text-muted mb-0">${msg}</p>`;
  document.getElementById('incoming').innerHTML = me.incoming.length
    ? `<ul class="list-group list-group-flush">${me.incoming.map((c) => `
        <li class="list-group-item px-0 d-flex justify-content-between align-items-center gap-2">
          <span><strong>${esc(c.claimant)}</strong> on <a href="/item.html?id=${c.itemId}">${esc(c.title)}</a><br><small class="text-muted">${timeAgo(c.createdAt)}</small></span>
          <a class="btn btn-sm btn-ink" href="/item.html?id=${c.itemId}">Review</a></li>`).join('')}</ul>`
    : empty('No pending claims. You are all caught up.');

  document.getElementById('outgoing').innerHTML = me.myClaims.length
    ? `<ul class="list-group list-group-flush">${me.myClaims.map((c) => `
        <li class="list-group-item px-0 d-flex justify-content-between align-items-center gap-2">
          <span><a href="/item.html?id=${c.itemId}">${esc(c.title)}</a><br><small class="text-muted">${timeAgo(c.createdAt)}</small></span>
          <span class="badge badge-status-${c.status} text-capitalize">${c.status}</span></li>`).join('')}</ul>`
    : empty('You have not sent any claims yet.');

  // ---- charts (Chart.js, served from /vendor so the app works offline) ----
  const PALETTE = ['#14213d', '#fca311', '#0b7a6b', '#b3263f', '#5b7bd5', '#8a6dd0', '#7a8499'];
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = '#3b4458';

  new Chart(document.getElementById('chart-category'), {
    type: 'doughnut',
    data: {
      labels: stats.byCategory.map((c) => c.category),
      datasets: [{ data: stats.byCategory.map((c) => c.count), backgroundColor: PALETTE, borderWidth: 2, borderColor: '#fff' }],
    },
    options: { maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } } },
  });

  new Chart(document.getElementById('chart-weekly'), {
    type: 'bar',
    data: {
      labels: stats.weekly.map((w) => (w.weeksAgo === 0 ? 'This week' : w.weeksAgo + 'w ago')),
      datasets: [
        { label: 'Lost', data: stats.weekly.map((w) => w.lost), backgroundColor: '#b3263f', borderRadius: 4 },
        { label: 'Found', data: stats.weekly.map((w) => w.found), backgroundColor: '#0b7a6b', borderRadius: 4 },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#e3e7f0' } }, x: { grid: { display: false } } },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
    },
  });
})();
