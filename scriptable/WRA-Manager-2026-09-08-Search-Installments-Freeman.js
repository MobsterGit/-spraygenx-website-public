// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: wrench;
// Spray GenX WRA Manager updater
// 2026-09-08: A-Z lists, Search All, Recent, installment schedules, Freeman Barn restore.

const fm = FileManager.iCloud();
const docs = fm.documentsDirectory();
const targets = [
  fm.joinPath(docs,"WRA Manager.js"),
  fm.joinPath(docs,"SprayGenX/WRA Manager.js"),
  fm.joinPath(docs,"SprayGenX/WRA-Manager.js")
];
const target = targets.find(p=>fm.fileExists(p));
if (!target) { await msg("WRA Manager Not Found","Could not locate your live WRA Manager.js."); Script.complete(); return; }
try { if (fm.isFileStoredIniCloud(target) && !fm.isFileDownloaded(target)) await fm.downloadFileFromiCloud(target); } catch(e){}
let src=fm.readString(target);
const backup=target.replace(/\.js$/i,"-pre-search-installments-2026-09-08.js");
if(!fm.fileExists(backup)) fm.copy(target,backup);

// Home-screen additions. Preserve the approved manager and inject only missing controls.
if(!src.includes('"Search All", searchAllDocs')) {
  src=src.replace(
    'addButtonRow(table, "Invoices", invoicesMenu, "Find / Archive", archiveMenu);',
    'addButtonRow(table, "Invoices", invoicesMenu, "Search All", searchAllDocs);\n  addButtonRow(table, "Recent", recentDocs, "Freeman Barn Restore", restoreFreemanBarn);\n  addButtonRow(table, "Find / Archive", archiveMenu, "Rebuild Data", rebuildAction);'
  );
  // Avoid duplicate Rebuild Data if it was on the following original row.
  src=src.replace('addButtonRow(table, "Rebuild Data", rebuildAction, "Backup", backupMenu);','addButtonRow(table, "Backup", backupMenu, "Settings", settingsMenu);');
  src=src.replace('addButtonRow(table, "Settings", settingsMenu, "Storage Paths", showPaths);','addButtonRow(table, "Storage Paths", showPaths, "Close", async()=>{});');
}

// Alphabetize proposal/invoice menus where their index is loaded.
src=src.replace(/const docs = arr\(readJson\(FILES\.proposals, \[\]\)\);/g,'const docs = arr(readJson(FILES.proposals, [])).sort(byAlpha);');
src=src.replace(/const docs = arr\(readJson\(FILES\.invoices, \[\]\)\);/g,'const docs = arr(readJson(FILES.invoices, [])).sort(byAlpha);');

