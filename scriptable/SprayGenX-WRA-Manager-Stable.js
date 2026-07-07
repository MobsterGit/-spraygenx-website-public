// Spray GenX WRA Manager — Stable Self-Contained Build
// Version: 2026.07.02 Stable-1
// Purpose: one complete Scriptable file with JSON helpers, array-safe indexes, current/archive browsing, backups, and proposal/invoice workflow.

const fm = FileManager.iCloud();
const ROOT = fm.joinPath(fm.documentsDirectory(), "SprayGenX");

const DIRS = {
  root: ROOT,
  proposals: fm.joinPath(ROOT, "Proposals"),
  invoices: fm.joinPath(ROOT, "Invoices"),
  data: fm.joinPath(ROOT, "Data"),
  logs: fm.joinPath(ROOT, "Logs"),
  backups: fm.joinPath(ROOT, "Backups"),
  exports: fm.joinPath(ROOT, "Exports")
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
  Object.values(DIRS).forEach(p => { if (!fm.fileExists(p)) fm.createDirectory(p, true); });
  if (!fm.fileExists(FILES.settings)) writeJson(FILES.settings, DEFAULT_SETTINGS);
  if (!fm.fileExists(FILES.proposals)) writeJson(FILES.proposals, []);
  if (!fm.fileExists(FILES.invoices)) writeJson(FILES.invoices, []);
  if (!fm.fileExists(FILES.activity)) writeJson(FILES.activity, []);
  normalizeIndex(FILES.proposals);
  normalizeIndex(FILES.invoices);
}

async function home() {
  let close = false;
  while (!close) {
    const s = stats();
    const a = new Alert();
    a.title = "Spray GenX Manager";
    a.message = `${s.active} active · ${s.proposals} proposals · ${s.invoices} invoices\nBalance due: ${money(s.balance)}\n\nStable build — self-contained helpers included.`;
    a.addAction("+ New Proposal");
    a.addAction("Current Work");
    a.addAction("Find / Archive");
    a.addAction("Test Center");
    a.addAction("Backup / Restore");
    a.addAction("Settings");
    a.addCancelAction("Close");
    const c = await a.presentSheet();
    if (c === -1) close = true;
    if (c === 0) await proposalFlow();
    if (c === 1) await currentWork();
    if (c === 2) await archiveMenu();
    if (c === 3) await testCenter();
    if (c === 4) await backupMenu();
    if (c === 5) await settingsMenu();
  }
}

function stats() {
  const props = asArray(readJson(FILES.proposals, []));
  const inv = asArray(readJson(FILES.invoices, []));
  const activeProps = props.filter(d => !["archived", "declined", "converted_to_invoice"].includes(status(d.status)));
  const activeInv = inv.filter(d => !["paid", "void", "archived"].includes(status(d.status)));
  return { proposals: props.length, invoices: inv.length, active: activeProps.length + activeInv.length, balance: activeInv.reduce((n, d) => n + Number(d.balance_due ?? d.total ?? 0), 0) };
}

async function proposalFlow(seed) {
  const doc = seed || blankProposal();
  const saved = await proposalEditor(doc, seed ? "Edit Proposal" : "New Proposal");
  if (!saved) return;
  saveProposal(saved);
  writeHtml(saved, "proposal");
  bumpProposal(saved.id);
  log("proposal_saved", saved.id);
  await afterSave(saved, "proposal");
}

