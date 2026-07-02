// Spray GenX WRA Manager — UX Test Build
// Version: 2026.07.02 UX-Test
// Purpose: first hands-on Scriptable testing with clearer screens, safer actions, and sample data.

const fm = FileManager.iCloud();
const ROOT = fm.joinPath(fm.documentsDirectory(), "SprayGenX");

const DIRS = {
  root: ROOT,
  proposals: fm.joinPath(ROOT, "Proposals"),
  invoices: fm.joinPath(ROOT, "Invoices"),
  data: fm.joinPath(ROOT, "Data"),
  logs: fm.joinPath(ROOT, "Logs"),
  backups: fm.joinPath(ROOT, "Backups")
};

const FILES = {
  settings: fm.joinPath(DIRS.data, "settings.json"),
  proposals: fm.joinPath(DIRS.logs, "proposal_index.json"),
  invoices: fm.joinPath(DIRS.logs, "invoice_index.json"),
  activity: fm.joinPath(DIRS.logs, "activity_log.json")
};

const DEFAULT_SETTINGS = {
  companyName: "Spray GenX LLC",
  tagline: "Painting & Refinishing",
  serviceArea: "Northeast Ohio",
  phone: "",
  email: "",
  nextProposalNumber: 1,
  nextInvoiceNumber: 1,
  defaultTerms: "Payment due upon completion unless otherwise noted.",
  warrantyNote: "Warranty applies to listed scope and assumes sound existing substrates unless otherwise noted."
};

setup();
await home();

function setup() {
  Object.values(DIRS).forEach(path => { if (!fm.fileExists(path)) fm.createDirectory(path, true); });
  if (!fm.fileExists(FILES.settings)) writeJson(FILES.settings, DEFAULT_SETTINGS);
  if (!fm.fileExists(FILES.proposals)) writeJson(FILES.proposals, []);
  if (!fm.fileExists(FILES.invoices)) writeJson(FILES.invoices, []);
  if (!fm.fileExists(FILES.activity)) writeJson(FILES.activity, []);
}

async function home() {
  let close = false;
  while (!close) {
    const stats = getStats();
    const a = new Alert();
    a.title = "Spray GenX Manager";
    a.message = `${stats.active} active · ${stats.proposals} proposals · ${stats.invoices} invoices\nBalance due: ${money(stats.balanceDue)}\n\nTesting build — safe to run.`;
    a.addAction("+ New Proposal");
    a.addAction("Current Work");
    a.addAction("Find / Archive");
    a.addAction("Test Center");
    a.addAction("Backup / Restore");
    a.addAction("Settings");
    a.addCancelAction("Close");
    const c = await a.presentSheet();
    if (c === -1) close = true;
    if (c === 0) await newProposalFlow();
    if (c === 1) await currentWork();
    if (c === 2) await archiveMenu();
    if (c === 3) await testCenter();
    if (c === 4) await backupMenu();
    if (c === 5) await settingsMenu();
  }
}

function getStats() {
  const proposals = readJson(FILES.proposals, []);
  const invoices = readJson(FILES.invoices, []);
  const activeProps = proposals.filter(x => !["archived", "declined", "converted_to_invoice"].includes(String(x.status || "").toLowerCase()));
  const activeInv = invoices.filter(x => !["paid", "void", "archived"].includes(String(x.status || "").toLowerCase()));
  return {
    proposals: proposals.length,
    invoices: invoices.length,
    active: activeProps.length + activeInv.length,
    balanceDue: activeInv.reduce((sum, item) => sum + Number(item.total || 0), 0)
  };
}

