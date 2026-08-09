// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: magic;
// Spray GenX WRA Manager
// Version: 2026.08.09 Canonical-1
// Image policy: real image files only. No embedded image data.

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
  templates: fm.joinPath(ROOT, "Templates")
};
const FILES = {
  settings: fm.joinPath(DIRS.data, "settings.json"),
  customers: fm.joinPath(DIRS.data, "customers.json"),
  proposals: fm.joinPath(DIRS.logs, "proposal_index.json"),
  invoices: fm.joinPath(DIRS.logs, "invoice_index.json"),
  activity: fm.joinPath(DIRS.logs, "activity_log.json")
};
const DEFAULTS = {
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
  Object.values(DIRS).forEach(ensureDir);
  const s = Object.assign({}, DEFAULTS, readJson(FILES.settings, {}));
  writeJson(FILES.settings, s);
  if (!fm.fileExists(FILES.customers)) writeJson(FILES.customers, []);
  if (!fm.fileExists(FILES.activity)) writeJson(FILES.activity, []);
  rebuildIndexes();
  syncNumbers();
}

async function home() {
  const table = new UITable();
  table.showSeparators = true;
  const h = new UITableRow();
  h.isHeader = true;
  h.height = 70;
  const st = stats();
  h.addText("Spray GenX WRA Manager", `${st.active} active · ${st.proposals} proposals · ${st.invoices} invoices`);
  table.addRow(h);
  addPair(table, "+ Proposal", () => docFlow(blankDoc("proposal"), "proposal"), "+ Invoice", () => docFlow(blankDoc("invoice"), "invoice"));
  addPair(table, "Current Work", currentWork, "Proposals", () => listDocs("Proposals", "proposal"));
  addPair(table, "Invoices", () => listDocs("Invoices", "invoice"), "Find / Archive", archiveMenu);
  addPair(table, "Rebuild Data", rebuildAction, "Backup", backupAll);
  addPair(table, "Settings", settingsMenu, "Storage Paths", showPaths);
  const close = new UITableRow();
  close.height = 48;
  close.addText("Close");
  table.addRow(close);
  await table.present();
}

function addPair(table, lt, lf, rt, rf) {
  const row = new UITableRow();
  row.height = 62;
  const l = row.addButton(lt); l.widthWeight = 50; l.onTap = lf;
  const r = row.addButton(rt); r.widthWeight = 50; r.onTap = rf;
  table.addRow(row);
}

async function docFlow(doc, kind) {
  const d = await editDoc(normalize(doc, kind), kind);
  if (!d) return;
  saveDoc(d, kind);
  writeHtml(d, kind);
  bumpNumber(d.id, kind);
  await afterSave(d, kind);
}

async function editDoc(d, kind) {
  const a = new Alert();
  a.title = d.path ? `Edit ${cap(kind)}` : `New ${cap(kind)}`;
  ["Customer","Contact / GC","Phone","Email","Job title","Site / address","City","Category"].forEach((label,i) => {
    const vals=[d.customer,d.contact,d.phone,d.email,d.title,d.site,d.city,d.category];
    a.addTextField(label, vals[i] || "");
  });
  a.addAction("Next"); a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return null;
  [d.customer,d.contact,d.phone,d.email,d.title,d.site,d.city,d.category] =
    Array.from({length:8},(_,i)=>clean(a.textFieldValue(i)));

  const p = new Alert();
  p.title = d.id; p.message = "Pricing";
  p.addTextField("Total price", String(d.total || ""));
  p.addTextField(kind === "invoice" ? "Paid" : "Deposit", String(d.deposit || ""));
  p.addTextField("Status", d.status || (kind === "invoice" ? "unpaid" : "open"));
  p.addAction("Next"); p.addCancelAction("Cancel");
  if (await p.presentAlert() === -1) return null;
  d.total = num(p.textFieldValue(0));
  d.deposit = num(p.textFieldValue(1));
  d.balance_due = Math.max(0, d.total - d.deposit);
  d.status = clean(p.textFieldValue(2)) || (kind === "invoice" ? "unpaid" : "open");

  d.summary = await textStep("Scope Summary", d.summary);
  d.details = await textStep("Scope Details", d.details);
  d.notes = await textStep("Notes / Exclusions", d.notes);
  await projectImageFlow(d);
  d.updated = today();
  sortKeys(d);
  return d;
}

