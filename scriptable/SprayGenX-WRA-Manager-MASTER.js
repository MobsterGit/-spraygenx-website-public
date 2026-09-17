// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: magic;
// Spray GenX WRA Manager — MASTER
// Version: 2026.09.08 Master-2 Sort-Control-Installments-Freeman
// Canonical single-file WRA manager. Preserve SprayGenX data folders.
// Purpose: Scriptable proposal/invoice manager connected to the existing SprayGenX data folder.

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
  photos: fm.joinPath(ROOT, "Photos"),
  images: fm.joinPath(ROOT, "Images"),
  templates: fm.joinPath(ROOT, "Templates")
};
const FILES = {
  settings: fm.joinPath(DIRS.data, "settings.json"),
  customers: fm.joinPath(DIRS.data, "customers.json"),
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
  listSort: "newest",
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
  if (!fm.fileExists(FILES.customers)) writeJson(FILES.customers, []);
  if (!fm.fileExists(FILES.activity)) writeJson(FILES.activity, []);
  rebuildIndexes();
  syncNextNumbers();
  rebuildCustomersFromDocs();
}

async function home() {
  const s = stats();
  const table = new UITable();
  table.showSeparators = true;
  const head = new UITableRow();
  head.isHeader = true;
  head.height = 78;
  head.addText("Spray GenX Manager - Linked", `${s.active} active · ${s.proposals} proposals · ${s.invoices} invoices · ${money(s.balance)} due`);
  table.addRow(head);
  addButtonRow(table, "+ Proposal", proposalFlow, "+ Invoice", invoiceFlow);
  addButtonRow(table, "Current Work", currentWork, "Proposals", proposalsMenu);
  addButtonRow(table, "Invoices", invoicesMenu, "Search All", searchAllDocs);
  addButtonRow(table, "Recent", recentDocs, "Freeman Barn Restore", restoreFreemanBarn);
  addButtonRow(table, "Find / Archive", archiveMenu, "Rebuild Data", rebuildAction);
  addButtonRow(table, "Backup", backupMenu, "Settings", settingsMenu);
  addButtonRow(table, "Storage Paths", showPaths, "Close", async()=>{});
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
  const originalId = doc.id;
  const a = new Alert();
  a.title = `${kind === "proposal" ? "Proposal" : "Invoice"} ${doc.id || "New"}`;
  a.addTextField("Customer", doc.customer || "");
  a.addTextField("Contact", doc.contact || "");
  a.addTextField("Project / Title", doc.title || "");
  a.addTextField("Site", doc.site || "");
  a.addTextField("City", doc.city || "");
  a.addTextField("Category", doc.category || "");
  a.addTextField("Total", String(doc.total ?? ""));
  a.addTextField("Deposit / Paid", String(doc.deposit ?? doc.paid ?? "0"));
  a.addTextField("Status", doc.status || (kind === "proposal" ? "draft" : "open"));
  a.addAction("Continue"); a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  const v = i => a.textFieldValue(i).trim();
  doc.customer = v(0); doc.contact = v(1); doc.title = v(2); doc.site = v(3); doc.city = v(4); doc.category = v(5);
  doc.total = num(v(6)); doc.deposit = num(v(7)); doc.paid = doc.deposit; doc.status = v(8) || doc.status;
  if (!doc.id) doc.id = kind === "proposal" ? nextProposalId() : nextInvoiceId();
  doc.type = kind; doc.updated = today(); if (!doc.created) doc.created = today();
  sortKeys(doc);
  const scope = new Alert(); scope.title = "Scope / Notes";
  scope.addTextField("Scope (use \\n for line breaks)", (doc.scope || []).join("\\n"));
  scope.addTextField("Notes", doc.notes || "");
  scope.addTextField("Terms", doc.terms || getSettings().defaultTerms);
  scope.addAction("Save"); scope.addCancelAction("Cancel");
  if (await scope.presentAlert() === -1) return;
  doc.scope = scope.textFieldValue(0).split(/\\n|\n/).map(x => x.trim()).filter(Boolean);
  doc.notes = scope.textFieldValue(1).trim(); doc.terms = scope.textFieldValue(2).trim();
  if (!doc.installments) doc.installments = [];
  if (!doc.payments) doc.payments = [];
  if (kind === "invoice") doc.balance_due = Math.max(0, doc.total - doc.deposit);
  await projectImageMenu(doc);
  saveDoc(doc, kind, originalId);
  await openDoc(doc);
}

