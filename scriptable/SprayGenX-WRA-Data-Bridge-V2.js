// Spray GenX WRA Data Bridge V2
// Imports old SprayGenX/Data JSON records into the UX Manager indexes.
// Safe: does not delete old records. It only reads Data/*.json and writes Logs/*_index.json.

const fm = FileManager.iCloud();
const root = fm.joinPath(fm.documentsDirectory(), "SprayGenX");
const dataDir = fm.joinPath(root, "Data");
const logsDir = fm.joinPath(root, "Logs");

ensure(logsDir);

const proposalIndex = [];
const invoiceIndex = [];
let readCount = 0;
let skippedCount = 0;

if (!fm.fileExists(dataDir)) {
  await notice("Data Folder Missing", `Could not find:\n${dataDir}`);
  Script.complete();
}

for (const name of fm.listContents(dataDir)) {
  if (!name.toLowerCase().endsWith(".json")) continue;
  const path = fm.joinPath(dataDir, name);
  const raw = readJson(path, null);
  const doc = normalizeRecord(raw, name, path);
  if (!doc) { skippedCount++; continue; }
  readCount++;
  if (doc.kind === "invoice") invoiceIndex.push(slim(doc));
  else proposalIndex.push(slim(doc));
}

proposalIndex.sort(byUpdated);
invoiceIndex.sort(byUpdated);

writeJson(fm.joinPath(logsDir, "proposal_index.json"), proposalIndex);
writeJson(fm.joinPath(logsDir, "invoice_index.json"), invoiceIndex);
writeJson(fm.joinPath(logsDir, "data_bridge_v2_log.json"), {
  at: new Date().toISOString(),
  dataDir,
  readCount,
  skippedCount,
  proposals: proposalIndex.length,
  invoices: invoiceIndex.length
});

await notice("Data Bridge Complete", `Read ${readCount} old Data record(s).\n\nUX indexes now:\n${proposalIndex.length} proposals\n${invoiceIndex.length} invoices\n\nSkipped: ${skippedCount}\n\nOld files were not changed.`);
Script.complete();

function normalizeRecord(raw, filename, path) {
  if (!raw) return null;
  const text = JSON.stringify(raw).toLowerCase();
  const file = String(filename || "");
  const isInvoice = file.includes("INV-") || file.toLowerCase().includes("invoice") || text.includes('"invoice"');
  const isProposal = file.includes("SGX-") || file.includes("PROP-") || file.toLowerCase().includes("proposal") || text.includes('"proposal"');
  const kind = isInvoice ? "invoice" : isProposal ? "proposal" : "proposal";

  const id = first(raw.docNo, raw.DocNo, raw.number, raw.id, raw.proposalNo, raw.invoiceNo, raw.proposalNumber, raw.invoiceNumber, idFromFilename(file));
  const client = first(raw.client, raw.Client, raw.customer, raw.customerName, raw.name, raw.company, nested(raw, "customer", "name"));
  const project = first(raw.project, raw.Project, raw.job, raw.jobName, raw.title, raw.scopeTitle, nested(raw, "job", "title"));
  const date = toIso(first(raw.date, raw.Date, raw.created, raw.createdDate, raw.created_date, raw.issueDate, today()));
  const updated = toIso(first(raw.updated, raw.updatedDate, raw.updated_date, date));
  const total = moneyNumber(first(raw.price, raw.Price, raw.total, raw.amount, raw.grandTotal, nested(raw, "pricing", "total"), 0));
  const deposit = moneyNumber(first(raw.deposit, raw.paid, raw.amountPaid, nested(raw, "pricing", "deposit"), 0));

  return {
    id,
    kind,
    path,
    customer: String(client || ""),
    contact: String(first(raw.contact, raw.gc, raw.contractor, "")),
    phone: String(first(raw.phone, raw.Phone, "")),
    email: String(first(raw.email, raw.Email, "")),
    title: String(project || ""),
    site: String(first(raw.site, raw.address, raw.jobAddress, nested(raw, "job", "site"), "")),
    city: String(first(raw.city, nested(raw, "job", "city"), "")),
    category: String(first(raw.category, raw.type, "")),
    status: String(first(raw.status, kind === "invoice" ? "unpaid" : "open")),
    total,
    deposit,
    balance_due: Math.max(0, total - deposit),
    created: date,
    updated,
    sort_year: date.slice(0, 4),
    sort_month: date.slice(0, 7),
    sort_week: weekKey(new Date(date))
  };
}

function slim(d) {
  return {
    id: d.id,
    kind: d.kind,
    path: d.path,
    customer: d.customer,
    title: d.title,
    site: d.site,
    city: d.city,
    status: d.status,
    total: d.total,
    deposit: d.deposit,
    balance_due: d.balance_due,
    created: d.created,
    updated: d.updated,
    sort_year: d.sort_year,
    sort_month: d.sort_month,
    sort_week: d.sort_week
  };
}

function idFromFilename(name) {
  const m = String(name).match(/(SGX|PROP|INV)-\d{4}-\d+/i);
  return m ? m[0].toUpperCase() : String(name).replace(/\.json$/i, "");
}

function nested(obj, a, b) { try { return obj[a] && obj[a][b]; } catch (e) { return ""; } }
function first(...vals) { for (const v of vals) if (v !== undefined && v !== null && String(v).trim() !== "") return v; return ""; }
function moneyNumber(v) { return Number(String(v || "0").replace(/[^0-9.-]/g, "")) || 0; }
function toIso(v) {
  const s = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return today();
}
function byUpdated(a, b) { return String(b.updated || "").localeCompare(String(a.updated || "")); }
function ensure(path) { if (!fm.fileExists(path)) fm.createDirectory(path, true); }
function readJson(path, fallback) { try { return JSON.parse(fm.readString(path)); } catch (e) { return fallback; } }
function writeJson(path, value) { fm.writeString(path, JSON.stringify(value, null, 2)); }
function today() { return new Date().toISOString().slice(0, 10); }
function weekKey(date) { const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); const week = Math.ceil((((d - start) / 86400000) + 1) / 7); return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`; }
async function notice(title, message) { const a = new Alert(); a.title = title; a.message = message; a.addAction("OK"); await a.presentAlert(); }