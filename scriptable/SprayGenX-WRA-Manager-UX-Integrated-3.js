// Spray GenX WRA Manager - UX Integrated 5
// Version: 2026.07.07 fixed-print-proposal-template
// Purpose: Scriptable proposal/invoice manager with editable job photo and fixed letter-size HTML output.

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
  sealText: "SPRAY\nGENX LLC",
  sealSubtext: "LLC / Business ID"
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
  doc = normalizeRecord(doc, `${doc.id || "draft"}.json`, doc.path || "") || doc;
  const base = new Alert();
  base.title = title;
  base.message = `${doc.id}\nCustomer and job`;
  ["Customer", "Contact / GC", "Phone", "Email", "Job title", "Site / address", "City", "Category"].forEach((label, i) => {
    base.addTextField(label, [doc.customer, doc.contact, doc.phone, doc.email, doc.title, doc.site, doc.city, doc.category][i] || "");
  });
  base.addAction("Next");
  base.addCancelAction("Cancel");
  if (await base.presentAlert() === -1) return null;
  doc.customer = cleanText(base.textFieldValue(0));
  doc.contact = cleanText(base.textFieldValue(1));
  doc.phone = cleanText(base.textFieldValue(2));
  doc.email = cleanText(base.textFieldValue(3));
  doc.title = cleanText(base.textFieldValue(4));
  doc.site = cleanText(base.textFieldValue(5));
  doc.city = cleanText(base.textFieldValue(6));
  doc.category = cleanText(base.textFieldValue(7));

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
  doc.balance_due = Math.max(0, doc.total - doc.deposit);
  doc.status = cleanText(price.textFieldValue(2)) || (doc.kind === "invoice" ? "unpaid" : "open");

  doc.summary = await textStep("Scope Summary", "Short scope summary", doc.summary);
  doc.details = await textStep("Scope Details", "Paste detailed scope here", doc.details);
  doc.notes = await textStep("Notes / Exclusions", "Anything excluded or special", doc.notes);

  doc.featuredImageId = cleanText(doc.featuredImageId || "");
  doc.imagePath = cleanText(doc.imagePath || doc.featuredImagePath || "");
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
  a.addAction("Set / Replace Job Photo");
  a.addAction("Edit Again");
  if (kind === "proposal") a.addAction("Convert to Invoice");
  a.addAction("Done");
  const c = await a.presentSheet();
  if (c === 0) await QuickLook.present(writeHtml(doc, kind));
  if (c === 1) { await setJobPhoto(doc, kind); await QuickLook.present(writeHtml(doc, kind)); }
  if (c === 2) kind === "invoice" ? await invoiceFlow(doc) : await proposalFlow(doc);
  if (kind === "proposal" && c === 3) await convertToInvoice(doc);
}