function blankDoc(kind) {
  return {
    id: "", type: kind, customer: "", contact: "", title: "", site: "", city: "", category: "",
    scope: [], notes: "", terms: getSettings().defaultTerms, total: 0, deposit: 0, paid: 0,
    balance_due: 0, status: kind === "proposal" ? "draft" : "open", created: today(), updated: today(),
    installments: [], payments: [], projectImagePath: ""
  };
}

async function projectImageMenu(doc) {
  const a = new Alert(); a.title = "Project Image";
  a.message = doc.projectImagePath ? `Current: ${doc.projectImagePath}` : "Optional. Paste an iCloud Scriptable image path or leave unchanged.";
  a.addTextField("Image path", doc.projectImagePath || "");
  a.addAction("Keep / Save Path"); a.addAction("Use Clipboard Path"); a.addCancelAction("No Image Change");
  const c = await a.presentSheet();
  if (c === 0) doc.projectImagePath = a.textFieldValue(0).trim();
  if (c === 1) doc.projectImagePath = clipboardText().trim();
}

function saveDoc(doc, kind, oldId) {
  normalizeDoc(doc, kind);
  const dir = kind === "proposal" ? DIRS.proposals : DIRS.invoices;
  if (oldId && oldId !== doc.id) {
    const old = fm.joinPath(dir, `${oldId}.json`);
    if (fm.fileExists(old)) fm.remove(old);
  }
  writeJson(fm.joinPath(dir, `${doc.id}.json`), doc);
  rebuildIndexes(); syncNextNumbers(); rebuildCustomersFromDocs();
  log("save", `${kind}:${doc.id}`);
}

function normalizeDoc(d, kind) {
  d.type = kind || d.type || inferKind(d.id);
  d.customer = first(d.customer, d.client, d.customer_name, d.name);
  d.contact = first(d.contact, d.contact_name);
  d.title = first(d.title, d.project, d.project_name, d.job, d.description);
  d.site = first(d.site, d.job_site, d.address, d.project_address);
  d.city = first(d.city, d.location);
  d.category = first(d.category, d.project_type);
  d.total = num(first(d.total, d.grand_total, d.contract_total, d.amount, 0));
  d.deposit = num(first(d.deposit, d.paid, d.amount_paid, 0));
  d.paid = num(first(d.paid, d.deposit, d.amount_paid, 0));
  d.balance_due = num(first(d.balance_due, d.balance, d.total - d.paid));
  d.status = first(d.status, d.state, d.type === "proposal" ? "draft" : "open");
  d.created = toIso(first(d.created, d.date, d.created_at, today()));
  d.updated = toIso(first(d.updated, d.modified, d.updated_at, d.created));
  d.scope = Array.isArray(d.scope) ? d.scope : cleanText(first(d.scope, d.scope_text, d.description, "")).split(/\n|•|;/).map(x=>x.trim()).filter(Boolean);
  d.notes = cleanText(first(d.notes, d.note, ""));
  d.terms = cleanText(first(d.terms, d.payment_terms, getSettings().defaultTerms));
  d.installments = arr(d.installments); d.payments = arr(d.payments);
  d.projectImagePath = first(d.projectImagePath, d.project_image_path, d.imagePath, d.image_path, "");
  sortKeys(d);
  return d;
}

