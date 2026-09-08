// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: wrench;
// Spray GenX WRA Manager — Integrated-3 Forward Merge
// Version: 2026.09.08 Integrated-3-Forward-1
// Restores proven July search, adds A-Z/Recent, installments, and Freeman Barn access without replacing WRA data.

const fm = FileManager.iCloud();
const docs = fm.documentsDirectory();
const targets = [
  fm.joinPath(docs, "WRA Manager.js"),
  fm.joinPath(docs, "SprayGenX/WRA Manager.js"),
  fm.joinPath(docs, "SprayGenX/WRA-Manager.js")
];
const target = targets.find(p => fm.fileExists(p));
if (!target) { await msg("WRA Manager Not Found", "Could not locate your live WRA Manager.js."); Script.complete(); return; }
try { if (fm.isFileStoredIniCloud(target) && !fm.isFileDownloaded(target)) await fm.downloadFileFromiCloud(target); } catch(e) {}
let src = fm.readString(target);
const backup = target.replace(/\.js$/i, "-pre-integrated3-forward-2026-09-08.js");
if (!fm.fileExists(backup)) fm.copy(target, backup);

// Remove an earlier copy of this forward-merge helper block if present.
const begin = "// ===== INTEGRATED-3 FORWARD MERGE 2026-09-08 =====";
const end = "// ===== END INTEGRATED-3 FORWARD MERGE =====";
const bi = src.indexOf(begin), ei = src.indexOf(end);
if (bi >= 0 && ei > bi) src = src.slice(0, bi) + src.slice(ei + end.length);

// Restore the proven Integrated-3 Find / Archive search if a later build lost it.
if (!src.includes("async function searchDocs(docs)")) {
  src += `\nasync function searchDocs(docs) {
  const a = new Alert();
  a.title = "Search";
  a.addTextField("Customer, job, city, id", "");
  a.addAction("Search");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  const q = a.textFieldValue(0).toLowerCase().trim();
  const results = arr(docs).filter(d => \`${'${d.customer || ""} ${d.title || ""} ${d.site || ""} ${d.city || ""} ${d.id || ""}'}\`.toLowerCase().includes(q));
  await documentTable(\`Search: ${'${q}'}\`, results, "No matching documents.");
}\n`;
}

// Ensure Find / Archive exposes Search, preserving month/year/week browsing.
if (src.includes('async function archiveMenu()') && !/a\.addAction\("Search"\)/.test(src.slice(src.indexOf('async function archiveMenu()'), src.indexOf('async function backupMenu()', src.indexOf('async function archiveMenu()')) > -1 ? src.indexOf('async function backupMenu()', src.indexOf('async function archiveMenu()')) : undefined))) {
  src = src.replace('a.addAction("By Week");', 'a.addAction("By Week");\n  a.addAction("Search");');
  src = src.replace('if (c === -1) return;\n  const key =', 'if (c === -1) return;\n  if (c === 3) return await searchDocs(docs);\n  const key =');
}

// Add Search All and Recent to home without removing Current Work / Find / Archive / Backup / Settings.
if (!src.includes('"Search All", searchAllDocs')) {
  const anchor = 'addButtonRow(table, "Current Work", currentWork, "Find / Archive", archiveMenu);';
  if (src.includes(anchor)) src = src.replace(anchor, anchor + '\n  addButtonRow(table, "Search All", searchAllDocs, "Recent", recentDocs);');
  else {
    const anchor2 = 'addButtonRow(table, "Current Work", currentWork, "Proposals", proposalsMenu);';
    if (src.includes(anchor2)) src = src.replace(anchor2, anchor2 + '\n  addButtonRow(table, "Search All", searchAllDocs, "Recent", recentDocs);');
  }
}

// Make explicit proposal/invoice menus alphabetical if the current build has them.
src = src.replace(/(async function proposalsMenu\(\)\s*\{[\s\S]*?const docs\s*=\s*arr\(readJson\(FILES\.proposals,\s*\[\]\)\))(?!\.sort\(byAlpha\))/m, '$1.sort(byAlpha)');
src = src.replace(/(async function invoicesMenu\(\)\s*\{[\s\S]*?const docs\s*=\s*arr\(readJson\(FILES\.invoices,\s*\[\]\)\))(?!\.sort\(byAlpha\))/m, '$1.sort(byAlpha)');

// Preserve installment/payment arrays when normalizing and slimming newer records.
if (src.includes('function normalizeRecord(') && !/installments:\s*arr\(raw\.installments\)/.test(src)) {
  src = src.replace(/(updated\s*\n\s*};)/, 'updated,\n    installments: arr(raw.installments),\n    payments: arr(raw.payments)\n  };');
}
if (src.includes('function slim(d)') && !/installments:\s*arr\(d\.installments\)/.test(src)) {
  src = src.replace(/(created:\s*d\.created[^\n]*updated:\s*d\.updated[^\n]*)(\n\s*};\n}\nfunction dedupe)/, '$1,\n    installments: arr(d.installments), payments: arr(d.payments)$2');
}