async function newProposalFlow(seed) {
  const settings = getSettings();
  const doc = seed || blankProposal(settings);

  const base = new Alert();
  base.title = doc.id;
  base.message = "Step 1 of 3 — customer and job";
  base.addTextField("Customer name", doc.customer || "");
  base.addTextField("Contact / GC", doc.contact || "");
  base.addTextField("Phone", doc.phone || "");
  base.addTextField("Email", doc.email || "");
  base.addTextField("Job title", doc.title || "");
  base.addTextField("Site / address", doc.site || "");
  base.addTextField("City", doc.city || "");
  base.addTextField("Category", doc.category || "");
  base.addAction("Next");
  base.addCancelAction("Cancel");
  if (await base.presentAlert() === -1) return;

  doc.customer = base.textFieldValue(0).trim();
  doc.contact = base.textFieldValue(1).trim();
  doc.phone = base.textFieldValue(2).trim();
  doc.email = base.textFieldValue(3).trim();
  doc.title = base.textFieldValue(4).trim();
  doc.site = base.textFieldValue(5).trim();
  doc.city = base.textFieldValue(6).trim();
  doc.category = base.textFieldValue(7).trim();

  const moneyForm = new Alert();
  moneyForm.title = doc.id;
  moneyForm.message = "Step 2 of 3 — pricing";
  moneyForm.addTextField("Total proposal price", String(doc.total || ""));
  moneyForm.addTextField("Deposit / draw", String(doc.deposit || ""));
  moneyForm.addTextField("Status", doc.status || "open");
  moneyForm.addAction("Next");
  moneyForm.addCancelAction("Cancel");
  if (await moneyForm.presentAlert() === -1) return;

  doc.total = num(moneyForm.textFieldValue(0));
  doc.deposit = num(moneyForm.textFieldValue(1));
  doc.status = moneyForm.textFieldValue(2).trim() || "open";

  doc.summary = await textStep("Step 3 of 3", "Short scope summary", doc.summary);
  doc.details = await textStep("Scope Details", "Paste detailed scope here", doc.details);
  doc.notes = await textStep("Notes / Exclusions", "Anything excluded or special", doc.notes);
  doc.updated = today();
  doc.sort_year = today().slice(0, 4);
  doc.sort_month = today().slice(0, 7);
  doc.sort_week = weekKey(new Date());

  saveProposal(doc);
  writeHtml(doc, "proposal");
  bumpProposal(doc.id);
  log("proposal_saved", doc.id);

  await afterSave(doc, "proposal");
}

async function textStep(title, placeholder, current) {
  const a = new Alert();
  a.title = title;
  a.message = "For first testing this uses one paste field. Long scope text will save, but the editor is basic.";
  a.addTextField(placeholder, current || "");
  a.addAction("Save");
  a.addAction("Skip");
  a.addCancelAction("Keep Existing");
  const c = await a.presentAlert();
  if (c === -1) return current || "";
  if (c === 1) return "";
  return a.textFieldValue(0);
}

async function afterSave(doc, type) {
  let back = false;
  while (!back) {
    const a = new Alert();
    a.title = "Saved";
    a.message = `${doc.id}\n${doc.customer || "No customer"}\n${doc.title || "No title"}\n${money(doc.total)}`;
    a.addAction("Preview Document");
    a.addAction("Edit Again");
    if (type === "proposal") a.addAction("Convert to Invoice");
    a.addAction("Copy File Path");
    a.addAction("Back to Home");
    const c = await a.presentSheet();
    if (c === 0) await QuickLook.present(writeHtml(doc, type));
    if (c === 1) {
      if (type === "proposal") await newProposalFlow(doc);
      else await editInvoiceFlow(doc);
      back = true;
    }
    if (type === "proposal" && c === 2) {
      await convertToInvoice(doc);
      back = true;
    }
    const copyIndex = type === "proposal" ? 3 : 2;
    const homeIndex = type === "proposal" ? 4 : 3;
    if (c === copyIndex) {
      Pasteboard.copy(filePathFor(doc, type));
      await notice("Copied", "The file path was copied to the clipboard.");
    }
    if (c === homeIndex || c === -1) back = true;
  }
}

async function currentWork() {
  const docs = activeDocs();
  await documentTable("Current Work", docs, "No active work yet. Create a test proposal first.");
}

function activeDocs() {
  const props = readJson(FILES.proposals, []).filter(x => !["archived", "declined", "converted_to_invoice"].includes(String(x.status || "").toLowerCase()));
  const inv = readJson(FILES.invoices, []).filter(x => !["paid", "void", "archived"].includes(String(x.status || "").toLowerCase()));
  return props.concat(inv).sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || "")));
}