async function textStep(title, current) {
  const a = new Alert();
  a.title = title;
  a.message = "Use Clipboard for multi-line text.";
  a.addTextField(title, current || "");
  a.addAction("Save"); a.addAction("Use Clipboard"); a.addAction("Blank"); a.addCancelAction("Keep Existing");
  const c = await a.presentAlert();
  if (c === -1) return current || "";
  if (c === 1) return clean(Pasteboard.pasteString() || "");
  if (c === 2) return "";
  return clean(a.textFieldValue(0));
}

async function projectImageFlow(d) {
  ensureMedia(d);
  const a = new Alert();
  a.title = "Project Image";
  a.message = hasProjectImage(d) ? "Keep, replace, or remove the project image." : "Optional: add a project image.";
  a.addAction("Keep / Skip");
  a.addAction("Choose Photo");
  a.addAction("Take Photo");
  if (hasProjectImage(d)) a.addAction("Remove Photo");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c < 1) return;
  if (c === 1 || c === 2) {
    try {
      const img = c === 1 ? await Photos.fromLibrary() : await Photos.fromCamera();
      const safe = slug(d.title || d.customer || "project");
      const path = fm.joinPath(DIRS.photos, `${d.id}-${safe}.jpg`);
      fm.writeImage(path, img);
      d.media.project_image_path = path;
    } catch (e) { await notice("Image Not Added", e); }
  } else if (c === 3 && hasProjectImage(d)) {
    d.media.project_image_path = "";
  }
}

async function afterSave(d, kind) {
  const a = new Alert();
  a.title = "Saved";
  a.message = `${d.id}\n${d.customer || "No customer"}\n${d.title || "No title"}\n${money(d.total)}`;
  a.addAction("Preview");
  a.addAction("Edit Again");
  if (kind === "proposal") a.addAction("Convert to Invoice");
  a.addAction("Done");
  const c = await a.presentSheet();
  if (c === 0) await QuickLook.present(writeHtml(d, kind));
  if (c === 1) await docFlow(d, kind);
  if (kind === "proposal" && c === 2) await convertToInvoice(d);
}

async function currentWork() {
  const docs = allIndexDocs().filter(d => !["archived","declined","paid","void","converted_to_invoice"].includes(status(d.status)));
  await documentTable("Current Work", docs);
}

async function listDocs(title, kind) {
  const docs = kind === "invoice" ? arr(readJson(FILES.invoices, [])) : arr(readJson(FILES.proposals, []));
  await documentTable(title, docs.sort(byUpdated));
}

async function documentTable(title, docs) {
  if (!docs.length) return notice(title, "No documents found.");
  const table = new UITable(); table.showSeparators = true;
  const h = new UITableRow(); h.isHeader = true; h.addText(title, `${docs.length} item(s)`); table.addRow(h);
  docs.forEach(meta => {
    const d = loadDoc(meta);
    const row = new UITableRow(); row.height = 82;
    const l = row.addText(`${d.kind === "invoice" ? "INVOICE" : "PROPOSAL"} ${d.id}`, [d.customer,d.title,d.status,d.site||d.city].filter(Boolean).join(" | "));
    l.widthWeight = 75;
    const r = row.addText(money(d.total), d.updated || d.created || ""); r.rightAligned(); r.widthWeight = 30;
    row.onSelect = async () => openDoc(d);
    table.addRow(row);
  });
  await table.present();
}

async function openDoc(d) {
  const kind = d.kind === "invoice" ? "invoice" : "proposal";
  const a = new Alert();
  a.title = `${kind.toUpperCase()} ${d.id}`;
  a.message = `${d.customer || "No customer"}\n${d.title || "No title"}\n${money(d.total)}`;
  a.addAction("Preview"); a.addAction("Edit"); a.addAction("Project Image"); a.addAction("Regenerate HTML");
  if (kind === "proposal") a.addAction("Convert to Invoice");
  a.addAction("Archive"); a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === 0) await QuickLook.present(writeHtml(d, kind));
  if (c === 1) await docFlow(d, kind);
  if (c === 2) { await projectImageFlow(d); saveDoc(d, kind); writeHtml(d, kind); }
  if (c === 3) { writeHtml(d, kind); await notice("HTML Regenerated", d.id); }
  if (kind === "proposal" && c === 4) await convertToInvoice(d);
  const archiveIndex = kind === "proposal" ? 5 : 4;
  if (c === archiveIndex) { d.status = "archived"; d.updated = today(); saveDoc(d, kind); }
}