async function proposalEditor(doc, title) {
  const base = new Alert();
  base.title = title;
  base.message = `${doc.id}\nStep 1 of 3 — customer and job`;
  ["Customer name", "Contact / GC", "Phone", "Email", "Job title", "Site / address", "City", "Category"].forEach((label, i) => base.addTextField(label, [doc.customer, doc.contact, doc.phone, doc.email, doc.title, doc.site, doc.city, doc.category][i] || ""));
  base.addAction("Next");
  base.addCancelAction("Cancel");
  if (await base.presentAlert() === -1) return null;
  doc.customer = base.textFieldValue(0).trim();
  doc.contact = base.textFieldValue(1).trim();
  doc.phone = base.textFieldValue(2).trim();
  doc.email = base.textFieldValue(3).trim();
  doc.title = base.textFieldValue(4).trim();
  doc.site = base.textFieldValue(5).trim();
  doc.city = base.textFieldValue(6).trim();
  doc.category = base.textFieldValue(7).trim();

  const price = new Alert();
  price.title = doc.id;
  price.message = "Step 2 of 3 — pricing";
  price.addTextField("Total price", String(doc.total || ""));
  price.addTextField("Deposit / paid", String(doc.deposit || ""));
  price.addTextField("Status", doc.status || "open");
  price.addAction("Next");
  price.addCancelAction("Cancel");
  if (await price.presentAlert() === -1) return null;
  doc.total = num(price.textFieldValue(0));
  doc.deposit = num(price.textFieldValue(1));
  doc.status = price.textFieldValue(2).trim() || "open";

  doc.summary = await textStep("Step 3 of 3", "Short scope summary", doc.summary);
  doc.details = await textStep("Scope Details", "Paste detailed scope here", doc.details);
  doc.notes = await textStep("Notes / Exclusions", "Anything excluded or special", doc.notes);
  doc.updated = today();
  sortKeys(doc);
  return doc;
}

async function textStep(title, placeholder, current) {
  const a = new Alert();
  a.title = title;
  a.message = "Long pasted scope text will save; Scriptable editing is basic.";
  a.addTextField(placeholder, current || "");
  a.addAction("Save");
  a.addAction("Blank");
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
    if (c === 1) { type === "proposal" ? await proposalFlow(doc) : await invoiceEditor(doc); back = true; }
    if (type === "proposal" && c === 2) { await convertToInvoice(doc); back = true; }
    const copyIndex = type === "proposal" ? 3 : 2;
    const homeIndex = type === "proposal" ? 4 : 3;
    if (c === copyIndex) { Pasteboard.copy(filePathFor(doc, type)); await notice("Copied", "File path copied."); }
    if (c === homeIndex || c === -1) back = true;
  }
}

async function currentWork() {
  const docs = activeDocs();
  await documentTable("Current Work", docs, "No active work yet. Create a test proposal first.");
}

function activeDocs() {
  const props = asArray(readJson(FILES.proposals, [])).filter(d => !["archived", "declined", "converted_to_invoice"].includes(status(d.status)));
  const inv = asArray(readJson(FILES.invoices, [])).filter(d => !["paid", "void", "archived"].includes(status(d.status)));
  return props.concat(inv).sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || "")));
}

async function documentTable(title, docs, emptyMsg) {
  docs = asArray(docs);
  if (!docs.length) return await notice(title, emptyMsg);
  const table = new UITable();
  table.showSeparators = true;
  const h = new UITableRow();
  h.isHeader = true;
  h.addText(title, `${docs.length} item(s)`);
  table.addRow(h);
  docs.forEach(doc => {
    const row = new UITableRow();
    row.height = 72;
    const left = row.addText(doc.customer || doc.title || doc.id, `${doc.kind || "proposal"} · ${doc.status || "open"} · ${money(doc.total)}`);
    left.widthWeight = 75;
    const right = row.addText(doc.updated || doc.created || "", doc.id);
    right.rightAligned();
    right.widthWeight = 35;
    row.onSelect = async () => await openDoc(loadDoc(doc));
    table.addRow(row);
  });
  await table.present();
}

function loadDoc(doc) {
  const type = doc.kind === "invoice" ? "invoice" : "proposal";
  const path = filePathFor(doc, type);
  return fm.fileExists(path) ? readJson(path, doc) : doc;
}

