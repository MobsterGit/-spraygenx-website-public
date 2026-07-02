// Proposal / invoice active-window and history layer for the Spray GenX Manager MVP.
// Loaded after manager.js so it can extend the current shell without disturbing the job MVP.

state.documentMode = state.documentMode || { proposals: 'active', invoices: 'active' };
state.documentSort = state.documentSort || {
  proposals: { key: 'date', direction: 'desc' },
  invoices: { key: 'date', direction: 'desc' }
};

render = function render() {
  const titles = {
    dashboard: 'Manager Dashboard',
    jobs: 'Jobs',
    customers: 'Customers',
    photos: 'Photos',
    proposals: 'Proposals',
    invoices: 'Invoices',
    mileage: 'Mileage',
    tasks: 'Tasks',
    settings: 'Settings'
  };

  viewTitle.textContent = titles[state.activeView] || 'Spray GenX Manager';

  switch (state.activeView) {
    case 'dashboard': renderDashboard(); break;
    case 'jobs': renderJobs(); break;
    case 'customers': renderSimpleModule('Customer Manager', state.records.customers, recordTitle, recordId); break;
    case 'photos': renderSimpleModule('Photo Manager', state.records.media, recordTitle, recordId); break;
    case 'proposals': renderDocumentManager('proposals'); break;
    case 'invoices': renderDocumentManager('invoices'); break;
    case 'mileage': renderSimpleModule('Mileage Tracker', state.records.mileage, recordTitle, recordId); break;
    case 'tasks': renderSimpleModule('Task Manager', state.records.tasks, recordTitle, recordId); break;
    default: renderSettings();
  }
};

function renderDocumentManager(type) {
  const singular = type === 'proposals' ? 'proposal' : 'invoice';
  const labelText = type === 'proposals' ? 'Proposal' : 'Invoice';
  const mode = state.documentMode[type] || 'active';
  const active = sortedDocuments(activeDocuments(type), type);
  const history = sortedDocuments(historyDocuments(type), type);
  const visible = mode === 'active' ? active : history;
  const total = visible.reduce((sum, record) => sum + documentAmount(record), 0);
  const note = type === 'proposals'
    ? 'Active window shows only current working proposals. Converted, accepted, declined, expired, and archived proposals move into history.'
    : 'Active window shows unpaid/open invoices first. Paid, void, and archived invoices move into history.';

  workspace.innerHTML = `
    <section class="document-manager card">
      <div class="panel-header">
        <div>
          <h2>${escapeHtml(labelText)} Manager</h2>
          <p>${escapeHtml(note)}</p>
        </div>
        <div class="toolbar-actions segmented-actions" role="group" aria-label="${escapeHtml(labelText)} view mode">
          <button class="btn ${mode === 'active' ? 'btn-primary' : 'btn-secondary'}" type="button" data-doc-mode="active">Active Window (${active.length})</button>
          <button class="btn ${mode === 'history' ? 'btn-primary' : 'btn-secondary'}" type="button" data-doc-mode="history">Browse History (${history.length})</button>
        </div>
      </div>

      <section class="document-summary-grid" aria-label="${escapeHtml(labelText)} summary">
        ${metricCard(mode === 'active' ? 'Visible Active' : 'Visible History', visible.length)}
        ${metricCard('Visible Total', money.format(total))}
        ${metricCard('Record Type', singular)}
      </section>

      <div class="document-controls">
        <label>Sort by
          <select data-doc-sort>
            ${sortOption(type, 'date', 'Date')}
            ${sortOption(type, 'client', 'Customer')}
            ${sortOption(type, 'project', 'Job / Project')}
            ${sortOption(type, 'status', 'Status')}
            ${sortOption(type, 'amount', 'Amount')}
          </select>
        </label>
        <button class="btn btn-secondary" type="button" data-doc-direction>${state.documentSort[type].direction === 'asc' ? 'Ascending' : 'Descending'}</button>
      </div>

      ${visible.length ? `<div class="document-list">${visible.map((record) => documentRow(record, type)).join('')}</div>` : emptyState(mode === 'active' ? `No active ${type} loaded yet.` : `No ${type} history loaded yet.`)}
    </section>
  `;

  document.querySelectorAll('[data-doc-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.documentMode[type] = button.dataset.docMode;
      renderDocumentManager(type);
    });
  });

  document.querySelector('[data-doc-sort]')?.addEventListener('change', (event) => {
    state.documentSort[type].key = event.target.value;
    renderDocumentManager(type);
  });

  document.querySelector('[data-doc-direction]')?.addEventListener('click', () => {
    state.documentSort[type].direction = state.documentSort[type].direction === 'asc' ? 'desc' : 'asc';
    renderDocumentManager(type);
  });
}

function activeDocuments(type) {
  const records = state.records[type] || [];
  const active = records.filter((record) => isActiveDocument(record, type));
  return type === 'proposals' ? active.slice(0, 20) : active;
}

function historyDocuments(type) {
  return (state.records[type] || []).filter((record) => !isActiveDocument(record, type));
}

function isActiveDocument(record, type) {
  if (record.audit?.archived) return false;
  const status = managerStatus(record);

  if (type === 'proposals') {
    return !['approved', 'accepted', 'declined', 'expired', 'converted', 'converted_to_invoice', 'archived', 'void'].includes(status);
  }

  const paymentStatus = invoicePaymentStatus(record);
  return !['paid', 'void', 'archived'].includes(status) && !['paid', 'void', 'archived'].includes(paymentStatus);
}

function sortedDocuments(records, type) {
  const sort = state.documentSort[type] || { key: 'date', direction: 'desc' };
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...records].sort((a, b) => {
    const aValue = documentSortValue(a, sort.key);
    const bValue = documentSortValue(b, sort.key);
    if (aValue > bValue) return factor;
    if (aValue < bValue) return -factor;
    return 0;
  });
}

function documentSortValue(record, key) {
  if (key === 'amount') return documentAmount(record);
  if (key === 'date') return normalizedDate(record.date || record.manager?.date || record.audit?.updated_at || record.audit?.created_at);
  if (key === 'client') return String(record.client || record.customer_display_name || '').toLowerCase();
  if (key === 'project') return String(record.project || record.job_title || '').toLowerCase();
  if (key === 'status') return recordStatus(record);
  return String(record[key] || '').toLowerCase();
}

function documentRow(record, type) {
  const amount = documentAmount(record);
  const city = documentCity(record);

  return `
    <article class="document-row">
      <div>
        <p class="eyebrow">${escapeHtml(record.docNo || recordId(record) || type)}</p>
        <h3>${escapeHtml(record.project || recordTitle(record))}</h3>
        <p>${escapeHtml(record.client || 'No customer')}${city ? ` · ${escapeHtml(city)}` : ''}</p>
      </div>
      <div class="document-meta">
        <strong>${money.format(amount)}</strong>
        <span>${escapeHtml(record.date || 'No date')}</span>
        <span class="pill ${escapeHtml(recordStatus(record))}">${escapeHtml(recordStatus(record))}</span>
      </div>
    </article>
  `;
}

function sortOption(type, value, text) {
  return `<option value="${escapeHtml(value)}" ${state.documentSort[type].key === value ? 'selected' : ''}>${escapeHtml(text)}</option>`;
}

function normalizedDate(value) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function documentAmount(record) {
  return moneyToNumber(record.manager?.balance_due || record.manager?.amount_due || record.price || record.total || record.amount || 0);
}

function documentCity(record) {
  const job = state.records.jobs.find((item) => item.job_id && item.job_id === record.manager?.job_id);
  return record.location?.city || job?.location?.city || '';
}
