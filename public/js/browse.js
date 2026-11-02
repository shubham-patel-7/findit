/* MODULE 2 (Student 1) - Browse page: live search, filters, sorting, pagination */
(async () => {
  await initPage();

  const form = document.getElementById('filter-form');
  const grid = document.getElementById('items');
  const count = document.getElementById('result-count');
  const pager = document.getElementById('pager');
  const sortSel = document.getElementById('f-sort');
  const category = document.getElementById('f-category');
  CATEGORIES.forEach((c) => category.insertAdjacentHTML('beforeend', `<option>${esc(c)}</option>`));

  // restore filters from the URL so a filtered view can be shared / bookmarked
  const q = new URLSearchParams(location.search);
  ['search', 'type', 'category', 'status'].forEach((n) => { if (q.get(n)) form.elements[n].value = q.get(n); });
  if (q.get('sort')) sortSel.value = q.get('sort');
  let page = parseInt(q.get('page'), 10) || 1;

  async function load() {
    const params = new URLSearchParams();
    ['search', 'type', 'category', 'status'].forEach((n) => form.elements[n].value && params.set(n, form.elements[n].value));
    if (sortSel.value !== 'newest') params.set('sort', sortSel.value);
    if (page > 1) params.set('page', page);
    history.replaceState(null, '', params.toString() ? '?' + params : location.pathname);

    grid.setAttribute('aria-busy', 'true');
    try {
      const data = await api('/api/items?' + params);
      count.textContent = data.total === 0 ? 'No items found' : `${data.total} item${data.total > 1 ? 's' : ''} found`;
      grid.innerHTML = data.items.length
        ? data.items.map(itemCard).join('')
        : `<div class="col-12"><div class="panel text-center py-5"><i class="bi bi-inbox display-4 text-muted" aria-hidden="true"></i>
             <p class="mt-2 mb-3">Nothing matches your search yet.</p><a class="btn btn-accent" href="report.html">Report an item</a></div></div>`;
      renderPager(data);
    } catch (e) {
      count.textContent = 'Could not load items';
      grid.innerHTML = `<div class="col-12"><div class="alert alert-danger">${esc(e.message)}</div></div>`;
    }
    grid.removeAttribute('aria-busy');
  }

  function renderPager({ page: p, pages }) {
    if (pages <= 1) { pager.innerHTML = ''; return; }
    let html = '<ul class="pagination justify-content-center">';
    html += `<li class="page-item${p === 1 ? ' disabled' : ''}"><button class="page-link" data-page="${p - 1}">Previous</button></li>`;
    for (let i = 1; i <= pages; i++)
      html += `<li class="page-item${i === p ? ' active' : ''}"><button class="page-link" data-page="${i}"${i === p ? ' aria-current="page"' : ''}>${i}</button></li>`;
    html += `<li class="page-item${p === pages ? ' disabled' : ''}"><button class="page-link" data-page="${p + 1}">Next</button></li></ul>`;
    pager.innerHTML = html;
  }

  pager.addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (!b) return;
    page = Number(b.dataset.page);
    load();
    document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
  });

  // debounce typing so we do not call the API on every keystroke
  let timer;
  form.addEventListener('input', (e) => {
    clearTimeout(timer);
    page = 1;
    timer = setTimeout(load, e.target.name === 'search' ? 300 : 0);
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); page = 1; load(); });
  sortSel.addEventListener('change', () => { page = 1; load(); });
  document.getElementById('f-reset').addEventListener('click', () => { form.reset(); sortSel.value = 'newest'; page = 1; load(); });

  load();
})();
