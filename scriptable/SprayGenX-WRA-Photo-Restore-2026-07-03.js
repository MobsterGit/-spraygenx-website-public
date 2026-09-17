// Spray GenX WRA Manager — Photo Restore Build
// Version: 2026.07.03-photo-restore
// Purpose: emergency Scriptable proposal/invoice manager with project photo picker, UTF-8 HTML, PDF-friendly fixed width, and bottom-right seal.

const fm = FileManager.iCloud();
const ROOT = fm.joinPath(fm.documentsDirectory(), "SprayGenX");

const DIRS = {
  root: ROOT,
  proposals: fm.joinPath(ROOT, "Proposals"),
  invoices: fm.joinPath(ROOT, "Invoices"),
  data: fm.joinPath(ROOT, "Data"),
  logs: fm.joinPath(ROOT, "Logs"),
  backups: fm.joinPath(ROOT, "Backups"),
  exports: fm.joinPath(ROOT, "Exports"),
  images: fm.joinPath(ROOT, "Images")
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
  phone: "330.620.8199",
  email: "spraygenx@gmail.com",
  address1: "2423 Reimer Rd",
  address2: "Wadsworth, Ohio 44281",
  nextProposalNumber: 27,
  nextInvoiceNumber: 1,
  defaultTerms: "Payment due upon completion unless otherwise noted.",
  warrantyNote: "Warranty applies to listed scope and assumes sound existing substrates unless otherwise noted."
};

setup();
await home();

function setup() {
  Object.values(DIRS).forEach(ensure);
  const settings = Object.assign({}, DEFAULT_SETTINGS, readJson(FILES.settings, {}));
  writeJson(FILES.settings, settings);
  if (!fm.fileExists(FILES.proposals)) writeJson(FILES.proposals, []);
  if (!fm.fileExists(FILES.invoices)) writeJson(FILES.invoices, []);
  if (!fm.fileExists(FILES.activity)) writeJson(FILES.activity, []);
  rebuildIndexes();
}

async function home() {
  let close = false;
  while (!close) {
    const s = stats();
    const a = new Alert();
    a.title = "Spray GenX Manager";
    a.message = `${s.active} active · ${s.proposals} proposals · ${s.invoices} invoices\nBalance due: ${money(s.balance)}\n\nPhoto restore build.`;
    a.addAction("+ New Proposal");
    a.addAction("Current Work");
    a.addAction("Find / Archive");
    a.addAction("Backup");
    a.addAction("Settings");
    a.addAction("Storage Paths");
    a.addCancelAction("Close");
    const c = await a.presentSheet();
    if (c === -1) close = true;
    if (c === 0) await proposalFlow();
    if (c === 1) await currentWork();
    if (c === 2) await archiveMenu();
    if (c === 3) await backupMenu();
    if (c === 4) await settingsMenu();
    if (c === 5) await showPaths();
  }
}

function stats() {
  const props = arr(readJson(FILES.proposals, []));
  const inv = arr(readJson(FILES.invoices, []));
  const activeProps = props.filter(d => !["archived", "declined", "converted_to_invoice"].includes(status(d.status)));
  const activeInv = inv.filter(d => !["paid", "void", "archived"].includes(status(d.status)));
  return { proposals: props.length, invoices: inv.length, active: activeProps.length + activeInv.length, balance: activeInv.reduce((n, d) => n + Number(d.balance_due ?? d.total ?? 0), 0) };
}

async function proposalFlow(seed) {
  const doc = seed || blankDoc("proposal");
  const saved = await docEditor(doc, "proposal");
  if (!saved) return;
  saveDoc(saved, "proposal");
  writeHtml(saved, "proposal");
  bumpNumber(saved.id, "proposal");
  await afterSave(saved, "proposal");
}

async function invoiceFlow(seed) {
  const doc = seed || blankDoc("invoice");
  const saved = await docEditor(doc, "invoice");
  if (!saved) return;
  saveDoc(saved, "invoice");
  writeHtml(saved, "invoice");
  bumpNumber(saved.id, "invoice");
  await afterSave(saved, "invoice");
}

