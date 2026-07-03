// Spray GenX WRA Manager for Scriptable
// Proposal + Invoice Manager + Project Image Watermark Test
// Version: 2026.07.03-image-test
// Runs locally in Scriptable using iCloud Drive storage.

const fm = FileManager.iCloud();
const ROOT = fm.joinPath(fm.documentsDirectory(), "SprayGenX");

const DIRS = {
  root: ROOT,
  proposals: fm.joinPath(ROOT, "Proposals"),
  invoices: fm.joinPath(ROOT, "Invoices"),
  data: fm.joinPath(ROOT, "Data"),
  logs: fm.joinPath(ROOT, "Logs"),
  templates: fm.joinPath(ROOT, "Templates"),
  archive: fm.joinPath(ROOT, "Archive"),
  backups: fm.joinPath(ROOT, "Backups"),
  exports: fm.joinPath(ROOT, "Exports"),
  photos: fm.joinPath(ROOT, "Photos")
};

const FILES = {
  proposalIndex: fm.joinPath(DIRS.logs, "proposal_index.json"),
  invoiceIndex: fm.joinPath(DIRS.logs, "invoice_index.json"),
  documentLog: fm.joinPath(DIRS.logs, "document_log.json"),
  settings: fm.joinPath(DIRS.data, "settings.json")
};

const DEFAULT_SETTINGS = {
  companyName: "Spray GenX LLC",
  tagline: "Painting & Refinishing",
  serviceArea: "Northeast Ohio",
  ownerName: "",
  phone: "",
  email: "",
  defaultTerms: "Payment due upon completion unless otherwise noted.",
  warrantyNote: "Warranty terms apply only to listed scope, surface condition, material compatibility, and manufacturer limits.",
  nextProposalNumber: 1,
  nextInvoiceNumber: 1
};

ensureSetup();
await mainMenu();

function ensureSetup() {
  Object.values(DIRS).forEach(ensureDir);
  if (!fm.fileExists(FILES.settings)) writeJson(FILES.settings, DEFAULT_SETTINGS);
  if (!fm.fileExists(FILES.proposalIndex)) writeJson(FILES.proposalIndex, []);
  if (!fm.fileExists(FILES.invoiceIndex)) writeJson(FILES.invoiceIndex, []);
  if (!fm.fileExists(FILES.documentLog)) writeJson(FILES.documentLog, []);
}

function ensureDir(path) {
  if (!fm.fileExists(path)) fm.createDirectory(path, true);
}

async function mainMenu() {
  let done = false;
  while (!done) {
    const a = new Alert();
    a.title = "Spray GenX Manager";
    a.message = "Proposal + invoice control center\nImage watermark test build";
    a.addAction("Create Proposal");
    a.addAction("Open Current Documents");
    a.addAction("Archive Browser");
    a.addAction("Backups");
    a.addAction("Settings");
    a.addCancelAction("Done");
    const choice = await a.presentSheet();
    if (choice === -1) done = true;
    if (choice === 0) await createProposalFlow();
    if (choice === 1) await currentDocumentsFlow();
    if (choice === 2) await archiveBrowserFlow();
    if (choice === 3) await backupFlow();
    if (choice === 4) await settingsFlow();
  }
}

async function createProposalFlow(existing) {
  const settings = getSettings();
  const proposal = existing || newProposal(settings);
  const edited = await proposalForm(proposal, "Proposal");
  if (!edited) return;

  const proposalPath = fm.joinPath(DIRS.proposals, `${edited.manager.proposal_id}.json`);
  writeJson(proposalPath, edited);
  upsertIndex(FILES.proposalIndex, indexEntry(edited, proposalPath));
  bumpProposalNumber(edited.manager.proposal_id);
  logDocument("proposal_saved", edited.manager.proposal_id, proposalPath);

  const htmlPath = writeDocumentHtml(edited, "proposal");
  await documentActions(edited, proposalPath, htmlPath, "proposal");
}

