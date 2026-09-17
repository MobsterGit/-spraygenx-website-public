// Spray GenX WRA Manager — Phone Test Build
// Version: 2026.07.03 Phone-Test-1
// Purpose: proposal + invoice manager for Scriptable using iCloud Drive.
// Storage: iCloud Drive / Scriptable / SprayGenX

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
await home();

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

async function home() {
  let done = false;
  while (!done) {
    const s = stats();
    const a = new Alert();
    a.title = "Spray GenX Manager";
    a.message = `${s.active} active · ${s.proposals} proposals · ${s.invoices} invoices\nInvoice balance: ${currency(s.balance)}\n\nPhone test build. Uses your existing SprayGenX folders.`;
    a.addAction("+ New Proposal");
    a.addAction("Current Work");
    a.addAction("Find / Archive");
    a.addAction("Test Center");
    a.addAction("Backup");
    a.addAction("Settings");
    a.addCancelAction("Close");
    const c = await a.presentSheet();
    if (c === -1) done = true;
    if (c === 0) await createProposalFlow();
    if (c === 1) await currentWorkFlow();
    if (c === 2) await findArchiveFlow();
    if (c === 3) await testCenterFlow();
    if (c === 4) await backupFlow();
    if (c === 5) await settingsFlow();
  }
}

function stats() {
  const proposals = readJson(FILES.proposalIndex, []);
  const invoices = readJson(FILES.invoiceIndex, []);
  const active = activeDocs(proposals, invoices);
  const balance = invoices
    .filter(x => !["paid", "void", "archived"].includes(status(x.status)))
    .reduce((sum, x) => sum + Number(x.balance_due ?? x.total ?? 0), 0);
  return { proposals: proposals.length, invoices: invoices.length, active: active.length, balance };
}

async function createProposalFlow(existing) {
  const settings = getSettings();
  const proposal = existing || newProposal(settings);
  const edited = await proposalForm(proposal, existing ? "Edit Proposal" : "New Proposal");
  if (!edited) return;

  edited.manager.updated_date = todayIso();
  keepSortKeysCurrent(edited);
  const proposalPath = fm.joinPath(DIRS.proposals, `${edited.manager.proposal_id}.json`);
  writeJson(proposalPath, edited);
  upsertIndex(FILES.proposalIndex, indexEntry(edited, proposalPath));
  bumpProposalNumber(edited.manager.proposal_id);
  const htmlPath = writeDocumentHtml(edited, "proposal");
  logDocument("proposal_saved", edited.manager.proposal_id, proposalPath);
  await documentActions(edited, proposalPath, htmlPath, "proposal");
}

function newProposal(settings) {
  const id = nextProposalIdPreview(settings);
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
    terms: settings.defaultTerms,
    warranty: settings.warrantyNote
  };
}

function nextProposalIdPreview(settings) {
  return `PROP-${new Date().getFullYear()}-${String(settings.nextProposalNumber || 1).padStart(4, "0")}`;
}

async function proposalForm(doc, label) {
  const base = new Alert();
  base.title = label;
  base.message = `${doc.manager.proposal_id || doc.manager.invoice_id}\nStep 1 of 3 — customer and job`;
  base.addTextField("Customer", doc.customer.name || "");
  base.addTextField("Contact / GC", doc.customer.contact || "");
  base.addTextField("Phone", doc.customer.phone || "");
  base.addTextField("Email", doc.customer.email || "");
  base.addTextField("Job title", doc.job.title || "");
  base.addTextField("Site / address", doc.job.site || "");
  base.addTextField("City", doc.job.city || doc.customer.city || "");
  base.addTextField("Category", doc.job.category || "");
  base.addAction("Next");
  base.addCancelAction("Cancel");
  if (await base.presentAlert() === -1) return null;

  doc.customer.name = base.textFieldValue(0).trim();
  doc.customer.contact = base.textFieldValue(1).trim();
  doc.customer.phone = base.textFieldValue(2).trim();
  doc.customer.email = base.textFieldValue(3).trim();
  doc.job.title = base.textFieldValue(4).trim();
  doc.job.site = base.textFieldValue(5).trim();
  doc.job.city = base.textFieldValue(6).trim();
  doc.job.category = base.textFieldValue(7).trim();

  const price = new Alert();
  price.title = doc.manager.proposal_id || doc.manager.invoice_id;
  price.message = "Step 2 of 3 — pricing and status";
  price.addTextField("Total price", String(doc.pricing.total || ""));
  price.addTextField("Deposit / paid", String(doc.pricing.deposit || ""));
  price.addTextField("Status", doc.manager.invoice_id ? (doc.manager.payment_status || "unpaid") : (doc.manager.status || "open"));
  price.addAction("Next");
  price.addCancelAction("Cancel");
  if (await price.presentAlert() === -1) return null;
  doc.pricing.total = numberValue(price.textFieldValue(0));
  doc.pricing.deposit = numberValue(price.textFieldValue(1));
  if (doc.manager.invoice_id) doc.manager.payment_status = price.textFieldValue(2).trim() || "unpaid";
  else doc.manager.status = price.textFieldValue(2).trim() || "open";

  doc.scope.summary = await largeText("Step 3 of 3", "Short scope summary", doc.scope.summary || "");
  doc.scope.details = await largeText("Scope Details", "Paste detailed scope here", doc.scope.details || "");
  doc.scope.exclusions = await largeText("Exclusions", "Anything excluded", doc.scope.exclusions || "");
  doc.scope.notes = await largeText("Notes", "Special notes", doc.scope.notes || "");
  return doc;
}

