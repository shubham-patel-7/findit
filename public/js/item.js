/* MODULE 3 (Student 2) - Item details, claim form, owner review of claims, contact reveal */
(async () => {
  await initPage();
  const id = new URLSearchParams(location.search).get('id');
  const content = document.getElementById('content');
  const pageAlert = document.getElementById('page-alert');
  const modalEl = document.getElementById('confirm-modal');
  const modal = new bootstrap.Modal(modalEl);

  if (new URLSearchParams(location.search).get('posted')) showAlert(pageAlert, 'Your item has been posted. You will get a notification when someone sends a claim.', 'success');

  /** Show the Bootstrap modal and resolve with true only if the user presses Confirm. */
  function confirmAction(title, body) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-body').textContent = body;
    return new Promise((resolve) => {
      let confirmed = false;
      const ok = document.getElementById('confirm-ok');
      ok.onclick = () => { confirmed = true; modal.hide(); };
      modalEl.addEventListener('hidden.bs.modal', () => resolve(confirmed), { once: true });
      modal.show();
    });
  }

  async function load() {
    let data;
    try { data = await api('/api/items/' + encodeURIComponent(id)); }
    catch (e) { content.innerHTML = `<div class="alert alert-danger">${esc(e.message)} <a href="/">Back to browse</a></div>`; return; }
    render(data);
  }

  function render({ item, viewer, claims, contact }) {
    document.title = `${item.title} · FindIt`;
    const icon = CATEGORY_ICONS[item.category] || 'bi-box-seam';
    const image = item.image
      ? `<img class="detail-image" src="${esc(item.image)}" alt="Photo of ${esc(item.title)}">`
      : `<div class="detail-image-empty" role="img" aria-label="No photo provided"><i class="bi ${icon}" aria-hidden="true"></i></div>`;
    const verb = item.type === 'found' ? 'Claim this item' : 'I found this item';
    const hint = item.type === 'found'
      ? 'Describe something only the owner would know (marks, contents, where you lost it).'
      : 'Tell the owner where and when you found it, and where it is now.';

    let side = '';

    // ----- contact details (only shown to an approved claimant) -----
    if (contact) {
      side += `<div class="alert alert-success" role="status"><h2 class="h6"><i class="bi bi-check-circle me-1" aria-hidden="true"></i>Your claim was approved</h2>
        <p class="mb-1">Contact <strong>${esc(contact.name)}</strong> to arrange the hand-over:</p>
        <p class="mb-0"><i class="bi bi-envelope" aria-hidden="true"></i> <a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>${contact.phone ? `<br><i class="bi bi-telephone" aria-hidden="true"></i> ${esc(contact.phone)}` : ''}</p></div>`;
    }

    // ----- visitor / claimant section -----
    if (!viewer.isOwner) {
      if (!viewer.loggedIn) {
        side += `<div class="panel"><p class="mb-2">Log in to send a claim for this item.</p><a class="btn btn-accent" href="/login.html?next=${encodeURIComponent(location.pathname + location.search)}">Log in</a></div>`;
      } else if (viewer.myClaim) {
        side += `<div class="panel"><h2 class="h6">Your claim <span class="badge badge-status-${viewer.myClaim.status} text-capitalize ms-1">${viewer.myClaim.status}</span></h2>
          <p class="mb-1 small text-muted">Sent ${timeAgo(viewer.myClaim.createdAt)}</p><p class="mb-0">${esc(viewer.myClaim.message)}</p></div>`;
      } else if (viewer.canClaim) {
        side += `<form id="claim-form" class="panel" novalidate>
          <h2 class="h6">${verb}</h2>
          <div id="claim-alert" role="alert" hidden></div>
          <div class="mb-3">
            <label for="message" class="form-label">Your message</label>
            <textarea id="message" name="message" class="form-control" rows="4" required minlength="10" maxlength="500" aria-describedby="msg-help"></textarea>
            <div id="msg-help" class="form-text">${hint}</div>
            <div class="invalid-feedback">Message must be 10-500 characters.</div>
          </div>
          <button class="btn btn-accent" type="submit"><i class="bi bi-send me-1" aria-hidden="true"></i>Send claim</button>
        </form>`;
      } else {
        side += `<div class="panel text-muted">This item is no longer open for claims.</div>`;
      }
    }

    // ----- owner / admin section -----
    if (claims) {
      const canDecide = item.status === 'open';
      side += `<section class="panel" aria-labelledby="claims-title">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 id="claims-title" class="h6 mb-0">Claims received (${claims.length})</h2>
          ${['open', 'claimed'].includes(item.status) ? '<button class="btn btn-outline-success btn-sm" id="resolve-btn"><i class="bi bi-check2-circle me-1" aria-hidden="true"></i>Mark as returned</button>' : ''}
        </div>
        ${claims.length ? claims.map((c) => `
          <div class="claim-card mb-2">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div><strong>${esc(c.claimant.name)}</strong> <span class="item-meta">(${esc(c.claimant.regNo)}) &middot; ${timeAgo(c.createdAt)}</span></div>
              <span class="badge badge-status-${c.status} text-capitalize">${c.status}</span>
            </div>
            <p class="my-2">${esc(c.message)}</p>
            ${c.status === 'pending' && canDecide ? `<div class="d-flex gap-2">
               <button class="btn btn-success btn-sm" data-act="approve" data-claim="${c.id}" data-who="${esc(c.claimant.name)}"><i class="bi bi-check-lg me-1" aria-hidden="true"></i>Approve</button>
               <button class="btn btn-outline-danger btn-sm" data-act="reject" data-claim="${c.id}" data-who="${esc(c.claimant.name)}"><i class="bi bi-x-lg me-1" aria-hidden="true"></i>Reject</button></div>` : ''}
            ${c.contact ? `<p class="small mb-0 mt-1"><i class="bi bi-envelope" aria-hidden="true"></i> ${esc(c.contact.email)}${c.contact.phone ? ' &middot; ' + esc(c.contact.phone) : ''}</p>` : ''}
          </div>`).join('') : '<p class="text-muted mb-0">No claims yet. You will be notified when someone sends one.</p>'}
      </section>`;
    }

    content.innerHTML = `
      <div class="row g-4">
        <div class="col-lg-7">
          ${image}
        </div>
        <div class="col-lg-5">
          <div class="mb-2"><span class="badge badge-${item.type}">${item.type === 'lost' ? 'Lost' : 'Found'}</span>
            <span class="badge badge-status-${item.status} text-capitalize ms-1">${item.status}</span></div>
          <h1 class="h3">${esc(item.title)}</h1>
          <ul class="list-unstyled item-meta mb-3">
            <li><i class="bi ${icon} me-2" aria-hidden="true"></i>${esc(item.category)}</li>
            <li><i class="bi bi-geo-alt me-2" aria-hidden="true"></i>${esc(item.location)}</li>
            <li><i class="bi bi-calendar-event me-2" aria-hidden="true"></i>${item.type === 'lost' ? 'Lost' : 'Found'} on ${fmtDate(item.dateEvent + 'T00:00:00')}</li>
            <li><i class="bi bi-person me-2" aria-hidden="true"></i>Posted by ${esc(item.ownerName)} &middot; ${timeAgo(item.createdAt)}</li>
          </ul>
          <p style="white-space:pre-line">${esc(item.description)}</p>
          ${viewer.isAdmin && !viewer.isOwner ? '<p class="badge text-bg-dark"><i class="bi bi-shield-check me-1"></i>Admin view</p>' : ''}
        </div>
      </div>
      <div class="row g-4 mt-1"><div class="col-lg-7 d-grid gap-3">${side}</div></div>`;

    bind(item);
  }

  function bind(item) {
    // submit a claim
    const cf = document.getElementById('claim-form');
    if (cf) cf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const box = document.getElementById('claim-alert');
      box.hidden = true;
      if (!validateForm(cf)) return;
      try {
        await api(`/api/items/${item.id}/claims`, { method: 'POST', body: { message: cf.elements.message.value } });
        load();
      } catch (err) { showAlert(box, err.message); showFieldErrors(cf, err.fields); }
    });

    // approve / reject
    content.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
      const approve = b.dataset.act === 'approve';
      const ok = await confirmAction(approve ? 'Approve this claim?' : 'Reject this claim?',
        approve ? `${b.dataset.who} will receive your contact details and all other pending claims will be rejected.` : `${b.dataset.who} will be told their claim was not accepted.`);
      if (!ok) return;
      try { await api('/api/claims/' + b.dataset.claim, { method: 'PATCH', body: { action: b.dataset.act } }); load(); }
      catch (err) { showAlert(pageAlert, err.message); }
    }));

    // mark as returned
    const rb = document.getElementById('resolve-btn');
    if (rb) rb.addEventListener('click', async () => {
      if (!(await confirmAction('Mark as returned?', 'The post will be closed and any pending claims will be rejected.'))) return;
      try { await api(`/api/items/${item.id}/resolve`, { method: 'PATCH' }); load(); }
      catch (err) { showAlert(pageAlert, err.message); }
    });
  }

  load();
})();