// Convert-to-invoice hook: let user choose payment schedule after invoice creation.
if(src.includes('async function convertToInvoice(') && !src.includes('await chooseInstallmentSchedule(invoice)')) {
  src=src.replace(/(invoice\.balance_due\s*=\s*Math\.max\([^;]+;)/, '$1\n  await chooseInstallmentSchedule(invoice);');
}

// Add payment schedule to generated HTML immediately before Scope Summary.
if(src.includes('function writeHtml(d, kind)') && !src.includes('${paymentScheduleHtml(d)}')) {
  src=src.replace('${projectPhoto}\n<section class="box"><h3>Scope Summary</h3>', '${projectPhoto}\n${paymentScheduleHtml(d)}\n<section class="box"><h3>Scope Summary</h3>');
  src=src.replace('${projectPhotoHtml(d, outDir)}\n<section class="box"><h3>Scope Summary</h3>', '${projectPhotoHtml(d, outDir)}\n${paymentScheduleHtml(d)}\n<section class="box"><h3>Scope Summary</h3>');
}

const helpers=`

// ===== 2026-09-08 WRA SEARCH / SORT / INSTALLMENTS / FREEMAN =====
function byAlpha(a,b){return (String(a.customer||"")+" "+String(a.title||"")+" "+String(a.id||"")).localeCompare(String(b.customer||"")+" "+String(b.title||"")+" "+String(b.id||""),undefined,{sensitivity:"base",numeric:true});}

async function searchAllDocs(){
  const docs=arr(readJson(FILES.proposals,[])).concat(arr(readJson(FILES.invoices,[]))).sort(byAlpha);
  const a=new Alert(); a.title="Search All Documents"; a.message="Customer, project, address, city, proposal/invoice #"; a.addTextField("Search",""); a.addAction("Search"); a.addCancelAction("Cancel");
  if(await a.presentAlert()===-1)return;
  const q=a.textFieldValue(0).toLowerCase().trim();
  const r=docs.filter(d=>(String(d.id||"")+" "+String(d.customer||"")+" "+String(d.contact||"")+" "+String(d.title||"")+" "+String(d.site||"")+" "+String(d.city||"")+" "+String(d.status||"")).toLowerCase().includes(q));
  await documentTable("Search: "+q,r,"No matching documents.");
}

async function recentDocs(){
  const docs=arr(readJson(FILES.proposals,[])).concat(arr(readJson(FILES.invoices,[]))).sort((a,b)=>String(b.updated||b.created||"").localeCompare(String(a.updated||a.created||""))).slice(0,20);
  await documentTable("Recent Documents",docs,"No documents found.");
}

async function chooseInstallmentSchedule(invoice){
  const a=new Alert(); a.title="Payment Schedule"; a.message="Choose how this contract will be billed.";
  a.addAction("Due in Full"); a.addAction("50 / 50"); a.addAction("3 Payments"); a.addAction("30 / 30 / 30 / 10"); a.addAction("Custom Later"); a.addCancelAction("Skip");
  const c=await a.presentSheet(); if(c===-1)return invoice;
  const total=Number(invoice.total||0); let p=[];
  if(c===0)p=[inst("Payment in Full",total,"Upon completion")];
  if(c===1)p=[inst("Initial Payment",total*.5,"At project start"),inst("Final Payment",total*.5,"Upon completion")];
  if(c===2){const x=Math.round(total/3*100)/100;p=[inst("Initial Payment",x,"At project start"),inst("Progress Payment",x,"At agreed milestone"),inst("Final Payment",Math.round((total-x-x)*100)/100,"Upon completion")];}
  if(c===3)p=[inst("Initial Mobilization Payment",total*.30,"At commencement of work"),inst("Progress Payment 1",total*.30,"Completion of first milestone"),inst("Progress Payment 2",total*.30,"Completion of second milestone"),inst("Final Closeout Payment",total*.10,"Final walkthrough / closeout")];
  invoice.installments=p.map((x,i)=>Object.assign({id:"inst-"+(i+1)},x)); return invoice;
}
function inst(label,amount,dueTrigger){return{label:label,amount:Math.round(Number(amount||0)*100)/100,dueTrigger:dueTrigger,status:"upcoming"};}
function paymentScheduleHtml(d){const items=arr(d.installments);if(!items.length)return"";return '<section class="box"><h3>Payment Schedule</h3>'+items.map(x=>'<p><strong>'+esc(x.label||"Payment")+': '+money(x.amount)+'</strong><br>'+esc(x.dueTrigger||"")+' - '+esc(x.status||"upcoming")+'</p>').join("")+'</section>';}

async function restoreFreemanBarn(){
  rebuildIndexes();
  const props=arr(readJson(FILES.proposals,[]));
  const existing=props.find(d=>/freeman/i.test(String(d.title||"")+" "+String(d.customer||"")+" "+String(d.site||"")));
  if(existing){await documentTable("Freeman Barn",[existing],"Freeman Barn found.");return;}
  const a=new Alert();a.title="Freeman Barn Proposal Missing";a.message="The index does not contain the Freeman Barn proposal. Rebuild SGX-2026-002 now?";a.addAction("Restore SGX-2026-002");a.addCancelAction("Cancel");if(await a.presentAlert()===-1)return;
  const d=blankDoc("proposal");
  d.id="SGX-2026-002";d.customer="Twinsburg Historical Society";d.contact="";d.phone="";d.email="";d.title="Freeman Barn Exterior Restoration";d.site="8996 Darrow Road";d.city="Twinsburg, Ohio";d.category="Historic Exterior Restoration";d.total=48900;d.deposit=0;d.balance_due=48900;d.status="approved";d.created="2026-03-12";d.updated=today();
  d.summary="Restore, protect, and preserve the exterior of the Freeman Barn through proper surface preparation, durable coating systems, roof restoration, window glazing, minor carpentry, and preservation of the historic painted signage.";
  d.details="Wood siding and trim restoration; Peel RX/Prime RX preparation system as required; low-pressure washing; scraping, sanding and preparation; sealing open joints; window glazing; exterior finish coatings; metal roof cleaning and preparation; rust treatment; inspection and replacement of approved suspect fasteners with EPDM-sealed fasteners; roof coating system after compatibility/adhesion testing; drip-edge and minor carpentry work within approved scope; historic lettering preservation and hand-detail repainting; aerial lift access.";
  d.notes="Wood repairs necessary to complete the approved restoration scope are included. Existing silver roof coating will be assessed at start-up and final roof preparation/coating products selected after inspection and adhesion testing. Unforeseen conditions materially changing scope will be reviewed with the Society before proceeding.";
  d.installments=[
    {id:"inst-1",label:"Initial Mobilization Payment",amount:14670,dueTrigger:"Due at commencement of work and prior to material/lift mobilization",status:"due"},
    {id:"inst-2",label:"Progress Payment 1",amount:14670,dueTrigger:"Completion of roof and upper-preparation items",status:"upcoming"},
    {id:"inst-3",label:"Progress Payment 2",amount:14670,dueTrigger:"Completion of roof/upper coatings and exterior finish work",status:"upcoming"},
    {id:"inst-4",label:"Final Closeout Payment",amount:4890,dueTrigger:"Completion of historic detail, closeout and final walkthrough",status:"upcoming"}
  ];
  sortKeys(d);saveDoc(d,"proposal");await writeHtml(d,"proposal");rebuildIndexes();await notice("Freeman Barn Restored","SGX-2026-002 restored to the WRA Manager. Contract: $48,900.00. Initial payment: $14,670.00.");
}
// ===== END 2026-09-08 UPDATE =====
`;

if(!src.includes('2026-09-08 WRA SEARCH / SORT / INSTALLMENTS / FREEMAN')) src += helpers;
src=src.replace(/\/\/ Version: .*$/m,'// Version: 2026.09.08 Search-Sort-Installments-Freeman');

try{new Function('return (async function(){\n'+src+'\n});');}catch(e){await msg("Update Stopped","Generated WRA Manager failed syntax check. Original file was not changed.\n\n"+e.message);Script.complete();return;}
fm.writeString(target,src);
await msg("WRA Manager Updated","Added A-Z document sorting, Search All, Recent Documents, installment schedules, and Freeman Barn restore.\n\nA safety backup was created before the update.");
Script.complete();

async function msg(title,message){const a=new Alert();a.title=title;a.message=message;a.addAction("OK");await a.presentAlert();}