async function largeText(title, placeholder, current) {
  const a = new Alert();
  a.title = title;
  a.message = "Paste text here. Scriptable keeps long pasted scope text.";
  a.addTextField(placeholder, current || "");
  a.addAction("Save");
  a.addAction("Blank");
  a.addCancelAction("Keep Existing");
  const c = await a.presentAlert();
  if (c === -1) return current || "";
  if (c === 1) return "";
  return a.textFieldValue(0);
}

async function currentWorkFlow() {
  await chooseDocument(activeDocs(), "Current Work", "No active proposals or invoices yet.");
}

function activeDocs(proposals, invoices) {
  const props = proposals || readJson(FILES.proposalIndex, []);
  const inv = invoices || readJson(FILES.invoiceIndex, []);
  const activeProposalStatuses = ["open", "draft", "sent", "accepted", "in_progress"];
  const activeInvoiceStatuses = ["open", "sent", "partial", "overdue", "unpaid"];
  return props.filter(x => activeProposalStatuses.includes(status(x.status)))
    .concat(inv.filter(x => activeInvoiceStatuses.includes(status(x.status))))
    .sort((a, b) => String(b.updated_date || "").localeCompare(String(a.updated_date || "")));
}

async function findArchiveFlow() {
  const docs = allIndexedDocuments();
  const a = new Alert();
  a.title = "Find / Archive";
  a.message = "Keep active work up front. Drill into older records here.";
  a.addAction("By Month");
  a.addAction("By Year");
  a.addAction("By Week");
  a.addAction("Customer / Job Search");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === -1) return;
  if (c === 3) return await searchDocs(docs);
  const key = c === 0 ? "sort_month" : c === 1 ? "sort_year" : "sort_week";
  const groups = groupBy(docs, d => d[key] || "Unsorted");
  const keys = Object.keys(groups).sort().reverse();
  if (!keys.length) return await info("Find / Archive", "No documents yet.");
  const picker = new Alert();
  picker.title = key.replace("sort_", "").toUpperCase();
  keys.forEach(k => picker.addAction(`${k} (${groups[k].length})`));
  picker.addCancelAction("Back");
  const p = await picker.presentSheet();
  if (p !== -1) await chooseDocument(groups[keys[p]], keys[p], "No documents in this group.");
}

async function searchDocs(docs) {
  const a = new Alert();
  a.title = "Search";
  a.addTextField("Customer, job, city, id", "");
  a.addAction("Search");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  const q = a.textFieldValue(0).toLowerCase().trim();
  if (!q) return await info("Search", "Enter at least one search word.");
  const results = docs.filter(d => `${d.customer || ""} ${d.title || ""} ${d.city || ""} ${d.id || ""}`.toLowerCase().includes(q));
  await chooseDocument(results, `Search: ${q}`, "No matching documents.");
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
    row.height = 70;
    const left = row.addText(item.customer || item.title || item.id || "Document", `${item.type || "doc"} · ${item.status || "open"} · ${currency(item.total || 0)}`);
    left.widthWeight = 76;
    const right = row.addText(item.updated_date || item.created_date || "", item.id || "");
    right.rightAligned();
    right.widthWeight = 34;
    row.onSelect = async () => await openIndexedDocument(item);
    table.addRow(row);
  });
  await table.present();
}