async function setJobPhoto(doc, kind) {
  try {
    const img = await Photos.fromLibrary();
    const path = fm.joinPath(DIRS.images, `${doc.id}-featured.jpg`);
    fm.writeImage(path, img);
    doc.imagePath = path;
    doc.featuredImageId = `${doc.id}-featured`;
    doc.updated = today();
    saveDoc(doc, kind);
    await notice("Photo Saved", "The job photo is attached to this document.");
  } catch (e) {
    await notice("Photo Not Changed", String(e));
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
    const marker = hasImageRef(doc) ? " - photo" : "";
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
  a.addAction("Set / Replace Job Photo");
  a.addAction("Edit / Upgrade");
  a.addAction("Duplicate");
  if (kind === "proposal") a.addAction("Convert to Invoice");
  a.addAction("Archive");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === 0) await QuickLook.present(writeHtml(doc, kind));
  if (c === 1) { await setJobPhoto(doc, kind); await QuickLook.present(writeHtml(doc, kind)); }
  if (c === 2) kind === "invoice" ? await invoiceFlow(doc) : await proposalFlow(doc);
  if (c === 3) await duplicateDoc(doc, kind);
  if (kind === "proposal" && c === 4) await convertToInvoice(doc);
  const archiveIndex = kind === "proposal" ? 5 : 4;
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

async function archiveDoc(doc, kind) { doc.status = "archived"; doc.updated = today(); saveDoc(doc, kind); await notice("Archived", doc.id); }

async function archiveMenu() {
  const docs = arr(readJson(FILES.proposals, [])).concat(arr(readJson(FILES.invoices, [])));
  const a = new Alert();
  a.title = "Find / Archive";
  a.addAction("By Month"); a.addAction("By Year"); a.addAction("By Week"); a.addAction("Search"); a.addCancelAction("Back");
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
  copyDir(DIRS.data, fm.joinPath(dir, "Data")); copyDir(DIRS.logs, fm.joinPath(dir, "Logs")); copyDir(DIRS.proposals, fm.joinPath(dir, "Proposals")); copyDir(DIRS.invoices, fm.joinPath(dir, "Invoices")); copyDir(DIRS.images, fm.joinPath(dir, "Images")); copyDir(DIRS.imageBlocks, fm.joinPath(dir, "ImageBlocks"));
  await notice("Backup Created", dir);
}

async function rebuildAction() { const r = rebuildIndexes(); syncNextNumbers(); await notice("Data Rebuilt", `${r.proposals} proposals\n${r.invoices} invoices\n${r.skipped} skipped`); }

async function settingsMenu() {
  const s = getSettings();
  const a = new Alert();
  a.title = "Settings";
  a.message = "Branding and document seal";
  a.addTextField("Company", s.companyName || ""); a.addTextField("Phone", s.phone || ""); a.addTextField("Email", s.email || ""); a.addTextField("Service area", s.serviceArea || ""); a.addTextField("Seal text", s.sealText || s.companyName || ""); a.addTextField("Seal small text", s.sealSubtext || ""); a.addTextField("Seal on? yes/no", s.sealEnabled === false ? "no" : "yes");
  a.addAction("Save"); a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  s.companyName = cleanText(a.textFieldValue(0)); s.phone = cleanText(a.textFieldValue(1)); s.email = cleanText(a.textFieldValue(2)); s.serviceArea = cleanText(a.textFieldValue(3)); s.sealText = cleanText(a.textFieldValue(4)) || s.companyName; s.sealSubtext = cleanText(a.textFieldValue(5)); s.sealEnabled = !/^n(o)?|false|off|0$/i.test(a.textFieldValue(6).trim());
  writeJson(FILES.settings, s);
}

async function showPaths() { await notice("Spray GenX Paths", `Root:\n${ROOT}\n\nData:\n${DIRS.data}\n\nProposals:\n${DIRS.proposals}\n\nInvoices:\n${DIRS.invoices}\n\nImages:\n${DIRS.images}\n\nImage Blocks:\n${DIRS.imageBlocks}\n\nLogs:\n${DIRS.logs}`); }

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
      writeJson(path, d);
    }
  });
  writeJson(FILES.proposals, dedupe(p).sort(byUpdated));
  writeJson(FILES.invoices, dedupe(i).sort(byUpdated));
  return { proposals: p.length, invoices: i.length, skipped };
}