function newProposal(settings) {
  const id = `PROP-${new Date().getFullYear()}-${String(settings.nextProposalNumber || 1).padStart(4, "0")}`;
  const today = todayIso();
  return {
    manager: {
      proposal_id: id,
      invoice_id: "",
      job_id: "",
      status: "open",
      payment_status: "not_billable_yet",
      created_date: today,
      updated_date: today,
      accepted_date: "",
      converted_to_invoice_date: "",
      sort_year: today.slice(0, 4),
      sort_month: today.slice(0, 7),
      sort_week: weekKey(new Date())
    },
    customer: { name: "", contact: "", phone: "", email: "", address: "", city: "", state: "OH", zip: "" },
    job: { title: "", site: "", city: "", state: "OH", category: "", start_date: "", completion_target: "" },
    scope: { summary: "", details: "", exclusions: "", notes: "" },
    pricing: { total: 0, deposit: 0, tax_exempt: false },
    media: { project_image_path: "", project_image_mode: "watermark", project_image_opacity: 0.10 },
    terms: settings.defaultTerms,
    warranty: settings.warrantyNote
  };
}

function ensureMedia(doc) {
  if (!doc.media) doc.media = {};
  if (doc.media.project_image_path === undefined) doc.media.project_image_path = "";
  if (!doc.media.project_image_mode) doc.media.project_image_mode = "watermark";
  if (!doc.media.project_image_opacity) doc.media.project_image_opacity = 0.10;
  return doc;
}

async function proposalForm(doc, label) {
  ensureMedia(doc);
  const form = new Alert();
  form.title = `${label}: ${doc.manager.proposal_id || doc.manager.invoice_id}`;
  form.message = "Fill the key fields. Scope and notes can be pasted as long text.";
  form.addTextField("Customer", doc.customer.name || "");
  form.addTextField("Contact", doc.customer.contact || "");
  form.addTextField("Phone", doc.customer.phone || "");
  form.addTextField("Email", doc.customer.email || "");
  form.addTextField("Job title", doc.job.title || "");
  form.addTextField("Site / address", doc.job.site || "");
  form.addTextField("City", doc.job.city || "");
  form.addTextField("Category", doc.job.category || "");
  form.addTextField("Total price", String(doc.pricing.total || ""));
  form.addTextField("Deposit", String(doc.pricing.deposit || ""));
  form.addAction("Next: Scope");
  form.addCancelAction("Cancel");
  const res = await form.presentAlert();
  if (res === -1) return null;

  doc.customer.name = form.textFieldValue(0).trim();
  doc.customer.contact = form.textFieldValue(1).trim();
  doc.customer.phone = form.textFieldValue(2).trim();
  doc.customer.email = form.textFieldValue(3).trim();
  doc.job.title = form.textFieldValue(4).trim();
  doc.job.site = form.textFieldValue(5).trim();
  doc.job.city = form.textFieldValue(6).trim();
  doc.job.category = form.textFieldValue(7).trim();
  doc.pricing.total = numberValue(form.textFieldValue(8));
  doc.pricing.deposit = numberValue(form.textFieldValue(9));

  doc.scope.summary = await largeText("Scope summary", doc.scope.summary || "");
  doc.scope.details = await largeText("Scope details", doc.scope.details || "");
  doc.scope.exclusions = await largeText("Exclusions", doc.scope.exclusions || "");
  doc.scope.notes = await largeText("Notes", doc.scope.notes || "");
  await projectImageFlow(doc);
  doc.manager.updated_date = todayIso();
  return doc;
}

