// Spray GenX Proposal Visual Builder
// Version: 2026.07.06 Visual-1
// Purpose: Fast Scriptable proposal builder with large job photo, clean card layout, UTF-8 safe text, price block, and bottom-right seal.

const fm = FileManager.iCloud();
const ROOT = fm.joinPath(fm.documentsDirectory(), "SprayGenX");
const DIRS = {
  root: ROOT,
  proposals: fm.joinPath(ROOT, "Proposals"),
  images: fm.joinPath(ROOT, "Images"),
  data: fm.joinPath(ROOT, "Data")
};
const SETTINGS_PATH = fm.joinPath(DIRS.data, "visual_proposal_settings.json");
const INDEX_PATH = fm.joinPath(DIRS.data, "visual_proposal_index.json");

const DEFAULT_SETTINGS = {
  companyName: "Spray GenX LLC",
  tagline: "Painting & Refinishing",
  serviceArea: "Northeast Ohio",
  phone: "",
  email: "",
  nextProposalNumber: 1,
  defaultTerms: "Payment due upon completion unless otherwise noted.",
  warrantyNote: "Warranty applies to listed scope and assumes sound existing substrates unless otherwise noted.",
  sealTop: "SPRAY\nGENX LLC",
  sealBottom: "LLC / Business ID"
};

setup();
await mainMenu();

function setup() {
  Object.values(DIRS).forEach(ensureDir);
  if (!fm.fileExists(SETTINGS_PATH)) writeJson(SETTINGS_PATH, DEFAULT_SETTINGS);
  if (!fm.fileExists(INDEX_PATH)) writeJson(INDEX_PATH, []);
}

async function mainMenu() {
  const a = new Alert();
  a.title = "Spray GenX Proposal";
  a.message = "Visual proposal builder";
  a.addAction("New Visual Proposal");
  a.addAction("Open Recent");
  a.addAction("Settings");
  a.addCancelAction("Close");
  const c = await a.presentSheet();
  if (c === 0) await newProposal();
  if (c === 1) await openRecent();
  if (c === 2) await settingsMenu();
}

async function newProposal(seed) {
  const d = seed || blankProposal();
  const saved = await editProposal(d);
  if (!saved) return;

  const imgChoice = new Alert();
  imgChoice.title = "Job Photo";
  imgChoice.message = saved.imagePath ? "Replace the current job image?" : "Add a large job image like the sample?";
  imgChoice.addAction(saved.imagePath ? "Keep Existing" : "Skip Image");
  imgChoice.addAction("Choose Photo");
  imgChoice.addCancelAction("Cancel Save");
  const ic = await imgChoice.presentSheet();
  if (ic === -1) return;
  if (ic === 1) saved.imagePath = await chooseAndSaveImage(saved.id);

  saveProposal(saved);
  const htmlPath = writeProposalHtml(saved);
  await afterSave(saved, htmlPath);
}

async function editProposal(d) {
  const s = getSettings();
  const a = new Alert();
  a.title = d.id;
  a.message = "Customer / Project";
  [
    ["Customer", d.customer],
    ["Contact / GC", d.contact],
    ["Phone", d.phone],
    ["Email", d.email],
    ["Project", d.project],
    ["Address", d.address],
    ["City / State / ZIP", d.city],
    ["Category", d.category]
  ].forEach(([label, val]) => a.addTextField(label, val || ""));
  a.addAction("Next");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return null;

  d.customer = clean(a.textFieldValue(0));
  d.contact = clean(a.textFieldValue(1));
  d.phone = clean(a.textFieldValue(2));
  d.email = clean(a.textFieldValue(3));
  d.project = clean(a.textFieldValue(4));
  d.address = clean(a.textFieldValue(5));
  d.city = clean(a.textFieldValue(6));
  d.category = clean(a.textFieldValue(7));

  const p = new Alert();
  p.title = "Pricing";
  p.addTextField("Price / Total", String(d.total || ""));
  p.addTextField("Deposit", String(d.deposit || ""));
  p.addTextField("Status", d.status || "open");
  p.addAction("Next");
  p.addCancelAction("Cancel");
  if (await p.presentAlert() === -1) return null;
  d.total = num(p.textFieldValue(0));
  d.deposit = num(p.textFieldValue(1));
  d.balance = Math.max(0, d.total - d.deposit);
  d.status = clean(p.textFieldValue(2)) || "open";

  d.summary = await textBox("Scope Summary", "Short summary", d.summary);
  d.details = await textBox("Scope Details", "Detailed scope", d.details);
  d.notes = await textBox("Exclusions / Notes", "Conditions, exclusions, extra repair notes", d.notes);
  d.updated = today();
  return d;
}