async function docEditor(doc, kind) {
  doc.kind = kind;
  const base = new Alert();
  base.title = doc.path ? `Edit ${cap(kind)}` : `New ${cap(kind)}`;
  base.message = `${doc.id}\nCustomer and job`;
  ["Customer", "Contact / GC", "Phone", "Email", "Job title", "Site / address", "City", "Category"].forEach((label, i) => {
    base.addTextField(label, [doc.customer, doc.contact, doc.phone, doc.email, doc.title, doc.site, doc.city, doc.category][i] || "");
  });
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
  price.addTextField(kind === "invoice" ? "Paid" : "Deposit", String(doc.deposit || ""));
  price.addTextField("Status", doc.status || (kind === "invoice" ? "unpaid" : "open"));
  price.addAction("Next");
  price.addCancelAction("Cancel");
  if (await price.presentAlert() === -1) return null;
  doc.total = num(price.textFieldValue(0));
  doc.deposit = num(price.textFieldValue(1));
  doc.status = price.textFieldValue(2).trim() || (kind === "invoice" ? "unpaid" : "open");
  doc.balance_due = Math.max(0, doc.total - doc.deposit);

  if (kind === "proposal") doc.photoPath = await photoStep(doc);
  doc.summary = await textStep("Scope Summary", "Short scope summary", doc.summary);
  doc.details = await textStep("Scope Details", "Paste detailed scope here", doc.details);
  doc.notes = await textStep("Notes / Exclusions", "Anything excluded or special", doc.notes);
  doc.updated = today();
  sortKeys(doc);
  return doc;
}

async function photoStep(doc) {
  const a = new Alert();
  a.title = "Project Photo";
  a.message = doc.photoPath ? "A project photo is attached." : "No project photo attached.";
  a.addAction(doc.photoPath ? "Replace Photo" : "Add Photo");
  if (doc.photoPath) a.addDestructiveAction("Remove Photo");
  a.addAction("Skip");
  const c = await a.presentSheet();
  if (c === 0) {
    try {
      const img = await Photos.fromLibrary();
      const safeId = String(doc.id || "proposal").replace(/[^A-Z0-9-]/gi, "_");
      const path = fm.joinPath(DIRS.images, `${safeId}_project.jpg`);
      fm.writeImage(path, img);
      return path;
    } catch (e) {
      await notice("Photo Error", String(e));
      return doc.photoPath || "";
    }
  }
  if (doc.photoPath && c === 1) return "";
  return doc.photoPath || "";
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

async function afterSave(doc, kind) {
  let done = false;
  while (!done) {
    const a = new Alert();
    a.title = "Saved";
    a.message = `${doc.id}\n${doc.customer || "No customer"}\n${doc.title || "No title"}\n${money(doc.total)}`;
    a.addAction("Preview");
    a.addAction("Edit Again");
    if (kind === "proposal") a.addAction("Convert to Invoice");
    a.addAction("Copy HTML Path");
    a.addAction("Done");
    const c = await a.presentSheet();
    if (c === 0) await QuickLook.present(writeHtml(doc, kind));
    if (c === 1) { kind === "invoice" ? await invoiceFlow(doc) : await proposalFlow(doc); done = true; }
    if (kind === "proposal" && c === 2) { await convertToInvoice(doc); done = true; }
    const copyIndex = kind === "proposal" ? 3 : 2;
    const doneIndex = kind === "proposal" ? 4 : 3;
    if (c === copyIndex) { Pasteboard.copy(htmlPathFor(doc, kind)); await notice("Copied", "HTML file path copied."); }
    if (c === doneIndex || c === -1) done = true;
  }
}

async function currentWork() { await documentTable("Current Work", activeDocs(), "No active work found."); }
function activeDocs() {
  const props = arr(readJson(FILES.proposals, [])).filter(d => !["archived", "declined", "converted_to_invoice"].includes(status(d.status)));
  const inv = arr(readJson(FILES.invoices, [])).filter(d => !["paid", "void", "archived"].includes(status(d.status)));
  return props.concat(inv).sort(byUpdated);
}

async function documentTable(title, docs, emptyMsg) {
  docs = arr(docs);
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
  const kind = doc.kind === "invoice" ? "invoice" : "proposal";
  const path = filePathFor(doc, kind);
  return fm.fileExists(path) ? normalizeRecord(readJson(path, doc), path.split("/").pop(), path) || doc : doc;
}

async function openDoc(doc) {
  const kind = doc.kind === "invoice" ? "invoice" : "proposal";
  const a = new Alert();
  a.title = doc.id;
  a.message = `${doc.customer || "No customer"}\n${doc.title || "No title"}\n${money(doc.total)}`;
  a.addAction("Preview");
  a.addAction("Edit");
  a.addAction("Duplicate");
  if (kind === "proposal") a.addAction("Convert to Invoice");
  a.addAction("Archive");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === 0) await QuickLook.present(writeHtml(doc, kind));
  if (c === 1) kind === "invoice" ? await invoiceFlow(doc) : await proposalFlow(doc);
  if (c === 2) await duplicateDoc(doc, kind);
  if (kind === "proposal" && c === 3) await convertToInvoice(doc);
  const archiveIndex = kind === "proposal" ? 4 : 3;
  if (c === archiveIndex) await archiveDoc(doc, kind);
}