async function openDoc(doc) {
  const type = doc.kind === "invoice" ? "invoice" : "proposal";
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
  if (c === 0) await QuickLook.present(writeHtml(doc, type));
  if (c === 1) type === "proposal" ? await proposalFlow(doc) : await invoiceEditor(doc);
  if (c === 2) await duplicateDoc(doc, type);
  if (type === "proposal" && c === 3) await convertToInvoice(doc);
  const archiveIndex = type === "proposal" ? 4 : 3;
  if (c === archiveIndex) await archiveDoc(doc, type);
}

async function invoiceEditor(doc) {
  const a = new Alert();
  a.title = `Invoice ${doc.id}`;
  a.message = "Edit invoice status and amount.";
  a.addTextField("Customer", doc.customer || "");
  a.addTextField("Job title", doc.title || "");
  a.addTextField("Total", String(doc.total || ""));
  a.addTextField("Deposit / paid", String(doc.deposit || ""));
  a.addTextField("Status", doc.status || "unpaid");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  doc.customer = a.textFieldValue(0).trim();
  doc.title = a.textFieldValue(1).trim();
  doc.total = num(a.textFieldValue(2));
  doc.deposit = num(a.textFieldValue(3));
  doc.status = a.textFieldValue(4).trim() || "unpaid";
  doc.updated = today();
  sortKeys(doc);
  saveInvoice(doc);
  writeHtml(doc, "invoice");
  log("invoice_updated", doc.id);
}

async function convertToInvoice(proposal) {
  const id = nextInvoiceId();
  const invoice = Object.assign({}, proposal, { id, kind: "invoice", status: "unpaid", source_proposal: proposal.id, created: today(), updated: today() });
  sortKeys(invoice);
  proposal.status = "converted_to_invoice";
  proposal.updated = today();
  saveProposal(proposal);
  saveInvoice(invoice);
  writeHtml(proposal, "proposal");
  writeHtml(invoice, "invoice");
  log("converted_to_invoice", `${proposal.id} -> ${invoice.id}`);
  await notice("Invoice Created", `${invoice.id} was created from ${proposal.id}.`);
}

async function duplicateDoc(doc, type) {
  const copy = Object.assign({}, doc);
  copy.id = type === "invoice" ? nextInvoiceId() : nextProposalId();
  copy.kind = type;
  copy.status = "draft";
  copy.created = today();
  copy.updated = today();
  sortKeys(copy);
  type === "invoice" ? saveInvoice(copy) : saveProposal(copy);
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
  type === "invoice" ? saveInvoice(doc) : saveProposal(doc);
  log("archived", doc.id);
}

async function archiveMenu() {
  const docs = asArray(readJson(FILES.proposals, [])).concat(asArray(readJson(FILES.invoices, [])));
  const a = new Alert();
  a.title = "Find / Archive";
  a.message = "Browse older proposals and invoices without crowding Current Work.";
  a.addAction("By Month");
  a.addAction("By Year");
  a.addAction("By Week");
  a.addAction("By Customer / Job Search");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === -1) return;
  if (c === 3) return await searchDocs(docs);
  const key = c === 0 ? "sort_month" : c === 1 ? "sort_year" : "sort_week";
  const groups = groupBy(docs, d => d[key] || "Unsorted");
  const names = Object.keys(groups).sort().reverse();
  if (!names.length) return await notice("Find / Archive", "No documents yet.");
  const pick = new Alert();
  pick.title = key.replace("sort_", "").toUpperCase();
  names.forEach(name => pick.addAction(`${name} (${groups[name].length})`));
  pick.addCancelAction("Back");
  const p = await pick.presentSheet();
  if (p !== -1) await documentTable(names[p], groups[names[p]], "No documents found.");
}

async function searchDocs(docs) {
  const a = new Alert();
  a.title = "Customer / Job Search";
  a.addTextField("Search customer, job, city, or id", "");
  a.addAction("Search");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  const q = a.textFieldValue(0).toLowerCase().trim();
  if (!q) return await notice("Search", "Enter at least one search word.");
  const results = docs.filter(d => `${d.customer || ""} ${d.title || ""} ${d.site || ""} ${d.city || ""} ${d.id || ""}`.toLowerCase().includes(q));
  await documentTable(`Search: ${q}`, results, "No matching documents.");
}