async function openIndexedDocument(entry) {
  const path = entry.path || pathForEntry(entry);
  if (!path || !fm.fileExists(path)) {
    await info("Missing file", path || "No path saved. Use Test Center > Rebuild Indexes.");
    return;
  }
  const doc = readJson(path, null);
  if (!doc) return await info("Read error", "Could not read this JSON file.");
  const type = entry.type || (doc.manager.invoice_id ? "invoice" : "proposal");
  const htmlPath = writeDocumentHtml(doc, type);
  await documentActions(doc, path, htmlPath, type);
}

function pathForEntry(entry) {
  if (!entry || !entry.id) return "";
  return fm.joinPath(entry.type === "invoice" ? DIRS.invoices : DIRS.proposals, `${entry.id}.json`);
}

async function documentActions(doc, jsonPath, htmlPath, type) {
  let done = false;
  while (!done) {
    const id = doc.manager.invoice_id || doc.manager.proposal_id;
    const a = new Alert();
    a.title = id;
    a.message = `${doc.customer.name || "No customer"}\n${doc.job.title || "No job title"}\n${currency(doc.pricing.total || 0)}`;
    a.addAction("Preview");
    a.addAction("Edit");
    a.addAction("Duplicate");
    if (type === "proposal") a.addAction("Convert to Invoice");
    a.addAction("Archive");
    a.addAction("Copy JSON Path");
    a.addCancelAction("Back");
    const c = await a.presentSheet();
    if (c === -1) done = true;
    if (c === 0) await QuickLook.present(htmlPath);
    if (c === 1) {
      const edited = await proposalForm(doc, type === "invoice" ? "Edit Invoice" : "Edit Proposal");
      if (edited) {
        edited.manager.updated_date = todayIso();
        keepSortKeysCurrent(edited);
        writeJson(jsonPath, edited);
        upsertIndex(type === "invoice" ? FILES.invoiceIndex : FILES.proposalIndex, indexEntry(edited, jsonPath));
        htmlPath = writeDocumentHtml(edited, type);
        doc = edited;
      }
    }
    if (c === 2) await duplicateDocument(doc, type);
    if (type === "proposal" && c === 3) { await convertProposalToInvoice(doc, jsonPath); done = true; }
    const archiveIndex = type === "proposal" ? 4 : 3;
    const copyIndex = type === "proposal" ? 5 : 4;
    if (c === archiveIndex) { await archiveDocument(doc, jsonPath, type); done = true; }
    if (c === copyIndex) { Pasteboard.copy(jsonPath); await info("Copied", "JSON path copied."); }
  }
}