async function duplicateDoc(doc, kind) {
  const copy = Object.assign({}, doc);
  delete copy.path;
  copy.id = kind === "invoice" ? nextInvoiceId() : nextProposalId();
  copy.kind = kind;
  copy.status = "draft";
  copy.created = today();
  copy.updated = today();
  if (copy.photoPath && fm.fileExists(copy.photoPath)) {
    const newPhoto = fm.joinPath(DIRS.images, `${copy.id}_project.jpg`);
    if (fm.fileExists(newPhoto)) fm.remove(newPhoto);
    fm.copy(copy.photoPath, newPhoto);
    copy.photoPath = newPhoto;
  }
  saveDoc(copy, kind);
  writeHtml(copy, kind);
  await notice("Duplicated", `${copy.id} created.`);
}

async function convertToInvoice(proposal) {
  const invoice = Object.assign({}, proposal, { id: nextInvoiceId(), kind: "invoice", status: "unpaid", source_proposal: proposal.id, created: today(), updated: today() });
  proposal.status = "converted_to_invoice";
  proposal.updated = today();
  saveDoc(proposal, "proposal");
  saveDoc(invoice, "invoice");
  writeHtml(proposal, "proposal");
  writeHtml(invoice, "invoice");
  bumpNumber(invoice.id, "invoice");
  await notice("Invoice Created", `${invoice.id} from ${proposal.id}`);
}

async function archiveDoc(doc, kind) {
  doc.status = "archived";
  doc.updated = today();
  saveDoc(doc, kind);
  await notice("Archived", doc.id);
}

async function archiveMenu() {
  const docs = arr(readJson(FILES.proposals, [])).concat(arr(readJson(FILES.invoices, [])));
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
  copyDir(DIRS.images, fm.joinPath(dir, "Images"));
  await notice("Backup Created", dir);
}

async function settingsMenu() {
  const s = getSettings();
  const a = new Alert();
  a.title = "Settings";
  a.addTextField("Company", s.companyName || "");
  a.addTextField("Address 1", s.address1 || "");
  a.addTextField("Address 2", s.address2 || "");
  a.addTextField("Phone", s.phone || "");
  a.addTextField("Email", s.email || "");
  a.addTextField("Service area", s.serviceArea || "");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  s.companyName = a.textFieldValue(0).trim();
  s.address1 = a.textFieldValue(1).trim();
  s.address2 = a.textFieldValue(2).trim();
  s.phone = a.textFieldValue(3).trim();
  s.email = a.textFieldValue(4).trim();
  s.serviceArea = a.textFieldValue(5).trim();
  writeJson(FILES.settings, s);
}

async function showPaths() { await notice("Spray GenX Paths", `Root:\n${ROOT}\n\nData:\n${DIRS.data}\n\nProposals:\n${DIRS.proposals}\n\nInvoices:\n${DIRS.invoices}\n\nImages:\n${DIRS.images}\n\nLogs:\n${DIRS.logs}`); }

