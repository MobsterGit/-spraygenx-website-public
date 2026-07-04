// Spray GenX WRA Manager - UX Integrated 4
// Version: 2026.07.04 Integrated-4
// Purpose: Scriptable proposal/invoice manager with two-column UX, legacy import repair, backups, archive browsing, UTF-8-safe HTML, small document seal, and image-block-ready records.

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
  images: fm.joinPath(ROOT, "Images"),
  imageBlocks: fm.joinPath(ROOT, "ImageBlocks")
};

const FILES = {
  settings: fm.joinPath(DIRS.data, "settings.json"),
  proposals: fm.joinPath(DIRS.logs, "proposal_index.json"),
  invoices: fm.joinPath(DIRS.logs, "invoice_index.json"),
  imageBlocks: fm.joinPath(DIRS.logs, "image_block_index.json"),
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
  warrantyNote: "Warranty applies to listed scope and assumes sound existing substrates unless otherwise noted.",
  sealEnabled: true,
  sealText: "Spray GenX LLC",
  sealSubtext: "Painting & Refinishing"
};

setup();
await home();

function setup() {
  Object.values(DIRS).forEach(ensure);
  const settings = Object.assign({}, DEFAULT_SETTINGS, readJson(FILES.settings, {}));
  writeJson(FILES.settings, settings);
  if (!fm.fileExists(FILES.activity)) writeJson(FILES.activity, []);
  if (!fm.fileExists(FILES.imageBlocks)) writeJson(FILES.imageBlocks, []);
  rebuildIndexes();
  syncNextNumbers();
}