async function duplicateDocument(doc, type) {
  const copy = JSON.parse(JSON.stringify(doc));
  if (type === "invoice") {
    const id = nextInvoiceId();
    copy.manager.invoice_id = id;
    copy.manager.status = "open";
    copy.manager.payment_status = "unpaid";
    copy.manager.created_date = todayIso();
    copy.manager.updated_date = todayIso();
    keepSortKeysCurrent(copy);
    const p = fm.joinPath(DIRS.invoices, `${id}.json`);
    writeJson(p, copy);
    upsertIndex(FILES.invoiceIndex, indexEntry(copy, p));
    writeDocumentHtml(copy, "invoice");
  } else {
    const id = nextProposalId();
    copy.manager.proposal_id = id;
    copy.manager.invoice_id = "";
    copy.manager.status = "draft";
    copy.manager.payment_status = "not_billable_yet";
    copy.manager.created_date = todayIso();
    copy.manager.updated_date = todayIso();
    keepSortKeysCurrent(copy);
    const p = fm.joinPath(DIRS.proposals, `${id}.json`);
    writeJson(p, copy);
    upsertIndex(FILES.proposalIndex, indexEntry(copy, p));
    writeDocumentHtml(copy, "proposal");
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
  keepSortKeysCurrent(invoice);
  const invoicePath = fm.joinPath(DIRS.invoices, `${id}.json`);
  writeJson(invoicePath, invoice);
  upsertIndex(FILES.invoiceIndex, indexEntry(invoice, invoicePath));

  proposal.manager.status = "converted_to_invoice";
  proposal.manager.converted_to_invoice_date = todayIso();
  proposal.manager.invoice_id = id;
  proposal.manager.updated_date = todayIso();
  writeJson(proposalPath, proposal);
  upsertIndex(FILES.proposalIndex, indexEntry(proposal, proposalPath));
  writeDocumentHtml(proposal, "proposal");
  writeDocumentHtml(invoice, "invoice");
  logDocument("proposal_converted_to_invoice", proposal.manager.proposal_id, invoicePath);
  await info("Invoice created", `${id} was created from ${proposal.manager.proposal_id}.`);
}

async function archiveDocument(doc, path, type) {
  const a = new Alert();
  a.title = "Archive?";
  a.message = "This removes it from Current Work but keeps it searchable.";
  a.addDestructiveAction("Archive");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  doc.manager.status = "archived";
  if (type === "invoice") doc.manager.payment_status = "archived";
  doc.manager.updated_date = todayIso();
  writeJson(path, doc);
  upsertIndex(type === "invoice" ? FILES.invoiceIndex : FILES.proposalIndex, indexEntry(doc, path));
  logDocument("document_archived", doc.manager.invoice_id || doc.manager.proposal_id, path);
  await info("Archived", "It remains available under Find / Archive.");
}

async function testCenterFlow() {
  const a = new Alert();
  a.title = "Test Center";
  a.message = "Safe testing tools. TEST records only are removable.";
  a.addAction("Create Sample Proposal");
  a.addAction("Create Sample Invoice");
  a.addAction("Show Storage Paths");
  a.addAction("Rebuild Indexes");
  a.addDestructiveAction("Delete TEST Records Only");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === 0) await sampleProposal();
  if (c === 1) await sampleInvoice();
  if (c === 2) await info("Storage", `${ROOT}\n\nProposals: ${DIRS.proposals}\nInvoices: ${DIRS.invoices}\nBackups: ${DIRS.backups}`);
  if (c === 3) { rebuildIndexes(); await info("Indexes Rebuilt", "Lists rebuilt from JSON files."); }
  if (c === 4) await deleteTestRecords();
}

async function sampleProposal() {
  const d = newProposal(getSettings());
  d.customer.name = "TEST Customer";
  d.customer.contact = "TEST Contact";
  d.job.title = "TEST Interior Repaint";
  d.job.site = "123 Test Street";
  d.job.city = "Wadsworth";
  d.job.category = "commercial-interior";
  d.scope.summary = "TEST proposal for Scriptable UX testing.";
  d.scope.details = "Prep, mask, paint listed surfaces, and clean work area.";
  d.scope.notes = "Safe to delete from Test Center.";
  d.pricing.total = 2500;
  const path = fm.joinPath(DIRS.proposals, `${d.manager.proposal_id}.json`);
  writeJson(path, d);
  upsertIndex(FILES.proposalIndex, indexEntry(d, path));
  bumpProposalNumber(d.manager.proposal_id);
  writeDocumentHtml(d, "proposal");
  logDocument("sample_proposal_created", d.manager.proposal_id, path);
  await info("Sample Created", `${d.manager.proposal_id} is ready in Current Work.`);
}

async function sampleInvoice() {
  const d = newProposal(getSettings());
  d.manager.invoice_id = nextInvoiceId();
  d.manager.proposal_id = "";
  d.manager.status = "open";
  d.manager.payment_status = "unpaid";
  d.customer.name = "TEST Customer";
  d.customer.contact = "TEST Contact";
  d.job.title = "TEST Invoice";
  d.job.site = "123 Test Street";
  d.job.city = "Wadsworth";
  d.job.category = "test";
  d.scope.summary = "TEST invoice for Scriptable UX testing.";
  d.scope.details = "Invoice generated from test center.";
  d.scope.notes = "Safe to delete.";
  d.pricing.total = 1200;
  keepSortKeysCurrent(d);
  const path = fm.joinPath(DIRS.invoices, `${d.manager.invoice_id}.json`);
  writeJson(path, d);
  upsertIndex(FILES.invoiceIndex, indexEntry(d, path));
  writeDocumentHtml(d, "invoice");
  logDocument("sample_invoice_created", d.manager.invoice_id, path);
  await info("Sample Created", `${d.manager.invoice_id} is ready in Current Work.`);
}

