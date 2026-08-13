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

function normalizeText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function buildCSV(rows) {
  const headers = [
    "Date",
    "Receipt / Order #",
    "Total",
    "Type",
    "Summary",
    "Page URL"
  ];
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push([
      r.date || "",
      r.number || "",
      r.total || "",
      r.type || "",
      r.summary || "",
      r.url || ""
    ].map(csvCell).join(","));
  }
  return lines.join("\n");
}

async function showStart() {
  const a = new Alert();
  a.title = "Home Depot Receipt Exporter";
  a.message = [
    "1. Log in if needed.",
    "2. Open Purchase History.",
    "3. Scroll so the purchases you want are loaded.",
    "4. Close the browser with Done.",
    "",
    "The script will then scan the loaded page and create a CSV in your Scriptable iCloud folder."
  ].join("\n");
  a.addAction("Open Purchase History");
  a.addCancelAction("Cancel");
  return await a.presentAlert();
}

async function showResult(rows, pageURL) {
  const a = new Alert();
  a.title = rows.length ? "Home Depot export created" : "No receipts detected yet";
  a.message = rows.length
    ? `${rows.length} purchase records found.\n\nSaved:\nHome-Depot-Purchase-History.csv\nHome-Depot-Purchase-History-Raw.html\nHome-Depot-Purchase-History-Raw.json`
    : `I saved the raw page so we can refine the extractor.\n\nCurrent page:\n${pageURL || "Unknown"}\n\nTry again after opening Purchase History and scrolling the list.`;
  if (rows.length) a.addAction("Export CSV");
  a.addCancelAction("Done");
  const c = await a.presentAlert();
  if (rows.length && c === 0) await DocumentPicker.export(csvPath);
}

function uniqueRows(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const key = [r.date, r.number, r.total, r.summary].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

async function main() {
  if (await showStart() !== 0) return;

  const w = new WebView();
  await w.loadURL(PURCHASE_HISTORY_URL);
  await w.present(true);

  // After the user closes the WebView, inspect the exact page that is still loaded.
  let pageURL = "";
  try {
    pageURL = await w.evaluateJavaScript("location.href", false);
  } catch (_) {}

  let html = "";
  try {
    html = await w.getHTML();
    fm.writeString(htmlPath, html || "");
  } catch (_) {}

  const scrapeJS = `
  (() => {
    const clean = s => String(s || '').replace(/\\s+/g, ' ').trim();
    const money = s => {
      const m = clean(s).match(/\\$\\s?[0-9,]+(?:\\.[0-9]{2})?/);
      return m ? m[0].replace(/\\s+/g,'') : '';
    };
    const date = s => {
      const t = clean(s);
      const m = t.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2},?\\s+\\d{4}/i);
      return m ? m[0].replace(/^(\\w+\\s+\\d{1,2}),?\\s+(\\d{4})$/, '$1, $2') : '';
    };
    const number = s => {
      const t = clean(s);
      let m = t.match(/Receipt\\s*#?\\s*([A-Z0-9-]+)/i);
      if (m) return m[1];
      m = t.match(/Order\\s*#?\\s*([A-Z0-9-]+)/i);
      return m ? m[1] : '';
    };

    const results = [];
    const nodes = Array.from(document.querySelectorAll('article, li, section, div'));

    for (const el of nodes) {
      const txt = clean(el.innerText);
      if (!txt || txt.length < 20 || txt.length > 1800) continue;
      if (!/Receipt\\s*#|Order\\s*#/i.test(txt)) continue;
      const n = number(txt);
      const d = date(txt);
      const totalMatch = txt.match(/Total:?\\s*\\$\\s?[0-9,]+(?:\\.[0-9]{2})?/i);
      const total = totalMatch ? money(totalMatch[0]) : money(txt);
      if (!n && !d && !total) continue;

      results.push({
        date: d,
        number: n,
        total,
        type: /Receipt\\s*#/i.test(txt) ? 'Receipt' : 'Order',
        summary: txt.slice(0, 1200),
        url: location.href
      });
    }

    // Also inspect Next.js / JSON script blocks for purchase-like records.
    const jsonScripts = Array.from(document.querySelectorAll('script[type="application/json"], script#__NEXT_DATA__'));
    const rawJson = jsonScripts.map(s => s.textContent || '').filter(Boolean);

    return { results, rawJson, title: document.title, url: location.href, bodyText: clean(document.body?.innerText || '').slice(0, 20000) };
  })();`;

  let scraped = { results: [], rawJson: [], title: "", url: pageURL, bodyText: "" };
  try {
    scraped = await w.evaluateJavaScript(scrapeJS, false) || scraped;
  } catch (e) {
    scraped.error = String(e);
  }

  const rows = uniqueRows(Array.isArray(scraped.results) ? scraped.results : []);
  fm.writeString(jsonPath, JSON.stringify(scraped, null, 2));
  fm.writeString(csvPath, buildCSV(rows));

  await showResult(rows, scraped.url || pageURL);
}

await main();
Script.complete();