async function home() {
  const s = stats();
  const table = new UITable();
  table.showSeparators = true;

  const head = new UITableRow();
  head.isHeader = true;
  head.height = 78;
  head.addText("Spray GenX Manager", `${s.active} active - ${s.proposals} proposals - ${s.invoices} invoices - ${money(s.balance)} due`);
  table.addRow(head);

  addButtonRow(table, "+ Proposal", proposalFlow, "+ Invoice", invoiceFlow);
  addButtonRow(table, "Current Work", currentWork, "Find / Archive", archiveMenu);
  addButtonRow(table, "Rebuild Data", rebuildAction, "Backup", backupMenu);
  addButtonRow(table, "Settings", settingsMenu, "Storage Paths", showPaths);

  const foot = new UITableRow();
  foot.height = 54;
  foot.addText("Close", "Tap here when finished");
  table.addRow(foot);
  await table.present();
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

async function rebuildAction() {
  const r = rebuildIndexes();
  syncNextNumbers();
  await notice("Data Rebuilt", `${r.proposals} proposals\n${r.invoices} invoices\n${r.skipped} skipped`);
}

function stats() {
  const props = arr(readJson(FILES.proposals, []));
  const inv = arr(readJson(FILES.invoices, []));
  const activeProps = props.filter(d => !["archived", "declined", "converted_to_invoice"].includes(status(d.status)));
  const activeInv = inv.filter(d => !["paid", "void", "archived"].includes(status(d.status)));
  return {
    proposals: props.length,
    invoices: inv.length,
    active: activeProps.length + activeInv.length,
    balance: activeInv.reduce((n, d) => n + Number(d.balance_due ?? d.total ?? 0), 0)
  };
}

async function proposalFlow(seed) { await docFlow(seed || blankDoc("proposal"), "proposal"); }
async function invoiceFlow(seed) { await docFlow(seed || blankDoc("invoice"), "invoice"); }

async function docFlow(doc, kind) {
  doc.kind = kind;
  const saved = await docEditor(doc, doc.path ? `Edit ${cap(kind)}` : `New ${cap(kind)}`);
  if (!saved) return;
  saveDoc(saved, kind);
  writeHtml(saved, kind);
  bumpNumber(saved.id, kind);
  await afterSave(saved, kind);
}

async function docEditor(doc, title) {
  const base = new Alert();
  base.title = title;
  base.message = `${doc.id}\nCustomer and job`;
  ["Customer", "Contact / GC", "Phone", "Email", "Job title", "Site / address", "City", "Category"].forEach((label, i) => {
    base.addTextField(label, [doc.customer, doc.contact, doc.phone, doc.email, doc.title, doc.site, doc.city, doc.category][i] || "");
  });
  base.addAction("Next");
  base.addCancelAction("Cancel");
  if (await base.presentAlert() === -1) return null;

  doc.customer = cleanText(base.textFieldValue(0).trim());
  doc.contact = cleanText(base.textFieldValue(1).trim());
  doc.phone = cleanText(base.textFieldValue(2).trim());
  doc.email = cleanText(base.textFieldValue(3).trim());
  doc.title = cleanText(base.textFieldValue(4).trim());
  doc.site = cleanText(base.textFieldValue(5).trim());
  doc.city = cleanText(base.textFieldValue(6).trim());
  doc.category = cleanText(base.textFieldValue(7).trim());

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
  doc.status = cleanText(price.textFieldValue(2).trim()) || (doc.kind === "invoice" ? "unpaid" : "open");
  doc.balance_due = Math.max(0, doc.total - doc.deposit);

  doc.summary = await textStep("Scope Summary", "Short scope summary", doc.summary);
  doc.details = await textStep("Scope Details", "Paste detailed scope here", doc.details);
  doc.notes = await textStep("Notes / Exclusions", "Anything excluded or special", doc.notes);

  // Reserved for the shared image asset system. These fields can be populated by the future photo/portfolio manager.
  doc.featuredImageId = doc.featuredImageId || "";
  doc.imageBlockIds = arr(doc.imageBlockIds);
  doc.imageBlocks = arr(doc.imageBlocks);

  doc.updated = today();
  sortKeys(doc);
  return doc;
}

async function textStep(title, placeholder, current) {
  const a = new Alert();
  a.title = title;
  a.addTextField(placeholder, cleanText(current || ""));
  a.addAction("Save");
  a.addAction("Blank");
  a.addCancelAction("Keep Existing");
  const c = await a.presentAlert();
  if (c === -1) return cleanText(current || "");
  if (c === 1) return "";
  return cleanText(a.textFieldValue(0));
}

async function afterSave(doc, kind) {
  const a = new Alert();
  a.title = "Saved";
  a.message = `${doc.id}\n${doc.customer || "No customer"}\n${doc.title || "No title"}\n${money(doc.total)}`;
  a.addAction("Preview");
  a.addAction("Edit Again");
  if (kind === "proposal") a.addAction("Convert to Invoice");
  a.addAction("Done");
  const c = await a.presentSheet();
  if (c === 0) await QuickLook.present(writeHtml(doc, kind));
  if (c === 1) kind === "invoice" ? await invoiceFlow(doc) : await proposalFlow(doc);
  if (kind === "proposal" && c === 2) await convertToInvoice(doc);
}

async function currentWork() {
  await documentTable("Current Work", activeDocs(), "No active work found.");
}

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
    const marker = doc.featuredImageId ? " - featured image" : "";
    const left = row.addText(doc.customer || doc.title || doc.id, `${doc.kind || "proposal"} - ${doc.status || "open"} - ${money(doc.total)}${marker}`);
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
  const kind = doc.kind === "invoice" ? "invoice" : "proposal";
  const a = new Alert();
  a.title = doc.id;
  a.message = `${doc.customer || "No customer"}\n${doc.title || "No title"}\n${money(doc.total)}`;
  a.addAction("Preview");
  a.addAction("Edit / Upgrade");
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
  saveDoc(copy, kind);
  writeHtml(copy, kind);
  await notice("Duplicated", `${copy.id} created.`);
}

async function convertToInvoice(proposal) {
  const invoice = Object.assign({}, proposal, {
    id: nextInvoiceId(),
    kind: "invoice",
    status: "unpaid",
    source_proposal: proposal.id,
    created: today(),
    updated: today()
  });
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
  copyDir(DIRS.imageBlocks, fm.joinPath(dir, "ImageBlocks"));
  await notice("Backup Created", dir);
}