async function projectImageFlow(doc) {
  ensureMedia(doc);
  const a = new Alert();
  a.title = "Project Image";
  a.message = doc.media.project_image_path ? "A project image is attached. Use it as a faded proposal background, small photo, or remove it." : "Optional: add a building/job photo to the proposal.";
  a.addAction("Keep / Skip");
  a.addAction("Choose Photo");
  a.addAction("Take Photo");
  if (doc.media.project_image_path) a.addAction("Remove Photo");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === -1 || c === 0) return doc;
  if (c === 1 || c === 2) {
    try {
      const img = c === 1 ? await Photos.fromLibrary() : await Photos.fromCamera();
      const id = doc.manager.proposal_id || doc.manager.invoice_id || `IMG-${Date.now()}`;
      const safeTitle = String(doc.job.title || doc.customer.name || "project").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) || "project";
      const photoPath = fm.joinPath(DIRS.photos, `${id}-${safeTitle}.jpg`);
      fm.writeImage(photoPath, img);
      doc.media.project_image_path = photoPath;
      doc.media.project_image_mode = await chooseImageMode(doc.media.project_image_mode || "watermark");
      doc.media.project_image_opacity = await chooseWatermarkOpacity(doc.media.project_image_opacity || 0.10);
    } catch (e) {
      await info("Image not added", String(e));
    }
  }
  if (doc.media.project_image_path && ((c === 3 && a.actions.length >= 4) || c === 99)) {
    doc.media.project_image_path = "";
  }
  return doc;
}

async function chooseImageMode(current) {
  const a = new Alert();
  a.title = "Image Placement";
  a.message = "Watermark is the large faded background. Small photo is a regular job image above the scope.";
  a.addAction("Large Background Watermark");
  a.addAction("Small Job Photo");
  a.addAction("Both");
  a.addCancelAction("Keep Current");
  const c = await a.presentSheet();
  if (c === -1) return current || "watermark";
  if (c === 1) return "photo";
  if (c === 2) return "both";
  return "watermark";
}

async function chooseWatermarkOpacity(current) {
  const a = new Alert();
  a.title = "Background Strength";
  a.message = "Start light. 8–12% usually prints cleanly behind text.";
  a.addAction("Very Light 6%");
  a.addAction("Light 10%");
  a.addAction("Stronger 14%");
  a.addCancelAction("Keep Current");
  const c = await a.presentSheet();
  if (c === -1) return Number(current || 0.10);
  if (c === 0) return 0.06;
  if (c === 2) return 0.14;
  return 0.10;
}

async function largeText(title, current) {
  const a = new Alert();
  a.title = title;
  a.message = "Paste or edit text here. Scriptable uses a single field, but it will keep long pasted scope text.";
  a.addTextField(title, current || "");
  a.addAction("Save");
  a.addAction("Leave Blank");
  a.addCancelAction("Keep Existing");
  const c = await a.presentAlert();
  if (c === -1) return current || "";
  if (c === 1) return "";
  return a.textFieldValue(0);
}

async function currentDocumentsFlow() {
  const proposals = readJson(FILES.proposalIndex, []);
  const invoices = readJson(FILES.invoiceIndex, []);
  const activeProposalStatuses = ["open", "draft", "sent", "accepted", "in_progress"];
  const activeInvoiceStatuses = ["open", "sent", "partial", "overdue", "unpaid"];
  const active = proposals.filter(x => activeProposalStatuses.includes(String(x.status || "open").toLowerCase()))
    .concat(invoices.filter(x => activeInvoiceStatuses.includes(String(x.status || "open").toLowerCase())));
  active.sort((a, b) => String(b.updated_date || "").localeCompare(String(a.updated_date || "")));
  await chooseDocument(active, "Current Documents", "No active proposals or invoices yet.");
}

async function archiveBrowserFlow() {
  const a = new Alert();
  a.title = "Archive Browser";
  a.message = "Drill into older proposals and invoices.";
  a.addAction("By Month");
  a.addAction("By Year");
  a.addAction("By Week");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === -1) return;
  const key = c === 0 ? "sort_month" : c === 1 ? "sort_year" : "sort_week";
  const docs = allIndexedDocuments();
  const groups = groupBy(docs, d => d[key] || "Unsorted");
  const keys = Object.keys(groups).sort().reverse();
  const picker = new Alert();
  picker.title = `Archive ${key.replace("sort_", "")}`;
  keys.forEach(k => picker.addAction(`${k} (${groups[k].length})`));
  picker.addCancelAction("Back");
  const choice = await picker.presentSheet();
  if (choice === -1) return;
  await chooseDocument(groups[keys[choice]], keys[choice], "No documents in this group.");
}