async function openDoc(doc) {
  const kind = doc.type || inferKind(doc.id);
  const a = new Alert();
  a.title = doc.id;
  a.message = `${doc.customer || ""}\n${doc.title || ""}\n${money(doc.total)} · ${doc.status || ""}`;
  a.addAction("Preview / Print"); a.addAction("Edit");
  if (kind === "proposal") a.addAction("Convert to Invoice");
  a.addAction("Archive"); a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === 0) await QuickLook.present(await writeHtml(doc, kind));
  if (c === 1) kind === "invoice" ? await invoiceFlow(doc) : await proposalFlow(doc);
  if (kind === "proposal" && c === 2) await convertToInvoice(doc);
  const archiveIndex = kind === "proposal" ? 3 : 2;
  if (c === archiveIndex) await archiveDoc(doc, kind);
}

async function currentWork() {
  const docs = activeDocs();
  await sortedDocumentMenu("Current Work", docs, "No active work found.");
}

async function proposalsMenu() {
  const docs = arr(readJson(FILES.proposals, []));
  await searchableDocumentMenu("Proposals", docs, "No proposals found.");
}

async function invoicesMenu() {
  const docs = arr(readJson(FILES.invoices, []));
  await searchableDocumentMenu("Invoices", docs, "No invoices found.");
}

async function searchableDocumentMenu(title, docs, emptyMsg) {
  if (!docs.length) return await notice(title, emptyMsg);
  const a = new Alert(); a.title = title;
  a.addAction(`View (${sortLabel(getListSort())})`); a.addAction("Sort"); a.addAction("Search"); a.addAction("Recent"); a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === 0) return await documentTable(`${title} - ${sortLabel(getListSort())}`, sortDocs(docs), emptyMsg);
  if (c === 1) { await chooseListSort(); return await searchableDocumentMenu(title, docs, emptyMsg); }
  if (c === 2) return await searchDocs(docs);
  if (c === 3) return await documentTable(`${title} - Recent`, docs.slice().sort(byUpdated).slice(0,25), emptyMsg);
}

async function sortedDocumentMenu(title, docs, emptyMsg) {
  if (!docs.length) return await notice(title, emptyMsg);
  const a = new Alert(); a.title = title; a.message = `Sort: ${sortLabel(getListSort())}`;
  a.addAction("View"); a.addAction("Change Sort"); a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === 0) return await documentTable(`${title} - ${sortLabel(getListSort())}`, sortDocs(docs), emptyMsg);
  if (c === 1) { await chooseListSort(); return await sortedDocumentMenu(title, docs, emptyMsg); }
}

async function chooseListSort() {
  const a = new Alert(); a.title = "Sort Documents";
  ["Newest First", "Oldest First", "A-Z", "Z-A"].forEach(x => a.addAction(x));
  a.addCancelAction("Cancel");
  const c = await a.presentSheet(); if (c < 0) return;
  const modes = ["newest", "oldest", "az", "za"];
  const st = getSettings(); st.listSort = modes[c]; writeJson(FILES.settings, st);
}

function getListSort() { return getSettings().listSort || "newest"; }
function sortLabel(mode) { return ({newest:"Newest First",oldest:"Oldest First",az:"A-Z",za:"Z-A"})[mode] || "Newest First"; }
function sortDocs(docs, mode) {
  mode = mode || getListSort(); const out = arr(docs).slice();
  if (mode === "oldest") return out.sort((a,b) => String(a.updated || a.created || "").localeCompare(String(b.updated || b.created || "")));
  if (mode === "az") return out.sort(byAlpha);
  if (mode === "za") return out.sort((a,b) => byAlpha(b,a));
  return out.sort(byUpdated);
}

async function searchAllDocs() {
  const docs = arr(readJson(FILES.proposals, [])).concat(arr(readJson(FILES.invoices, [])));
  await searchDocs(docs);
}

async function recentDocs() {
  const docs = arr(readJson(FILES.proposals, [])).concat(arr(readJson(FILES.invoices, []))).sort(byUpdated).slice(0,25);
  await documentTable("Recent Documents", docs, "No documents found.");
}