function normalizeRecord(raw, filename, path) {
  if (!raw || typeof raw !== "object") return null;
  const file = String(filename || "");
  const manager = raw.manager || {};
  const customerObj = typeof raw.customer === "object" ? raw.customer : {};
  const job = raw.job || {};
  const scope = raw.scope || {};
  const pricing = raw.pricing || {};
  const kindText = [file, raw.kind, raw.docType, raw.DocType, manager.invoice_id, manager.proposal_id, raw.id].join(" ").toLowerCase();
  const kind = /invoice|\binv-/.test(kindText) ? "invoice" : "proposal";
  const id = cleanText(first(raw.id, raw.docNo, raw.DocNo, raw.number, manager.invoice_id, manager.proposal_id, idFromFilename(file)));
  const total = num(first(pricing.total, pricing.price, pricing.amount, raw.total, raw.price, raw.Price, raw.amount, raw.Amount, raw.contract_total, raw.grandTotal, raw.totalDue));
  const paid = num(first(pricing.amount_paid, pricing.paid, pricing.deposit, raw.amount_paid, raw.paid, raw.deposit, manager.amount_paid));
  const balanceRaw = first(pricing.balance_due, raw.balance_due, raw.balanceDue, manager.balance_due);
  const balance = balanceRaw !== "" ? num(balanceRaw) : Math.max(0, total - paid);
  const created = toIso(first(manager.created_date, raw.date, raw.Date, raw.created, raw.createdDate, raw.created_at, today()));
  const updated = toIso(first(manager.updated_date, raw.updated, raw.updatedDate, raw.updated_at, created));
  const d = {
    id, kind, path,
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
    total, deposit: paid, balance_due: balance,
    status: cleanText(first(manager.status, manager.payment_status, raw.status, kind === "invoice" ? "unpaid" : "open")),
    imagePath: cleanText(first(raw.imagePath, raw.featuredImagePath, raw.photoPath, raw.projectImagePath, job.imagePath, job.featuredImagePath)),
    featuredImageId: cleanText(first(raw.featuredImageId, raw.featured_image_id, job.featuredImageId, job.featured_image_id)),
    imageBlockIds: arr(raw.imageBlockIds).concat(arr(raw.image_block_ids)),
    imageBlocks: arr(raw.imageBlocks).concat(arr(raw.image_blocks)),
    created, updated
  };
  sortKeys(d);
  return d;
}

function blankDoc(kind) {
  const d = { id: kind === "invoice" ? nextInvoiceId() : nextProposalId(), kind, customer: "", contact: "", phone: "", email: "", title: "", site: "", city: "", category: "", summary: "", details: "", notes: "", total: 0, deposit: 0, balance_due: 0, status: kind === "invoice" ? "unpaid" : "open", imagePath: "", featuredImageId: "", imageBlockIds: [], imageBlocks: [], created: today(), updated: today() };
  sortKeys(d); return d;
}

function saveDoc(d, kind) {
  d.kind = kind;
  d.balance_due = Math.max(0, Number(d.total || 0) - Number(d.deposit || 0));
  d.customer = cleanText(d.customer); d.contact = cleanText(d.contact); d.phone = cleanText(d.phone); d.email = cleanText(d.email); d.title = cleanText(d.title); d.site = cleanText(d.site); d.city = cleanText(d.city); d.category = cleanText(d.category); d.summary = cleanText(d.summary); d.details = cleanText(d.details); d.notes = cleanText(d.notes); d.status = cleanText(d.status); d.imagePath = cleanText(d.imagePath || ""); d.featuredImageId = cleanText(d.featuredImageId || "");
  sortKeys(d);
  writeJson(filePathFor(d, kind), d);
  rebuildIndexes();
  log(`${kind}_saved`, d.id);
}

function filePathFor(d, kind) { return fm.joinPath(kind === "invoice" ? DIRS.invoices : DIRS.proposals, `${d.id}.json`); }
function slim(d) { return { id: d.id, kind: d.kind, path: d.path || "", customer: d.customer || "", title: d.title || "", site: d.site || "", city: d.city || "", status: d.status || "open", total: Number(d.total || 0), deposit: Number(d.deposit || 0), balance_due: Number(d.balance_due || 0), featuredImageId: d.featuredImageId || "", imagePath: d.imagePath || "", imageBlockIds: arr(d.imageBlockIds), imageBlocks: arr(d.imageBlocks), created: d.created || today(), updated: d.updated || d.created || today(), sort_year: d.sort_year, sort_month: d.sort_month, sort_week: d.sort_week }; }