async function chooseDocument(items, title, emptyMessage) {
  if (!items.length) return await info(title, emptyMessage);
  const table = new UITable();
  table.showSeparators = true;
  const header = new UITableRow();
  header.isHeader = true;
  header.addText(title, `${items.length} document(s)`);
  table.addRow(header);
  items.forEach(item => {
    const row = new UITableRow();
    row.height = 62;
    const left = row.addText(item.title || item.id || "Document", `${item.type || "doc"} · ${item.status || "open"} · ${currency(item.total || 0)}`);
    left.widthWeight = 80;
    const right = row.addText(item.updated_date || item.created_date || "", item.id || "");
    right.rightAligned();
    right.widthWeight = 30;
    row.onSelect = async () => await openIndexedDocument(item);
    table.addRow(row);
  });
  await table.present();
}

async function openIndexedDocument(entry) {
  const path = entry.path;
  if (!fm.fileExists(path)) return await info("Missing file", path);
  const doc = readJson(path, null);
  if (!doc) return;
  const type = entry.type || (doc.manager.invoice_id ? "invoice" : "proposal");
  const htmlPath = writeDocumentHtml(doc, type);
  await documentActions(doc, path, htmlPath, type);
}

async function documentActions(doc, jsonPath, htmlPath, type) {
  let done = false;
  while (!done) {
    const a = new Alert();
    a.title = doc.manager.invoice_id || doc.manager.proposal_id;
    a.message = `${doc.customer.name || "No customer"}\n${doc.job.title || "No job title"}`;
    a.addAction("Open HTML Preview");
    a.addAction("Edit");
    a.addAction("Duplicate");
    if (type === "proposal") a.addAction("Convert to Invoice");
    a.addAction("Mark Archived");
    a.addAction("Copy JSON Path");
    a.addCancelAction("Back");
    const c = await a.presentSheet();
    if (c === -1) done = true;
    if (c === 0) await QuickLook.present(htmlPath);
    if (c === 1) {
      const edited = await proposalForm(doc, type === "invoice" ? "Invoice" : "Proposal");
      if (edited) {
        writeJson(jsonPath, edited);
        upsertIndex(type === "invoice" ? FILES.invoiceIndex : FILES.proposalIndex, indexEntry(edited, jsonPath));
        htmlPath = writeDocumentHtml(edited, type);
      }
    }
    if (c === 2) await duplicateDocument(doc, type);
    if (type === "proposal" && c === 3) await convertProposalToInvoice(doc, jsonPath);
    const archiveIndex = type === "proposal" ? 4 : 3;
    const copyIndex = type === "proposal" ? 5 : 4;
    if (c === archiveIndex) await archiveDocument(doc, jsonPath, type);
    if (c === copyIndex) await Pasteboard.copy(jsonPath);
  }
}

async function duplicateDocument(doc, type) {
  const copy = JSON.parse(JSON.stringify(doc));
  if (type === "invoice") {
    const id = nextInvoiceId();
    copy.manager.invoice_id = id;
    copy.manager.status = "draft";
    copy.manager.created_date = todayIso();
    copy.manager.updated_date = todayIso();
    const p = fm.joinPath(DIRS.invoices, `${id}.json`);
    writeJson(p, copy);
    upsertIndex(FILES.invoiceIndex, indexEntry(copy, p));
  } else {
    const id = nextProposalId();
    copy.manager.proposal_id = id;
    copy.manager.invoice_id = "";
    copy.manager.status = "draft";
    copy.manager.created_date = todayIso();
    copy.manager.updated_date = todayIso();
    const p = fm.joinPath(DIRS.proposals, `${id}.json`);
    writeJson(p, copy);
    upsertIndex(FILES.proposalIndex, indexEntry(copy, p));
  }
  await info("Duplicated", "A new draft copy was created.");
}

