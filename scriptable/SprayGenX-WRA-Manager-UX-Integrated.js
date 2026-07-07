// Spray GenX WRA Manager — UX Integrated
// Version: 2026.07.03 Integrated-1
// Two-column dashboard + built-in legacy Data index import.

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
  Object.values(DIRS).forEach(ensure);
  if (!fm.fileExists(FILES.settings)) writeJson(FILES.settings, DEFAULT_SETTINGS);
  if (!fm.fileExists(FILES.activity)) writeJson(FILES.activity, []);
  rebuildIndexes();
  syncNextNumbers();
}

async function home() {
  let close = false;
  while (!close) {
    const s = stats();
    const table = new UITable();
    table.showSeparators = true;
    const head = new UITableRow();
    head.isHeader = true;
    head.height = 78;
    head.addText("Spray GenX Manager", `${s.active} active · ${s.proposals} proposals · ${s.invoices} invoices · ${money(s.balance)} due`);
    table.addRow(head);
    addButtonRow(table, "+ Proposal", proposalFlow, "+ Invoice", newInvoiceFlow);
    addButtonRow(table, "Current Work", currentWork, "Find / Archive", archiveMenu);
    addButtonRow(table, "Rebuild Data", async () => { const r = rebuildIndexes(); syncNextNumbers(); await notice("Data Rebuilt", `${r.proposals} proposals\n${r.invoices} invoices\n${r.skipped} skipped`); }, "Backup", backupMenu);
    addButtonRow(table, "Settings", settingsMenu, "Storage Paths", showPaths);
    const foot = new UITableRow();
    foot.height = 56;
    foot.addText("Close", "Tap here when finished");
    foot.onSelect = () => { close = true; };
    table.addRow(foot);
    await table.present();
    close = true;
  }
}

function addButtonRow(table, leftTitle, leftFn, rightTitle, rightFn) {
  const row = new UITableRow();
  row.height = 64;
  const left = row.addButton(leftTitle);
  left.widthWeight = 50;
  left.onTap = leftFn;
  const right = row.addButton(rightTitle);
  right.widthWeight = 50;
  right.onTap = rightFn;
  table.addRow(row);
}

function stats() {
  const props = readJson(FILES.proposals, []);
  const inv = readJson(FILES.invoices, []);
  const activeProps = props.filter(d => !["archived", "declined", "converted_to_invoice"].includes(status(d.status)));
  const activeInv = inv.filter(d => !["paid", "void", "archived"].includes(status(d.status)));
  return { proposals: props.length, invoices: inv.length, active: activeProps.length + activeInv.length, balance: activeInv.reduce((n, d) => n + Number(d.balance_due ?? d.total ?? 0), 0) };
}

async function proposalFlow(seed) {
  const doc = seed || blankDoc("proposal");
  const saved = await docEditor(doc, seed ? "Edit Proposal" : "New Proposal");
  if (!saved) return;
  saveDoc(saved, "proposal");
  writeHtml(saved, "proposal");
  bumpNumber(saved.id, "proposal");
  await afterSave(saved, "proposal");
}

async function newInvoiceFlow(seed) {
  const doc = seed || blankDoc("invoice");
  const saved = await docEditor(doc, seed ? "Edit Invoice" : "New Invoice");
  if (!saved) return;
  saveDoc(saved, "invoice");
  writeHtml(saved, "invoice");
  bumpNumber(saved.id, "invoice");
  await afterSave(saved, "invoice");
}

async function docEditor(doc, title) {
  const base = new Alert();
  base.title = title;
  base.message = `${doc.id}\nCustomer and job`;
  ["Customer", "Contact / GC", "Phone", "Email", "Job title", "Site / address", "City", "Category"].forEach((label, i) => base.addTextField(label, [doc.customer, doc.contact, doc.phone, doc.email, doc.title, doc.site, doc.city, doc.category][i] || ""));
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
  price.message = "Pricing";
  price.addTextField("Total price", String(doc.total || ""));
  price.addTextField(doc.kind === "invoice" ? "Paid" : "Deposit", String(doc.deposit || ""));
  price.addTextField("Status", doc.status || (doc.kind === "invoice" ? "unpaid" : "open"));
  price.addAction("Next");
  price.addCancelAction("Cancel");
  if (await price.presentAlert() === -1) return null;
  doc.total = num(price.textFieldValue(0));
  doc.deposit = num(price.textFieldValue(1));
  doc.status = price.textFieldValue(2).trim() || (doc.kind === "invoice" ? "unpaid" : "open");
  doc.balance_due = Math.max(0, doc.total - doc.deposit);
  doc.summary = await textStep("Scope Summary", "Short scope summary", doc.summary);
  doc.details = await textStep("Scope Details", "Paste detailed scope here", doc.details);
  doc.notes = await textStep("Notes / Exclusions", "Anything excluded or special", doc.notes);
  doc.updated = today();
  sortKeys(doc);
  return doc;
}

