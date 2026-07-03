// Spray GenX WRA Legacy Bridge
// Run this once in Scriptable before using the UX manager.
// It copies old proposal/invoice JSON files into the UX manager folder and rebuilds simple indexes.
// It does not remove or change the old files.

const fm = FileManager.iCloud();
const docs = fm.documentsDirectory();
const uxRoot = fm.joinPath(docs, "SprayGenX");
const uxProposals = fm.joinPath(uxRoot, "Proposals");
const uxInvoices = fm.joinPath(uxRoot, "Invoices");
const uxLogs = fm.joinPath(uxRoot, "Logs");
const uxData = fm.joinPath(uxRoot, "Data");

const oldRoots = [
  docs,
  fm.joinPath(docs, "WRA"),
  fm.joinPath(docs, "Spray GenX"),
  fm.joinPath(docs, "SprayGenX WRA"),
  fm.joinPath(docs, "WRA Manager")
];

ensure(uxRoot);
ensure(uxProposals);
ensure(uxInvoices);
ensure(uxLogs);
ensure(uxData);

let copiedProposals = 0;
let copiedInvoices = 0;

for (const root of oldRoots) {
  if (root === uxRoot) continue;
  copiedProposals += copyJsonFolder(fm.joinPath(root, "Proposals"), uxProposals, "proposal");
  copiedInvoices += copyJsonFolder(fm.joinPath(root, "Invoices"), uxInvoices, "invoice");
}

const proposals = scan(uxProposals, "proposal");
const invoices = scan(uxInvoices, "invoice");
writeJson(fm.joinPath(uxLogs, "proposal_index.json"), proposals);
writeJson(fm.joinPath(uxLogs, "invoice_index.json"), invoices);
writeJson(fm.joinPath(uxLogs, "legacy_bridge_log.json"), {
  at: new Date().toISOString(),
  copiedProposals,
  copiedInvoices,
  totalProposals: proposals.length,
  totalInvoices: invoices.length,
  uxRoot
});

await notice("Legacy Bridge Complete", `Copied ${copiedProposals} proposal file(s) and ${copiedInvoices} invoice file(s).\n\nUX totals now:\n${proposals.length} proposals\n${invoices.length} invoices\n\nOld files were not changed.`);

function copyJsonFolder(source, target, kind) {
  if (!fm.fileExists(source) || !fm.isDirectory(source)) return 0;
  let count = 0;
  for (const name of fm.listContents(source)) {
    const src = fm.joinPath(source, name);
    if (fm.isDirectory(src) || !name.toLowerCase().endsWith(".json")) continue;
    const doc = normalize(readJson(src, null), kind, src);
    if (!doc || !doc.id) continue;
    const dst = fm.joinPath(target, `${doc.id}.json`);
    if (!fm.fileExists(dst)) {
      writeJson(dst, doc);
      count++;
    }
  }
  return count;
}

function scan(dir, kind) {
  if (!fm.fileExists(dir)) return [];
  return fm.listContents(dir)
    .filter(n => n.toLowerCase().endsWith(".json"))
    .map(n => normalize(readJson(fm.joinPath(dir, n), null), kind, fm.joinPath(dir, n)))
    .filter(Boolean)
    .map(slim)
    .sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || "")));
}

function normalize(d, kind, path) {
  if (!d) return null;
  if (d.manager || d.customer?.name || d.job || d.scope || d.pricing) {
    const m = d.manager || {};
    const c = d.customer || {};
    const j = d.job || {};
    const s = d.scope || {};
    const p = d.pricing || {};
    const total = Number(p.total ?? d.total ?? 0);
    const deposit = Number(p.deposit ?? d.deposit ?? 0);
    return {
      id: d.id || m.invoice_id || m.proposal_id || base(path),
      kind,
      customer: c.name || "",
      contact: c.contact || "",
      phone: c.phone || "",
      email: c.email || "",
      title: j.title || "",
      site: j.site || c.address || "",
      city: j.city || c.city || "",
      category: j.category || "",
      summary: s.summary || "",
      details: s.details || "",
      notes: [s.exclusions, s.notes].filter(Boolean).join("\n\n"),
      total,
      deposit,
      balance_due: Math.max(0, total - deposit),
      status: kind === "invoice" ? (m.payment_status || m.status || "unpaid") : (m.status || "open"),
      created: m.created_date || today(),
      updated: m.updated_date || m.created_date || today()
    };
  }
  d.id = d.id || base(path);
  d.kind = kind;
  d.total = Number(d.total || 0);
  d.deposit = Number(d.deposit || 0);
  d.balance_due = Math.max(0, d.total - d.deposit);
  d.created = d.created || today();
  d.updated = d.updated || d.created;
  return d;
}

function slim(d) {
  const date = d.created || today();
  return {
    id: d.id,
    kind: d.kind,
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
    sort_year: date.slice(0, 4),
    sort_month: date.slice(0, 7),
    sort_week: weekKey(new Date(date))
  };
}

function ensure(path) { if (!fm.fileExists(path)) fm.createDirectory(path, true); }
function readJson(path, fallback) { try { return JSON.parse(fm.readString(path)); } catch (e) { return fallback; } }
function writeJson(path, value) { fm.writeString(path, JSON.stringify(value, null, 2)); }
function base(path) { return String(path || "").split("/").pop().replace(/\.json$/i, ""); }
function today() { return new Date().toISOString().slice(0, 10); }
function weekKey(date) { const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); const week = Math.ceil((((d - start) / 86400000) + 1) / 7); return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`; }
async function notice(title, message) { const a = new Alert(); a.title = title; a.message = message; a.addAction("OK"); await a.presentAlert(); }