async function textBox(title, placeholder, current) {
  const a = new Alert();
  a.title = title;
  a.addTextField(placeholder, clean(current || ""));
  a.addAction("Save");
  a.addAction("Blank");
  a.addCancelAction("Keep Existing");
  const c = await a.presentAlert();
  if (c === -1) return clean(current || "");
  if (c === 1) return "";
  return clean(a.textFieldValue(0));
}

async function chooseAndSaveImage(id) {
  try {
    const img = await Photos.fromLibrary();
    const path = fm.joinPath(DIRS.images, `${id}-job-photo.jpg`);
    fm.writeImage(path, img);
    return path;
  } catch (e) {
    await notice("Image Not Added", String(e));
    return "";
  }
}

async function afterSave(d, htmlPath) {
  const a = new Alert();
  a.title = "Saved";
  a.message = `${d.id}\n${d.customer}\n${d.project}\n${money(d.total)}`;
  a.addAction("Preview");
  a.addAction("Edit Again");
  a.addAction("Copy HTML Path");
  a.addAction("Done");
  const c = await a.presentSheet();
  if (c === 0) await QuickLook.present(htmlPath);
  if (c === 1) await newProposal(d);
  if (c === 2) { Pasteboard.copy(htmlPath); await notice("Copied", htmlPath); }
}

async function openRecent() {
  const list = readJson(INDEX_PATH, []).sort((a,b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 30);
  if (!list.length) return await notice("Recent", "No proposals saved yet.");
  const a = new Alert();
  a.title = "Recent Proposals";
  list.forEach(d => a.addAction(`${d.id} - ${d.customer || d.project || "Untitled"}`));
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === -1) return;
  const d = readJson(fm.joinPath(DIRS.proposals, `${list[c].id}.json`), null);
  if (!d) return await notice("Missing", "Could not open the JSON record.");
  const p = writeProposalHtml(d);
  await QuickLook.present(p);
}

async function settingsMenu() {
  const s = getSettings();
  const a = new Alert();
  a.title = "Settings";
  a.addTextField("Company", s.companyName || "");
  a.addTextField("Tagline", s.tagline || "");
  a.addTextField("Service area", s.serviceArea || "");
  a.addTextField("Phone", s.phone || "");
  a.addTextField("Email", s.email || "");
  a.addTextField("Seal top", s.sealTop || "");
  a.addTextField("Seal bottom", s.sealBottom || "");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  s.companyName = clean(a.textFieldValue(0));
  s.tagline = clean(a.textFieldValue(1));
  s.serviceArea = clean(a.textFieldValue(2));
  s.phone = clean(a.textFieldValue(3));
  s.email = clean(a.textFieldValue(4));
  s.sealTop = clean(a.textFieldValue(5));
  s.sealBottom = clean(a.textFieldValue(6));
  writeJson(SETTINGS_PATH, s);
}