async function textStep(title, placeholder, current) {
  const a = new Alert();
  a.title = title;
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
  const a = new Alert();
  a.title = "Saved";
  a.message = `${doc.id}\n${doc.customer || "No customer"}\n${doc.title || "No title"}\n${money(doc.total)}`;
  a.addAction("Preview");
  a.addAction("Edit Again");
  if (type === "proposal") a.addAction("Convert to Invoice");
  a.addAction("Done");
  const c = await a.presentSheet();
  if (c === 0) await QuickLook.present(writeHtml(doc, type));
  if (c === 1) type === "invoice" ? await newInvoiceFlow(doc) : await proposalFlow(doc);
  if (type === "proposal" && c === 2) await convertToInvoice(doc);
}

async function currentWork() {
  const docs = activeDocs();
  await documentTable("Current Work", docs, "No active work found.");
}
function activeDocs() {
  const props = readJson(FILES.proposals, []).filter(d => !["archived", "declined", "converted_to_invoice"].includes(status(d.status)));
  const inv = readJson(FILES.invoices, []).filter(d => !["paid", "void", "archived"].includes(status(d.status)));
  return props.concat(inv).sort(byUpdated);
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
  const path = doc.path && fm.fileExists(doc.path) ? doc.path : filePathFor(doc, doc.kind || "proposal");
  return fm.fileExists(path) ? normalizeRecord(readJson(path, doc), path.split("/").pop(), path) || doc : doc;
}

async function openDoc(doc) {
  const type = doc.kind === "invoice" ? "invoice" : "proposal";
  const a = new Alert();
  a.title = doc.id;
  a.message = `${doc.customer || "No customer"}\n${doc.title || "No title"}\n${money(doc.total)}`;
  a.addAction("Preview");
  a.addAction("Edit / Upgrade");
  a.addAction("Duplicate");
  if (type === "proposal") a.addAction("Convert to Invoice");
  a.addAction("Archive");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === 0) await QuickLook.present(writeHtml(doc, type));
  if (c === 1) type === "invoice" ? await newInvoiceFlow(doc) : await proposalFlow(doc);
  if (c === 2) await duplicateDoc(doc, type);
  if (type === "proposal" && c === 3) await convertToInvoice(doc);
  const archiveIndex = type === "proposal" ? 4 : 3;
  if (c === archiveIndex) await archiveDoc(doc, type);
}

async function duplicateDoc(doc, type) {
  const copy = Object.assign({}, doc);
  delete copy.path;
  copy.id = type === "invoice" ? nextInvoiceId() : nextProposalId();
  copy.kind = type;
  copy.status = "draft";
  copy.created = today();
  copy.updated = today();
  saveDoc(copy, type);
  writeHtml(copy, type);
  await notice("Duplicated", `${copy.id} created.`);
}

async function convertToInvoice(proposal) {
  const invoice = Object.assign({}, proposal, { id: nextInvoiceId(), kind: "invoice", status: "unpaid", source_proposal: proposal.id, created: today(), updated: today() });
  proposal.status = "converted_to_invoice";
  proposal.updated = today();
  saveDoc(proposal, "proposal");
  saveDoc(invoice, "invoice");
  writeHtml(invoice, "invoice");
  await notice("Invoice Created", `${invoice.id} from ${proposal.id}`);
}

async function archiveDoc(doc, type) {
  doc.status = "archived";
  doc.updated = today();
  saveDoc(doc, type);
  await notice("Archived", doc.id);
}

async function archiveMenu() {
  const docs = readJson(FILES.proposals, []).concat(readJson(FILES.invoices, []));
  const a = new Alert();
  a.title = "Find / Archive";
  a.addAction("By Month");
  a.addAction("By Year");
  a.addAction("By Week");
  a.addAction("Search");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === -1) return;
  if (c === 3) return await searchDocs(docs);
  const key = c === 0 ? "sort_month" : c === 1 ? "sort_year" : "sort_week";
  const groups = groupBy(docs, d => d[key] || "Unsorted");
  const names = Object.keys(groups).sort().reverse();
  const pick = new Alert();
  pick.title = key.replace("sort_", "").toUpperCase();
  names.forEach(n => pick.addAction(`${n} (${groups[n].length})`));
  pick.addCancelAction("Back");
  const p = await pick.presentSheet();
  if (p !== -1) await documentTable(names[p], groups[names[p]], "No documents found.");
}

