/* MODULE 1 (Student 1) - Register and login pages */
(async () => {
  await initPage();
  if (CURRENT.user) { location.href = '/'; return; } // already logged in

  const form = document.querySelector('form');
  const alertBox = document.getElementById('form-alert');
  const isRegister = form.id === 'register-form';

  // show / hide password
  const toggle = document.getElementById('toggle-pw');
  toggle.addEventListener('click', () => {
    const pw = document.getElementById('password');
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    toggle.firstElementChild.className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.hidden = true;
    if (!validateForm(form)) return; // 1) client-side validation

    const body = Object.fromEntries(new FormData(form).entries());
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      // 2) JSON POST -> server validates again, hashes the password, sets the cookie
      await api(isRegister ? '/api/auth/register' : '/api/auth/login', { method: 'POST', body });
      const next = new URLSearchParams(location.search).get('next');
      location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    } catch (err) {
      showAlert(alertBox, err.message);
      showFieldErrors(form, err.fields);
      btn.disabled = false;
    }
  });
})();