function writeHtml(d, kind) {
  d = normalizeRecord(d, `${d.id || "document"}.json`, d.path || "") || d;
  const s = getSettings();
  const path = fm.joinPath(kind === "invoice" ? DIRS.invoices : DIRS.proposals, `${d.id}.html`);
  const label = kind === "invoice" ? "INVOICE" : "PROPOSAL";
  const img = imageHtml(d);
  const companyInfo = htmlLines([s.tagline, s.serviceArea, s.phone, s.email]);
  const customerInfo = htmlLines([d.customer, d.contact, d.phone, d.email]);
  const projectInfo = htmlLines([d.title, d.site, d.city, d.category]);
  const seal = s.sealEnabled === false ? "" : `<div class="seal"><div class="seal-center">${esc(s.sealText || "SPRAY\nGENX LLC").replace(/\n/g, "<br>")}<span>${esc(s.sealSubtext || "LLC / Business ID")}</span></div></div>`;
  const html = `<!doctype html>
<html><head><meta charset="UTF-8"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.id)} - ${label}</title><style>
@page{size:letter;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#e9e9e9;color:#111;font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;line-height:1.38}.page{background:#fff;width:8.5in;min-height:11in;margin:0 auto;padding:.50in .55in .95in;position:relative}.top{display:grid;grid-template-columns:1fr 1fr;gap:.30in;align-items:start;border-bottom:3px solid #111;padding-bottom:.22in;margin-bottom:.24in}.brand h1{margin:0 0 .08in;font-size:29px;line-height:1;font-weight:900;letter-spacing:-.035em}.brand .info,.doc .meta{font-size:16px;color:#444}.doc{text-align:right}.doc h2{margin:0 0 .07in;font-size:26px;line-height:1;text-transform:uppercase;font-weight:900}.doc .num{font-size:18px;font-weight:900;margin-bottom:.06in}.doc .meta{font-size:15px}.cards{display:grid;grid-template-columns:1fr 1fr;gap:.20in;margin-bottom:.24in}.card{border:1px solid #ddd;border-radius:9px;padding:.16in .17in;min-height:1.35in;break-inside:avoid}.card h3,.section h3{margin:0 0 .12in;font-size:13px;text-transform:uppercase;letter-spacing:.14em;font-weight:900}.card p{margin:0}.card strong{font-weight:850}.hero{display:block;width:100%;height:2.55in;object-fit:cover;border:1px solid #d7d7d7;border-radius:9px;margin:0 0 .25in}.nohero{display:none}.section{border:1px solid #ddd;border-radius:9px;padding:.17in .18in;margin:0 0 .18in;break-inside:avoid}.scope{white-space:pre-wrap;margin:0;font-size:15px}.two{display:grid;grid-template-columns:1fr 1fr;gap:.20in;align-items:stretch}.price-card{min-height:2.25in}.price{font-size:32px;font-weight:900;text-align:right;margin:.18in 0 .20in}.price-card p{font-size:15px;margin:.12in 0}.terms{border-top:1px solid #ddd;margin-top:.20in;padding-top:.16in;padding-right:1.55in;font-size:12px;color:#333;break-inside:avoid}.terms p{margin:0 0 .07in}.seal{position:fixed;right:.55in;bottom:.35in;width:1.12in;height:1.12in;border:2px solid #111;border-radius:50%;background:rgba(255,255,255,.96);display:flex;align-items:center;justify-content:center;text-align:center;z-index:50;transform:rotate(-6deg)}.seal:before{content:"";position:absolute;inset:.08in;border:1px solid #111;border-radius:50%}.seal-center{position:relative;font-weight:900;font-size:11px;line-height:.95;letter-spacing:.02em}.seal-center span{display:block;margin-top:.055in;font-size:6.5px;line-height:1.05;letter-spacing:.06em}@media screen and (max-width:720px){.page{width:auto;min-height:100vh;padding:28px 24px 105px}.top,.cards,.two{display:block}.doc{text-align:left;margin-top:20px}.card{margin-bottom:16px}.hero{height:220px}.terms{padding-right:0}.seal{right:24px}}
</style></head><body><main class="page">
<section class="top"><div class="brand"><h1>${esc(s.companyName)}</h1><div class="info">${companyInfo}</div></div><div class="doc"><h2>${label}</h2><div class="num">${esc(d.id)}</div><div class="meta">${esc(d.created || today())}<br>Status: ${esc(d.status || "open")}</div></div></section>
<section class="cards"><div class="card"><h3>Customer</h3><p>${customerInfo}</p></div><div class="card"><h3>Project</h3><p>${projectInfo}</p></div></section>
${img || '<div class="nohero"></div>'}
<section class="section"><h3>Scope Summary</h3><p class="scope">${esc(d.summary)}</p></section>
<section class="section"><h3>Scope Details</h3><p class="scope">${esc(d.details)}</p></section>
<section class="two"><div class="section"><h3>Exclusions / Notes</h3><p class="scope">${esc(d.notes)}</p></div><div class="section price-card"><h3>Price</h3><div class="price">${moneyWhole(d.total)}</div><p>Deposit: ${moneyWhole(d.deposit)}</p><p>Balance: ${moneyWhole(d.balance_due)}</p></div></section>
<section class="terms"><p><strong>Terms:</strong> ${esc(s.defaultTerms)}</p><p><strong>Warranty:</strong> ${esc(s.warrantyNote)}</p></section>${seal}
</main></body></html>`;
  fm.writeString(path, html);
  return path;
}

