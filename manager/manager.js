const state = {
  activeView: 'dashboard',
  records: {
    jobs: [],
    customers: [],
    proposals: [],
    invoices: [],
    media: [],
    mileage: [],
    tasks: []
  }
};

const workspace = document.querySelector('#workspace');
const viewTitle = document.querySelector('#view-title');
const dataStatus = document.querySelector('#data-status');
const refreshButton = document.querySelector('#refresh-data');
const newJobButton = document.querySelector('#new-job');
const navItems = [...document.querySelectorAll('.nav-item')];

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

init();

function init() {
  navItems.forEach((item) => {
    item.addEventListener('click', () => setView(item.dataset.view));
  });

  refreshButton.addEventListener('click', loadData);
  newJobButton.addEventListener('click', renderNewJobDraft);

  loadData();
}

async function loadData() {
  setStatus('Loading manager records…');

  try {
    const index = await fetchJson('../data/manager/manager-index.json');
    const records = await loadRecords(index.records || {});
    state.records = { ...state.records, ...records };
    setStatus(`Loaded ${state.records.jobs.length} job record(s) from /data/manager/.`);
    render();
  } catch (error) {
    console.error(error);
    setStatus('Manager data could not be loaded. Check file paths and JSON formatting.');
    workspace.innerHTML = errorCard(error);
  }
}

async function loadRecords(recordIndex) {
  const output = {};
  const groups = Object.keys(state.records);

  for (const group of groups) {
    const paths = recordIndex[group] || [];
    output[group] = await Promise.all(paths.map(fetchJson));
  }

  return output;
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json();
}

function setView(view) {
  state.activeView = view;
  navItems.forEach((item) => item.classList.toggle('is-active', item.dataset.view === view));
  render();
}

function render() {
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
    case 'dashboard':
      renderDashboard();
      break;
    case 'jobs':
      renderJobs();
      break;
    case 'customers':
      renderSimpleModule('Customer Manager', state.records.customers, 'customer_display_name', 'customer_id');
      break;
    case 'photos':
      renderSimpleModule('Photo Manager', state.records.media, 'title', 'media_id');
      break;
    case 'proposals':
      renderSimpleModule('Proposal Manager', state.records.proposals, 'proposal_title', 'proposal_id');
      break;
    case 'invoices':
      renderSimpleModule('Invoice Manager', state.records.invoices, 'invoice_title', 'invoice_id');
      break;
    case 'mileage':
      renderSimpleModule('Mileage Tracker', state.records.mileage, 'trip_purpose', 'mileage_id');
      break;
    case 'tasks':
      renderSimpleModule('Task Manager', state.records.tasks, 'task_title', 'task_id');
      break;
    default:
      renderSettings();
  }
}

function renderDashboard() {
  const jobs = state.records.jobs;
  const proposals = state.records.proposals;
  const invoices = state.records.invoices;
  const tasks = state.records.tasks;
  const estimatedValue = jobs.reduce((sum, job) => sum + Number(job.financials?.estimated_value || 0), 0);

  workspace.innerHTML = `
    <section class="dashboard-grid" aria-label="Manager totals">
      ${metricCard('Jobs', jobs.length)}
      ${metricCard('Open Proposals', proposals.length)}
      ${metricCard('Invoices', invoices.length)}
      ${metricCard('Tasks', tasks.length)}
    </section>

    <section class="card">
      <h2>Pipeline Value</h2>
      <strong>${money.format(estimatedValue)}</strong>
      <p>Current value calculated from loaded job records.</p>
    </section>

    <section class="jobs-panel card">
      <div class="panel-header">
        <div>
          <h2>Recent Jobs</h2>
          <p>Click a job to open the MVP detail view.</p>
        </div>
      </div>
      ${jobList(jobs)}
    </section>
  `;

  bindJobRows();
}

function renderJobs() {
  workspace.innerHTML = `
    <section class="jobs-panel card">
      <div class="panel-header">
        <div>
          <h2>Job List</h2>
          <p>First MVP view: read jobs, open a job, and show linked manager records.</p>
        </div>
        <button class="btn btn-primary" type="button" data-new-job>+ New Job</button>
      </div>
      ${jobList(state.records.jobs)}
    </section>
  `;

  bindJobRows();
  document.querySelector('[data-new-job]')?.addEventListener('click', renderNewJobDraft);
}