async function convertProposalToInvoice(proposal, proposalPath) {
  const id = nextInvoiceId();
  const invoice = JSON.parse(JSON.stringify(proposal));
  invoice.manager.invoice_id = id;
  invoice.manager.status = "open";
  invoice.manager.payment_status = "unpaid";
  invoice.manager.converted_from_proposal_id = proposal.manager.proposal_id;
  invoice.manager.created_date = todayIso();
  invoice.manager.updated_date = todayIso();
  invoice.manager.sort_year = todayIso().slice(0, 4);
  invoice.manager.sort_month = todayIso().slice(0, 7);
  invoice.manager.sort_week = weekKey(new Date());
  const invoicePath = fm.joinPath(DIRS.invoices, `${id}.json`);
  writeJson(invoicePath, invoice);
  upsertIndex(FILES.invoiceIndex, indexEntry(invoice, invoicePath));
  proposal.manager.status = "converted_to_invoice";
  proposal.manager.converted_to_invoice_date = todayIso();
  proposal.manager.invoice_id = id;
  proposal.manager.updated_date = todayIso();
  writeJson(proposalPath, proposal);
  upsertIndex(FILES.proposalIndex, indexEntry(proposal, proposalPath));
  writeDocumentHtml(invoice, "invoice");
  logDocument("proposal_converted_to_invoice", proposal.manager.proposal_id, invoicePath);
  await info("Invoice created", `${id} was created from ${proposal.manager.proposal_id}.`);
}

async function archiveDocument(doc, path, type) {
  doc.manager.status = "archived";
  doc.manager.updated_date = todayIso();
  writeJson(path, doc);
  upsertIndex(type === "invoice" ? FILES.invoiceIndex : FILES.proposalIndex, indexEntry(doc, path));
  logDocument("document_archived", doc.manager.invoice_id || doc.manager.proposal_id, path);
  await info("Archived", "The document stays searchable in Archive Browser.");
}

async function backupFlow() {
  const a = new Alert();
  a.title = "Backups";
  a.message = "Create recoverable copies of JSON indexes and documents.";
  a.addAction("Create Backup Now");
  a.addAction("View Backup Folders");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === -1) return;
  if (c === 0) await info("Backup created", createBackup());
  if (c === 1) {
    const backups = fm.listContents(DIRS.backups).sort().reverse();
    await info("Backups", backups.length ? backups.join("\n") : "No backups yet.");
  }
}

function createBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = fm.joinPath(DIRS.backups, stamp);
  fm.createDirectory(dir, true);
  copyDir(DIRS.proposals, fm.joinPath(dir, "Proposals"));
  copyDir(DIRS.invoices, fm.joinPath(dir, "Invoices"));
  copyDir(DIRS.logs, fm.joinPath(dir, "Logs"));
  copyDir(DIRS.data, fm.joinPath(dir, "Data"));
  copyDir(DIRS.photos, fm.joinPath(dir, "Photos"));
  logDocument("backup_created", stamp, dir);
  return dir;
}

function copyDir(source, target) {
  ensureDir(target);
  if (!fm.fileExists(source)) return;
  fm.listContents(source).forEach(name => {
    const src = fm.joinPath(source, name);
    const dst = fm.joinPath(target, name);
    if (fm.isDirectory(src)) copyDir(src, dst);
    else {
      if (fm.fileExists(dst)) fm.remove(dst);
      fm.copy(src, dst);
    }
  });
}

async function settingsFlow() {
  const settings = getSettings();
  const a = new Alert();
  a.title = "Settings";
  a.addTextField("Company", settings.companyName || "");
  a.addTextField("Phone", settings.phone || "");
  a.addTextField("Email", settings.email || "");
  a.addTextField("Service area", settings.serviceArea || "");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  const c = await a.presentAlert();
  if (c === -1) return;
  settings.companyName = a.textFieldValue(0).trim();
  settings.phone = a.textFieldValue(1).trim();
  settings.email = a.textFieldValue(2).trim();
  settings.serviceArea = a.textFieldValue(3).trim();
  writeJson(FILES.settings, settings);
}