function blankDoc(kind) {
  const d = { id: kind === "invoice" ? nextInvoiceId() : nextProposalId(), kind, customer: "", contact: "", phone: "", email: "", title: "", site: "", city: "", category: "", summary: "", details: "", notes: "", photoPath: "", total: 0, deposit: 0, balance_due: 0, status: kind === "invoice" ? "unpaid" : "open", created: today(), updated: today() };
  sortKeys(d);
  return d;
}

function saveDoc(d, kind) { d.kind = kind; d.balance_due = Math.max(0, Number(d.total || 0) - Number(d.deposit || 0)); sortKeys(d); writeJson(filePathFor(d, kind), d); rebuildIndexes(); log(`${kind}_saved`, d.id); }
function filePathFor(d, kind) { return fm.joinPath(kind === "invoice" ? DIRS.invoices : DIRS.proposals, `${d.id}.json`); }
function htmlPathFor(d, kind) { return fm.joinPath(kind === "invoice" ? DIRS.invoices : DIRS.proposals, `${d.id}.html`); }
function slim(d) { return { id: d.id, kind: d.kind, path: filePathFor(d, d.kind || "proposal"), customer: d.customer || "", title: d.title || "", site: d.site || "", city: d.city || "", status: d.status || "open", total: Number(d.total || 0), deposit: Number(d.deposit || 0), balance_due: Number(d.balance_due || 0), created: d.created || today(), updated: d.updated || d.created || today(), sort_year: d.sort_year, sort_month: d.sort_month, sort_week: d.sort_week } }
function rebuildIndexes() {
  const p = scan(DIRS.proposals, "proposal");
  const i = scan(DIRS.invoices, "invoice");
  writeJson(FILES.proposals, p);
  writeJson(FILES.invoices, i);
}
function scan(dir, kind) { if (!fm.fileExists(dir)) return []; return fm.listContents(dir).filter(n => n.toLowerCase().endsWith(".json")).map(n => normalizeRecord(readJson(fm.joinPath(dir, n), null), n, fm.joinPath(dir, n))).filter(Boolean).map(d => { d.kind = kind; sortKeys(d); return slim(d); }).sort(byUpdated); }
function normalizeRecord(raw, filename, path) {
  if (!raw || typeof raw !== "object") return null;
  const customerObj = typeof raw.customer === "object" ? raw.customer : {};
  const job = raw.job || {};
  const scope = raw.scope || {};
  const pricing = raw.pricing || {};
  const kind = /invoice|\binv-/i.test([filename, raw.kind, raw.docType, raw.DocType, raw.id].join(" ")) ? "invoice" : "proposal";
  const d = {
    id: first(raw.id, raw.docNo, raw.DocNo, raw.number, idFromFilename(filename)), kind, path,
    customer: first(customerObj.name, customerObj.client, raw.client, raw.Client, raw.customerName, typeof raw.customer === "string" ? raw.customer : "", raw.name),
    contact: first(customerObj.contact, raw.contact, raw.gc, raw.GC), phone: first(customerObj.phone, raw.phone), email: first(customerObj.email, raw.email),
    title: first(job.title, raw.project, raw.Project, raw.title, raw.jobName, raw.job_title), site: first(job.site, job.address, customerObj.address, raw.site, raw.address, raw.location), city: first(job.city, customerObj.city, raw.city), category: first(job.category, raw.category),
    summary: first(scope.summary, raw.summary), details: first(scope.details, scope.description, raw.details, typeof raw.scope === "string" ? raw.scope : "", raw.description), notes: [scope.exclusions, scope.notes, raw.exclusions, raw.notes].filter(Boolean).join("\n\n"), photoPath: first(raw.photoPath, raw.imagePath, raw.jobPhoto, raw.coverImage),
    total: num(first(pricing.total, pricing.price, pricing.amount, raw.total, raw.price, raw.Price, raw.amount, raw.Amount, raw.contract_total, raw.grandTotal, raw.totalDue)), deposit: num(first(pricing.amount_paid, pricing.paid, pricing.deposit, raw.amount_paid, raw.paid, raw.deposit)),
    status: first(raw.status, kind === "invoice" ? "unpaid" : "open"), created: toIso(first(raw.date, raw.Date, raw.created, raw.createdDate, raw.created_at, today())), updated: toIso(first(raw.updated, raw.updatedDate, raw.updated_at, raw.created, today()))
  };
  d.balance_due = Math.max(0, Number(d.total || 0) - Number(d.deposit || 0));
  sortKeys(d);
  return d;
}