function jobList(jobs) {
  if (!jobs.length) return emptyState('No jobs loaded yet.');

  return `
    <div class="job-list">
      ${jobs.map((job) => `
        <button class="job-row" type="button" data-job-id="${escapeHtml(job.job_id)}">
          <span>
            <h3>${escapeHtml(job.job_title || job.job_id)}</h3>
            <p>${escapeHtml(job.customer_display_name || 'No customer')} · ${escapeHtml(job.location?.city || 'No city')}, ${escapeHtml(job.location?.state || '')}</p>
          </span>
          <span class="pill ${escapeHtml(job.status || '')}">${label(job.status || 'draft')}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function bindJobRows() {
  document.querySelectorAll('[data-job-id]').forEach((button) => {
    button.addEventListener('click', () => renderJobDetail(button.dataset.jobId));
  });
}

function renderJobDetail(jobId) {
  const job = state.records.jobs.find((item) => item.job_id === jobId);
  if (!job) return;

  const linked = getLinkedRecords(job);

  viewTitle.textContent = job.job_title || job.job_id;
  workspace.innerHTML = `
    <article class="job-detail">
      <div class="panel-header">
        <div>
          <p class="eyebrow">${escapeHtml(job.job_id)}</p>
          <h2>${escapeHtml(job.job_title || 'Untitled Job')}</h2>
          <p>${escapeHtml(job.scope?.scope_short || '')}</p>
        </div>
        <span class="pill ${escapeHtml(job.status || '')}">${label(job.status || 'draft')}</span>
      </div>

      <section class="detail-grid">
        ${detailCard('Customer', {
          Name: job.customer_display_name,
          Contact: job.primary_contact_name,
          Type: label(job.contact_type)
        })}
        ${detailCard('Location', {
          Site: job.location?.site_name,
          City: `${job.location?.city || ''}, ${job.location?.state || ''}`,
          County: job.location?.county
        })}
        ${detailCard('Financials', {
          Estimate: money.format(Number(job.financials?.estimated_value || 0)),
          Approved: money.format(Number(job.financials?.approved_value || 0)),
          Payment: label(job.financials?.payment_status)
        })}
        ${detailCard('Follow Up', {
          Action: job.follow_up?.next_action,
          Due: job.follow_up?.next_action_due || 'Not set',
          Priority: label(job.follow_up?.priority)
        })}
      </section>

      <section class="detail-grid" style="margin-top:14px;">
        ${relationCard('Proposals', linked.proposals, 'proposal_id')}
        ${relationCard('Invoices', linked.invoices, 'invoice_id')}
        ${relationCard('Photos', linked.media, 'media_id')}
        ${relationCard('Mileage', linked.mileage, 'mileage_id')}
        ${relationCard('Tasks', linked.tasks, 'task_id')}
      </section>
    </article>
  `;
}

function getLinkedRecords(job) {
  const links = job.links || {};

  return {
    proposals: state.records.proposals.filter((item) => (links.proposal_ids || []).includes(item.proposal_id) || item.job_id === job.job_id),
    invoices: state.records.invoices.filter((item) => (links.invoice_ids || []).includes(item.invoice_id) || item.job_id === job.job_id),
    media: state.records.media.filter((item) => (links.photo_group_ids || []).includes(item.media_id) || item.job_id === job.job_id),
    mileage: state.records.mileage.filter((item) => (links.mileage_ids || []).includes(item.mileage_id) || item.job_id === job.job_id),
    tasks: state.records.tasks.filter((item) => (links.task_ids || []).includes(item.task_id) || item.job_id === job.job_id)
  };
}

function renderSimpleModule(title, records, titleKey, idKey) {
  workspace.innerHTML = `
    <section class="card">
      <h2>${escapeHtml(title)}</h2>
      <p>This module is connected to /data/manager/ and will use the same shell as the Job Manager.</p>
      ${records.length ? `
        <div class="job-list">
          ${records.map((record) => `
            <div class="job-row" role="group">
              <span>
                <h3>${escapeHtml(record[titleKey] || record[idKey] || 'Record')}</h3>
                <p>${escapeHtml(record[idKey] || '')}</p>
              </span>
              <span class="pill">Loaded</span>
            </div>
          `).join('')}
        </div>
      ` : emptyState('No records loaded for this module yet.')}
    </section>
  `;
}

function renderNewJobDraft() {
  viewTitle.textContent = 'New Job Draft';
  workspace.innerHTML = `
    <section class="card">
      <h2>Create New Job</h2>
      <p>This MVP form drafts the structure. Saving to GitHub/local JSON is the next sprint step.</p>
      <form class="form-grid">
        <label>Job Title<input type="text" placeholder="Example: Drug Mart Ceiling Repaint"></label>
        <label>Customer<input type="text" placeholder="General contractor or property owner"></label>
        <label>City<input type="text" placeholder="Wadsworth"></label>
        <label>Estimated Value<input type="number" placeholder="0"></label>
        <textarea placeholder="Scope notes"></textarea>
        <button class="btn btn-primary" type="button">Draft Only</button>
      </form>
    </section>
  `;
}

function renderSettings() {
  workspace.innerHTML = `
    <section class="card">
      <h2>Manager Settings</h2>
      <p>Future controls: company defaults, proposal wording, invoice terms, service categories, and portfolio publishing rules.</p>
    </section>
  `;
}

function metricCard(labelText, value) {
  return `<article class="card"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(labelText)}</span></article>`;
}

function detailCard(title, rows) {
  return `
    <section class="detail-card">
      <h3>${escapeHtml(title)}</h3>
      <dl>
        ${Object.entries(rows).map(([key, value]) => `
          <div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value || '—')}</dd></div>
        `).join('')}
      </dl>
    </section>
  `;
}

function relationCard(title, records, idKey) {
  return `
    <section class="detail-card">
      <h3>${escapeHtml(title)}</h3>
      ${records.length ? records.map((record) => `<p><strong>${escapeHtml(record[idKey] || 'Record')}</strong></p>`).join('') : '<p>No linked records yet.</p>'}
    </section>
  `;
}

function emptyState(message) {
  return `<article class="empty-state"><h2>No records yet</h2><p>${escapeHtml(message)}</p></article>`;
}

function errorCard(error) {
  return `<article class="empty-state"><h2>Manager load error</h2><p>${escapeHtml(error.message)}</p></article>`;
}

function setStatus(message) {
  dataStatus.textContent = message;
}

function label(value = '') {
  return String(value).replaceAll('_', ' ');
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