async function restoreFreemanBarn() {
  const existing = arr(readJson(FILES.proposals, [])).find(d => /SGX-2026-002/i.test(d.id||"") || /freeman barn/i.test(`${d.title||""} ${d.site||""}`));
  if (existing) {
    const a = new Alert(); a.title = "Freeman Barn Found"; a.message = `${existing.id}\n${existing.customer}\n${existing.title}`;
    a.addAction("Open Existing"); a.addAction("Rebuild / Restore Copy"); a.addCancelAction("Cancel");
    const c = await a.presentSheet(); if (c === 0) return await openDoc(loadDoc(existing)); if (c !== 1) return;
  }
  const d = blankDoc("proposal");
  d.id = existing ? nextProposalId() : "SGX-2026-002";
  d.customer = "Twinsburg Historical Society"; d.contact = "Bob"; d.title = "Freeman Barn Exterior Restoration";
  d.site = "8996 Darrow Road"; d.city = "Twinsburg, Ohio"; d.category = "Historic Exterior Restoration";
  d.created = "2026-03-12"; d.updated = today(); d.total = 48900; d.deposit = 0; d.paid = 0; d.balance_due = 48900; d.status = "accepted";
  d.scope = [
    "Low-pressure wash of wood siding and trim; scrape, feather-sand and prepare failing coatings.",
    "Apply Peel RX and Prime RX where appropriate for historic coating stabilization.",
    "Repair failed window glazing as required within approved scope.",
    "Clean and prepare metal roof; treat rust and inspect existing silver coating.",
    "Inspect and replace approved suspect roof fasteners with EPDM-sealed fasteners.",
    "Apply compatible roof coating after inspection, adhesion testing and substrate confirmation.",
    "Hand-detail historic lettering, including typography and shadowing, where included in approved scope.",
    "Provide aerial lift access for upper elevations and roof-related work.",
    "Perform minor approved carpentry and water-management repairs; materially different concealed conditions require review."
  ];
  d.notes = "Weather and Historical Society event blackout dates may affect sequencing. Roof coating system is subject to field inspection, compatibility and adhesion testing. Current contract/payment schedule basis: $48,900.";
  d.installments = [
    {id:1,label:"Initial Mobilization Payment",amount:14670,dueTrigger:"At commencement before material/lift mobilization",status:"due"},
    {id:2,label:"Progress Payment 1",amount:14670,dueTrigger:"After roof/upper preparation milestone",status:"scheduled"},
    {id:3,label:"Progress Payment 2",amount:14670,dueTrigger:"After roof/upper coatings and exterior finish milestone",status:"scheduled"},
    {id:4,label:"Final Payment",amount:4890,dueTrigger:"After historic detail, closeout and final walkthrough",status:"scheduled"}
  ];
  saveDoc(d, "proposal");
  await notice("Freeman Barn Restored", `${d.id}\n${money(d.total)}\nSaved to Proposals`);
  await openDoc(d);
}

async function convertToInvoice(p) {
  const d = JSON.parse(JSON.stringify(p));
  d.id = nextInvoiceId(); d.type = "invoice"; d.sourceProposalId = p.id; d.status = "open"; d.created = today(); d.updated = today();
  d.installments = await chooseInstallmentSchedule(d.total, d.installments);
  d.payments = arr(d.payments); d.paid = d.payments.reduce((n,x)=>n+num(x.amount), num(d.deposit));
  d.balance_due = Math.max(0, d.total - d.paid);
  saveDoc(d, "invoice");
  p.status = "converted_to_invoice"; p.updated = today(); saveDoc(p, "proposal");
  await notice("Invoice Created", `${d.id}\nFrom ${p.id}`);
  await openDoc(d);
}