async function settingsMenu() {
  const s = getSettings();
  const a = new Alert();
  a.title = "Settings";
  a.message = "Branding and document seal";
  a.addTextField("Company", s.companyName || "");
  a.addTextField("Phone", s.phone || "");
  a.addTextField("Email", s.email || "");
  a.addTextField("Service area", s.serviceArea || "");
  a.addTextField("Seal text", s.sealText || s.companyName || "");
  a.addTextField("Seal small text", s.sealSubtext || "");
  a.addTextField("Seal on? yes/no", s.sealEnabled === false ? "no" : "yes");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  s.companyName = cleanText(a.textFieldValue(0).trim());
  s.phone = cleanText(a.textFieldValue(1).trim());
  s.email = cleanText(a.textFieldValue(2).trim());
  s.serviceArea = cleanText(a.textFieldValue(3).trim());
  s.sealText = cleanText(a.textFieldValue(4).trim()) || s.companyName;
  s.sealSubtext = cleanText(a.textFieldValue(5).trim());
  s.sealEnabled = !/^n(o)?|false|off|0$/i.test(a.textFieldValue(6).trim());
  writeJson(FILES.settings, s);
}

async function showPaths() {
  await notice("Spray GenX Paths", `Root:\n${ROOT}\n\nData:\n${DIRS.data}\n\nProposals:\n${DIRS.proposals}\n\nInvoices:\n${DIRS.invoices}\n\nImages:\n${DIRS.images}\n\nImage Blocks:\n${DIRS.imageBlocks}\n\nLogs:\n${DIRS.logs}`);
}

function rebuildIndexes() {
  const p = [], i = [];
  let skipped = 0;

  [DIRS.data, DIRS.proposals, DIRS.invoices].forEach(dir => {
    if (!fm.fileExists(dir)) return;
    for (const name of fm.listContents(dir)) {
      if (!name.toLowerCase().endsWith(".json") || name === "settings.json") continue;
      const path = fm.joinPath(dir, name);
      const d = normalizeRecord(readJson(path, null), name, path);
      if (!d) { skipped++; continue; }
      if (dir === DIRS.proposals) d.kind = "proposal";
      if (dir === DIRS.invoices) d.kind = "invoice";
      (d.kind === "invoice" ? i : p).push(slim(d));
    }
  });

  writeJson(FILES.proposals, dedupe(p).sort(byUpdated));
  writeJson(FILES.invoices, dedupe(i).sort(byUpdated));
  return { proposals: p.length, invoices: i.length, skipped };
}

function normalizeRecord(raw, filename, path) {
  if (!raw || typeof raw !== "object") return null;
  const file = String(filename || "");
  const text = JSON.stringify(raw).toLowerCase();
  const manager = raw.manager || {};
  const customerObj = typeof raw.customer === "object" ? raw.customer : {};
  const job = raw.job || {};
  const scope = raw.scope || {};
  const pricing = raw.pricing || {};
  const kindText = [file, raw.kind, raw.docType, raw.DocType, manager.invoice_id, manager.proposal_id, text].join(" ").toLowerCase();
  const kind = /invoice|\binv-/.test(kindText) ? "invoice" : "proposal";
  const id = first(raw.id, raw.docNo, raw.DocNo, raw.number, manager.invoice_id, manager.proposal_id, idFromFilename(file));
  const total = num(first(pricing.total, pricing.price, pricing.amount, raw.total, raw.price, raw.Price, raw.amount, raw.Amount, raw.contract_total, raw.grandTotal, raw.totalDue));
  const paid = num(first(pricing.amount_paid, pricing.paid, pricing.deposit, raw.amount_paid, raw.paid, raw.deposit, manager.amount_paid));
  const balanceRaw = first(pricing.balance_due, raw.balance_due, raw.balanceDue, manager.balance_due);
  const balance = balanceRaw !== "" ? num(balanceRaw) : Math.max(0, total - paid);
  const created = toIso(first(manager.created_date, raw.date, raw.Date, raw.created, raw.createdDate, raw.created_at, today()));
  const updated = toIso(first(manager.updated_date, raw.updated, raw.updatedDate, raw.updated_at, created));

  const d = {
    id,
    kind,
    path,
    customer: cleanText(first(customerObj.name, customerObj.client, raw.client, raw.Client, raw.customerName, typeof raw.customer === "string" ? raw.customer : "", raw.name)),
    contact: cleanText(first(customerObj.contact, raw.contact, raw.gc, raw.GC)),
    phone: cleanText(first(customerObj.phone, raw.phone)),
    email: cleanText(first(customerObj.email, raw.email)),
    title: cleanText(first(job.title, raw.project, raw.Project, raw.title, raw.jobName, raw.job_title)),
    site: cleanText(first(job.site, job.address, customerObj.address, raw.site, raw.address, raw.location)),
    city: cleanText(first(job.city, customerObj.city, raw.city)),
    category: cleanText(first(job.category, raw.category)),
    summary: cleanText(first(scope.summary, raw.summary)),
    details: cleanText(first(scope.details, scope.description, raw.details, typeof raw.scope === "string" ? raw.scope : "", raw.description)),
    notes: cleanText([scope.exclusions, scope.notes, raw.exclusions, raw.notes].filter(Boolean).join("\n\n")),
    total,
    deposit: paid,
    balance_due: balance,
    status: cleanText(first(manager.status, manager.payment_status, raw.status, kind === "invoice" ? "unpaid" : "open")),
    featuredImageId: cleanText(first(raw.featuredImageId, raw.featured_image_id, job.featuredImageId, job.featured_image_id)),
    imageBlockIds: arr(raw.imageBlockIds).concat(arr(raw.image_block_ids)),
    imageBlocks: arr(raw.imageBlocks).concat(arr(raw.image_blocks)),
    created,
    updated
  };

  sortKeys(d);
  return d;
}

