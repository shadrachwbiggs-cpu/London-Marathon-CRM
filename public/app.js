const state = {
  businesses: [],
  sortKey: 'business_name',
  sortDir: 'asc',
  search: '',
  statusFilter: '',
  followupOnly: false,
};

const $ = (id) => document.getElementById(id);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function statusToClass(status) {
  return 'badge-' + status.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
}

function fmtMoney(n) {
  if (n === null || n === undefined || n === '') return '';
  return '£' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '';
  return d;
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2200);
}

// --- Data loading ---

async function loadBusinesses() {
  const res = await fetch('/api/businesses');
  state.businesses = await res.json();
  render();
}

async function loadStats() {
  const res = await fetch('/api/stats');
  const stats = await res.json();
  $('statPledged').textContent = fmtMoney(stats.totalPledged);
  $('statCommitted').textContent = stats.committedCount;
  $('statFollowups').textContent = stats.followUpsDue;
  $('statFollowupsWrap').classList.toggle('zero', stats.followUpsDue === 0);
}

function refreshAll() {
  loadBusinesses();
  loadStats();
}

// --- Filtering / sorting / rendering ---

function getFiltered() {
  const search = state.search.trim().toLowerCase();
  const today = todayISO();
  return state.businesses.filter((b) => {
    if (state.statusFilter && b.status !== state.statusFilter) return false;
    if (state.followupOnly) {
      if (!b.follow_up_date || b.follow_up_date > today) return false;
    }
    if (search) {
      const haystack = `${b.business_name || ''} ${b.contact_name || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function getSorted(list) {
  const key = state.sortKey;
  const dir = state.sortDir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    let av = a[key];
    let bv = b[key];
    if (key === 'pledged_amount') {
      av = av === null || av === undefined ? -Infinity : Number(av);
      bv = bv === null || bv === undefined ? -Infinity : Number(bv);
    } else {
      av = (av || '').toString().toLowerCase();
      bv = (bv || '').toString().toLowerCase();
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function render() {
  const filtered = getSorted(getFiltered());
  const tbody = $('tableBody');
  tbody.innerHTML = '';
  const today = todayISO();

  filtered.forEach((b) => {
    const tr = document.createElement('tr');
    const isDue = b.follow_up_date && b.follow_up_date <= today;
    if (isDue) tr.classList.add('row-followup-due');

    tr.innerHTML = `
      <td>${escapeHtml(b.business_name)}</td>
      <td>${escapeHtml(b.contact_name || '')}</td>
      <td>${escapeHtml(b.contact_email || '')}</td>
      <td>${escapeHtml(b.contact_phone || '')}</td>
      <td><span class="badge ${statusToClass(b.status)}">${escapeHtml(b.status)}</span></td>
      <td>${fmtDate(b.last_contact_date)}</td>
      <td>${escapeHtml(b.contact_method || '')}</td>
      <td>${fmtDate(b.follow_up_date)}${isDue ? ' ⚠️' : ''}</td>
      <td>${fmtMoney(b.pledged_amount)}</td>
      <td class="actions-cell"></td>
    `;

    const actionsCell = tr.querySelector('.actions-cell');
    actionsCell.appendChild(makeBtn('Log', 'btn-primary', () => openLogModal(b)));
    actionsCell.appendChild(makeBtn('Edit', 'btn-secondary', () => openBusinessModal(b)));
    actionsCell.appendChild(makeBtn('Delete', 'btn-danger', () => openDeleteModal(b)));

    tbody.appendChild(tr);
  });

  $('emptyState').classList.toggle('hidden', filtered.length > 0);

  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.sort === state.sortKey) {
      th.classList.add(state.sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

function makeBtn(label, cls, onClick) {
  const btn = document.createElement('button');
  btn.className = `btn btn-small ${cls}`;
  btn.textContent = label;
  btn.type = 'button';
  btn.addEventListener('click', onClick);
  return btn;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str === null || str === undefined ? '' : str;
  return div.innerHTML;
}

// --- Sorting header clicks ---

document.querySelectorAll('th[data-sort]').forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (state.sortKey === key) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = key;
      state.sortDir = 'asc';
    }
    render();
  });
});

// --- Toolbar ---

$('searchInput').addEventListener('input', (e) => {
  state.search = e.target.value;
  render();
});

$('statusFilter').addEventListener('change', (e) => {
  state.statusFilter = e.target.value;
  render();
});

$('followupFilter').addEventListener('change', (e) => {
  state.followupOnly = e.target.checked;
  render();
});

// --- Business Add/Edit Modal ---

const businessModalOverlay = $('businessModalOverlay');
const businessForm = $('businessForm');

function openBusinessModal(business) {
  businessForm.reset();
  $('businessId').value = business ? business.id : '';
  $('businessModalTitle').textContent = business ? 'Edit Business' : 'Add Business';
  $('f_business_name').value = business ? business.business_name : '';
  $('f_contact_name').value = business ? business.contact_name || '' : '';
  $('f_contact_phone').value = business ? business.contact_phone || '' : '';
  $('f_contact_email').value = business ? business.contact_email || '' : '';
  $('f_status').value = business ? business.status : 'Not Contacted';
  $('f_contact_method').value = business ? business.contact_method || '' : '';
  $('f_last_contact_date').value = business ? business.last_contact_date || '' : '';
  $('f_follow_up_date').value = business ? business.follow_up_date || '' : '';
  $('f_pledged_amount').value = business && business.pledged_amount !== null ? business.pledged_amount : '';
  $('f_notes').value = business ? business.notes || '' : '';
  businessModalOverlay.classList.remove('hidden');
  $('f_business_name').focus();
}

function closeBusinessModal() {
  businessModalOverlay.classList.add('hidden');
}

$('btnAdd').addEventListener('click', () => openBusinessModal(null));
$('btnCancelBusiness').addEventListener('click', closeBusinessModal);
businessModalOverlay.addEventListener('click', (e) => {
  if (e.target === businessModalOverlay) closeBusinessModal();
});

businessForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('businessId').value;
  const payload = {
    business_name: $('f_business_name').value,
    contact_name: $('f_contact_name').value,
    contact_phone: $('f_contact_phone').value,
    contact_email: $('f_contact_email').value,
    status: $('f_status').value,
    contact_method: $('f_contact_method').value,
    last_contact_date: $('f_last_contact_date').value,
    follow_up_date: $('f_follow_up_date').value,
    pledged_amount: $('f_pledged_amount').value,
    notes: $('f_notes').value,
  };

  const url = id ? `/api/businesses/${id}` : '/api/businesses';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    toast(err.error || 'Failed to save');
    return;
  }

  closeBusinessModal();
  toast(id ? 'Business updated' : 'Business added');
  refreshAll();
});

// --- Quick Log Modal ---

const logModalOverlay = $('logModalOverlay');
const logForm = $('logForm');

function openLogModal(business) {
  logForm.reset();
  $('logBusinessId').value = business.id;
  $('logBusinessName').textContent = business.business_name;
  $('log_date').value = todayISO();
  $('log_method').value = business.contact_method || '';
  $('log_status').value = business.status;
  $('log_follow_up_date').value = business.follow_up_date || '';
  $('log_pledged_amount').value = business.pledged_amount !== null ? business.pledged_amount : '';
  $('log_note').value = '';
  logModalOverlay.classList.remove('hidden');
  $('log_note').focus();
}

function closeLogModal() {
  logModalOverlay.classList.add('hidden');
}

$('btnCancelLog').addEventListener('click', closeLogModal);
logModalOverlay.addEventListener('click', (e) => {
  if (e.target === logModalOverlay) closeLogModal();
});

logForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('logBusinessId').value;
  const payload = {
    date: $('log_date').value,
    contact_method: $('log_method').value,
    status: $('log_status').value,
    follow_up_date: $('log_follow_up_date').value,
    pledged_amount: $('log_pledged_amount').value,
    note: $('log_note').value,
  };

  const res = await fetch(`/api/businesses/${id}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    toast(err.error || 'Failed to log outreach');
    return;
  }

  closeLogModal();
  toast('Outreach logged');
  refreshAll();
});

// --- Delete Modal ---

const deleteModalOverlay = $('deleteModalOverlay');
let pendingDeleteId = null;

function openDeleteModal(business) {
  pendingDeleteId = business.id;
  $('deleteConfirmText').textContent = `Delete "${business.business_name}" and all its outreach history? This cannot be undone.`;
  deleteModalOverlay.classList.remove('hidden');
}

function closeDeleteModal() {
  pendingDeleteId = null;
  deleteModalOverlay.classList.add('hidden');
}

$('btnCancelDelete').addEventListener('click', closeDeleteModal);
deleteModalOverlay.addEventListener('click', (e) => {
  if (e.target === deleteModalOverlay) closeDeleteModal();
});

$('btnConfirmDelete').addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  const res = await fetch(`/api/businesses/${pendingDeleteId}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    toast('Failed to delete');
    return;
  }
  closeDeleteModal();
  toast('Business deleted');
  refreshAll();
});

// --- Email Template Modal ---

const templateModalOverlay = $('templateModalOverlay');

async function openTemplateModal() {
  const res = await fetch('/api/template');
  const data = await res.json();
  $('templateText').value = data.template;
  templateModalOverlay.classList.remove('hidden');
}

function closeTemplateModal() {
  templateModalOverlay.classList.add('hidden');
}

$('btnTemplate').addEventListener('click', openTemplateModal);
$('btnCloseTemplate').addEventListener('click', closeTemplateModal);
templateModalOverlay.addEventListener('click', (e) => {
  if (e.target === templateModalOverlay) closeTemplateModal();
});

$('btnSaveTemplate').addEventListener('click', async () => {
  const template = $('templateText').value;
  await fetch('/api/template', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template }),
  });
  toast('Template saved');
});

$('btnCopyTemplate').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('templateText').value);
    toast('Copied to clipboard');
  } catch (err) {
    $('templateText').select();
    document.execCommand('copy');
    toast('Copied to clipboard');
  }
});

// --- Escape key closes any open modal ---

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeBusinessModal();
    closeLogModal();
    closeDeleteModal();
    closeTemplateModal();
  }
});

refreshAll();