async function chooseInstallmentSchedule(total, existing) {
  const a = new Alert(); a.title = "Payment Schedule"; a.message = `Contract total: ${money(total)}`;
  a.addAction("Keep Existing Schedule"); a.addAction("Due in Full"); a.addAction("Deposit + Final (50/50)"); a.addAction("3 Payments"); a.addAction("4 Payments (30/30/30/10)"); a.addAction("Custom Later"); a.addCancelAction("Cancel Conversion");
  const c = await a.presentSheet();
  if (c === -1) return arr(existing);
  if (c === 0 && arr(existing).length) return existing;
  if (c === 1) return [{id:1,label:"Payment Due",amount:total,dueTrigger:"Due in full",status:"due"}];
  if (c === 2) return splitInstallments(total,[.5,.5],["Deposit","Final Payment"]);
  if (c === 3) return splitInstallments(total,[1/3,1/3,1/3],["Payment 1","Payment 2","Final Payment"]);
  if (c === 4) return splitInstallments(total,[.3,.3,.3,.1],["Initial Payment","Progress Payment 1","Progress Payment 2","Final Payment"]);
  return [];
}

function splitInstallments(total, ratios, labels) {
  let used = 0;
  return ratios.map((r,i) => {
    const amount = i === ratios.length - 1 ? Math.round((total-used)*100)/100 : Math.round(total*r*100)/100;
    used += amount;
    return {id:i+1,label:labels[i]||`Payment ${i+1}`,amount,dueTrigger:i===0?"At project start":"Per project milestone",status:i===0?"due":"scheduled"};
  });
}

async function documentTable(title, docs, emptyMsg) {
  if (!docs.length) return await notice(title, emptyMsg);
  const table = new UITable(); table.showSeparators = true;
  const h = new UITableRow(); h.isHeader = true; h.addText(title, `${docs.length} document${docs.length===1?"":"s"}`); table.addRow(h);
  docs.forEach(meta => {
    const row = new UITableRow(); row.height = 62;
    const d = loadDoc(meta);
    row.addText(`${d.customer || "Unknown"} — ${d.title || d.id}`, `${d.id} · ${money(d.total)} · ${d.status || ""}`);
    row.onSelect = async () => await openDoc(d);
    table.addRow(row);
  });
  await table.present();
}

function loadDoc(meta) {
  const kind = meta.type || inferKind(meta.id);
  const dir = kind === "invoice" ? DIRS.invoices : DIRS.proposals;
  const p = fm.joinPath(dir, `${meta.id}.json`);
  return normalizeDoc(readJson(p, meta), kind);
}

function activeDocs() {
  return arr(readJson(FILES.proposals, [])).concat(arr(readJson(FILES.invoices, []))).filter(d => !["archived","declined","converted_to_invoice","paid","void"].includes(status(d.status))).sort(byUpdated);
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
  await sortedDocumentMenu(`Search: ${q}`, results, "No matching documents.");
}

async function backupMenu() {
  const stamp = new Date().toISOString().replace(/[:.]/g,"-");
  const dest = fm.joinPath(DIRS.backups, stamp); ensure(dest);
  [DIRS.data, DIRS.logs, DIRS.proposals, DIRS.invoices, DIRS.photos, DIRS.images].forEach(src => copyFolder(src, fm.joinPath(dest, src.split("/").pop())));
  log("backup", stamp);
  await notice("Backup Complete", stamp);
}

function copyFolder(src, dest) {
  if (!fm.fileExists(src)) return;
  ensure(dest);
  for (const name of fm.listContents(src)) {
    const s = fm.joinPath(src,name), d = fm.joinPath(dest,name);
    if (fm.isDirectory(s)) copyFolder(s,d); else { try { ensureDownloaded(s); fm.copy(s,d); } catch(e) {} }
  }
}