async function convertToInvoice(p) {
  const inv = Object.assign({}, p, {
    id: nextId("invoice"), kind: "invoice", status: "unpaid",
    source_proposal: p.id, created: today(), updated: today(), path: ""
  });
  p.status = "converted_to_invoice"; p.updated = today();
  saveDoc(p, "proposal"); saveDoc(inv, "invoice");
  writeHtml(p, "proposal"); writeHtml(inv, "invoice");
  bumpNumber(inv.id, "invoice");
  await notice("Invoice Created", `${inv.id} from ${p.id}`);
}

async function archiveMenu() {
  const docs = allIndexDocs();
  const a = new Alert(); a.title = "Find / Archive"; a.addTextField("Customer, job, city, id", "");
  a.addAction("Search"); a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  const q = a.textFieldValue(0).toLowerCase().trim();
  await documentTable(`Search: ${q}`, docs.filter(d => JSON.stringify(d).toLowerCase().includes(q)));
}

async function rebuildAction() {
  const r = rebuildIndexes(); syncNumbers();
  await notice("Data Rebuilt", `${r.proposals} proposals\n${r.invoices} invoices\n${r.skipped} skipped`);
}

async function backupAll() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dst = fm.joinPath(DIRS.backups, stamp); ensureDir(dst);
  [DIRS.data,DIRS.logs,DIRS.proposals,DIRS.invoices,DIRS.photos,DIRS.templates].forEach(src => copyDir(src, fm.joinPath(dst, src.split("/").pop())));
  await notice("Backup Created", dst);
}

async function settingsMenu() {
  const s = getSettings();
  const a = new Alert(); a.title = "Settings";
  ["Company","Phone","Email","Service area","Tagline"].forEach((x,i)=>a.addTextField(x,[s.companyName,s.phone,s.email,s.serviceArea,s.tagline][i]||""));
  a.addAction("Save"); a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  s.companyName=clean(a.textFieldValue(0)); s.phone=clean(a.textFieldValue(1)); s.email=clean(a.textFieldValue(2)); s.serviceArea=clean(a.textFieldValue(3)); s.tagline=clean(a.textFieldValue(4));
  writeJson(FILES.settings,s);
}

async function showPaths() {
  await notice("Spray GenX Paths", `Root:\n${ROOT}\n\nTemplates:\n${DIRS.templates}\n\nPhotos:\n${DIRS.photos}\n\nProposals:\n${DIRS.proposals}\n\nInvoices:\n${DIRS.invoices}`);
}

