// Spray GenX WRA — Legacy Import Fix
// Version: 2026.07.04
// Run once in Scriptable if old proposals/invoices import without names or dollar amounts.

const fm = FileManager.iCloud();
const ROOT = fm.joinPath(fm.documentsDirectory(), "SprayGenX");
const DIRS = {
  root: ROOT,
  data: fm.joinPath(ROOT, "Data"),
  logs: fm.joinPath(ROOT, "Logs"),
  proposals: fm.joinPath(ROOT, "Proposals"),
  invoices: fm.joinPath(ROOT, "Invoices")
};
const FILES = {
  proposals: fm.joinPath(DIRS.logs, "proposal_index.json"),
  invoices: fm.joinPath(DIRS.logs, "invoice_index.json"),
  report: fm.joinPath(DIRS.logs, "legacy_import_fix_report.json")
};

Object.values(DIRS).forEach(ensure);

const imported = [];
const skipped = [];

await main();

async function main() {
  const jsonFiles = unique([
    ...walk(DIRS.data, ".json"),
    ...walk(DIRS.proposals, ".json"),
    ...walk(DIRS.invoices, ".json")
  ]).filter(p => !p.endsWith("settings.json") && !p.endsWith("proposal_index.json") && !p.endsWith("invoice_index.json"));

  for (const path of jsonFiles) importJsonFile(path);

  const csvFiles = unique([
    ...walk(DIRS.data, ".csv"),
    ...walk(DIRS.logs, ".csv")
  ]);
  for (const path of csvFiles) importCsvFile(path);

  rebuildIndexes();
  writeJson(FILES.report, {
    fixed_at: new Date().toISOString(),
    imported_count: imported.length,
    skipped_count: skipped.length,
    imported,
    skipped
  });

  await notice("Legacy Import Fixed", `${imported.length} document(s) normalized.\n${skipped.length} skipped.\n\nOpen the main manager and tap Rebuild Data if needed.`);
}

function importJsonFile(path, overlay) {
  const raw = readJson(path, null);
  if (!raw) return skipped.push({ path, reason: "bad_json" });
  if (Array.isArray(raw)) {
    raw.forEach((item, index) => normalizeAndWrite(Object.assign({}, item, overlay || {}), `${path}#${index}`));
    return;
  }
  normalizeAndWrite(Object.assign({}, raw, overlay || {}), path);
}

function importCsvFile(path) {
  const rows = parseCsv(fm.readString(path));
  rows.forEach((row, index) => {
    const jsonPath = row.JsonPath || row.jsonPath || row.JSONPath || row.path || row.FilePath || "";
    if (jsonPath && String(jsonPath).endsWith(".json") && fm.fileExists(jsonPath)) {
      importJsonFile(jsonPath, row);
    } else {
      normalizeAndWrite(row, `${path}#${index + 1}`);
    }
  });
}

function normalizeAndWrite(raw, source) {
  const flat = flatten(raw);
  const id = first(flat, ["docno", "documentno", "number", "id", "invoiceid", "proposalid"]) || idFromSource(source);
  const kind = detectKind(raw, source, id);
  if (!id || !kind) return skipped.push({ source, reason: "missing_id_or_kind" });

  const total = num(first(flat, [
    "price", "total", "amount", "grandtotal", "totalprice", "invoicetotal", "proposaltotal", "contracttotal", "bidtotal", "balance", "balancedue", "pricingtotal"
  ]));
  const deposit = num(first(flat, ["deposit", "paid", "amountpaid", "payment", "pricingdeposit"]));
  const created = toIso(first(flat, ["date", "created", "createddate", "managercreateddate", "documentdate"]));
  const customer = first(flat, ["client", "customer", "customername", "clientname", "name", "billto", "company", "business", "customernamename"]);
  const title = first(flat, ["project", "title", "job", "jobname", "projectname", "scope", "summary", "description"]);
  const statusValue = first(flat, ["status", "managerstatus"]) || (kind === "invoice" ? "unpaid" : "open");

  const doc = {
    id,
    kind,
    source_path: source,
    customer: clean(customer),
    contact: clean(first(flat, ["contact", "gc", "generalcontractor", "customercontact"])),
    phone: clean(first(flat, ["phone", "customerphone", "clientphone"])),
    email: clean(first(flat, ["email", "customeremail", "clientemail"])),
    title: clean(title),
    site: clean(first(flat, ["site", "address", "jobsite", "siteaddress", "projectaddress", "customeraddress"])),
    city: clean(first(flat, ["city", "sitecity", "projectcity"])),
    category: clean(first(flat, ["category", "type", "jobtype"])),
    summary: clean(first(flat, ["summary", "scopesummary", "description"])),
    details: clean(first(flat, ["details", "scopedetails", "workscope", "scopeofwork", "scope"])),
    notes: clean(first(flat, ["notes", "exclusions", "termsnotes", "note"])),
    total,
    deposit,
    balance_due: Math.max(0, total - deposit),
    status: clean(statusValue),
    created,
    updated: toIso(first(flat, ["updated", "updateddate", "managerupdateddate"])) || created
  };
  sortKeys(doc);

  const outDir = kind === "invoice" ? DIRS.invoices : DIRS.proposals;
  const outPath = fm.joinPath(outDir, `${doc.id}.json`);
  writeJson(outPath, doc);
  imported.push({ id: doc.id, kind, customer: doc.customer, title: doc.title, total: doc.total, outPath });
}