function writeDocumentHtml(doc, type) {
  ensureMedia(doc);
  const settings = getSettings();
  const id = doc.manager.invoice_id || doc.manager.proposal_id;
  const total = currency(doc.pricing.total || 0);
  const balance = currency(Math.max(0, Number(doc.pricing.total || 0) - Number(doc.pricing.deposit || 0)));
  const imgUri = projectImageDataUri(doc);
  const mode = doc.media.project_image_mode || "watermark";
  const opacity = Math.max(0.03, Math.min(0.20, Number(doc.media.project_image_opacity || 0.10)));
  const watermark = imgUri && (mode === "watermark" || mode === "both") ? `<div class="project-watermark" style="background-image:url('${imgUri}');opacity:${opacity}"></div>` : "";
  const photo = imgUri && (mode === "photo" || mode === "both") ? `<section class="project-photo"><img src="${imgUri}" alt="Project photo"></section>` : "";
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.45;color:#111;margin:0;background:#eee}.page{position:relative;max-width:800px;margin:0 auto;background:#fff;min-height:100vh;padding:36px;box-sizing:border-box;overflow:hidden}.content{position:relative;z-index:2}.project-watermark{position:absolute;z-index:1;inset:112px 26px 70px;background-repeat:no-repeat;background-position:center 42%;background-size:cover;filter:grayscale(25%);pointer-events:none}.top{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #111;padding-bottom:20px;margin-bottom:24px}.brand h1{margin:0;font-size:28px}.brand p{margin:3px 0;color:#555}.doc h2{margin:0;text-align:right;font-size:24px;text-transform:uppercase}.doc p{text-align:right;margin:3px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:22px 0}.box{background:rgba(255,255,255,.88);border:1px solid #ddd;padding:14px;border-radius:8px;backdrop-filter:blur(1px)}.box h3{margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.08em}.scope{white-space:pre-wrap}.price{font-size:26px;font-weight:800;text-align:right}.terms{position:relative;z-index:2;font-size:13px;color:#333;border-top:1px solid #ddd;margin-top:24px;padding-top:14px;background:rgba(255,255,255,.82)}.project-photo{position:relative;z-index:2;margin:20px 0}.project-photo img{width:100%;max-height:260px;object-fit:cover;border-radius:10px;border:1px solid #ddd;display:block}@media print{body{background:#fff}.page{padding:24px}.box{background:rgba(255,255,255,.90)}.project-watermark{inset:96px 20px 64px}}
</style></head><body><main class="page">${watermark}<div class="content"><section class="top"><div class="brand"><h1>${escapeHtml(settings.companyName)}</h1><p>${escapeHtml(settings.tagline)}</p><p>${escapeHtml(settings.serviceArea)}</p><p>${escapeHtml([settings.phone, settings.email].filter(Boolean).join(" · "))}</p></div><div class="doc"><h2>${type}</h2><p><strong>${escapeHtml(id)}</strong></p><p>${escapeHtml(doc.manager.created_date || todayIso())}</p><p>Status: ${escapeHtml(doc.manager.status || "open")}</p></div></section><section class="grid"><div class="box"><h3>Customer</h3><p><strong>${escapeHtml(doc.customer.name)}</strong><br>${escapeHtml(doc.customer.contact)}<br>${escapeHtml(doc.customer.phone)}<br>${escapeHtml(doc.customer.email)}</p></div><div class="box"><h3>Project</h3><p><strong>${escapeHtml(doc.job.title)}</strong><br>${escapeHtml(doc.job.site)}<br>${escapeHtml([doc.job.city, doc.job.state].filter(Boolean).join(", "))}<br>${escapeHtml(doc.job.category)}</p></div></section>${photo}<section class="box"><h3>Scope Summary</h3><p class="scope">${escapeHtml(doc.scope.summary)}</p></section><section class="box"><h3>Scope Details</h3><p class="scope">${escapeHtml(doc.scope.details)}</p></section><section class="grid"><div class="box"><h3>Exclusions / Notes</h3><p class="scope">${escapeHtml([doc.scope.exclusions, doc.scope.notes].filter(Boolean).join("\n\n"))}</p></div><div class="box"><h3>Price</h3><p class="price">${total}</p><p>Deposit: ${currency(doc.pricing.deposit || 0)}</p><p>Balance: ${balance}</p></div></section><section class="terms"><p><strong>Terms:</strong> ${escapeHtml(doc.terms || settings.defaultTerms)}</p><p><strong>Warranty:</strong> ${escapeHtml(doc.warranty || settings.warrantyNote)}</p></section></div></main></body></html>`;
  const targetDir = type === "invoice" ? DIRS.invoices : DIRS.proposals;
  const htmlPath = fm.joinPath(targetDir, `${id}.html`);
  fm.writeString(htmlPath, html);
  return htmlPath;
}

function projectImageDataUri(doc) {
  const p = doc && doc.media ? doc.media.project_image_path : "";
  if (!p || !fm.fileExists(p)) return "";
  try {
    const data = Data.fromFile(p);
    const ext = String(p).split(".").pop().toLowerCase();
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${data.toBase64String()}`;
  } catch (e) {
    return "";
  }
}