function writeHtml(d, kind) {
  const s = getSettings();
  ensureMedia(d);
  const outDir = kind === "invoice" ? DIRS.invoices : DIRS.proposals;
  const path = fm.joinPath(outDir, `${d.id}.html`);
  const logoFile = materializeBrandImage(outDir, "logo", ["logo.png","Logo-SprayGenxLLC.PNG","Actual-Logo-SprayGenX.png","SprayGenX-Logo.png","SprayGenX-Logo.jpg","SprayGenX Logo.png"], "SprayGenX-Logo.png");
  const medallionFile = materializeBrandImage(outDir, "medallion", ["medallion.png","medallion.jpg","SprayGenX-Medallion.png","SprayGenX-Medallion.jpg","WRA-Medallion.png","WRA-Medallion.jpg"], "SprayGenX-Medallion.png");
  const logo = logoFile ? `<img class="brand-logo" src="${esc(logoFile)}" alt="Spray GenX LLC logo">` : "";
  const seal = medallionFile ? `<div class="seal"><img src="${esc(medallionFile)}" alt="Spray GenX medallion"></div>` : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#eee;color:#111;font:15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{background:#fff;max-width:820px;margin:0 auto;padding:28px 30px 64px;box-sizing:border-box;min-height:100vh}
.top{display:flex;justify-content:space-between;gap:22px;align-items:flex-start;border-bottom:3px solid #111;padding-bottom:14px;margin-bottom:14px}.brand{display:flex;gap:12px;max-width:56%;align-items:flex-start}.brand-logo{max-width:145px;max-height:70px;object-fit:contain}.brand h1{margin:0;font-size:22px}.brand p,.customer p,.docline p{margin:3px 0;color:#444}.customer{text-align:right;max-width:42%}.customer .name{font-size:19px;font-weight:800}.label,.box h3{text-transform:uppercase;font-size:12px;letter-spacing:.08em;color:#444;margin:0 0 7px}
.docline{display:flex;justify-content:space-between;gap:18px;margin-bottom:16px}.docline h2{margin:0;font-size:17px;text-transform:uppercase}.project-photo{margin:12px 0 16px}.project-photo img{width:100%;max-height:250px;object-fit:cover;border:1px solid #ddd;border-radius:9px}
.box{border:1px solid #ddd;border-radius:9px;padding:12px 14px;margin-bottom:14px}.scope{white-space:pre-wrap}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.total-box{display:grid;grid-template-columns:102px 1fr;gap:14px;align-items:center;min-height:112px}.seal{width:88px;height:88px;margin:0 auto}.seal img{width:100%;height:100%;object-fit:contain}.price{font-size:30px;font-weight:800;text-align:right;margin:0 0 10px}.total-copy p:not(.price){text-align:right;margin:6px 0}.terms{border-top:1px solid #ddd;margin-top:10px;padding-top:9px;font-size:12px}
@media screen and (max-width:650px){.top,.docline,.grid{display:block}.brand,.customer{max-width:none}.customer{text-align:left;margin-top:12px}.total-box{grid-template-columns:92px 1fr}.page{padding:22px}}
@media print{body{background:#fff}.page{max-width:none}.top,.docline{display:flex!important}.grid,.total-box{display:grid!important}.grid{grid-template-columns:1fr 1fr!important}.total-box{grid-template-columns:102px 1fr!important}}
</style></head><body><main class="page">
<section class="top"><div class="brand">${logo}<div><h1>${esc(s.companyName)}</h1><p>${esc(s.tagline)}</p><p>${esc(s.serviceArea)}</p><p>${esc([s.phone,s.email].filter(Boolean).join(" | "))}</p></div></div><div class="customer"><div class="label">Customer</div><div class="name">${esc(d.customer || "Customer")}</div><p>${esc([d.contact,d.phone,d.email].filter(Boolean).join(" | "))}</p><p>${esc([d.site,d.city].filter(Boolean).join(", "))}</p></div></section>
<section class="docline"><div><h2>${esc(kind)}</h2><p><strong>${esc(d.id)}</strong> | ${esc(d.created || today())} | ${esc(d.status || "open")}</p></div><div><p><strong>Project:</strong> ${esc(d.title)}</p><p>${esc(d.category || "")}</p></div></section>
${projectPhotoHtml(d,outDir)}
<section class="box"><h3>Scope Summary</h3><p class="scope">${esc(d.summary)}</p></section>
<section class="box"><h3>Scope Details</h3><p class="scope">${esc(d.details)}</p></section>
<section class="grid"><div class="box"><h3>Notes / Exclusions</h3><p class="scope">${esc(d.notes)}</p></div><div class="box"><h3>Total</h3><div class="total-box"><div>${seal}</div><div class="total-copy"><p class="price">${money(d.total)}</p><p>Deposit / Paid: ${money(d.deposit)}</p><p>Balance Due: ${money(d.balance_due)}</p></div></div></div></section>
<section class="terms"><p><strong>Terms:</strong> ${esc(s.defaultTerms)}</p><p><strong>Warranty:</strong> ${esc(s.warrantyNote)}</p></section>
</main></body></html>`;
  fm.writeString(path, html);
  return path;
}

function projectPhotoHtml(d,outDir){const f=materializeProjectImage(d,outDir);return f?`<section class="project-photo"><img src="${esc(f)}" alt="Project photo"></section>`:"";}
function materializeProjectImage(d,outDir){ensureMedia(d);const p=d.media.project_image_path;if(!p||!fm.fileExists(p))return"";try{downloadIfNeeded(p);const ext=/\.png$/i.test(p)?".png":".jpg";const n=`${d.id}-project-image${ext}`;const dst=fm.joinPath(outDir,n);if(fm.fileExists(dst))fm.remove(dst);fm.copy(p,dst);return n}catch(e){return""}}
function materializeBrandImage(outDir,type,candidates,outputName){for(const dir of [DIRS.templates,DIRS.photos,DIRS.root]){if(!fm.fileExists(dir))continue;let source="";for(const n of candidates){const p=fm.joinPath(dir,n);if(fm.fileExists(p)){source=p;break}}if(!source){try{const hit=fm.listContents(dir).find(n=>/\.(png|jpe?g)$/i.test(n)&&n.toLowerCase().includes(type));if(hit)source=fm.joinPath(dir,hit)}catch(e){}}if(source){try{downloadIfNeeded(source);const ext=/\.jpe?g$/i.test(source)?".jpg":".png";const dst=fm.joinPath(outDir,outputName.replace(/\.(png|jpe?g)$/i,ext));if(fm.fileExists(dst))fm.remove(dst);fm.copy(source,dst);return dst.split("/").pop()}catch(e){}}}return""}

function rebuildIndexes(){const p=[],i=[];let skipped=0;for(const [dir,kind] of [[DIRS.proposals,"proposal"],[DIRS.invoices,"invoice"],[DIRS.data,""]]){if(!fm.fileExists(dir))continue;for(const name of fm.listContents(dir)){if(!/\.json$/i.test(name)||["settings.json","customers.json"].includes(name))continue;const path=fm.joinPath(dir,name);const raw=readJson(path,null);if(!raw||typeof raw!=="object"){skipped++;continue}const d=normalize(raw,kind||detectKind(raw,name));d.path=path;(d.kind==="invoice"?i:p).push(slim(d))}}writeJson(FILES.proposals,dedupe(p).sort(byUpdated));writeJson(FILES.invoices,dedupe(i).sort(byUpdated));return{proposals:p.length,invoices:i.length,skipped}}
function normalize(raw,kind){const d=Object.assign(blankDoc(kind||detectKind(raw,"")),raw);d.kind=kind||d.kind||detectKind(raw,"");d.id=raw.id||raw.number||raw.docNo||nextId(d.kind);d.customer=typeof raw.customer==="string"?raw.customer:(raw.customer&&raw.customer.name)||raw.client||"";d.title=raw.title||raw.project||(raw.job&&raw.job.title)||"";d.site=raw.site||raw.address||(raw.job&&raw.job.site)||"";d.city=raw.city||(raw.job&&raw.job.city)||"";d.category=raw.category||(raw.job&&raw.job.category)||"";d.summary=raw.summary||(raw.scope&&raw.scope.summary)||"";d.details=raw.details||raw.description||(typeof raw.scope==="string"?raw.scope:"")||(raw.scope&&raw.scope.details)||"";d.notes=raw.notes||raw.exclusions||(raw.scope&&[raw.scope.notes,raw.scope.exclusions].filter(Boolean).join("\n\n"))||"";d.total=num(raw.total??raw.price??(raw.pricing&&raw.pricing.total));d.deposit=num(raw.deposit??raw.paid??(raw.pricing&&raw.pricing.deposit));d.balance_due=Math.max(0,num(raw.balance_due||d.total-d.deposit));d.status=raw.status||(d.kind==="invoice"?"unpaid":"open");d.created=raw.created||raw.date||today();d.updated=raw.updated||d.created;ensureMedia(d);sortKeys(d);return d}
function detectKind(raw,name){return /invoice|inv-/i.test(`${name} ${raw.kind||""} ${raw.id||""}`)?"invoice":"proposal"}
function blankDoc(kind){const d={id:nextId(kind),kind,customer:"",contact:"",phone:"",email:"",title:"",site:"",city:"",category:"",summary:"",details:"",notes:"",media:{project_image_path:""},total:0,deposit:0,balance_due:0,status:kind==="invoice"?"unpaid":"open",created:today(),updated:today()};sortKeys(d);return d}
function saveDoc(d,kind){d.kind=kind;ensureMedia(d);d.balance_due=Math.max(0,num(d.total)-num(d.deposit));sortKeys(d);const path=filePath(d,kind);d.path=path;writeJson(path,d);rebuildIndexes();log(`${kind}_saved`,d.id)}
function loadDoc(meta){const path=meta.path&&fm.fileExists(meta.path)?meta.path:filePath(meta,meta.kind||"proposal");return normalize(readJson(path,meta),meta.kind||detectKind(meta,""))}
function filePath(d,kind){return fm.joinPath(kind==="invoice"?DIRS.invoices:DIRS.proposals,`${d.id}.json`)}
function ensureMedia(d){const p=d&&d.media&&typeof d.media==="object"?d.media.project_image_path:"";d.media={project_image_path:p||""};return d}
function hasProjectImage(d){ensureMedia(d);return !!(d.media.project_image_path&&fm.fileExists(d.media.project_image_path))}
function nextId(kind){const s=getSettings();const n=kind==="invoice"?s.nextInvoiceNumber:s.nextProposalNumber;return `${kind==="invoice"?"INV":"SGX"}-${new Date().getFullYear()}-${String(n||1).padStart(3,"0")}`}
function bumpNumber(id,kind){const s=getSettings();const n=Number(String(id).match(/(\d+)$/)?.[1]||0)+1;if(kind==="invoice")s.nextInvoiceNumber=Math.max(num(s.nextInvoiceNumber),n);else s.nextProposalNumber=Math.max(num(s.nextProposalNumber),n);writeJson(FILES.settings,s)}
function syncNumbers(){const s=getSettings();const all=allIndexDocs();const pn=all.filter(d=>d.kind!=="invoice").map(d=>Number(String(d.id).match(/(\d+)$/)?.[1]||0));const inn=all.filter(d=>d.kind==="invoice").map(d=>Number(String(d.id).match(/(\d+)$/)?.[1]||0));s.nextProposalNumber=Math.max(num(s.nextProposalNumber)||1,1+Math.max(0,...pn));s.nextInvoiceNumber=Math.max(num(s.nextInvoiceNumber)||1,1+Math.max(0,...inn));writeJson(FILES.settings,s)}
function slim(d){return{id:d.id,kind:d.kind,path:d.path||"",customer:d.customer||"",title:d.title||"",site:d.site||"",city:d.city||"",status:d.status||"open",total:num(d.total),deposit:num(d.deposit),balance_due:num(d.balance_due),created:d.created||today(),updated:d.updated||d.created||today(),sort_year:d.sort_year,sort_month:d.sort_month,sort_week:d.sort_week}}
function allIndexDocs(){return arr(readJson(FILES.proposals,[])).concat(arr(readJson(FILES.invoices,[]))).sort(byUpdated)}
function stats(){const p=arr(readJson(FILES.proposals,[])),i=arr(readJson(FILES.invoices,[]));return{proposals:p.length,invoices:i.length,active:p.concat(i).filter(d=>!["archived","declined","paid","void","converted_to_invoice"].includes(status(d.status))).length}}
function dedupe(list){const m={};list.forEach(d=>m[d.id]=d);return Object.values(m)}
function byUpdated(a,b){return String(b.updated||"").localeCompare(String(a.updated||""))}
function getSettings(){return Object.assign({},DEFAULTS,readJson(FILES.settings,{}))}
function readJson(path,fallback){try{return fm.fileExists(path)?JSON.parse(fm.readString(path)):fallback}catch(e){return fallback}}
function writeJson(path,v){fm.writeString(path,JSON.stringify(v,null,2))}
function copyDir(src,dst){if(!fm.fileExists(src))return;ensureDir(dst);for(const n of fm.listContents(src)){const s=fm.joinPath(src,n),d=fm.joinPath(dst,n);if(fm.isDirectory(s))copyDir(s,d);else{if(fm.fileExists(d))fm.remove(d);fm.copy(s,d)}}}
function ensureDir(p){if(!fm.fileExists(p))fm.createDirectory(p,true)}
function downloadIfNeeded(p){try{if(fm.isFileDownloaded&&!fm.isFileDownloaded(p))fm.downloadFileFromiCloud(p)}catch(e){}}
function sortKeys(d){const x=d.created||today();d.sort_year=x.slice(0,4);d.sort_month=x.slice(0,7);d.sort_week=weekKey(new Date(x))}
function weekKey(date){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const start=new Date(Date.UTC(d.getUTCFullYear(),0,1));const w=Math.ceil((((d-start)/86400000)+1)/7);return`${d.getUTCFullYear()}-W${String(w).padStart(2,"0")}`}
function today(){return new Date().toISOString().slice(0,10)}
function num(v){return Number(String(v??"0").replace(/[^0-9.-]/g,""))||0}
function money(v){return"$"+num(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function status(v){return String(v||"").toLowerCase().trim()}
function clean(v){return String(v??"").replace(/\r\n/g,"\n").replace(/\r/g,"\n").replace(/\\n/g,"\n")}
function esc(v){return clean(v).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]))}
function arr(v){return Array.isArray(v)?v:[]}
function cap(v){return String(v).charAt(0).toUpperCase()+String(v).slice(1)}
function slug(v){return String(v||"project").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)||"project"}
function log(action,detail){const x=arr(readJson(FILES.activity,[]));x.push({at:new Date().toISOString(),action,detail});writeJson(FILES.activity,x.slice(-500))}
async function notice(title,msg){const a=new Alert();a.title=title;a.message=String(msg||"");a.addAction("OK");await a.presentAlert()}