function imageHtml(d) {
  const path = findImagePath(d);
  if (!path) return "";
  try { const img = fm.readImage(path); if (!img) return ""; const b64 = Data.fromJPEG(img, 0.86).toBase64String(); return `<img class="hero" src="data:image/jpeg;base64,${b64}" alt="Project photo">`; } catch (e) { return ""; }
}

function findImagePath(d) {
  const candidates = [d.imagePath, d.featuredImagePath, d.photoPath, d.projectImagePath].filter(Boolean);
  for (const p of candidates) if (fm.fileExists(p)) return p;
  const ids = [d.featuredImageId].concat(arr(d.imageBlockIds)).concat(arr(d.imageBlocks).map(x => typeof x === "string" ? x : first(x.id, x.imageBlockId, x.path))).filter(Boolean).map(String);
  const dirs = [DIRS.images, DIRS.imageBlocks, DIRS.proposals, DIRS.data];
  for (const dir of dirs) {
    if (!fm.fileExists(dir)) continue;
    const files = fm.listContents(dir);
    for (const id of ids) {
      const low = id.toLowerCase();
      for (const name of files) {
        const n = name.toLowerCase();
        if ((n.includes(low) || low.includes(n.replace(/\.(jpg|jpeg|png)$/i, ""))) && /\.(jpg|jpeg|png)$/i.test(n)) return fm.joinPath(dir, name);
      }
    }
  }
  return "";
}

