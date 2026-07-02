// Adds search and date drill-down filters to proposal / invoice history.
state.documentFilters = state.documentFilters || {
  proposals: { search: '', year: '', month: '', week: '' },
  invoices: { search: '', year: '', month: '', week: '' }
};

renderDocumentManager = function renderDocumentManager(type) {
  const singular = type === 'proposals' ? 'proposal' : 'invoice';
  const labelText = type === 'proposals' ? 'Proposal' : 'Invoice';
  const mode = state.documentMode[type] || 'active';
  const active = sortedDocuments(activeDocuments(type), type);
  const historyRaw = historyDocuments(type);
  const history = sortedDocuments(filteredDocuments(historyRaw, type), type);
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
          <button class="btn ${mode === 'history' ? 'btn-primary' : 'btn-secondary'}" type="button" data-doc-mode="history">Browse History (${history.length}/${historyRaw.length})</button>
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

      ${mode === 'history' ? documentFilterControls(type, historyRaw) : activeWindowHint(type, active.length)}
      ${visible.length ? `<div class="document-list">${visible.map((record) => documentRow(record, type)).join('')}</div>` : emptyState(mode === 'active' ? `No active ${type} loaded yet.` : `No ${type} history matches the current filters.`)}
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

  document.querySelectorAll('[data-doc-filter]').forEach((control) => {
    control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', (event) => {
      state.documentFilters[type][event.target.dataset.docFilter] = event.target.value;
      renderDocumentManager(type);
    });
  });

  document.querySelector('[data-doc-clear-filters]')?.addEventListener('click', () => {
    state.documentFilters[type] = { search: '', year: '', month: '', week: '' };
    renderDocumentManager(type);
  });
};

function filteredDocuments(records, type) {
  const filters = state.documentFilters[type] || {};
  const search = String(filters.search || '').trim().toLowerCase();

  return records.filter((record) => {
    const date = documentDateValue(record);
    if (filters.year && documentYear(date) !== filters.year) return false;
    if (filters.month && documentMonth(date) !== filters.month) return false;
    if (filters.week && documentWeek(date) !== filters.week) return false;
    return !search || documentSearchText(record).includes(search);
  });
}

function documentFilterControls(type, records) {
  const filters = state.documentFilters[type] || { search: '', year: '', month: '', week: '' };
  return `
    <div class="document-filters" aria-label="Document history filters">
      <label>Search
        <input data-doc-filter="search" type="search" value="${escapeHtml(filters.search || '')}" placeholder="Customer, job, city, number, status">
      </label>
      <label>Year
        <select data-doc-filter="year">
          ${filterOption('', 'All years', filters.year)}
          ${distinctDateOptions(records, documentYear).map((value) => filterOption(value, value, filters.year)).join('')}
        </select>
      </label>
      <label>Month
        <select data-doc-filter="month">
          ${filterOption('', 'All months', filters.month)}
          ${distinctDateOptions(records, documentMonth).map((value) => filterOption(value, value, filters.month)).join('')}
        </select>
      </label>
      <label>Week
        <select data-doc-filter="week">
          ${filterOption('', 'All weeks', filters.week)}
          ${distinctDateOptions(records, documentWeek).map((value) => filterOption(value, value, filters.week)).join('')}
        </select>
      </label>
      <button class="btn btn-secondary" type="button" data-doc-clear-filters>Clear Filters</button>
    </div>
  `;
}

function activeWindowHint(type, count) {
  const text = type === 'proposals'
    ? `Showing the current working proposal window. Target cap: 20 active proposals. Current visible: ${count}.`
    : 'Showing open / unpaid invoices first. Paid and archived invoices stay out of the daily view.';
  return `<p class="document-hint">${escapeHtml(text)}</p>`;
}

function filterOption(value, text, current) {
  return `<option value="${escapeHtml(value)}" ${String(value) === String(current || '') ? 'selected' : ''}>${escapeHtml(text)}</option>`;
}

function distinctDateOptions(records, getter) {
  return [...new Set(records.map((record) => getter(documentDateValue(record))).filter(Boolean))].sort().reverse();
}

function documentDateValue(record) {
  return record.date || record.manager?.date || record.manager?.proposal_date || record.manager?.invoice_date || record.audit?.updated_at || record.audit?.created_at || '';
}

function documentSearchText(record) {
  return [record.docNo, recordId(record), record.project, record.job_title, record.client, record.customer_display_name, documentCity(record), recordStatus(record), documentDateValue(record), documentAmount(record)].join(' ').toLowerCase();
}

function documentYear(value) {
  const date = parsedDate(value);
  return date ? String(date.getFullYear()) : '';
}

function documentMonth(value) {
  const date = parsedDate(value);
  return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : '';
}

function documentWeek(value) {
  const date = parsedDate(value);
  if (!date) return '';
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function parsedDate(value) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}
