const STORAGE_KEY = 'spraygenx.manager.jobDrafts';

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
  },
  drafts: []
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
  state.drafts = readDrafts();

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
    setStatus(`Loaded ${state.records.jobs.length} repo job record(s) and ${state.drafts.length} local draft(s).`);
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
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
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
    case 'dashboard': renderDashboard(); break;
    case 'jobs': renderJobs(); break;
    case 'customers': renderSimpleModule('Customer Manager', state.records.customers, 'customer_display_name', 'customer_id'); break;
    case 'photos': renderSimpleModule('Photo Manager', state.records.media, 'title', 'media_id'); break;
    case 'proposals': renderSimpleModule('Proposal Manager', state.records.proposals, 'proposal_title', 'proposal_id'); break;
    case 'invoices': renderSimpleModule('Invoice Manager', state.records.invoices, 'invoice_title', 'invoice_id'); break;
    case 'mileage': renderSimpleModule('Mileage Tracker', state.records.mileage, 'trip_purpose', 'mileage_id'); break;
    case 'tasks': renderSimpleModule('Task Manager', state.records.tasks, 'task_title', 'task_id'); break;
    default: renderSettings();
  }
}

function allJobs() {
  return [...state.records.jobs, ...state.drafts];
}

function renderDashboard() {
  const jobs = allJobs();
  const estimatedValue = jobs.reduce((sum, job) => sum + Number(job.financials?.estimated_value || 0), 0);

  workspace.innerHTML = `
    <section class="dashboard-grid" aria-label="Manager totals">
      ${metricCard('Repo Jobs', state.records.jobs.length)}
      ${metricCard('Local Drafts', state.drafts.length)}
      ${metricCard('Proposals', state.records.proposals.length)}
      ${metricCard('Tasks', state.records.tasks.length)}
    </section>

    <section class="card">
      <h2>Pipeline Value</h2>
      <strong>${money.format(estimatedValue)}</strong>
      <p>Current value calculated from loaded repo jobs plus local drafts.</p>
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
          <p>Repo records are permanent. Local drafts are stored in this browser until exported/committed.</p>
        </div>
        <div class="toolbar-actions">
          <button class="btn btn-secondary" type="button" data-clear-drafts>Clear Drafts</button>
          <button class="btn btn-primary" type="button" data-new-job>+ New Job</button>
        </div>
      </div>
      ${jobList(allJobs())}
    </section>
  `;

  bindJobRows();
  document.querySelector('[data-new-job]')?.addEventListener('click', renderNewJobDraft);
  document.querySelector('[data-clear-drafts]')?.addEventListener('click', clearDrafts);
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
          <span class="pill ${escapeHtml(job.status || '')}">${job.audit?.local_draft ? 'Local Draft' : label(job.status || 'draft')}</span>
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

function findJob(jobId) {
  return allJobs().find((item) => item.job_id === jobId);
}

function renderJobDetail(jobId) {
  const job = findJob(jobId);
  if (!job) return;

  const linked = getLinkedRecords(job);
  const isDraft = Boolean(job.audit?.local_draft);

  viewTitle.textContent = job.job_title || job.job_id;
  workspace.innerHTML = `
    <article class="job-detail">
      <div class="panel-header">
        <div>
          <p class="eyebrow">${escapeHtml(job.job_id)}</p>
          <h2>${escapeHtml(job.job_title || 'Untitled Job')}</h2>
          <p>${escapeHtml(job.scope?.scope_short || '')}</p>
        </div>
        <div class="toolbar-actions">
          ${isDraft ? `<button class="btn btn-secondary" type="button" data-copy-json="${escapeHtml(job.job_id)}">Copy JSON</button>` : ''}
          <span class="pill ${escapeHtml(job.status || '')}">${isDraft ? 'Local Draft' : label(job.status || 'draft')}</span>
        </div>
      </div>

      <section class="detail-grid">
        ${detailCard('Customer', { Name: job.customer_display_name, Contact: job.primary_contact_name, Type: label(job.contact_type) })}
        ${detailCard('Location', { Site: job.location?.site_name, City: `${job.location?.city || ''}, ${job.location?.state || ''}`, County: job.location?.county })}
        ${detailCard('Financials', { Estimate: money.format(Number(job.financials?.estimated_value || 0)), Approved: money.format(Number(job.financials?.approved_value || 0)), Payment: label(job.financials?.payment_status) })}
        ${detailCard('Follow Up', { Action: job.follow_up?.next_action, Due: job.follow_up?.next_action_due || 'Not set', Priority: label(job.follow_up?.priority) })}
      </section>

      <section class="detail-grid relation-grid">
        ${relationCard('Proposals', linked.proposals, 'proposal_id')}
        ${relationCard('Invoices', linked.invoices, 'invoice_id')}
        ${relationCard('Photos', linked.media, 'media_id')}
        ${relationCard('Mileage', linked.mileage, 'mileage_id')}
        ${relationCard('Tasks', linked.tasks, 'task_id')}
      </section>

      ${isDraft ? `<section class="card json-card"><h3>Export JSON</h3><p>Copy this into <code>data/manager/jobs/${escapeHtml(job.job_id)}.json</code>, then add that path to <code>manager-index.json</code>.</p><pre>${escapeHtml(JSON.stringify(job, null, 2))}</pre></section>` : ''}
    </article>
  `;

  document.querySelector('[data-copy-json]')?.addEventListener('click', () => copyJobJson(job));
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
      ${records.length ? `<div class="job-list">${records.map((record) => `<div class="job-row" role="group"><span><h3>${escapeHtml(record[titleKey] || record[idKey] || 'Record')}</h3><p>${escapeHtml(record[idKey] || '')}</p></span><span class="pill">Loaded</span></div>`).join('')}</div>` : emptyState('No records loaded for this module yet.')}
    </section>
  `;
}

function renderNewJobDraft() {
  viewTitle.textContent = 'New Job Draft';
  workspace.innerHTML = `
    <section class="card">
      <h2>Create New Job</h2>
      <p>This creates a local draft and generates clean JSON for the repo. Browser storage is temporary; exporting/committing makes it permanent.</p>
      <form class="form-grid" id="job-draft-form">
        <label>Job Title<input name="job_title" type="text" placeholder="Example: Drug Mart Ceiling Repaint" required></label>
        <label>Customer<input name="customer_display_name" type="text" placeholder="General contractor or property owner" required></label>
        <label>Contact<input name="primary_contact_name" type="text" placeholder="Main contact"></label>
        <label>City<input name="city" type="text" placeholder="Wadsworth"></label>
        <label>State<input name="state" type="text" value="OH"></label>
        <label>Estimated Value<input name="estimated_value" type="number" min="0" step="1" placeholder="0"></label>
        <label>Status<input name="status" type="text" value="draft"></label>
        <label>Category<input name="job_category" type="text" placeholder="commercial-interior"></label>
        <textarea name="scope_short" placeholder="Scope notes"></textarea>
        <div class="draft-actions">
          <button class="btn btn-secondary" type="button" data-preview-draft>Preview JSON</button>
          <button class="btn btn-primary" type="submit">Save Local Draft</button>
        </div>
      </form>
      <section class="json-card" id="draft-preview" hidden></section>
    </section>
  `;

  const form = document.querySelector('#job-draft-form');
  const previewButton = document.querySelector('[data-preview-draft]');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const draft = buildDraftFromForm(form);
    state.drafts = upsertDraft(draft);
    writeDrafts(state.drafts);
    setStatus(`Saved local draft ${draft.job_id}. Copy/export JSON when ready to commit.`);
    state.activeView = 'jobs';
    navItems.forEach((item) => item.classList.toggle('is-active', item.dataset.view === 'jobs'));
    renderJobs();
  });

  previewButton.addEventListener('click', () => {
    const draft = buildDraftFromForm(form);
    document.querySelector('#draft-preview').hidden = false;
    document.querySelector('#draft-preview').innerHTML = `<h3>Draft JSON</h3><pre>${escapeHtml(JSON.stringify(draft, null, 2))}</pre>`;
  });
}

function buildDraftFromForm(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const id = nextDraftId();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  return {
    job_id: id,
    job_title: data.job_title || 'Untitled Job',
    job_slug: slugify(data.job_title || id),
    job_type: 'commercial',
    job_category: data.job_category || '',
    status: data.status || 'draft',
    customer_id: '',
    customer_display_name: data.customer_display_name || '',
    contact_type: 'customer',
    primary_contact_name: data.primary_contact_name || '',
    location: { site_name: data.job_title || '', address_line_1: '', address_line_2: '', city: data.city || '', state: data.state || 'OH', zip: '', county: '', service_area: 'Northeast Ohio' },
    scope: { scope_short: data.scope_short || '', scope_full: data.scope_short || '', surface_types: [], materials: [], access_notes: '', exclusions: '' },
    dates: { created_date: today, estimate_date: '', proposal_sent_date: '', approved_date: '', scheduled_start_date: '', actual_start_date: '', completion_date: '', invoice_sent_date: '', paid_date: '' },
    financials: { estimated_value: Number(data.estimated_value || 0), approved_value: 0, invoice_total: 0, amount_paid: 0, balance_due: 0, pricing_type: 'fixed_price', tax_exempt: false, payment_status: 'not_billable_yet' },
    links: { proposal_ids: [], invoice_ids: [], photo_group_ids: [], mileage_ids: [], task_ids: [], portfolio_project_id: '' },
    photos: { photo_status: 'none', photo_folder: `images/jobs/${id}/`, portfolio_candidate: false, portfolio_approved: false, before_after_available: false, cover_photo: '' },
    portfolio: { portfolio_candidate: false, portfolio_category: data.job_category || '', portfolio_title: data.job_title || '', portfolio_description: '', portfolio_visible: false, portfolio_published_date: '' },
    follow_up: { next_action: '', next_action_due: '', priority: 'normal', assigned_to: 'owner', follow_up_required: false },
    notes: { field_notes: '', private_notes: 'Local browser draft created from Manager MVP.', customer_notes: '' },
    audit: { created_by: 'owner', created_at: now, updated_at: now, archived: false, archive_reason: '', local_draft: true }
  };
}

function nextDraftId() {
  const ids = allJobs().map((job) => job.job_id).filter(Boolean);
  const numbers = ids.map((id) => Number(String(id).match(/(\d+)$/)?.[1] || 0));
  const next = Math.max(0, ...numbers) + 1;
  return `JOB-2026-${String(next).padStart(4, '0')}`;
}

function upsertDraft(draft) {
  return [...state.drafts.filter((job) => job.job_id !== draft.job_id), draft];
}

function readDrafts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function writeDrafts(drafts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

function clearDrafts() {
  localStorage.removeItem(STORAGE_KEY);
  state.drafts = [];
  setStatus('Cleared local job drafts from this browser.');
  renderJobs();
}

async function copyJobJson(job) {
  const json = JSON.stringify(job, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    setStatus(`Copied JSON for ${job.job_id}.`);
  } catch {
    setStatus('Clipboard copy failed. Use the Export JSON box below.');
  }
}

function renderSettings() {
  workspace.innerHTML = `
    <section class="card">
      <h2>Manager Settings</h2>
      <p>Future controls: company defaults, proposal wording, invoice terms, service categories, and portfolio publishing rules.</p>
      <p><strong>Storage mode:</strong> Repo JSON for permanent records; browser localStorage for MVP drafts.</p>
    </section>
  `;
}

function metricCard(labelText, value) {
  return `<article class="card"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(labelText)}</span></article>`;
}

function detailCard(title, rows) {
  return `<section class="detail-card"><h3>${escapeHtml(title)}</h3><dl>${Object.entries(rows).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value || '—')}</dd></div>`).join('')}</dl></section>`;
}

function relationCard(title, records, idKey) {
  return `<section class="detail-card"><h3>${escapeHtml(title)}</h3>${records.length ? records.map((record) => `<p><strong>${escapeHtml(record[idKey] || 'Record')}</strong></p>`).join('') : '<p>No linked records yet.</p>'}</section>`;
}

function emptyState(message) {
  return `<article class="empty-state"><h2>No records yet</h2><p>${escapeHtml(message)}</p></article>`;
}

function errorCard(error) {
  return `<article class="empty-state"><h2>Manager load error</h2><p>${escapeHtml(error.message)}</p></article>`;
}

function setStatus(message) { dataStatus.textContent = message; }
function label(value = '') { return String(value).replaceAll('_', ' '); }
function slugify(value = '') { return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function escapeHtml(value = '') { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
