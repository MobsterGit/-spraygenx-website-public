// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: wrench;
// Spray GenX WRA Manager — image branding patch
// Syntax-safe patch: uses function source instead of nested template literals.

const fm = FileManager.iCloud();
const docs = fm.documentsDirectory();
const candidates = [
  fm.joinPath(docs, "WRA Manager.js"),
  fm.joinPath(docs, "SprayGenX/WRA Manager.js"),
  fm.joinPath(docs, "SprayGenX/WRA-Manager.js")
];
let target = candidates.find(p => fm.fileExists(p));
if (!target) {
  const a = new Alert();
  a.title = "WRA Manager Not Found";
  a.message = "Expected WRA Manager.js in Scriptable Documents or the SprayGenX folder.";
  a.addAction("OK");
  await a.presentAlert();
  Script.complete();
  return;
}

if (fm.isFileDownloaded && !fm.isFileDownloaded(target)) await fm.downloadFileFromiCloud(target);
let src = fm.readString(target);
const original = src;

if (!/templates:\s*fm\.joinPath\(ROOT,\s*["']Templates["']\)/.test(src)) {
  src = src.replace(
    /photos:\s*fm\.joinPath\(ROOT,\s*["']Photos["']\)\s*\n\};/,
    'photos: fm.joinPath(ROOT, "Photos"),\n  templates: fm.joinPath(ROOT, "Templates")\n};'
  );
}

src = src.replace(/\n?const MEDALLION_IMAGE_BASE64\s*=\s*["'][\s\S]*?["'];\s*\n/, "\n");

function patchedWriteHtml(d, kind) {
  const s = getSettings();
  ensureMedia(d);
  const outDir = kind === "invoice" ? DIRS.invoices : DIRS.proposals;
  const path = fm.joinPath(outDir, `${d.id}.html`);
  const logoFile = materializeBrandImage(outDir, "logo", ["logo.png","Logo-SprayGenxLLC.PNG","Actual-Logo-SprayGenX.png","SprayGenX-Logo.png","SprayGenX-Logo.jpg","SprayGenX Logo.png"], "SprayGenX-Logo.png");
  const medallionFile = materializeBrandImage(outDir, "medallion", ["medallion.png","medallion.jpg","SprayGenX-Medallion.png","SprayGenX-Medallion.jpg","WRA-Medallion.png","WRA-Medallion.jpg"], "SprayGenX-Medallion.png");
  const logo = logoFile ? `<img class="brand-logo" src="${esc(logoFile)}" alt="Spray GenX LLC logo">` : "";
  const seal = medallionFile ? `<div class="seal"><img src="${esc(medallionFile)}" alt="Spray GenX medallion"></div>` : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#eee;color:#111;font:15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{background:white;max-width:820px;margin:0 auto;min-height:100vh;padding:28px 30px 74px;box-sizing:border-box}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:3px solid #111;padding-bottom:14px;margin-bottom:14px}.brand{max-width:54%;display:flex;align-items:flex-start;gap:13px}.brand-logo{display:block;max-width:150px;max-height:72px;width:auto;height:auto;object-fit:contain}.brand-copy{padding-top:2px}.brand h1{margin:0;font-size:24px}.brand p,.customer p,.docline p{margin:3px 0;color:#444}.customer{text-align:right;max-width:42%}.customer .label,.box h3{margin:0 0 7px;text-transform:uppercase;font-size:12px;letter-spacing:.08em;color:#444}.customer .name{font-size:19px;font-weight:800}.docline{display:flex;justify-content:space-between;gap:18px;margin:0 0 18px;color:#444}.docline h2{margin:0;text-transform:uppercase;font-size:17px}.project-photo{margin:14px 0 18px}.project-photo img{display:block;width:100%;max-height:250px;object-fit:cover;border:1px solid #ddd;border-radius:9px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.box{border:1px solid #ddd;border-radius:9px;padding:12px 14px;margin-bottom:14px}.scope{white-space:pre-wrap}.total-box{display:grid;grid-template-columns:112px 1fr;gap:14px;align-items:center;min-height:138px}.total-art{display:flex;align-items:center;justify-content:center}.total-copy{min-width:0}.price{font-size:30px;font-weight:800;text-align:right;margin:4px 0 14px}.total-copy p:not(.price){margin:8px 0;text-align:right}.seal{width:96px;height:96px;margin:0;opacity:.86}.seal img{display:block;width:100%;height:100%;object-fit:contain}.terms{border-top:1px solid #ddd;margin-top:12px;padding-top:10px;font-size:12px}@media screen and (max-width:650px){.top,.grid,.docline{display:block}.brand,.customer{max-width:none}.brand{display:flex}.customer{text-align:left;margin-top:14px}.page{padding:22px 22px 70px}.total-box{grid-template-columns:100px 1fr}}@media print{body{background:white}.page{max-width:none;margin:0;min-height:auto}.top{display:flex!important}.brand{max-width:54%!important;display:flex!important}.customer{max-width:42%!important;text-align:right!important;margin-top:0!important}.docline{display:flex!important}.grid{display:grid!important;grid-template-columns:1fr 1fr!important}.total-box{display:grid!important;grid-template-columns:112px 1fr!important}}
</style></head><body><main class="page"><section class="top"><div class="brand">${logo}<div class="brand-copy"><h1>${esc(s.companyName)}</h1><p>${esc(s.tagline)}</p><p>${esc(s.serviceArea)}</p><p>${esc([s.phone,s.email].filter(Boolean).join(" | "))}</p></div></div><div class="customer"><div class="label">Customer</div><div class="name">${esc(d.customer || "Customer")}</div><p>${esc([d.contact,d.phone,d.email].filter(Boolean).join(" | "))}</p><p>${esc([d.site,d.city].filter(Boolean).join(", "))}</p></div></section><section class="docline"><div><h2>${esc(kind)}</h2><p><strong>${esc(d.id)}</strong> | ${esc(d.created || today())} | ${esc(d.status || "open")}</p></div><div><p><strong>Project:</strong> ${esc(d.title)}</p><p>${esc(d.category || "")}</p></div></section>${projectPhotoHtml(d, outDir)}<section class="box"><h3>Scope Summary</h3><p class="scope">${esc(d.summary)}</p></section><section class="box"><h3>Scope Details</h3><p class="scope">${esc(d.details)}</p></section><section class="grid"><div class="box"><h3>Notes / Exclusions</h3><p class="scope">${esc(d.notes)}</p></div><div class="box"><h3>Total</h3><div class="total-box"><div class="total-art">${seal}</div><div class="total-copy"><p class="price">${money(d.total)}</p><p>Deposit / Paid: ${money(d.deposit)}</p><p>Balance Due: ${money(d.balance_due)}</p></div></div></div></section><section class="terms"><p><strong>Terms:</strong> ${esc(s.defaultTerms)}</p><p><strong>Warranty:</strong> ${esc(s.warrantyNote)}</p></section></main></body></html>`;
  fm.writeString(path, html);
  return path;
}

function patchedMaterializeBrandImage(outDir, type, candidates, outputName) {
  const roots = [DIRS.templates, DIRS.photos, DIRS.root];
  let imageSource = "";
  for (const dir of roots) {
    if (!dir || !fm.fileExists(dir)) continue;
    for (const name of candidates) {
      const p = fm.joinPath(dir, name);
      if (fm.fileExists(p)) { imageSource = p; break; }
    }
    if (imageSource) break;
    try {
      const hit = fm.listContents(dir).find(n => /\.(png|jpe?g)$/i.test(n) && n.toLowerCase().includes(type));
      if (hit) imageSource = fm.joinPath(dir, hit);
    } catch (e) {}
    if (imageSource) break;
  }
  if (!imageSource) return "";
  try {
    downloadIfNeeded(imageSource);
    const ext = /\.jpe?g$/i.test(imageSource) ? ".jpg" : ".png";
    const finalName = outputName.replace(/\.(png|jpe?g)$/i, ext);
    const dst = fm.joinPath(outDir, finalName);
    if (fm.fileExists(dst)) fm.remove(dst);
    fm.copy(imageSource, dst);
    return finalName;
  } catch (e) { return ""; }
}

const newWriteHtml = patchedWriteHtml.toString().replace(/^function patchedWriteHtml/, "function writeHtml") + "\n\n" + patchedMaterializeBrandImage.toString().replace(/^function patchedMaterializeBrandImage/, "function materializeBrandImage");
const writeStart = src.indexOf("function writeHtml(d, kind) {");
const copyStart = src.indexOf("function copyDir(", writeStart);
if (writeStart < 0 || copyStart < 0) {
  const a = new Alert();
  a.title = "Patch Failed";
  a.message = "Could not locate the current writeHtml section. No changes were written.";
  a.addAction("OK");
  await a.presentAlert();
  Script.complete();
  return;
}
src = src.slice(0, writeStart) + newWriteHtml + "\n\n" + src.slice(copyStart);
src = src.replace(/\nfunction materializeMedallion\(outDir\)\s*\{[\s\S]*?\n\}\s*(?=\nfunction downloadIfNeeded)/, "\n");

if (src === original) {
  const a = new Alert();
  a.title = "No Changes Needed";
  a.message = "The WRA Manager already appears to contain the image branding layout.";
  a.addAction("OK");
  await a.presentAlert();
  Script.complete();
  return;
}
const backup = target.replace(/\.js$/i, "-before-branding-fix.js");
if (!fm.fileExists(backup)) fm.copy(target, backup);
fm.writeString(target, src);
const a = new Alert();
a.title = "WRA Manager Updated";
a.message = "Done. Main logo and medallion use image files; medallion sits left of pricing. Backup: " + backup;
a.addAction("OK");
await a.presentAlert();
Script.complete();