async function deleteTestRecords() {
  const a = new Alert();
  a.title = "Delete TEST records?";
  a.message = "Only JSON/HTML files with TEST in the customer, title, or filename will be removed.";
  a.addDestructiveAction("Delete TEST Records");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  [DIRS.proposals, DIRS.invoices].forEach(dir => {
    if (!fm.fileExists(dir)) return;
    fm.listContents(dir).forEach(name => {
      const path = fm.joinPath(dir, name);
      if (fm.isDirectory(path)) return;
      let isTest = String(name).toUpperCase().includes("TEST");
      if (name.endsWith(".json")) {
        const d = readJson(path, null);
        if (d) isTest = isTest || `${d.customer?.name || ""} ${d.job?.title || ""}`.toUpperCase().includes("TEST");
      }
      if (isTest) fm.remove(path);
    });
  });
  rebuildIndexes();
  await info("Cleaned", "TEST records were removed and indexes rebuilt.");
}

async function backupFlow() {
  const a = new Alert();
  a.title = "Backup";
  a.message = "Create full copies before testing real data.";
  a.addAction("Create Backup Now");
  a.addAction("List Backups");
  a.addCancelAction("Back");
  const c = await a.presentSheet();
  if (c === 0) await info("Backup Created", createBackup());
  if (c === 1) {
    const list = fm.fileExists(DIRS.backups) ? fm.listContents(DIRS.backups).sort().reverse() : [];
    await info("Backups", list.length ? list.join("\n") : "No backups yet.");
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
  logDocument("backup_created", stamp, dir);
  return dir;
}

function copyDir(source, target) {
  if (!fm.fileExists(source)) return;
  ensureDir(target);
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
  a.message = "These appear on previews and future PDFs.";
  a.addTextField("Company", settings.companyName || "");
  a.addTextField("Phone", settings.phone || "");
  a.addTextField("Email", settings.email || "");
  a.addTextField("Service area", settings.serviceArea || "");
  a.addTextField("Default terms", settings.defaultTerms || "");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return;
  settings.companyName = a.textFieldValue(0).trim();
  settings.phone = a.textFieldValue(1).trim();
  settings.email = a.textFieldValue(2).trim();
  settings.serviceArea = a.textFieldValue(3).trim();
  settings.defaultTerms = a.textFieldValue(4).trim();
  writeJson(FILES.settings, settings);
}

function writeDocumentHtml(doc, type) {
  const settings = getSettings();
  const id = doc.manager.invoice_id || doc.manager.proposal_id;
  const total = currency(doc.pricing.total || 0);
  const balance = currency(Math.max(0, Number(doc.pricing.total || 0) - Number(doc.pricing.deposit || 0)));
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.45;color:#111;margin:0;background:#eee}.page{max-width:820px;margin:0 auto;background:#fff;min-height:100vh;padding:34px;box-sizing:border-box}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #111;padding-bottom:18px;margin-bottom:24px}.brand h1{margin:0;font-size:29px}.brand p,.doc p{margin:4px 0;color:#444}.doc{text-align:right}.doc h2{margin:0;text-transform:uppercase}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.box{border:1px solid #ddd;border-radius:9px;padding:14px;margin-bottom:18px}.box h3{margin:0 0 8px;text-transform:uppercase;font-size:13px;letter-spacing:.08em}.scope{white-space:pre-wrap}.price{font-size:30px;font-weight:800;text-align:right}.terms{border-top:1px solid #ddd;margin-top:18px;padding-top:12px;font-size:13px}@media(max-width:650px){.top,.grid{display:block}.doc{text-align:left;margin-top:18px}.page{padding:24px}}@media print{body{background:#fff}.page{padding:24px}}</style></head><body><main class="page"><section class="top"><div class="brand"><h1>${escapeHtml(settings.companyName)}</h1><p>${escapeHtml(settings.tagline)}</p><p>${escapeHtml(settings.serviceArea)}</p><p>${escapeHtml([settings.phone,settings.email].filter(Boolean).join(" · "))}</p></div><div class="doc"><h2>${escapeHtml(type)}</h2><p><strong>${escapeHtml(id)}</strong></p><p>${escapeHtml(doc.manager.created_date || todayIso())}</p><p>Status: ${escapeHtml(doc.manager.payment_status && type === "invoice" ? doc.manager.payment_status : doc.manager.status)}</p></div></section><section class="grid"><div class="box"><h3>Customer</h3><p><strong>${escapeHtml(doc.customer.name)}</strong><br>${escapeHtml(doc.customer.contact)}<br>${escapeHtml(doc.customer.phone)}<br>${escapeHtml(doc.customer.email)}</p></div><div class="box"><h3>Project</h3><p><strong>${escapeHtml(doc.job.title)}</strong><br>${escapeHtml(doc.job.site)}<br>${escapeHtml([doc.job.city, doc.job.state].filter(Boolean).join(", "))}<br>${escapeHtml(doc.job.category)}</p></div></section><section class="box"><h3>Scope Summary</h3><p class="scope">${escapeHtml(doc.scope.summary)}</p></section><section class="box"><h3>Scope Details</h3><p class="scope">${escapeHtml(doc.scope.details)}</p></section><section class="grid"><div class="box"><h3>Exclusions / Notes</h3><p class="scope">${escapeHtml([doc.scope.exclusions, doc.scope.notes].filter(Boolean).join("\n\n"))}</p></div><div class="box"><h3>Total</h3><p class="price">${total}</p><p>Deposit / Paid: ${currency(doc.pricing.deposit || 0)}</p><p>Balance Due: ${balance}</p></div></section><section class="terms"><p><strong>Terms:</strong> ${escapeHtml(doc.terms || settings.defaultTerms)}</p><p><strong>Warranty:</strong> ${escapeHtml(doc.warranty || settings.warrantyNote)}</p></section></main></body></html>`;
  const targetDir = type === "invoice" ? DIRS.invoices : DIRS.proposals;
  const htmlPath = fm.joinPath(targetDir, `${id}.html`);
  fm.writeString(htmlPath, html);
  return htmlPath;
}

function indexEntry(doc, path) {
  const id = doc.manager.invoice_id || doc.manager.proposal_id;
  const type = doc.manager.invoice_id ? "invoice" : "proposal";
  const balance = Math.max(0, Number(doc.pricing.total || 0) - Number(doc.pricing.deposit || 0));
  return {
    id,
    type,
    path,
    title: doc.job.title || doc.customer.name || id,
    customer: doc.customer.name || "",
    status: doc.manager.payment_status && type === "invoice" ? doc.manager.payment_status : doc.manager.status,
    total: Number(doc.pricing.total || 0),
    deposit: Number(doc.pricing.deposit || 0),
    balance_due: balance,
    created_date: doc.manager.created_date || todayIso(),
    updated_date: doc.manager.updated_date || todayIso(),
    sort_year: doc.manager.sort_year || (doc.manager.created_date || todayIso()).slice(0, 4),
    sort_month: doc.manager.sort_month || (doc.manager.created_date || todayIso()).slice(0, 7),
    sort_week: doc.manager.sort_week || weekKey(new Date(doc.manager.created_date || Date.now()))
  };
}

function rebuildIndexes() {
  const proposals = [];
  const invoices = [];
  scanJsonDocs(DIRS.proposals).forEach(({ doc, path }) => proposals.push(indexEntry(doc, path)));
  scanJsonDocs(DIRS.invoices).forEach(({ doc, path }) => invoices.push(indexEntry(doc, path)));
  proposals.sort((a, b) => String(b.updated_date || "").localeCompare(String(a.updated_date || "")));
  invoices.sort((a, b) => String(b.updated_date || "").localeCompare(String(a.updated_date || "")));
  writeJson(FILES.proposalIndex, proposals);
  writeJson(FILES.invoiceIndex, invoices);
  logDocument("indexes_rebuilt", `${proposals.length} proposals / ${invoices.length} invoices`, DIRS.logs);
}

function scanJsonDocs(dir) {
  if (!fm.fileExists(dir)) return [];
  const found = [];
  fm.listContents(dir).forEach(name => {
    if (!name.endsWith(".json")) return;
    const path = fm.joinPath(dir, name);
    if (fm.isDirectory(path)) return;
    const doc = readJson(path, null);
    if (doc && doc.manager && doc.customer && doc.job && doc.scope && doc.pricing) found.push({ doc, path });
  });
  return found;
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
  const id = nextProposalIdPreview(settings);
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

function keepSortKeysCurrent(doc) {
  const date = doc.manager.updated_date || todayIso();
  doc.manager.sort_year = date.slice(0, 4);
  doc.manager.sort_month = date.slice(0, 7);
  doc.manager.sort_week = weekKey(new Date(date));
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

function status(value) {
  return String(value || "open").toLowerCase().trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