async function documentTable(title, docs, emptyMsg) {
  if (!docs.length) return await notice(title, emptyMsg);
  const table = new UITable();
  table.showSeparators = true;
  const h = new UITableRow();
  h.isHeader = true;
  h.addText(title, `${docs.length} item(s)`);
  table.addRow(h);

  docs.forEach(doc => {
    const row = new UITableRow();
    row.height = 70;
    const left = row.addText(doc.customer || doc.title || doc.id, `${doc.kind || "proposal"} · ${doc.status || "open"} · ${money(doc.total)}`);
    left.widthWeight = 75;
    const right = row.addText(doc.updated || doc.created || "", doc.id);
    right.rightAligned();
    right.widthWeight = 35;
    row.onSelect = async () => await openDoc(doc);
    table.addRow(row);
  });
  await table.present();
}

async function openDoc(doc) {
  const type = doc.kind === "invoice" ? "invoice" : "proposal";
  let done = false;
  while (!done) {
    const a = new Alert();
    a.title = doc.id;
    a.message = `${doc.customer || "No customer"}\n${doc.title || "No title"}\n${money(doc.total)}`;
    a.addAction("Preview");
    a.addAction("Edit");
    a.addAction("Duplicate");
    if (type === "proposal") a.addAction("Convert to Invoice");
    a.addAction("Archive");
    a.addCancelAction("Back");
    const c = await a.presentSheet();
    if (c === -1) done = true;
    if (c === 0) await QuickLook.present(writeHtml(doc, type));
    if (c === 1) {
      if (type === "proposal") await newProposalFlow(doc);
      else await editInvoiceFlow(doc);
      done = true;
    }
    if (c === 2) { await duplicateDoc(doc, type); done = true; }
    if (type === "proposal" && c === 3) { await convertToInvoice(doc); done = true; }
    const archiveIndex = type === "proposal" ? 4 : 3;
    if (c === archiveIndex) { await archiveDoc(doc, type); done = true; }
  }
}

async function editInvoiceFlow(doc) {
  const a = new Alert();
  a.title = `Invoice ${doc.id}`;
  a.message = "Edit invoice status and amount.";
  a.addTextField("Customer", doc.customer || "");
  a.addTextField("Job title", doc.title || "");
  a.addTextField("Total", String(doc.total || ""));
  a.addTextField("Status", doc.status || "unpaid");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  doc.customer = a.textFieldValue(0).trim();
  doc.title = a.textFieldValue(1).trim();
  doc.total = num(a.textFieldValue(2));
  doc.status = a.textFieldValue(3).trim() || "unpaid";
  doc.updated = today();
  saveInvoice(doc);
  writeHtml(doc, "invoice");
  log("invoice_updated", doc.id);
}

async function convertToInvoice(proposal) {
  const settings = getSettings();
  const id = `INV-${new Date().getFullYear()}-${String(settings.nextInvoiceNumber || 1).padStart(4, "0")}`;
  const invoice = Object.assign({}, proposal, {
    id,
    kind: "invoice",
    status: "unpaid",
    source_proposal: proposal.id,
    created: today(),
    updated: today()
  });
  proposal.status = "converted_to_invoice";
  proposal.updated = today();
  saveProposal(proposal);
  saveInvoice(invoice);
  writeHtml(invoice, "invoice");
  settings.nextInvoiceNumber = Number(settings.nextInvoiceNumber || 1) + 1;
  writeJson(FILES.settings, settings);
  log("converted_to_invoice", `${proposal.id} -> ${invoice.id}`);
  await notice("Invoice Created", `${invoice.id} was created from ${proposal.id}.`);
}

async function duplicateDoc(doc, type) {
  const copy = Object.assign({}, doc);
  if (type === "invoice") {
    copy.id = nextInvoiceId();
    copy.kind = "invoice";
    copy.status = "draft";
    saveInvoice(copy);
  } else {
    copy.id = nextProposalId();
    copy.kind = "proposal";
    copy.status = "draft";
    saveProposal(copy);
  }
  copy.created = today();
  copy.updated = today();
  writeHtml(copy, type);
  await notice("Duplicated", `${copy.id} was created.`);
}

async function archiveDoc(doc, type) {
  const a = new Alert();
  a.title = "Archive?";
  a.message = `${doc.id} will move out of Current Work but remain searchable.`;
  a.addDestructiveAction("Archive");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  doc.status = "archived";
  doc.updated = today();
  if (type === "invoice") saveInvoice(doc); else saveProposal(doc);
  log("archived", doc.id);
}