function blankProposal() {
  const s = getSettings();
  const id = `PROP-${new Date().getFullYear()}-${String(s.nextProposalNumber || 1).padStart(4, "0")}`;
  s.nextProposalNumber = Number(s.nextProposalNumber || 1) + 1;
  writeJson(SETTINGS_PATH, s);
  return {
    id,
    type: "proposal",
    customer: "",
    contact: "",
    phone: "",
    email: "",
    project: "",
    address: "",
    city: "",
    category: "",
    summary: "",
    details: "",
    notes: "",
    total: 0,
    deposit: 0,
    balance: 0,
    status: "open",
    imagePath: "",
    created: today(),
    updated: today()
  };
}

function saveProposal(d) {
  d.balance = Math.max(0, Number(d.total || 0) - Number(d.deposit || 0));
  d.updated = today();
  writeJson(fm.joinPath(DIRS.proposals, `${d.id}.json`), d);
  const list = readJson(INDEX_PATH, []).filter(x => x.id !== d.id);
  list.push({ id: d.id, customer: d.customer, project: d.project, total: d.total, updated: d.updated });
  writeJson(INDEX_PATH, list);
}

function writeProposalHtml(d) {
  const s = getSettings();
  const path = fm.joinPath(DIRS.proposals, `${d.id}.html`);
  const docLabel = d.type === "invoice" ? "INVOICE" : "PROPOSAL";
  const img = imageHtml(d.imagePath);
  const html = `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.id)} - ${docLabel}</title>
<style>
  @page{size:letter;margin:0}
  *{box-sizing:border-box}
  body{margin:0;background:#f2f2f2;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:16px;line-height:1.38}
  .page{width:8.5in;min-height:11in;margin:0 auto;background:#fff;padding:.58in .52in .72in;position:relative;overflow:hidden}
  .top{display:grid;grid-template-columns:1fr 1fr;gap:24px;border-bottom:4px solid #111;padding-bottom:24px;margin-bottom:26px}
  .brand h1{margin:0 0 8px;font-size:32px;line-height:1;font-weight:900;letter-spacing:-.03em}.brand p{margin:3px 0;color:#555;font-size:16px}
  .doc{text-align:right}.doc h2{margin:0 0 8px;font-size:26px;line-height:1;text-transform:uppercase;letter-spacing:.02em}.doc p{margin:5px 0;font-size:16px}.status{font-size:15px;color:#222}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.box{border:1px solid #ddd;border-radius:8px;padding:16px 16px;margin-bottom:22px;break-inside:avoid;background:#fff}.box h3{margin:0 0 16px;text-transform:uppercase;font-size:13px;letter-spacing:.14em}.box p{margin:0}.strong{font-weight:800}
  .hero-img{width:100%;height:290px;object-fit:cover;border-radius:8px;margin:0 0 24px;border:1px solid #d8d8d8;display:block}.summary{min-height:68px}.scope{white-space:pre-wrap}.scope-details{min-height:160px}.notes-price{align-items:stretch}.notes-price .box{min-height:250px}.price-card h3{margin-bottom:30px}.price{font-size:31px;font-weight:900;text-align:right;margin:0 0 30px}.price-lines p{font-size:16px;margin:0 0 18px}.terms{border-top:1px solid #ddd;margin-top:4px;padding-top:26px;padding-right:155px;font-size:13px;line-height:1.35}.terms p{margin:0 0 12px}.seal{position:absolute;right:.48in;bottom:.47in;width:1.18in;height:1.18in;border:2px solid #111;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;transform:rotate(-5deg);background:rgba(255,255,255,.95)}.seal:before{content:"";position:absolute;inset:7px;border:1px solid #111;border-radius:50%}.seal-inner{position:relative;z-index:1;font-weight:900;font-size:11px;line-height:.95;text-transform:uppercase}.seal-small{display:block;margin-top:5px;font-size:6.5px;font-weight:700;line-height:1.05;text-transform:none}
  @media(max-width:760px){.page{width:100%;min-height:100vh;padding:32px 22px 110px}.top,.grid{grid-template-columns:1fr}.doc{text-align:left}.hero-img{height:220px}.terms{padding-right:0}.seal{right:22px;bottom:22px}}
</style>
</head>
<body>
<main class="page">
  <section class="top">
    <div class="brand"><h1>${esc(s.companyName)}</h1><p>${esc(s.tagline)}</p><p>${esc(s.serviceArea)}</p></div>
    <div class="doc"><h2>${docLabel}</h2><p><strong>${esc(d.id)}</strong></p><p>${esc(d.created || today())}</p><p class="status">Status: ${esc(d.status || "open")}</p></div>
  </section>

  <section class="grid">
    <div class="box"><h3>Customer</h3><p><span class="strong">${esc(d.customer)}</span><br>${esc(d.contact)}<br>${esc(d.phone)}<br>${esc(d.email)}</p></div>
    <div class="box"><h3>Project</h3><p><span class="strong">${esc(d.project)}</span><br>${esc(d.address)}<br>${esc(d.city)}<br>${esc(d.category)}</p></div>
  </section>

  ${img}

  <section class="box summary"><h3>Scope Summary</h3><p class="scope">${esc(d.summary)}</p></section>
  <section class="box scope-details"><h3>Scope Details</h3><p class="scope">${esc(d.details)}</p></section>

  <section class="grid notes-price">
    <div class="box"><h3>Exclusions / Notes</h3><p class="scope">${esc(d.notes)}</p></div>
    <div class="box price-card"><h3>Price</h3><div class="price">${moneyNoCents(d.total)}</div><div class="price-lines"><p>Deposit: ${moneyNoCents(d.deposit)}</p><p>Balance: ${moneyNoCents(d.balance)}</p></div></div>
  </section>

  <section class="terms"><p><strong>Terms:</strong> ${esc(s.defaultTerms)}</p><p><strong>Warranty:</strong> ${esc(s.warrantyNote)}</p></section>
  <div class="seal"><div class="seal-inner">${esc(s.sealTop).replace(/\n/g,"<br>")}<span class="seal-small">${esc(s.sealBottom)}</span></div></div>
</main>
</body>
</html>`;
  fm.writeString(path, html);
  return path;
}