async function testCenter() {
  const a = new Alert();
  a.title = "Test Center";
  a.message = "Creates and removes obvious TEST records only.";
  a.addAction("Create Sample Proposal");
  a.addAction("Create Sample Invoice");
  a.addAction("Show Storage Paths");
  a.addAction("Rebuild Indexes");
  a.addDestructiveAction("Delete Test Records Only");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === 0) await sampleProposal();
  if (c === 1) await sampleInvoice();
  if (c === 2) await notice("Storage", `${ROOT}\n\nProposals: ${DIRS.proposals}\nInvoices: ${DIRS.invoices}\nBackups: ${DIRS.backups}`);
  if (c === 3) { rebuildIndexes(); await notice("Indexes Rebuilt", "Lists rebuilt from JSON files."); }
  if (c === 4) await deleteTestRecords();
}

async function sampleProposal() {
  const d = blankProposal();
  Object.assign(d, { customer: "TEST Customer", contact: "TEST Contact", title: "TEST Interior Repaint", site: "123 Test Street", city: "Wadsworth", category: "commercial-interior", summary: "TEST proposal for Scriptable UX testing.", details: "Prep, mask, paint listed surfaces, and clean work area.", notes: "Safe to delete from Test Center.", total: 2500, deposit: 0 });
  saveProposal(d); writeHtml(d, "proposal"); bumpProposal(d.id); log("sample_proposal_created", d.id);
  await notice("Sample Created", `${d.id} is ready in Current Work.`);
}

async function sampleInvoice() {
  const id = nextInvoiceId();
  const d = { id, kind: "invoice", customer: "TEST Customer", contact: "TEST Contact", phone: "", email: "", title: "TEST Invoice", site: "123 Test Street", city: "Wadsworth", category: "test", summary: "TEST invoice for UX testing.", details: "Invoice generated from test center.", notes: "Safe to delete.", total: 1200, deposit: 0, status: "unpaid", created: today(), updated: today() };
  sortKeys(d); saveInvoice(d); writeHtml(d, "invoice"); log("sample_invoice_created", d.id);
  await notice("Sample Created", `${d.id} is ready in Current Work.`);
}

async function deleteTestRecords() {
  const a = new Alert();
  a.title = "Delete test records?";
  a.message = "Only records with TEST in customer or title will be removed.";
  a.addDestructiveAction("Delete TEST Records");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  [DIRS.proposals, DIRS.invoices].forEach(dir => {
    fm.listContents(dir).forEach(name => {
      const path = fm.joinPath(dir, name);
      if (fm.isDirectory(path)) return;
      const d = name.endsWith(".json") ? readJson(path, null) : null;
      const isTest = String(name).toUpperCase().includes("TEST") || (d && `${d.customer || ""} ${d.title || ""}`.toUpperCase().includes("TEST"));
      if (isTest) fm.remove(path);
    });
  });
  rebuildIndexes();
  await notice("Cleaned", "TEST records and matching HTML/JSON files were removed.");
}

async function backupMenu() {
  const a = new Alert();
  a.title = "Backup / Restore";
  a.message = "Create full copies before testing real data.";
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
  copyDir(DIRS.proposals, fm.joinPath(dir, "Proposals"));
  copyDir(DIRS.invoices, fm.joinPath(dir, "Invoices"));
  copyDir(DIRS.logs, fm.joinPath(dir, "Logs"));
  copyDir(DIRS.data, fm.joinPath(dir, "Data"));
  log("backup_created", stamp);
  return dir;
}