async function archiveMenu() {
  const docs = readJson(FILES.proposals, []).concat(readJson(FILES.invoices, []));
  const a = new Alert();
  a.title = "Find / Archive";
  a.message = "Browse older documents by useful field.";
  a.addAction("By Month");
  a.addAction("By Year");
  a.addAction("By Customer Search");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === -1) return;
  if (c === 2) return await customerSearch(docs);
  const key = c === 0 ? "sort_month" : "sort_year";
  const groups = groupBy(docs, d => d[key] || "Unsorted");
  const names = Object.keys(groups).sort().reverse();
  const pick = new Alert();
  pick.title = c === 0 ? "Month" : "Year";
  names.forEach(name => pick.addAction(`${name} (${groups[name].length})`));
  pick.addCancelAction("Back");
  const p = await pick.presentSheet();
  if (p === -1) return;
  await documentTable(names[p], groups[names[p]], "No documents found.");
}

async function customerSearch(docs) {
  const a = new Alert();
  a.title = "Customer Search";
  a.addTextField("Search customer or job", "");
  a.addAction("Search");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  const q = a.textFieldValue(0).toLowerCase().trim();
  const results = docs.filter(d => `${d.customer} ${d.title} ${d.site} ${d.city} ${d.id}`.toLowerCase().includes(q));
  await documentTable(`Search: ${q}`, results, "No matching documents.");
}

async function testCenter() {
  const a = new Alert();
  a.title = "Test Center";
  a.message = "Use this before real data. It creates and removes obvious test records.";
  a.addAction("Create Sample Proposal");
  a.addAction("Create Sample Invoice");
  a.addAction("Show Storage Paths");
  a.addDestructiveAction("Delete Test Records Only");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === 0) await createSampleProposal();
  if (c === 1) await createSampleInvoice();
  if (c === 2) await notice("Storage", `${ROOT}\n\nProposals: ${DIRS.proposals}\nInvoices: ${DIRS.invoices}\nBackups: ${DIRS.backups}`);
  if (c === 3) await deleteTestRecords();
}

async function createSampleProposal() {
  const doc = blankProposal(getSettings());
  doc.customer = "TEST Customer";
  doc.contact = "TEST Contact";
  doc.title = "TEST Interior Repaint";
  doc.site = "123 Test Street";
  doc.city = "Wadsworth";
  doc.category = "commercial-interior";
  doc.summary = "TEST proposal for Scriptable UX testing.";
  doc.details = "Prep, mask, paint listed surfaces, and clean work area.";
  doc.notes = "This is safe to delete from Test Center.";
  doc.total = 2500;
  saveProposal(doc);
  writeHtml(doc, "proposal");
  bumpProposal(doc.id);
  await notice("Sample Created", `${doc.id} is ready in Current Work.`);
}

async function createSampleInvoice() {
  const id = nextInvoiceId();
  const doc = {
    id,
    kind: "invoice",
    customer: "TEST Customer",
    contact: "TEST Contact",
    phone: "",
    email: "",
    title: "TEST Invoice",
    site: "123 Test Street",
    city: "Wadsworth",
    category: "test",
    summary: "TEST invoice for UX testing.",
    details: "Invoice generated from test center.",
    notes: "Safe to delete.",
    total: 1200,
    deposit: 0,
    status: "unpaid",
    created: today(),
    updated: today(),
    sort_year: today().slice(0, 4),
    sort_month: today().slice(0, 7),
    sort_week: weekKey(new Date())
  };
  saveInvoice(doc);
  writeHtml(doc, "invoice");
  await notice("Sample Created", `${doc.id} is ready in Current Work.`);
}

async function deleteTestRecords() {
  const a = new Alert();
  a.title = "Delete test records?";
  a.message = "Only records with TEST in the customer or title will be removed.";
  a.addDestructiveAction("Delete TEST Records");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  const keepProps = readJson(FILES.proposals, []).filter(d => !isTest(d));
  const keepInv = readJson(FILES.invoices, []).filter(d => !isTest(d));
  writeJson(FILES.proposals, keepProps);
  writeJson(FILES.invoices, keepInv);
  await notice("Cleaned", "TEST records were removed from the indexes. HTML/JSON files may remain for inspection.");
}