async function settingsMenu() {
  const s = getSettings();
  const a = new Alert(); a.title = "Settings";
  a.addTextField("Company", s.companyName); a.addTextField("Tagline", s.tagline); a.addTextField("Service Area", s.serviceArea);
  a.addTextField("Phone", s.phone); a.addTextField("Email", s.email); a.addTextField("Default Terms", s.defaultTerms);
  a.addTextField("Seal Text", s.sealText); a.addTextField("Seal Subtext", s.sealSubtext);
  a.addAction("Save"); a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  s.companyName=a.textFieldValue(0); s.tagline=a.textFieldValue(1); s.serviceArea=a.textFieldValue(2); s.phone=a.textFieldValue(3); s.email=a.textFieldValue(4); s.defaultTerms=a.textFieldValue(5); s.sealText=a.textFieldValue(6); s.sealSubtext=a.textFieldValue(7);
  writeJson(FILES.settings,s); await notice("Settings Saved", "WRA settings updated.");
}

async function showPaths() {
  await notice("Storage Paths", `Root:\n${ROOT}\n\nProposals:\n${DIRS.proposals}\n\nInvoices:\n${DIRS.invoices}\n\nBackups:\n${DIRS.backups}`);
}

function rebuildIndexes() {
  const p = scanDir(DIRS.proposals,"proposal"), i = scanDir(DIRS.invoices,"invoice");
  writeJson(FILES.proposals,p.sort(byUpdated)); writeJson(FILES.invoices,i.sort(byUpdated));
  return {proposals:p.length,invoices:i.length,skipped:0};
}

function scanDir(dir, kind) {
  if (!fm.fileExists(dir)) return [];
  const out=[];
  for (const name of fm.listContents(dir)) {
    if (!/\.json$/i.test(name)) continue;
    try {
      const p=fm.joinPath(dir,name); ensureDownloaded(p); const d=normalizeDoc(readJson(p,{}),kind);
      if (!d.id) d.id=name.replace(/\.json$/i,"");
      out.push(indexMeta(d));
    } catch(e) {}
  }
  return out;
}

function indexMeta(d) {
  return {id:d.id,type:d.type,customer:d.customer,contact:d.contact,title:d.title,site:d.site,city:d.city,category:d.category,total:d.total,deposit:d.deposit,paid:d.paid,balance_due:d.balance_due,status:d.status,created:d.created,updated:d.updated,sort_year:d.sort_year,sort_month:d.sort_month,sort_week:d.sort_week};
}

function syncNextNumbers() {
  const s=getSettings();
  const p=arr(readJson(FILES.proposals,[])).map(d=>idNumber(d.id)).filter(Boolean);
  const i=arr(readJson(FILES.invoices,[])).map(d=>idNumber(d.id)).filter(Boolean);
  s.nextProposalNumber=Math.max(s.nextProposalNumber||1,(p.length?Math.max(...p)+1:1));
  s.nextInvoiceNumber=Math.max(s.nextInvoiceNumber||1,(i.length?Math.max(...i)+1:1));
  writeJson(FILES.settings,s);
}

function nextProposalId() { const s=getSettings(); const n=s.nextProposalNumber||1; s.nextProposalNumber=n+1; writeJson(FILES.settings,s); return `SGX-${new Date().getFullYear()}-${String(n).padStart(3,"0")}`; }
function nextInvoiceId() { const s=getSettings(); const n=s.nextInvoiceNumber||1; s.nextInvoiceNumber=n+1; writeJson(FILES.settings,s); return `INV-${new Date().getFullYear()}-${String(n).padStart(3,"0")}`; }
function idNumber(id) { const m=String(id||"").match(/(\d+)$/); return m?Number(m[1]):0; }
function inferKind(id) { return /^INV-/i.test(String(id||"")) ? "invoice" : "proposal"; }

function rebuildCustomersFromDocs() {
  const all=arr(readJson(FILES.proposals,[])).concat(arr(readJson(FILES.invoices,[])));
  const map={}; all.forEach(d=>{ const k=(d.customer||"").trim().toLowerCase(); if(k&&!map[k]) map[k]={name:d.customer,contact:d.contact||"",city:d.city||"",lastUpdated:d.updated||d.created}; });
  writeJson(FILES.customers,Object.values(map).sort((a,b)=>a.name.localeCompare(b.name)));
}