function blankDoc(kind) {
  const d = {
    id: kind === "invoice" ? nextInvoiceId() : nextProposalId(),
    kind,
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
    balance_due: 0,
    status: kind === "invoice" ? "unpaid" : "open",
    featuredImageId: "",
    imageBlockIds: [],
    imageBlocks: [],
    created: today(),
    updated: today()
  };
  sortKeys(d);
  return d;
}

function saveDoc(d, kind) {
  d.kind = kind;
  d.balance_due = Math.max(0, Number(d.total || 0) - Number(d.deposit || 0));
  d.customer = cleanText(d.customer);
  d.title = cleanText(d.title);
  d.summary = cleanText(d.summary);
  d.details = cleanText(d.details);
  d.notes = cleanText(d.notes);
  sortKeys(d);
  writeJson(filePathFor(d, kind), d);
  rebuildIndexes();
  log(`${kind}_saved`, d.id);
}

function filePathFor(d, kind) {
  return fm.joinPath(kind === "invoice" ? DIRS.invoices : DIRS.proposals, `${d.id}.json`);
}

function slim(d) {
  return {
    id: d.id,
    kind: d.kind,
    path: d.path || "",
    customer: d.customer || "",
    title: d.title || "",
    site: d.site || "",
    city: d.city || "",
    status: d.status || "open",
    total: Number(d.total || 0),
    deposit: Number(d.deposit || 0),
    balance_due: Number(d.balance_due || 0),
    featuredImageId: d.featuredImageId || "",
    imageBlockIds: arr(d.imageBlockIds),
    imageBlocks: arr(d.imageBlocks),
    created: d.created || today(),
    updated: d.updated || d.created || today(),
    sort_year: d.sort_year,
    sort_month: d.sort_month,
    sort_week: d.sort_week
  };
}

function dedupe(list) {
  const m = {};
  list.forEach(d => { m[d.id] = d; });
  return Object.values(m);
}

function nextProposalId() {
  const s = getSettings();
  return `SGX-${new Date().getFullYear()}-${String(s.nextProposalNumber || 1).padStart(3, "0")}`;
}

function nextInvoiceId() {
  const s = getSettings();
  return `INV-${new Date().getFullYear()}-${String(s.nextInvoiceNumber || 1).padStart(3, "0")}`;
}

function bumpNumber(id, kind) {
  const s = getSettings();
  const n = lastNumber(id) + 1;
  if (kind === "invoice" && n > Number(s.nextInvoiceNumber || 1)) s.nextInvoiceNumber = n;
  if (kind === "proposal" && n > Number(s.nextProposalNumber || 1)) s.nextProposalNumber = n;
  writeJson(FILES.settings, s);
}