function isTest(d) {
  return `${d.customer || ""} ${d.title || ""}`.toUpperCase().includes("TEST");
}

async function backupMenu() {
  const a = new Alert();
  a.title = "Backup / Restore";
  a.message = "First test version supports creating backups. Restore will be added after real-world testing.";
  a.addAction("Create Backup Now");
  a.addAction("List Backups");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === 0) await notice("Backup Created", createBackup());
  if (c === 1) await notice("Backups", fm.listContents(DIRS.backups).sort().reverse().join("\n") || "No backups yet.");
}

function createBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = fm.joinPath(DIRS.backups, stamp);
  fm.createDirectory(dir, true);
  copyIfExists(FILES.settings, fm.joinPath(dir, "settings.json"));
  copyIfExists(FILES.proposals, fm.joinPath(dir, "proposal_index.json"));
  copyIfExists(FILES.invoices, fm.joinPath(dir, "invoice_index.json"));
  copyIfExists(FILES.activity, fm.joinPath(dir, "activity_log.json"));
  log("backup_created", stamp);
  return dir;
}

function copyIfExists(src, dst) {
  if (!fm.fileExists(src)) return;
  if (fm.fileExists(dst)) fm.remove(dst);
  fm.copy(src, dst);
}

async function settingsMenu() {
  const s = getSettings();
  const a = new Alert();
  a.title = "Settings";
  a.message = "These appear on previews and future PDFs.";
  a.addTextField("Company", s.companyName || "");
  a.addTextField("Phone", s.phone || "");
  a.addTextField("Email", s.email || "");
  a.addTextField("Service area", s.serviceArea || "");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  s.companyName = a.textFieldValue(0).trim();
  s.phone = a.textFieldValue(1).trim();
  s.email = a.textFieldValue(2).trim();
  s.serviceArea = a.textFieldValue(3).trim();
  writeJson(FILES.settings, s);
}

function blankProposal(settings) {
  const id = `PROP-${new Date().getFullYear()}-${String(settings.nextProposalNumber || 1).padStart(4, "0")}`;
  return {
    id,
    kind: "proposal",
    customer: "",
    contact: "",
    phone: "",
    email: "",
    title: "",
    site: "",
    city: "",
    category: "",
    summary: "",
    details: "",
    notes: "",
    total: 0,
    deposit: 0,
    status: "open",
    created: today(),
    updated: today(),
    sort_year: today().slice(0, 4),
    sort_month: today().slice(0, 7),
    sort_week: weekKey(new Date())
  };
}

function saveProposal(doc) {
  doc.kind = "proposal";
  writeJson(filePathFor(doc, "proposal"), doc);
  upsert(FILES.proposals, doc);
}

function saveInvoice(doc) {
  doc.kind = "invoice";
  writeJson(filePathFor(doc, "invoice"), doc);
  upsert(FILES.invoices, doc);
}

function filePathFor(doc, type) {
  return fm.joinPath(type === "invoice" ? DIRS.invoices : DIRS.proposals, `${doc.id}.json`);
}

function upsert(indexPath, doc) {
  const list = readJson(indexPath, []).filter(x => x.id !== doc.id);
  list.push(slim(doc));
  list.sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || "")));
  writeJson(indexPath, list);
}

function slim(doc) {
  return {
    id: doc.id,
    kind: doc.kind,
    customer: doc.customer,
    title: doc.title,
    site: doc.site,
    city: doc.city,
    status: doc.status,
    total: doc.total,
    created: doc.created,
    updated: doc.updated,
    sort_year: doc.sort_year,
    sort_month: doc.sort_month,
    sort_week: doc.sort_week
  };
}