function copyDir(src, dst) {
  if (!fm.fileExists(src)) return;
  if (!fm.fileExists(dst)) fm.createDirectory(dst, true);
  fm.listContents(src).forEach(name => {
    const s = fm.joinPath(src, name);
    const d = fm.joinPath(dst, name);
    if (fm.isDirectory(s)) copyDir(s, d);
    else { if (fm.fileExists(d)) fm.remove(d); fm.copy(s, d); }
  });
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

function blankProposal() {
  const s = getSettings();
  const id = `PROP-${new Date().getFullYear()}-${String(s.nextProposalNumber || 1).padStart(4, "0")}`;
  const d = { id, kind: "proposal", customer: "", contact: "", phone: "", email: "", title: "", site: "", city: "", category: "", summary: "", details: "", notes: "", total: 0, deposit: 0, status: "open", created: today(), updated: today() };
  sortKeys(d);
  return d;
}

function saveProposal(d) { d.kind = "proposal"; d.balance_due = Math.max(0, Number(d.total || 0) - Number(d.deposit || 0)); writeJson(filePathFor(d, "proposal"), d); upsert(FILES.proposals, d); }
function saveInvoice(d) { d.kind = "invoice"; d.balance_due = Math.max(0, Number(d.total || 0) - Number(d.deposit || 0)); writeJson(filePathFor(d, "invoice"), d); upsert(FILES.invoices, d); }
function filePathFor(d, type) { return fm.joinPath(type === "invoice" ? DIRS.invoices : DIRS.proposals, `${d.id}.json`); }
function upsert(indexPath, d) { const list = asArray(readJson(indexPath, [])).filter(x => x.id !== d.id); list.push(slim(d)); list.sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || ""))); writeJson(indexPath, list); }
function slim(d) { return { id: d.id, kind: d.kind, customer: d.customer, title: d.title, site: d.site, city: d.city, status: d.status, total: d.total, deposit: d.deposit, balance_due: d.balance_due, created: d.created, updated: d.updated, sort_year: d.sort_year, sort_month: d.sort_month, sort_week: d.sort_week }; }

function writeHtml(d, type) {
  const s = getSettings();
  const path = fm.joinPath(type === "invoice" ? DIRS.invoices : DIRS.proposals, `${d.id}.html`);
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#eee;color:#111;font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{background:white;max-width:820px;margin:0 auto;min-height:100vh;padding:34px;box-sizing:border-box}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #111;padding-bottom:18px;margin-bottom:24px}.brand h1{margin:0;font-size:29px}.brand p,.doc p{margin:4px 0;color:#444}.doc{text-align:right}.doc h2{margin:0;text-transform:uppercase}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.box{border:1px solid #ddd;border-radius:9px;padding:14px;margin-bottom:18px}.box h3{margin:0 0 8px;text-transform:uppercase;font-size:13px;letter-spacing:.08em}.scope{white-space:pre-wrap}.price{font-size:30px;font-weight:800;text-align:right}.terms{border-top:1px solid #ddd;margin-top:18px;padding-top:12px;font-size:13px}@media(max-width:650px){.top,.grid{display:block}.doc{text-align:left;margin-top:18px}.page{padding:24px}}</style></head><body><main class="page"><section class="top"><div class="brand"><h1>${esc(s.companyName)}</h1><p>${esc(s.tagline)}</p><p>${esc(s.serviceArea)}</p><p>${esc([s.phone,s.email].filter(Boolean).join(" · "))}</p></div><div class="doc"><h2>${esc(type)}</h2><p><strong>${esc(d.id)}</strong></p><p>${esc(d.created || today())}</p><p>${esc(d.status || "open")}</p></div></section><section class="grid"><div class="box"><h3>Customer</h3><p><strong>${esc(d.customer)}</strong><br>${esc(d.contact)}<br>${esc(d.phone)}<br>${esc(d.email)}</p></div><div class="box"><h3>Project</h3><p><strong>${esc(d.title)}</strong><br>${esc(d.site)}<br>${esc(d.city)}<br>${esc(d.category)}</p></div></section><section class="box"><h3>Scope Summary</h3><p class="scope">${esc(d.summary)}</p></section><section class="box"><h3>Scope Details</h3><p class="scope">${esc(d.details)}</p></section><section class="grid"><div class="box"><h3>Notes / Exclusions</h3><p class="scope">${esc(d.notes)}</p></div><div class="box"><h3>Total</h3><p class="price">${money(d.total)}</p><p>Deposit / Paid: ${money(d.deposit)}</p><p>Balance Due: ${money(d.balance_due)}</p></div></section><section class="terms"><p><strong>Terms:</strong> ${esc(s.defaultTerms)}</p><p><strong>Warranty:</strong> ${esc(s.warrantyNote)}</p></section></main></body></html>`;
  fm.writeString(path, html);
  return path;
}