async function searchDocs(docs) {
  const a = new Alert();
  a.title = "Search";
  a.addTextField("Customer, job, city, id", "");
  a.addAction("Search");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  const q = a.textFieldValue(0).toLowerCase().trim();
  const results = docs.filter(d => `${d.customer || ""} ${d.title || ""} ${d.site || ""} ${d.city || ""} ${d.id || ""}`.toLowerCase().includes(q));
  await documentTable(`Search: ${q}`, results, "No matching documents.");
}

async function backupMenu() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = fm.joinPath(DIRS.backups, stamp);
  ensure(dir);
  copyDir(DIRS.data, fm.joinPath(dir, "Data"));
  copyDir(DIRS.logs, fm.joinPath(dir, "Logs"));
  copyDir(DIRS.proposals, fm.joinPath(dir, "Proposals"));
  copyDir(DIRS.invoices, fm.joinPath(dir, "Invoices"));
  await notice("Backup Created", dir);
}

async function settingsMenu() {
  const s = getSettings();
  const a = new Alert();
  a.title = "Settings";
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

async function showPaths() {
  await notice("Spray GenX Paths", `Root:\n${ROOT}\n\nData:\n${DIRS.data}\n\nProposals:\n${DIRS.proposals}\n\nInvoices:\n${DIRS.invoices}\n\nLogs:\n${DIRS.logs}`);
}

function rebuildIndexes() {
  const p = [], i = [];
  let skipped = 0;
  if (fm.fileExists(DIRS.data)) {
    for (const name of fm.listContents(DIRS.data)) {
      if (!name.toLowerCase().endsWith(".json") || name === "settings.json") continue;
      const path = fm.joinPath(DIRS.data, name);
      const d = normalizeRecord(readJson(path, null), name, path);
      if (!d) { skipped++; continue; }
      (d.kind === "invoice" ? i : p).push(slim(d));
    }
  }
  p.push(...scanFolder(DIRS.proposals, "proposal"));
  i.push(...scanFolder(DIRS.invoices, "invoice"));
  writeJson(FILES.proposals, dedupe(p).sort(byUpdated));
  writeJson(FILES.invoices, dedupe(i).sort(byUpdated));
  return { proposals: p.length, invoices: i.length, skipped };
}

function scanFolder(dir, kind) {
  if (!fm.fileExists(dir)) return [];
  return fm.listContents(dir).filter(n => n.toLowerCase().endsWith(".json")).map(n => normalizeRecord(readJson(fm.joinPath(dir, n), null), n, fm.joinPath(dir, n))).filter(Boolean).map(d => { d.kind = kind; return slim(d); });
}

function normalizeRecord(raw, filename, path) {
  if (!raw) return null;
  const file = String(filename || "");
  const text = JSON.stringify(raw).toLowerCase();
  const kind = file.includes("INV-") || file.toLowerCase().includes("invoice") || text.includes('"invoice"') ? "invoice" : "proposal";
  if (raw.manager || raw.customer?.name || raw.job || raw.scope || raw.pricing) {
    const m = raw.manager || {}, c = raw.customer || {}, j = raw.job || {}, s = raw.scope || {}, pr = raw.pricing || {};
    const total = num(pr.total ?? raw.total ?? 0), deposit = num(pr.deposit ?? raw.deposit ?? 0);
    const created = toIso(m.created_date || raw.created || today());
    const d = { id: raw.id || m.invoice_id || m.proposal_id || idFromFilename(file), kind, path, customer: c.name || raw.customer || "", contact: c.contact || "", phone: c.phone || "", email: c.email || "", title: j.title || raw.title || "", site: j.site || c.address || raw.site || "", city: j.city || c.city || raw.city || "", category: j.category || raw.category || "", summary: s.summary || raw.summary || "", details: s.details || raw.details || "", notes: [s.exclusions, s.notes, raw.notes].filter(Boolean).join("\n\n"), total, deposit, balance_due: Math.max(0, total - deposit), status: m.status || raw.status || (kind === "invoice" ? "unpaid" : "open"), created, updated: toIso(m.updated_date || raw.updated || created) };
    sortKeys(d); return d;
  }
  const total = num(raw.price ?? raw.Price ?? raw.total ?? raw.amount ?? 0);
  const deposit = num(raw.deposit ?? raw.paid ?? 0);
  const created = toIso(raw.date || raw.Date || raw.created || raw.createdDate || today());
  const d = { id: raw.docNo || raw.DocNo || raw.id || raw.number || idFromFilename(file), kind, path, customer: raw.client || raw.Client || raw.customer || raw.customerName || "", contact: raw.contact || raw.gc || "", phone: raw.phone || "", email: raw.email || "", title: raw.project || raw.Project || raw.title || raw.jobName || "", site: raw.site || raw.address || "", city: raw.city || "", category: raw.category || "", summary: raw.summary || "", details: raw.details || raw.scope || "", notes: raw.notes || "", total, deposit, balance_due: Math.max(0, total - deposit), status: raw.status || (kind === "invoice" ? "unpaid" : "open"), created, updated: toIso(raw.updated || raw.updatedDate || created) };
  sortKeys(d); return d;
}

function blankDoc(kind) { const id = kind === "invoice" ? nextInvoiceId() : nextProposalId(); const d = { id, kind, customer: "", contact: "", phone: "", email: "", title: "", site: "", city: "", category: "", summary: "", details: "", notes: "", total: 0, deposit: 0, balance_due: 0, status: kind === "invoice" ? "unpaid" : "open", created: today(), updated: today() }; sortKeys(d); return d; }
function saveDoc(d, kind) { d.kind = kind; d.balance_due = Math.max(0, Number(d.total || 0) - Number(d.deposit || 0)); sortKeys(d); writeJson(filePathFor(d, kind), d); rebuildIndexes(); log(`${kind}_saved`, d.id); }
function filePathFor(d, kind) { return fm.joinPath(kind === "invoice" ? DIRS.invoices : DIRS.proposals, `${d.id}.json`); }
function slim(d) { return { id: d.id, kind: d.kind, path: d.path || "", customer: d.customer || "", title: d.title || "", site: d.site || "", city: d.city || "", status: d.status || "open", total: Number(d.total || 0), deposit: Number(d.deposit || 0), balance_due: Number(d.balance_due || 0), created: d.created || today(), updated: d.updated || d.created || today(), sort_year: d.sort_year, sort_month: d.sort_month, sort_week: d.sort_week }; }
function dedupe(list) { const m = {}; list.forEach(d => { m[d.id] = d; }); return Object.values(m); }
function nextProposalId() { const s = getSettings(); return `SGX-${new Date().getFullYear()}-${String(s.nextProposalNumber || 1).padStart(3, "0")}`; }
function nextInvoiceId() { const s = getSettings(); return `INV-${new Date().getFullYear()}-${String(s.nextInvoiceNumber || 1).padStart(3, "0")}`; }
function bumpNumber(id, kind) { const s = getSettings(); const n = lastNumber(id) + 1; if (kind === "invoice" && n > Number(s.nextInvoiceNumber || 1)) s.nextInvoiceNumber = n; if (kind === "proposal" && n > Number(s.nextProposalNumber || 1)) s.nextProposalNumber = n; writeJson(FILES.settings, s); }
function syncNextNumbers() { const s = getSettings(); const ids = readJson(FILES.proposals, []).concat(readJson(FILES.invoices, [])).map(d => d.id || ""); s.nextProposalNumber = Math.max(Number(s.nextProposalNumber || 1), 1 + Math.max(0, ...ids.filter(id => id.startsWith("SGX-") || id.startsWith("PROP-")).map(lastNumber))); s.nextInvoiceNumber = Math.max(Number(s.nextInvoiceNumber || 1), 1 + Math.max(0, ...ids.filter(id => id.startsWith("INV-")).map(lastNumber))); writeJson(FILES.settings, s); }
function lastNumber(id) { return Number(String(id).match(/(\d+)$/)?.[1] || 0); }
function idFromFilename(name) { const m = String(name).match(/(SGX|PROP|INV)-\d{4}-\d+/i); return m ? m[0].toUpperCase() : String(name).replace(/\.json$/i, ""); }
function writeHtml(d, kind) { const s = getSettings(); const path = fm.joinPath(kind === "invoice" ? DIRS.invoices : DIRS.proposals, `${d.id}.html`); const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#eee;color:#111;font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{background:white;max-width:820px;margin:0 auto;min-height:100vh;padding:34px;box-sizing:border-box}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #111;padding-bottom:18px;margin-bottom:24px}.brand h1{margin:0;font-size:29px}.brand p,.doc p{margin:4px 0;color:#444}.doc{text-align:right}.doc h2{margin:0;text-transform:uppercase}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.box{border:1px solid #ddd;border-radius:9px;padding:14px;margin-bottom:18px}.box h3{margin:0 0 8px;text-transform:uppercase;font-size:13px;letter-spacing:.08em}.scope{white-space:pre-wrap}.price{font-size:30px;font-weight:800;text-align:right}.terms{border-top:1px solid #ddd;margin-top:18px;padding-top:12px;font-size:13px}@media(max-width:650px){.top,.grid{display:block}.doc{text-align:left;margin-top:18px}.page{padding:24px}}</style></head><body><main class="page"><section class="top"><div class="brand"><h1>${esc(s.companyName)}</h1><p>${esc(s.tagline)}</p><p>${esc(s.serviceArea)}</p><p>${esc([s.phone,s.email].filter(Boolean).join(" · "))}</p></div><div class="doc"><h2>${esc(kind)}</h2><p><strong>${esc(d.id)}</strong></p><p>${esc(d.created || today())}</p><p>${esc(d.status || "open")}</p></div></section><section class="grid"><div class="box"><h3>Customer</h3><p><strong>${esc(d.customer)}</strong><br>${esc(d.contact)}<br>${esc(d.phone)}<br>${esc(d.email)}</p></div><div class="box"><h3>Project</h3><p><strong>${esc(d.title)}</strong><br>${esc(d.site)}<br>${esc(d.city)}<br>${esc(d.category)}</p></div></section><section class="box"><h3>Scope Summary</h3><p class="scope">${esc(d.summary)}</p></section><section class="box"><h3>Scope Details</h3><p class="scope">${esc(d.details)}</p></section><section class="grid"><div class="box"><h3>Notes / Exclusions</h3><p class="scope">${esc(d.notes)}</p></div><div class="box"><h3>Total</h3><p class="price">${money(d.total)}</p><p>Deposit / Paid: ${money(d.deposit)}</p><p>Balance Due: ${money(d.balance_due)}</p></div></section><section class="terms"><p><strong>Terms:</strong> ${esc(s.defaultTerms)}</p><p><strong>Warranty:</strong> ${esc(s.warrantyNote)}</p></section></main></body></html>`; fm.writeString(path, html); return path; }
function copyDir(src, dst) { if (!fm.fileExists(src)) return; ensure(dst); fm.listContents(src).forEach(n => { const s = fm.joinPath(src, n), d = fm.joinPath(dst, n); if (fm.isDirectory(s)) copyDir(s, d); else { if (fm.fileExists(d)) fm.remove(d); fm.copy(s, d); } }); }
function sortKeys(d) { const date = d.created || today(); d.sort_year = date.slice(0, 4); d.sort_month = date.slice(0, 7); d.sort_week = weekKey(new Date(date)); }
function getSettings() { return Object.assign({}, DEFAULT_SETTINGS, readJson(FILES.settings, {})); }
function log(action, detail) { const list = readJson(FILES.activity, []); list.push({ at: new Date().toISOString(), action, detail }); writeJson(FILES.activity, list.slice(-500)); }
function groupBy(list, getter) { return list.reduce((acc, item) => { const key = getter(item) || "Unsorted"; if (!acc[key]) acc[key] = []; acc[key].push(item); return acc; }, {}); }
function byUpdated(a, b) { return String(b.updated || "").localeCompare(String(a.updated || "")); }
function toIso(v) { const s = String(v || "").trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d = new Date(s); return isNaN(d.getTime()) ? today() : d.toISOString().slice(0, 10); }
function readJson(path, fallback) { try { if (!fm.fileExists(path)) return fallback; return JSON.parse(fm.readString(path)); } catch (e) { return fallback; } }
function writeJson(path, value) { fm.writeString(path, JSON.stringify(value, null, 2)); }
function ensure(path) { if (!fm.fileExists(path)) fm.createDirectory(path, true); }
function today() { return new Date().toISOString().slice(0, 10); }
function weekKey(date) { const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); const week = Math.ceil((((d - start) / 86400000) + 1) / 7); return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`; }
function num(v) { return Number(String(v || "0").replace(/[^0-9.-]/g, "")) || 0; }
function money(v) { return "$" + Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function status(v) { return String(v || "").toLowerCase().trim(); }
function esc(v) { return String(v ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[ch])); }
async function notice(title, message) { const a = new Alert(); a.title = title; a.message = String(message || ""); a.addAction("OK"); await a.presentAlert(); }