function writeHtml(doc, type) {
  const s = getSettings();
  const path = fm.joinPath(type === "invoice" ? DIRS.invoices : DIRS.proposals, `${doc.id}.html`);
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#eee;color:#111;font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{background:white;max-width:820px;margin:0 auto;min-height:100vh;padding:34px;box-sizing:border-box}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #111;padding-bottom:18px;margin-bottom:24px}.brand h1{margin:0;font-size:29px}.brand p,.doc p{margin:4px 0;color:#444}.doc{text-align:right}.doc h2{margin:0;text-transform:uppercase}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.box{border:1px solid #ddd;border-radius:9px;padding:14px;margin-bottom:18px}.box h3{margin:0 0 8px;text-transform:uppercase;font-size:13px;letter-spacing:.08em}.scope{white-space:pre-wrap}.price{font-size:30px;font-weight:800;text-align:right}.terms{border-top:1px solid #ddd;margin-top:18px;padding-top:12px;font-size:13px}</style></head><body><main class="page"><section class="top"><div class="brand"><h1>${esc(s.companyName)}</h1><p>${esc(s.tagline)}</p><p>${esc(s.serviceArea)}</p><p>${esc([s.phone,s.email].filter(Boolean).join(" · "))}</p></div><div class="doc"><h2>${esc(type)}</h2><p><strong>${esc(doc.id)}</strong></p><p>${esc(doc.created || today())}</p><p>${esc(doc.status || "open")}</p></div></section><section class="grid"><div class="box"><h3>Customer</h3><p><strong>${esc(doc.customer)}</strong><br>${esc(doc.contact)}<br>${esc(doc.phone)}<br>${esc(doc.email)}</p></div><div class="box"><h3>Project</h3><p><strong>${esc(doc.title)}</strong><br>${esc(doc.site)}<br>${esc(doc.city)}</p></div></section><section class="box"><h3>Scope Summary</h3><p class="scope">${esc(doc.summary)}</p></section><section class="box"><h3>Scope Details</h3><p class="scope">${esc(doc.details)}</p></section><section class="grid"><div class="box"><h3>Notes / Exclusions</h3><p class="scope">${esc(doc.notes)}</p></div><div class="box"><h3>Total</h3><p class="price">${money(doc.total)}</p><p>Deposit: ${money(doc.deposit)}</p></div></section><section class="terms"><p><strong>Terms:</strong> ${esc(s.defaultTerms)}</p><p><strong>Warranty:</strong> ${esc(s.warrantyNote)}</p></section></main></body></html>`;
  fm.writeString(path, html);
  return path;
}

function nextProposalId() {
  const s = getSettings();
  const id = `PROP-${new Date().getFullYear()}-${String(s.nextProposalNumber || 1).padStart(4, "0")}`;
  s.nextProposalNumber = Number(s.nextProposalNumber || 1) + 1;
  writeJson(FILES.settings, s);
  return id;
}

function nextInvoiceId() {
  const s = getSettings();
  const id = `INV-${new Date().getFullYear()}-${String(s.nextInvoiceNumber || 1).padStart(4, "0")}`;
  s.nextInvoiceNumber = Number(s.nextInvoiceNumber || 1) + 1;
  writeJson(FILES.settings, s);
  return id;
}

function bumpProposal(id) {
  const s = getSettings();
  const n = Number(String(id).match(/(\d+)$/)?.[1] || 0) + 1;
  if (n > Number(s.nextProposalNumber || 1)) {
    s.nextProposalNumber = n;
    writeJson(FILES.settings, s);
  }
}

function getSettings() { return Object.assign({}, DEFAULT_SETTINGS, readJson(FILES.settings, {})); }
function readJson(path, fallback) { try { return fm.fileExists(path) ? JSON.parse(fm.readString(path)) : fallback; } catch { return fallback; } }
function writeJson(path, data) { fm.writeString(path, JSON.stringify(data, null, 2)); }
function today() { return new Date().toISOString().slice(0, 10); }
function num(v) { return Number(String(v || "0").replace(/[^0-9.-]/g, "")) || 0; }
function money(v) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v || 0)); }
function log(action, detail) { const l = readJson(FILES.activity, []); l.push({ at: new Date().toISOString(), action, detail }); writeJson(FILES.activity, l.slice(-500)); }
function groupBy(items, fn) { return items.reduce((a, x) => { const k = fn(x); a[k] = a[k] || []; a[k].push(x); return a; }, {}); }
async function notice(title, message) { const a = new Alert(); a.title = title; a.message = message; a.addAction("OK"); await a.presentAlert(); }
function esc(v) { return String(v || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function weekKey(date) { const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); const w = Math.ceil((((d - y) / 86400000) + 1) / 7); return `${d.getUTCFullYear()}-W${String(w).padStart(2, "0")}`; }