function nextProposalId() { const s = getSettings(); const id = `PROP-${new Date().getFullYear()}-${String(s.nextProposalNumber || 1).padStart(4, "0")}`; s.nextProposalNumber = Number(s.nextProposalNumber || 1) + 1; writeJson(FILES.settings, s); return id; }
function nextInvoiceId() { const s = getSettings(); const id = `INV-${new Date().getFullYear()}-${String(s.nextInvoiceNumber || 1).padStart(4, "0")}`; s.nextInvoiceNumber = Number(s.nextInvoiceNumber || 1) + 1; writeJson(FILES.settings, s); return id; }
function bumpProposal(id) { const s = getSettings(); const n = Number(String(id).match(/(\d+)$/)?.[1] || 0) + 1; if (n > Number(s.nextProposalNumber || 1)) { s.nextProposalNumber = n; writeJson(FILES.settings, s); } }
function rebuildIndexes() { writeJson(FILES.proposals, scan(DIRS.proposals, "proposal")); writeJson(FILES.invoices, scan(DIRS.invoices, "invoice")); }
function scan(dir, kind) { return fm.listContents(dir).filter(n => n.endsWith(".json")).map(n => readJson(fm.joinPath(dir, n), null)).filter(Boolean).map(d => { d.kind = kind; sortKeys(d); return slim(d); }).sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || ""))); }
function sortKeys(d) { const date = d.created || today(); d.sort_year = date.slice(0, 4); d.sort_month = date.slice(0, 7); d.sort_week = weekKey(new Date(date)); }
function getSettings() { return Object.assign({}, DEFAULT_SETTINGS, readJson(FILES.settings, {})); }
function normalizeIndex(path) { const list = asArray(readJson(path, [])); writeJson(path, list); }
function asArray(value) { if (Array.isArray(value)) return value.filter(Boolean); if (value && typeof value === "object") return Object.values(value).filter(Boolean); return []; }
function readJson(path, fallback) { try { if (!fm.fileExists(path)) return fallback; return JSON.parse(fm.readString(path)); } catch (e) { return fallback; } }
function writeJson(path, value) { fm.writeString(path, JSON.stringify(value, null, 2)); }
function loadJson(path, fallback) { return readJson(path, fallback); }
function loadJSON(path, fallback) { return readJson(path, fallback); }
function readJSON(path, fallback) { return readJson(path, fallback); }
function writeJSON(path, value) { return writeJson(path, value); }
function log(action, detail) { const list = asArray(readJson(FILES.activity, [])); list.push({ at: new Date().toISOString(), action, detail }); writeJson(FILES.activity, list.slice(-300)); }
function groupBy(list, getter) { return asArray(list).reduce((acc, item) => { const key = getter(item) || "Unsorted"; if (!acc[key]) acc[key] = []; acc[key].push(item); return acc; }, {}); }
function today() { return new Date().toISOString().slice(0, 10); }
function weekKey(date) { const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); const week = Math.ceil((((d - start) / 86400000) + 1) / 7); return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`; }
function num(v) { return Number(String(v || "0").replace(/[^0-9.-]/g, "")) || 0; }
function money(v) { return "$" + Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function status(v) { return String(v || "").toLowerCase().trim(); }
function esc(v) { return String(v ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[ch])); }
async function notice(title, message) { const a = new Alert(); a.title = title; a.message = String(message || ""); a.addAction("OK"); await a.presentAlert(); }