function syncNextNumbers() {
  const s = getSettings();
  const ids = arr(readJson(FILES.proposals, [])).concat(arr(readJson(FILES.invoices, []))).map(d => d.id || "");
  s.nextProposalNumber = Math.max(Number(s.nextProposalNumber || 1), 1 + Math.max(0, ...ids.filter(id => id.startsWith("SGX-") || id.startsWith("PROP-")).map(lastNumber)));
  s.nextInvoiceNumber = Math.max(Number(s.nextInvoiceNumber || 1), 1 + Math.max(0, ...ids.filter(id => id.startsWith("INV-")).map(lastNumber)));
  writeJson(FILES.settings, s);
}

function lastNumber(id) {
  return Number(String(id).match(/(\d+)$/)?.[1] || 0);
}

function idFromFilename(name) {
  const m = String(name).match(/(SGX|PROP|INV)-\d{4}-\d+/i);
  return m ? m[0].toUpperCase() : String(name).replace(/\.json$/i, "");
}

function writeHtml(d, kind) {
  const s = getSettings();
  const path = fm.joinPath(kind === "invoice" ? DIRS.invoices : DIRS.proposals, `${d.id}.html`);
  const contactLine = [s.phone, s.email].filter(Boolean).join(" - ");
  const imageMeta = buildImageMeta(d);
  const seal = s.sealEnabled === false ? "" : `<div class="seal"><div class="seal-title">${esc(s.sealText || s.companyName || "Spray GenX LLC")}</div><div class="seal-rule"></div><div class="seal-sub">${esc(s.sealSubtext || s.tagline || "Painting & Refinishing")}</div></div>`;

  const html = `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.id)} - ${esc(kind)}</title>
<style>
body{margin:0;background:#eee;color:#111;font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.page{background:white;max-width:820px;margin:0 auto;min-height:100vh;padding:34px 34px 104px;box-sizing:border-box;position:relative}
.top{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #111;padding-bottom:18px;margin-bottom:24px}
.brand h1{margin:0;font-size:29px}.brand p,.doc p{margin:4px 0;color:#444}.doc{text-align:right}.doc h2{margin:0;text-transform:uppercase}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.box{border:1px solid #ddd;border-radius:9px;padding:14px;margin-bottom:18px}
.box h3{margin:0 0 8px;text-transform:uppercase;font-size:13px;letter-spacing:.08em}.scope{white-space:pre-wrap}
.price{font-size:30px;font-weight:800;text-align:right}.terms{border-top:1px solid #ddd;margin-top:18px;padding-top:12px;font-size:13px;padding-right:190px}
.asset-meta{font-size:11px;color:#777;border-top:1px dashed #ddd;margin-top:12px;padding-top:8px}
.seal{position:absolute;right:34px;bottom:26px;width:150px;min-height:44px;border:1.5px solid #111;border-radius:50%;padding:10px 12px;text-align:center;box-sizing:border-box;opacity:.78;transform:rotate(-3deg);font-family:Georgia,"Times New Roman",serif;line-height:1.05;background:rgba(255,255,255,.92)}
.seal-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.seal-rule{border-top:1px solid #111;margin:5px 8px}.seal-sub{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#333}
@media(max-width:650px){.top,.grid{display:block}.doc{text-align:left;margin-top:18px}.page{padding:24px 24px 104px}.terms{padding-right:0}.seal{right:24px;width:138px}}
</style>
</head>
<body>
<main class="page">
<section class="top">
<div class="brand"><h1>${esc(s.companyName)}</h1><p>${esc(s.tagline)}</p><p>${esc(s.serviceArea)}</p><p>${esc(contactLine)}</p></div>
<div class="doc"><h2>${esc(kind)}</h2><p><strong>${esc(d.id)}</strong></p><p>${esc(d.created || today())}</p><p>${esc(d.status || "open")}</p></div>
</section>
<section class="grid">
<div class="box"><h3>Customer</h3><p><strong>${esc(d.customer)}</strong><br>${esc(d.contact)}<br>${esc(d.phone)}<br>${esc(d.email)}</p></div>
<div class="box"><h3>Project</h3><p><strong>${esc(d.title)}</strong><br>${esc(d.site)}<br>${esc(d.city)}<br>${esc(d.category)}</p>${imageMeta}</div>
</section>
<section class="box"><h3>Scope Summary</h3><p class="scope">${esc(d.summary)}</p></section>
<section class="box"><h3>Scope Details</h3><p class="scope">${esc(d.details)}</p></section>
<section class="grid">
<div class="box"><h3>Notes / Exclusions</h3><p class="scope">${esc(d.notes)}</p></div>
<div class="box"><h3>Total</h3><p class="price">${money(d.total)}</p><p>Deposit / Paid: ${money(d.deposit)}</p><p>Balance Due: ${money(d.balance_due)}</p></div>
</section>
<section class="terms"><p><strong>Terms:</strong> ${esc(s.defaultTerms)}</p><p><strong>Warranty:</strong> ${esc(s.warrantyNote)}</p></section>
${seal}
</main>
</body>
</html>`;

  fm.writeString(path, html);
  return path;
}