function indexEntry(doc, path) {
  const id = doc.manager.invoice_id || doc.manager.proposal_id;
  const type = doc.manager.invoice_id ? "invoice" : "proposal";
  return {
    id,
    type,
    path,
    title: doc.job.title || doc.customer.name || id,
    customer: doc.customer.name || "",
    status: doc.manager.payment_status && type === "invoice" ? doc.manager.payment_status : doc.manager.status,
    total: Number(doc.pricing.total || 0),
    created_date: doc.manager.created_date || todayIso(),
    updated_date: doc.manager.updated_date || todayIso(),
    sort_year: doc.manager.sort_year || (doc.manager.created_date || todayIso()).slice(0, 4),
    sort_month: doc.manager.sort_month || (doc.manager.created_date || todayIso()).slice(0, 7),
    sort_week: doc.manager.sort_week || weekKey(new Date(doc.manager.created_date || Date.now()))
  };
}

function upsertIndex(file, entry) {
  const list = readJson(file, []);
  const next = list.filter(x => x.id !== entry.id);
  next.push(entry);
  next.sort((a, b) => String(b.updated_date || "").localeCompare(String(a.updated_date || "")));
  writeJson(file, next);
}

function allIndexedDocuments() {
  return readJson(FILES.proposalIndex, []).concat(readJson(FILES.invoiceIndex, []));
}

function getSettings() {
  return Object.assign({}, DEFAULT_SETTINGS, readJson(FILES.settings, {}));
}

function bumpProposalNumber(id) {
  const settings = getSettings();
  const n = Number(String(id).match(/(\d+)$/)?.[1] || 0) + 1;
  if (n > Number(settings.nextProposalNumber || 1)) {
    settings.nextProposalNumber = n;
    writeJson(FILES.settings, settings);
  }
}

function nextProposalId() {
  const settings = getSettings();
  const id = `PROP-${new Date().getFullYear()}-${String(settings.nextProposalNumber || 1).padStart(4, "0")}`;
  settings.nextProposalNumber = Number(settings.nextProposalNumber || 1) + 1;
  writeJson(FILES.settings, settings);
  return id;
}

function nextInvoiceId() {
  const settings = getSettings();
  const id = `INV-${new Date().getFullYear()}-${String(settings.nextInvoiceNumber || 1).padStart(4, "0")}`;
  settings.nextInvoiceNumber = Number(settings.nextInvoiceNumber || 1) + 1;
  writeJson(FILES.settings, settings);
  return id;
}

function readJson(path, fallback) {
  try {
    if (!fm.fileExists(path)) return fallback;
    return JSON.parse(fm.readString(path));
  } catch (e) {
    return fallback;
  }
}

function writeJson(path, value) {
  fm.writeString(path, JSON.stringify(value, null, 2));
}

function logDocument(action, id, path) {
  const log = readJson(FILES.documentLog, []);
  log.push({ at: new Date().toISOString(), action, id, path });
  writeJson(FILES.documentLog, log.slice(-1000));
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

async function info(title, message) {
  const a = new Alert();
  a.title = title;
  a.message = message;
  a.addAction("OK");
  await a.presentAlert();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function weekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function numberValue(value) {
  return Number(String(value || "0").replace(/[^0-9.-]/g, "")) || 0;
}

function currency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