function htmlLines(values) {
  const seen = new Set();
  return values.map(v => cleanText(v || "")).filter(v => { if (!v) return false; const k = v.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).map(v => esc(v)).join("<br>");
}
function hasImageRef(d) { return !!(d.imagePath || d.featuredImageId || arr(d.imageBlockIds).length || arr(d.imageBlocks).length); }
function dedupe(list) { const m = {}; list.forEach(d => { if (d && d.id) m[d.id] = d; }); return Object.values(m); }
function nextProposalId() { const s = getSettings(); return `SGX-${new Date().getFullYear()}-${String(s.nextProposalNumber || 1).padStart(3, "0")}`; }
function nextInvoiceId() { const s = getSettings(); return `INV-${new Date().getFullYear()}-${String(s.nextInvoiceNumber || 1).padStart(3, "0")}`; }
function bumpNumber(id, kind) { const s = getSettings(); const n = lastNumber(id) + 1; if (kind === "invoice" && n > Number(s.nextInvoiceNumber || 1)) s.nextInvoiceNumber = n; if (kind === "proposal" && n > Number(s.nextProposalNumber || 1)) s.nextProposalNumber = n; writeJson(FILES.settings, s); }
function syncNextNumbers() { const s = getSettings(); const ids = arr(readJson(FILES.proposals, [])).concat(arr(readJson(FILES.invoices, []))).map(d => d.id || ""); s.nextProposalNumber = Math.max(Number(s.nextProposalNumber || 1), 1 + Math.max(0, ...ids.filter(id => id.startsWith("SGX-") || id.startsWith("PROP-")).map(lastNumber))); s.nextInvoiceNumber = Math.max(Number(s.nextInvoiceNumber || 1), 1 + Math.max(0, ...ids.filter(id => id.startsWith("INV-")).map(lastNumber))); writeJson(FILES.settings, s); }
function lastNumber(id) { return Number(String(id).match(/(\d+)$/)?.[1] || 0); }
function idFromFilename(name) { const m = String(name).match(/(SGX|PROP|INV)-\d{4}-\d+/i); return m ? m[0].toUpperCase() : String(name).replace(/\.json$/i, ""); }
function copyDir(src, dst) { if (!fm.fileExists(src)) return; ensure(dst); fm.listContents(src).forEach(n => { const s = fm.joinPath(src, n), d = fm.joinPath(dst, n); if (fm.isDirectory(s)) copyDir(s, d); else { if (fm.fileExists(d)) fm.remove(d); fm.copy(s, d); } }); }
function sortKeys(d) { const date = d.created || today(); d.sort_year = date.slice(0, 4); d.sort_month = date.slice(0, 7); d.sort_week = weekKey(new Date(date)); }
function getSettings() { return Object.assign({}, DEFAULT_SETTINGS, readJson(FILES.settings, {})); }
function log(action, detail) { const list = arr(readJson(FILES.activity, [])); list.push({ at: new Date().toISOString(), action, detail }); writeJson(FILES.activity, list.slice(-500)); }
function groupBy(list, getter) { return arr(list).reduce((acc, item) => { const key = getter(item) || "Unsorted"; if (!acc[key]) acc[key] = []; acc[key].push(item); return acc; }, {}); }
function byUpdated(a, b) { return String(b.updated || "").localeCompare(String(a.updated || "")); }
function toIso(v) { const s = String(v || "").trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d = new Date(s); return isNaN(d.getTime()) ? today() : d.toISOString().slice(0, 10); }
function readJson(path, fallback) { try { if (!fm.fileExists(path)) return fallback; return JSON.parse(fm.readString(path)); } catch (e) { return fallback; } }
function writeJson(path, value) { fm.writeString(path, JSON.stringify(value, null, 2)); }
function ensure(path) { if (!fm.fileExists(path)) fm.createDirectory(path, true); }
function today() { return new Date().toISOString().slice(0, 10); }
function weekKey(date) { const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); const week = Math.ceil((((d - start) / 86400000) + 1) / 7); return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`; }
function num(v) { return Number(String(v ?? "0").replace(/[^0-9.-]/g, "")) || 0; }
function money(v) { return "$" + Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function moneyWhole(v) { return "$" + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
function status(v) { return String(v || "").toLowerCase().trim(); }
function esc(v) { return cleanText(v).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[ch])); }
function arr(v) { return Array.isArray(v) ? v : []; }
function cap(v) { return String(v).charAt(0).toUpperCase() + String(v).slice(1); }
function first(...vals) { for (const v of vals) { if (v !== undefined && v !== null && String(v).trim() !== "") return v; } return ""; }
function cleanText(v) { return String(v ?? "").replace(/â€¦/g, "...").replace(/â€”|â€“|â€\"|â€–/g, "-").replace(/â€¢/g, "-").replace(/â€˜|â€™|â€²/g, "'").replace(/â€œ|â€�/g, '"').replace(/â„¢/g, "TM").replace(/Â /g, " ").replace(/Â/g, "").replace(/\u00a0/g, " ").replace(/[\u2022]/g, "-").replace(/[\u2013\u2014]/g, "-").replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'").trim(); }
async function notice(title, message) { const a = new Alert(); a.title = title; a.message = String(message || ""); a.addAction("OK"); await a.presentAlert(); }
