/* MODULE 2 (Student 1) - Report an item: validation, live image preview, multipart upload */
(async () => {
  if (!(await initPage({ login: true }))) return;

  const form = document.getElementById('report-form');
  const alertBox = document.getElementById('form-alert');
  const typeError = document.getElementById('type-error');
  const img = form.elements.image;
  const preview = document.getElementById('preview');
  const MAX = 3 * 1024 * 1024;

  CATEGORIES.forEach((c) => form.elements.category.insertAdjacentHTML('beforeend', `<option>${esc(c)}</option>`));

  // date cannot be in the future or older than a year (matches the server rule)
  const today = new Date();
  const yearAgo = new Date(); yearAgo.setFullYear(today.getFullYear() - 1);
  const iso = (d) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  form.elements.dateEvent.max = iso(today);
  form.elements.dateEvent.min = iso(yearAgo);
  form.elements.dateEvent.value = iso(today);

  // ?type=lost|found pre-selects the toggle
  const t = new URLSearchParams(location.search).get('type');
  if (t === 'lost' || t === 'found') document.getElementById('type-' + t).checked = true;

  // character counter
  const desc = form.elements.description;
  desc.addEventListener('input', () => (document.getElementById('desc-count').textContent = desc.value.length));

  // image: check type/size in the browser and show a preview
  img.addEventListener('change', () => {
    const f = img.files[0];
    img.setCustomValidity('');
    preview.hidden = true;
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > MAX) {
      img.setCustomValidity('invalid');
      img.classList.add('is-invalid');
      return;
    }
    img.classList.remove('is-invalid');
    preview.src = URL.createObjectURL(f);
    preview.hidden = false;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.hidden = true;
    const typeChosen = !!form.querySelector('input[name=type]:checked');
    typeError.hidden = typeChosen;
    if (!validateForm(form) || !typeChosen) return;

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      // multipart/form-data: text fields + the image file in a single POST
      const { id } = await api('/api/items', { method: 'POST', body: new FormData(form) });
      location.href = 'item.html?id=' + id + '&posted=1';
    } catch (err) {
      showAlert(alertBox, err.message);
      showFieldErrors(form, err.fields);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      btn.disabled = false;
    }
  });
})();