function writeHtml(d, kind) {
  const s = getSettings();
  const path = htmlPathFor(d, kind);
  const photo = d.photoPath && fm.fileExists(d.photoPath) ? `<section class="photo-wrap"><img class="job-photo" src="file://${escAttr(d.photoPath)}"></section>` : "";
  const html = `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=820,initial-scale=1"><style>
body{margin:0;background:#eee;color:#111;font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{background:white;width:820px;margin:0 auto;min-height:1060px;padding:34px 34px 104px;box-sizing:border-box;position:relative}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #111;padding-bottom:18px;margin-bottom:24px}.logo-text{font-weight:900;font-size:34px;line-height:.9;letter-spacing:-.04em}.logo-text .x{color:#1e9be0}.brand h1{margin:18px 0 6px;font-size:20px}.brand p,.doc p{margin:4px 0;color:#444}.doc{text-align:right}.doc h2{margin:0;text-transform:uppercase;font-size:10px;letter-spacing:.18em}.doc strong{font-size:16px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.box{border:1px solid #ddd;border-radius:9px;padding:14px;margin-bottom:18px}.box h3{margin:0 0 8px;text-transform:uppercase;font-size:12px;letter-spacing:.08em;color:#333}.scope{white-space:pre-wrap}.photo-wrap{margin:0 0 18px;border-radius:9px;overflow:hidden;border:1px solid #ddd}.job-photo{display:block;width:100%;height:280px;object-fit:cover}.price{font-size:30px;font-weight:800;text-align:right}.terms{border-top:1px solid #ddd;margin-top:18px;padding-top:12px;font-size:13px;padding-right:190px}.seal{position:absolute;right:34px;bottom:26px;width:150px;min-height:44px;border:1.5px solid #111;border-radius:50%;padding:10px 12px;text-align:center;box-sizing:border-box;opacity:.78;transform:rotate(-3deg);font-family:Georgia,"Times New Roman",serif;line-height:1.05;background:rgba(255,255,255,.92)}.seal-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.seal-rule{border-top:1px solid #111;margin:5px 8px}.seal-sub{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#333}</style></head><body><main class="page"><section class="top"><div class="brand"><div class="logo-text">SPRAY<br>GEN<span class="x">X</span></div><h1>${esc(s.companyName)}</h1><p>${esc(s.address1 || "")}</p><p>${esc(s.address2 || s.serviceArea || "")}</p><p>${esc(s.phone || "")}</p><p>${esc(s.email || "")}</p></div><div class="doc"><h2>${esc(kind)}</h2><p><strong>${esc(d.id)}</strong></p><p>${esc(formatDate(d.created || today()))}</p><p>${esc(d.status || "open")}</p></div></section><section class="grid"><div class="box"><h3>Client</h3><p><strong>${esc(d.customer)}</strong><br>${esc(d.contact)}<br>${esc(d.phone)}<br>${esc(d.email)}</p></div><div class="box"><h3>Project</h3><p><strong>${esc(d.title)}</strong><br>${esc(d.site)}<br>${esc(d.city)}<br>${esc(d.category)}</p></div></section>${photo}<section class="box"><h3>Scope / Description</h3><p class="scope">${esc(d.details || d.summary)}</p></section><section class="grid"><div class="box"><h3>Notes / Exclusions</h3><p class="scope">${esc(d.notes)}</p></div><div class="box"><h3>Total</h3><p class="price">${money(d.total)}</p><p>Deposit: ${money(d.deposit)}</p><p>Balance Due: ${money(d.balance_due)}</p></div></section><section class="terms"><p><strong>Terms:</strong> ${esc(s.defaultTerms)}</p><p><strong>Warranty:</strong> ${esc(s.warrantyNote)}</p></section><div class="seal"><div class="seal-title">Spray GenX LLC</div><div class="seal-rule"></div><div class="seal-sub">LLC / Business ID</div></div></main></body></html>`;
  fm.writeString(path, html);
  return path;
}