function imageHtml(path) {
  if (!path || !fm.fileExists(path)) return "";
  const img = fm.readImage(path);
  if (!img) return "";
  const b64 = Data.fromJPEG(img, 0.86).toBase64String();
  return `<img class="hero-img" src="data:image/jpeg;base64,${b64}" alt="Project photo">`;
}

function getSettings() { return Object.assign({}, DEFAULT_SETTINGS, readJson(SETTINGS_PATH, {})); }
function ensureDir(p) { if (!fm.fileExists(p)) fm.createDirectory(p, true); }
function readJson(path, fallback) { try { return fm.fileExists(path) ? JSON.parse(fm.readString(path)) : fallback; } catch(e) { return fallback; } }
function writeJson(path, value) { fm.writeString(path, JSON.stringify(value, null, 2)); }
function today() { return new Date().toISOString().slice(0,10); }
function num(v) { return Number(String(v ?? "0").replace(/[^0-9.-]/g, "")) || 0; }
function moneyNoCents(v) { return "$" + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
function money(v) { return "$" + Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function clean(v) {
  return String(v ?? "")
    .replace(/\u00e2\u20ac\u00a2/g, "-")
    .replace(/\u00e2\u20ac\u201c/g, "-")
    .replace(/\u00e2\u20ac\u201d/g, "-")
    .replace(/\u00e2\u20ac\u02dc|\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac\u0153|\u00e2\u20ac\ufffd/g, '"')
    .replace(/\u00c2/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2022]/g, "-")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .trim();
}
function esc(v) { return clean(v).replace(/[&<>\"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch])); }
async function notice(title, message) { const a = new Alert(); a.title = title; a.message = String(message || ""); a.addAction("OK"); await a.presentAlert(); }