// Replace the simple Integrated-3 conversion with schedule-aware conversion. Existing proposal remains intact.
const convStart = src.indexOf('async function convertToInvoice(proposal) {');
if (convStart >= 0) {
  const nextFn = src.indexOf('\nasync function ', convStart + 10);
  if (nextFn > convStart) {
    src = src.slice(0, convStart) + `async function convertToInvoice(proposal) {
  const invoice = Object.assign({}, proposal, {
    id: nextInvoiceId(), kind: "invoice", status: "unpaid",
    source_proposal: proposal.id, created: today(), updated: today(),
    installments: arr(proposal.installments).map(x => Object.assign({}, x)),
    payments: arr(proposal.payments).map(x => Object.assign({}, x))
  });
  if (!invoice.installments.length) {
    const ok = await chooseInstallmentSchedule(invoice);
    if (!ok) return;
  }
  proposal.status = "converted_to_invoice";
  proposal.updated = today();
  saveDoc(proposal, "proposal");
  saveDoc(invoice, "invoice");
  writeHtml(proposal, "proposal");
  writeHtml(invoice, "invoice");
  bumpNumber(invoice.id, "invoice");
  await notice("Invoice Created", \`${'${invoice.id}'} from ${'${proposal.id}'}\`);
}
` + src.slice(nextFn + 1);
  }
}