function copyDir(src, dst) { if (!fm.fileExists(src)) return; ensure(dst); fm.listContents(src).forEach(n => { const s = fm.joinPath(src, n), d = fm.joinPath(dst, n); if (fm.isDirectory(s)) copyDir(s, d); else { if (fm.fileExists(d)) fm.remove(d); fm.copy(s, d); } }); }
function sortKeys(d) { const date = d.created || today(); d.sort_year = String(date).slice(0, 4); d.sort_month = String(date).slice(0, 7); d.sort_week = weekKey(new Date(date)); }
function getSettings() { return Object.assign({}, DEFAULT_SETTINGS, readJson(FILES.settings, {})); }
function nextProposalId() { const s = getSettings(); return `SGX-${new Date().getFullYear()}-${String(s.nextProposalNumber || 1).padStart(3, "0")}`; }
function nextInvoiceId() { const s = getSettings(); return `INV-${new Date().getFullYear()}-${String(s.nextInvoiceNumber || 1).padStart(3, "0")}`; }
function bumpNumber(id, kind) { const s = getSettings(); const n = lastNumber(id) + 1; if (kind === "invoice" && n > Number(s.nextInvoiceNumber || 1)) s.nextInvoiceNumber = n; if (kind === "proposal" && n > Number(s.nextProposalNumber || 1)) s.nextProposalNumber = n; writeJson(FILES.settings, s); }
function lastNumber(id) { return Number(String(id).match(/(\d+)$/)?.[1] || 0); }
function idFromFilename(name) { const m = String(name).match(/(SGX|PROP|INV)-\d{4}-\d+/i); return m ? m[0].toUpperCase() : String(name).replace(/\.json$/i, ""); }
function log(action, detail) { const list = arr(readJson(FILES.activity, [])); list.push({ at: new Date().toISOString(), action, detail }); writeJson(FILES.activity, list.slice(-500)); }
function groupBy(list, getter) { return arr(list).reduce((acc, item) => { const key = getter(item) || "Unsorted"; if (!acc[key]) acc[key] = []; acc[key].push(item); return acc; }, {}); }
function byUpdated(a, b) { return String(b.updated || "").localeCompare(String(a.updated || "")); }
function toIso(v) { const s = String(v || "").trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d = new Date(s); return isNaN(d.getTime()) ? today() : d.toISOString().slice(0, 10); }
function formatDate(v) { const d = new Date(v); return isNaN(d.getTime()) ? String(v || "") : d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }); }
function readJson(path, fallback) { try { if (!fm.fileExists(path)) return fallback; return JSON.parse(fm.readString(path)); } catch (e) { return fallback; } }
function writeJson(path, value) { fm.writeString(path, JSON.stringify(value, null, 2)); }
function ensure(path) { if (!fm.fileExists(path)) fm.createDirectory(path, true); }
function today() { return new Date().toISOString().slice(0, 10); }
function weekKey(date) { const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); const week = Math.ceil((((d - start) / 86400000) + 1) / 7); return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`; }
function num(v) { return Number(String(v ?? "0").replace(/[^0-9.-]/g, "")) || 0; }
function money(v) { return "$" + Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function status(v) { return String(v || "").toLowerCase().trim(); }
function esc(v) { return String(v ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[ch])); }
function escAttr(v) { return esc(String(v || "").replace(/#/g, "%23")); }
function arr(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }
function cap(v) { return String(v).charAt(0).toUpperCase() + String(v).slice(1); }
function first(...vals) { for (const v of vals) { if (v !== undefined && v !== null && String(v).trim() !== "") return v; } return ""; }
async function notice(title, message) { const a = new Alert(); a.title = title; a.message = String(message || ""); a.addAction("OK"); await a.presentAlert(); }