async function writeHtml(doc, kind) {
  const html = buildHtml(doc,kind);
  const path=fm.joinPath(DIRS.exports,`${doc.id}.html`); fm.writeString(path,html); return path;
}

function buildHtml(doc,kind) {
  const s=getSettings();
  const image=doc.projectImagePath&&fm.fileExists(doc.projectImagePath)?`<img class="project" src="${fileURL(doc.projectImagePath)}">`:"";
  const scope=arr(doc.scope).map(x=>`<li>${esc(x)}</li>`).join("");
  const schedule=paymentScheduleHtml(doc);
  const balance=kind==="invoice"?`<div class="moneyrow"><b>Balance Due</b><b>${money(doc.balance_due)}</b></div>`:"";
  const seal=s.sealEnabled?`<div class="seal"><b>${esc(s.sealText)}</b><small>${esc(s.sealSubtext)}</small></div>`:"";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  @page{size:letter;margin:.45in}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#182334;margin:0;background:#fff;font-size:12px}.page{position:relative;min-height:9.8in;padding-bottom:75px}.head{display:flex;justify-content:space-between;border-bottom:4px solid #17365d;padding-bottom:12px;margin-bottom:14px}.brand h1{margin:0;color:#17365d;font-size:26px}.brand p{margin:3px 0}.doctype{text-align:right}.doctype h2{margin:0;color:#17365d;font-size:22px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}.box{border:1px solid #c9d1dc;border-radius:7px;padding:10px}.box h3{margin:0 0 6px;color:#17365d;font-size:12px;text-transform:uppercase}.project{width:100%;max-height:235px;object-fit:cover;border-radius:7px;margin:8px 0 12px}.scope{line-height:1.42}.scope li{margin:4px 0}.money{margin-left:auto;width:46%;border-top:2px solid #17365d}.moneyrow{display:flex;justify-content:space-between;padding:6px;border-bottom:1px solid #d6dce5}.schedule{margin-top:12px}.schedule table{width:100%;border-collapse:collapse}.schedule th,.schedule td{padding:6px;border-bottom:1px solid #d6dce5;text-align:left}.schedule th{background:#eef3f8}.notes{margin-top:12px;white-space:pre-wrap}.seal{position:absolute;right:0;bottom:0;width:120px;height:58px;border:2px solid #17365d;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#17365d;text-align:center}.seal small{font-size:8px}.footer{position:absolute;left:0;bottom:8px;color:#667;font-size:9px}</style></head><body><div class="page">
  <div class="head"><div class="brand"><h1>${esc(s.companyName)}</h1><p>${esc(s.tagline)} · ${esc(s.serviceArea)}</p><p>${esc(s.phone)} ${s.phone&&s.email?" · ":""}${esc(s.email)}</p></div><div class="doctype"><h2>${kind==="invoice"?"INVOICE":"PROPOSAL"}</h2><div>${esc(doc.id)}</div><div>${esc(doc.created)}</div></div></div>
  <div class="meta"><div class="box"><h3>Customer</h3><b>${esc(doc.customer)}</b><div>${esc(doc.contact)}</div></div><div class="box"><h3>Project</h3><b>${esc(doc.title)}</b><div>${esc(doc.site)}</div><div>${esc(doc.city)}</div></div></div>${image}
  <div class="box scope"><h3>Scope of Work</h3><ul>${scope}</ul></div>
  <div class="money"><div class="moneyrow"><span>Contract Total</span><b>${money(doc.total)}</b></div>${kind==="invoice"?`<div class="moneyrow"><span>Payments / Deposit</span><span>${money(doc.paid||doc.deposit)}</span></div>`:""}${balance}</div>
  ${schedule}${doc.notes?`<div class="box notes"><h3>Notes</h3>${esc(doc.notes)}</div>`:""}<div class="box notes"><h3>Terms</h3>${esc(doc.terms)}</div>
  <div class="footer">${esc(s.companyName)} · ${esc(doc.id)}</div>${seal}</div></body></html>`;
}

function paymentScheduleHtml(doc) {
  const list=arr(doc.installments); if(!list.length) return "";
  const rows=list.map(x=>`<tr><td>${esc(x.label||`Payment ${x.id}`)}</td><td>${money(x.amount)}</td><td>${esc(x.dueTrigger||"")}</td><td>${esc(cap(x.status||"scheduled"))}</td></tr>`).join("");
  return `<div class="schedule box"><h3>Payment Schedule</h3><table><thead><tr><th>Installment</th><th>Amount</th><th>Due</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function notice(title,message) { const a=new Alert();a.title=title;a.message=message||"";a.addAction("OK");await a.presentAlert(); }
function ensureDownloaded(path) { try { if(fm.isFileStoredIniCloud(path)&&!fm.isFileDownloaded(path)) fm.downloadFileFromiCloud(path); } catch(e){} }
function fileURL(path) { const parts=String(path||"").replace(/\\/g,"/").split("/"); return "file://"+parts.map((part,i)=>i===0?"":encodeURIComponent(part)).join("/"); }
function sortKeys(d) { const date=d.created||today();d.sort_year=date.slice(0,4);d.sort_month=date.slice(0,7);d.sort_week=weekKey(new Date(date)); }
function getSettings() { return Object.assign({},DEFAULT_SETTINGS,readJson(FILES.settings,{})); }
function log(action,detail) { const list=arr(readJson(FILES.activity,[]));list.push({at:new Date().toISOString(),action,detail});writeJson(FILES.activity,list.slice(-500)); }
function groupBy(list,getter) { return arr(list).reduce((acc,item)=>{const key=getter(item)||"Unsorted";if(!acc[key])acc[key]=[];acc[key].push(item);return acc;},{}); }
function byUpdated(a,b) { return String(b.updated||"").localeCompare(String(a.updated||"")); }
function byAlpha(a,b) { return `${a.customer||""} ${a.title||""} ${a.id||""}`.localeCompare(`${b.customer||""} ${b.title||""} ${b.id||""}`,undefined,{sensitivity:"base",numeric:true}); }
function toIso(v) { const s=String(v||"").trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const d=new Date(s);return isNaN(d.getTime())?today():d.toISOString().slice(0,10); }
function readJson(path,fallback) { try{if(!fm.fileExists(path))return fallback;return JSON.parse(fm.readString(path));}catch(e){return fallback;} }
function writeJson(path,value) { fm.writeString(path,JSON.stringify(value,null,2)); }
function ensure(path) { if(!fm.fileExists(path))fm.createDirectory(path,true); }
function today() { return new Date().toISOString().slice(0,10); }
function weekKey(date) { const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const start=new Date(Date.UTC(d.getUTCFullYear(),0,1));const week=Math.ceil((((d-start)/86400000)+1)/7);return `${d.getUTCFullYear()}-W${String(week).padStart(2,"0")}`; }
function num(v) { return Number(String(v??"0").replace(/[^0-9.-]/g,""))||0; }
function money(v) { return "$"+Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function status(v) { return String(v||"").toLowerCase().trim(); }
function clipboardText() { try{return Pasteboard.pasteString()||"";}catch(e){return "";} }
function cleanText(v) { return String(v??"").replace(/\r\n/g,"\n").replace(/\r/g,"\n").replace(/\\n/g,"\n").replace(/â€“|â€”|â€•/g,"-").replace(/â€˜|â€™/g,"'").replace(/â€œ|â€�/g,"\"").replace(/â€¦/g,"...").replace(/â€¢/g,"-").replace(/Â·/g," ").replace(/Â /g," ").replace(/Â/g,"").replace(/�/g,""); }
function esc(v) { return cleanText(v).replace(/[&<>\"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[ch])); }
function arr(v) { return Array.isArray(v)?v:[]; }
function cap(v) { return String(v).charAt(0).toUpperCase()+String(v).slice(1); }
function first(...vals) { for(const v of vals){if(v!==undefined&&v!==null&&String(v).trim()!=="")return v;}return ""; }