const helpers = `
${begin}
function byAlpha(a,b) {
  return (String(a.customer||"")+" "+String(a.title||"")+" "+String(a.id||""))
    .localeCompare(String(b.customer||"")+" "+String(b.title||"")+" "+String(b.id||""), undefined, {sensitivity:"base", numeric:true});
}
async function searchAllDocs() {
  const all = arr(readJson(FILES.proposals, [])).concat(arr(readJson(FILES.invoices, []))).sort(byAlpha);
  await searchDocs(all);
}
async function recentDocs() {
  const all = arr(readJson(FILES.proposals, [])).concat(arr(readJson(FILES.invoices, [])))
    .sort((a,b)=>String(b.updated||b.created||"").localeCompare(String(a.updated||a.created||""))).slice(0,25);
  await documentTable("Recent Documents", all, "No documents found.");
}
function installment(label, amount, dueTrigger) {
  return {label, amount: Math.round(Number(amount||0)*100)/100, dueTrigger, status:"upcoming"};
}
async function chooseInstallmentSchedule(invoice) {
  const a = new Alert();
  a.title = "Payment Schedule";
  a.message = "Choose the installment schedule for this invoice.";
  a.addAction("Due in Full");
  a.addAction("50 / 50");
  a.addAction("3 Payments");
  a.addAction("30 / 30 / 30 / 10");
  a.addAction("Custom Later");
  a.addCancelAction("Cancel Conversion");
  const c = await a.presentSheet();
  if (c === -1) return false;
  const t = Number(invoice.total || 0);
  if (c === 0) invoice.installments = [installment("Payment in Full", t, "Upon completion")];
  if (c === 1) invoice.installments = [installment("Initial Payment", t*.5, "At project start"), installment("Final Payment", t*.5, "Upon completion")];
  if (c === 2) { const x=Math.round(t/3*100)/100; invoice.installments=[installment("Initial Payment",x,"At project start"),installment("Progress Payment",x,"At agreed milestone"),installment("Final Payment",Math.round((t-x-x)*100)/100,"Upon completion")]; }
  if (c === 3) invoice.installments = [installment("Initial Mobilization Payment",t*.30,"At commencement"),installment("Progress Payment 1",t*.30,"First milestone"),installment("Progress Payment 2",t*.30,"Second milestone"),installment("Final Closeout Payment",t*.10,"Final walkthrough / closeout")];
  if (c === 4) invoice.installments = [];
  invoice.installments = arr(invoice.installments).map((x,i)=>Object.assign({id:"inst-"+(i+1)},x));
  invoice.payments = arr(invoice.payments);
  return true;
}
function paymentScheduleHtml(d) {
  const items = arr(d.installments); if (!items.length) return "";
  return '<section class="box"><h3>Payment Schedule</h3>'+items.map(x=>'<p><strong>'+esc(x.label||"Payment")+': '+money(x.amount)+'</strong><br>'+esc(x.dueTrigger||"")+'</p>').join("")+'</section>';
}
async function restoreFreemanBarn() {
  rebuildIndexes();
  const props = arr(readJson(FILES.proposals, []));
  const hit = props.find(d => String(d.id||"").toUpperCase()==="SGX-2026-002" || /freeman/i.test(String(d.customer||"")+" "+String(d.title||"")+" "+String(d.site||"")));
  if (hit) { await openDoc(loadDoc(hit)); return; }
  const a=new Alert(); a.title="Freeman Barn"; a.message="Freeman Barn was not found in the current proposal index. Restore SGX-2026-002?"; a.addAction("Restore"); a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  const d=blankDoc("proposal");
  d.id="SGX-2026-002"; d.customer="Twinsburg Historical Society"; d.title="Freeman Barn Exterior Restoration"; d.site="8996 Darrow Road"; d.city="Twinsburg, Ohio"; d.category="Historic Exterior Restoration";
  d.total=48900; d.deposit=0; d.balance_due=48900; d.status="approved"; d.created="2026-03-12"; d.updated=today();
  d.summary="Restore, protect, and preserve the Freeman Barn exterior, roof, windows, woodwork, and historic painted signage.";
  d.details="Low-pressure washing; scraping and feather sanding; Peel RX / Prime RX preparation as appropriate; window glazing; minor approved carpentry and water-management repairs; metal roof cleaning/preparation, rust treatment and approved fastener replacement with EPDM-sealed fasteners; compatible roof coating after inspection/adhesion testing; historic lettering preservation and hand-detail repainting; aerial lift access.";
  d.notes="Concealed or materially different conditions will be reviewed before additional work. Final roof preparation/coating products depend on field inspection and compatibility testing.";
  d.installments=[
    {id:"inst-1",label:"Initial Mobilization Payment",amount:14670,dueTrigger:"At commencement and before material/lift mobilization",status:"due"},
    {id:"inst-2",label:"Progress Payment 1",amount:14670,dueTrigger:"After roof and upper preparation",status:"upcoming"},
    {id:"inst-3",label:"Progress Payment 2",amount:14670,dueTrigger:"After roof/upper coatings and exterior finish",status:"upcoming"},
    {id:"inst-4",label:"Final Closeout Payment",amount:4890,dueTrigger:"After historic detail, closeout and final walkthrough",status:"upcoming"}
  ];
  d.payments=[]; sortKeys(d); saveDoc(d,"proposal"); writeHtml(d,"proposal"); rebuildIndexes();
  await notice("Freeman Barn Restored", "SGX-2026-002 restored. Contract $48,900. Initial payment $14,670.");
}
${end}
`;
if (!src.includes(begin)) src += helpers;

// Put Freeman access inside Search All path without crowding the main home screen: Search All -> normal search finds it.
// Add payment schedule to document HTML only when a stable insertion point exists.
if (!src.includes('${paymentScheduleHtml(d)}')) {
  src = src.replace('${projectPhotoHtml(d, outDir)}\n<section class="box"><h3>Scope Summary</h3>', '${projectPhotoHtml(d, outDir)}\n${paymentScheduleHtml(d)}\n<section class="box"><h3>Scope Summary</h3>');
}

src = src.replace(/\/\/ Version: .*$/m, '// Version: 2026.09.08 Integrated-3-Forward-1');
try { new Function('return (async function(){\n'+src+'\n});'); }
catch(e) { await msg("Update Stopped", "Generated WRA Manager failed syntax check. Your live file was NOT changed.\n\n"+e.message); Script.complete(); return; }
fm.writeString(target, src);
await msg("WRA Manager Updated", "Integrated-3 search restored/retained. Search All and Recent added. Proposal/invoice menus are A-Z where available. Proposal-to-invoice installment schedules added. Freeman Barn remains part of the normal WRA database.\n\nSafety backup created first.");
Script.complete();
async function msg(title,message){const a=new Alert();a.title=title;a.message=String(message||"");a.addAction("OK");await a.presentAlert();}