function rebuildIndexes() {
  const p = walk(DIRS.proposals, ".json").map(path => slim(readJson(path, null), path)).filter(Boolean);
  const i = walk(DIRS.invoices, ".json").map(path => slim(readJson(path, null), path)).filter(Boolean);
  writeJson(FILES.proposals, dedupe(p).sort(byUpdated));
  writeJson(FILES.invoices, dedupe(i).sort(byUpdated));
}

function slim(d, path) {
  if (!d || !d.id) return null;
  return {
    id: d.id,
    kind: d.kind,
    path,
    customer: d.customer || "",
    title: d.title || "",
    site: d.site || "",
    city: d.city || "",
    status: d.status || "open",
    total: Number(d.total || 0),
    deposit: Number(d.deposit || 0),
    balance_due: Number(d.balance_due || 0),
    created: d.created || today(),
    updated: d.updated || d.created || today(),
    sort_year: d.sort_year,
    sort_month: d.sort_month,
    sort_week: d.sort_week
  };
}

function detectKind(raw, source, id) {
  const text = `${source} ${id} ${JSON.stringify(raw)}`.toLowerCase();
  if (text.includes("invoice") || String(id).toUpperCase().startsWith("INV-")) return "invoice";
  if (text.includes("proposal") || String(id).toUpperCase().startsWith("PROP-") || String(id).toUpperCase().startsWith("SGX-")) return "proposal";
  return "proposal";
}

function flatten(obj, prefix, out) {
  out = out || {};
  if (!obj || typeof obj !== "object") return out;
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    const normalized = norm(prefix ? `${prefix}_${key}` : key);
    if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, normalized, out);
    else out[normalized] = value;
  });
  return out;
}

function first(flat, keys) {
  for (const key of keys) {
    const k = norm(key);
    if (flat[k] !== undefined && flat[k] !== null && String(flat[k]).trim() !== "") return flat[k];
  }
  for (const want of keys.map(norm)) {
    const found = Object.keys(flat).find(k => k.endsWith(want) && flat[k] !== undefined && String(flat[k]).trim() !== "");
    if (found) return flat[found];
  }
  return "";
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === "," && !quoted) { row.push(cell); cell = ""; continue; }
    if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = ""; continue;
    }
    cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim());
  return rows.filter(r => r.some(c => String(c).trim())).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i] || "");
    return obj;
  });
}

function walk(dir, ext) {
  const result = [];
  if (!fm.fileExists(dir)) return result;
  for (const name of fm.listContents(dir)) {
    const path = fm.joinPath(dir, name);
    if (fm.isDirectory(path)) result.push(...walk(path, ext));
    else if (!ext || name.toLowerCase().endsWith(ext)) result.push(path);
  }
  return result;
}

function unique(list) { return [...new Set(list)]; }
function clean(v) { return String(v ?? "").trim(); }
function norm(v) { return String(v || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function num(v) { return Number(String(v || "0").replace(/[^0-9.-]/g, "")) || 0; }
function idFromSource(source) { const m = String(source || "").match(/(INV|PROP|SGX)-\d{4}-\d+/i); return m ? m[0].toUpperCase() : ""; }
function today() { return new Date().toISOString().slice(0, 10); }
function toIso(v) { const s = String(v || "").trim(); if (!s) return today(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d = new Date(s); return isNaN(d.getTime()) ? today() : d.toISOString().slice(0, 10); }
function sortKeys(d) { const date = d.created || today(); d.sort_year = date.slice(0, 4); d.sort_month = date.slice(0, 7); d.sort_week = weekKey(new Date(date)); }
function weekKey(date) { const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); const week = Math.ceil((((d - start) / 86400000) + 1) / 7); return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`; }
function byUpdated(a, b) { return String(b.updated || "").localeCompare(String(a.updated || "")); }
function dedupe(list) { const m = {}; list.forEach(d => { m[d.id] = d; }); return Object.values(m); }
function readJson(path, fallback) { try { if (!fm.fileExists(path)) return fallback; return JSON.parse(fm.readString(path)); } catch (e) { return fallback; } }
function writeJson(path, value) { fm.writeString(path, JSON.stringify(value, null, 2)); }
function ensure(path) { if (!fm.fileExists(path)) fm.createDirectory(path, true); }
async function notice(title, message) { const a = new Alert(); a.title = title; a.message = String(message || ""); a.addAction("OK"); await a.presentAlert(); }
