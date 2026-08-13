// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: receipt;

const fm = FileManager.iCloud();
const docs = fm.documentsDirectory();
const PURCHASE_HISTORY_URL = "https://www.homedepot.com/myaccount/purchase-history";
const csvPath = fm.joinPath(docs, "Home-Depot-Purchase-History.csv");
const htmlPath = fm.joinPath(docs, "Home-Depot-Purchase-History-Raw.html");
const jsonPath = fm.joinPath(docs, "Home-Depot-Purchase-History-Raw.json");

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function buildCSV(rows) {
  const headers = [
    "Date", "Receipt / Order #", "Total", "PO / Job Name",
    "Store #", "Store / Origin", "Transaction ID", "Register #",
    "Transaction Type", "Items", "Order Details URL"
  ];
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push([
      r.date, r.number, r.total, r.poJobName,
      r.storeNumber, r.orderOrigin, r.transactionId, r.registerNumber,
      r.transactionType, (r.items || []).join(" | "), r.detailsURL
    ].map(csvCell).join(","));
  }
  return lines.join("\n");
}

async function showStart() {
  const a = new Alert();
  a.title = "Home Depot Receipt Exporter";
  a.message = [
    "1. Open Purchase History.",
    "2. Scroll until the purchases you want are loaded.",
    "3. Tap Close.",
    "",
    "The script will read the purchase cards and save a CSV plus raw backup files in iCloud/Scriptable."
  ].join("\n");
  a.addAction("Open Purchase History");
  a.addCancelAction("Cancel");
  return await a.presentAlert();
}

async function showResult(rows, pageURL) {
  const a = new Alert();
  a.title = rows.length ? "Home Depot export created" : "No purchase cards detected";
  a.message = rows.length
    ? `${rows.length} purchases found.\n\nSaved:\nHome-Depot-Purchase-History.csv\nHome-Depot-Purchase-History-Raw.html\nHome-Depot-Purchase-History-Raw.json`
    : `Raw page saved for troubleshooting.\n\nCurrent page:\n${pageURL || "Unknown"}`;
  if (rows.length) a.addAction("Export CSV");
  a.addCancelAction("Done");
  const c = await a.presentAlert();
  if (rows.length && c === 0) await DocumentPicker.export(csvPath);
}

async function main() {
  if (await showStart() !== 0) return;

  const w = new WebView();
  await w.loadURL(PURCHASE_HISTORY_URL);
  await w.present(true);

  let pageURL = "";
  try { pageURL = await w.evaluateJavaScript("location.href", false); } catch (_) {}

  let html = "";
  try {
    html = await w.getHTML();
    fm.writeString(htmlPath, html || "");
  } catch (_) {}

  const scrapeJS = `
  (() => {
    const clean = s => String(s || '').replace(/\\s+/g, ' ').trim();
    const anchors = Array.from(document.querySelectorAll('a[data-testid="order-details-link"]'));

    const results = anchors.map(a => {
      const href = a.getAttribute('href') || '';
      const u = new URL(href, location.origin);
      const q = u.searchParams;
      const txt = clean(a.innerText);

      const receiptMatch = txt.match(/(?:Receipt|Order)\\s*#\\s*([A-Z0-9-]+)/i);
      const dateTotalMatch = txt.match(/((?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2},\\s+\\d{4})\\s*\\|\\s*Total:\\s*(\\$[0-9,]+(?:\\.[0-9]{2})?)/i);

      const itemNames = Array.from(a.querySelectorAll('img[alt]'))
        .map(img => clean(img.getAttribute('alt')))
        .filter(Boolean);

      let poJobName = q.get('POJobName') || '';
      let orderOrigin = q.get('orderOrigin') || '';
      try { poJobName = decodeURIComponent(poJobName); } catch (_) {}
      try { orderOrigin = decodeURIComponent(decodeURIComponent(orderOrigin)); } catch (_) {}

      return {
        date: dateTotalMatch ? dateTotalMatch[1] : (q.get('salesDate') || ''),
        number: receiptMatch ? receiptMatch[1] : (q.get('orderNumber') || ''),
        total: dateTotalMatch ? dateTotalMatch[2] : '',
        poJobName,
        storeNumber: q.get('storeNumber') || '',
        orderOrigin,
        transactionId: q.get('transactionId') || '',
        registerNumber: q.get('registerNumber') || '',
        transactionType: q.get('transactionType') || '',
        items: itemNames,
        detailsURL: u.href,
        rawText: txt
      };
    });

    return {
      results,
      title: document.title,
      url: location.href,
      bodyText: clean(document.body?.innerText || '').slice(0, 30000)
    };
  })();`;

  let scraped = { results: [], title: "", url: pageURL, bodyText: "" };
  try {
    scraped = await w.evaluateJavaScript(scrapeJS, false) || scraped;
  } catch (e) {
    scraped.error = String(e);
  }

  const seen = new Set();
  const rows = [];
  for (const r of (Array.isArray(scraped.results) ? scraped.results : [])) {
    const key = `${r.number}|${r.date}|${r.storeNumber}|${r.transactionId}`;
    if (!r.number || seen.has(key)) continue;
    seen.add(key);
    rows.push(r);
  }

  rows.sort((a, b) => {
    const da = new Date(a.date).getTime() || 0;
    const db = new Date(b.date).getTime() || 0;
    return db - da;
  });

  fm.writeString(jsonPath, JSON.stringify(scraped, null, 2));
  fm.writeString(csvPath, buildCSV(rows));
  await showResult(rows, scraped.url || pageURL);
}

await main();
Script.complete();