function buildImageMeta(d) {
  const ids = arr(d.imageBlockIds).filter(Boolean);
  const blocks = arr(d.imageBlocks).map(b => typeof b === "string" ? b : (b.id || b.imageBlockId || "")).filter(Boolean);
  const all = ids.concat(blocks);
  const featured = d.featuredImageId ? `<p>Featured Image ID: ${esc(d.featuredImageId)}</p>` : "";
  const linked = all.length ? `<p>Image Block IDs: ${esc(all.join(", "))}</p>` : "";
  return featured || linked ? `<div class="asset-meta">${featured}${linked}</div>` : "";
}

function cleanText(v) {
  return String(v ?? "")
    .replace(/\u00e2\u20ac\u00a2/g, "-")      // mojibake bullet
    .replace(/\u00e2\u20ac\u201c/g, "-")      // mojibake en dash
    .replace(/\u00e2\u20ac\u201d/g, "-")      // mojibake em dash
    .replace(/\u00e2\u20ac\u02dc|\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac\u0153|\u00e2\u20ac\ufffd/g, '"')
    .replace(/\u00c2 /g, " ")
    .replace(/\u00c2/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2022]/g, "-")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

function copyDir(src, dst) {
  if (!fm.fileExists(src)) return;
  ensure(dst);
  fm.listContents(src).forEach(n => {
    const s = fm.joinPath(src, n);
    const d = fm.joinPath(dst, n);
    if (fm.isDirectory(s)) copyDir(s, d);
    else {
      if (fm.fileExists(d)) fm.remove(d);
      fm.copy(s, d);
    }
  });
}

function sortKeys(d) {
  const date = d.created || today();
  d.sort_year = date.slice(0, 4);
  d.sort_month = date.slice(0, 7);
  d.sort_week = weekKey(new Date(date));
}

function getSettings() {
  return Object.assign({}, DEFAULT_SETTINGS, readJson(FILES.settings, {}));
}

function log(action, detail) {
  const list = arr(readJson(FILES.activity, []));
  list.push({ at: new Date().toISOString(), action, detail });
  writeJson(FILES.activity, list.slice(-500));
}

function groupBy(list, getter) {
  return arr(list).reduce((acc, item) => {
    const key = getter(item) || "Unsorted";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function byUpdated(a, b) { return String(b.updated || "").localeCompare(String(a.updated || "")); }

function toIso(v) {
  const s = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? today() : d.toISOString().slice(0, 10);
}

function readJson(path, fallback) {
  try {
    if (!fm.fileExists(path)) return fallback;
    return JSON.parse(fm.readString(path));
  } catch (e) {
    return fallback;
  }
}

function writeJson(path, value) { fm.writeString(path, JSON.stringify(value, null, 2)); }
function ensure(path) { if (!fm.fileExists(path)) fm.createDirectory(path, true); }
function today() { return new Date().toISOString().slice(0, 10); }

function weekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - start) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function num(v) { return Number(String(v ?? "0").replace(/[^0-9.-]/g, "")) || 0; }
function money(v) { return "$" + Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function status(v) { return String(v || "").toLowerCase().trim(); }
function esc(v) { return cleanText(v).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[ch])); }
function arr(v) { return Array.isArray(v) ? v : []; }
function cap(v) { return String(v).charAt(0).toUpperCase() + String(v).slice(1); }
function first(...vals) { for (const v of vals) { if (v !== undefined && v !== null && String(v).trim() !== "") return v; } return ""; }

async function notice(title, message) {
  const a = new Alert();
  a.title = title;
  a.message = String(message || "");
  a.addAction("OK");
  await a.presentAlert();
}
