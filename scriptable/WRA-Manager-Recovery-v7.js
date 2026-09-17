// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: wrench;
// Spray GenX WRA Manager - Recovery v7
// Recovers from the best intact local WRA Manager copy, then applies image-file-only branding.

async function main() {
  const fm = FileManager.iCloud();
  const docs = fm.documentsDirectory();

  const targetCandidates = [
    fm.joinPath(docs, "WRA Manager.js"),
    fm.joinPath(docs, "SprayGenX/WRA Manager.js"),
    fm.joinPath(docs, "SprayGenX/WRA-Manager.js")
  ];
  const target = targetCandidates.find(p => fm.fileExists(p));
  if (!target) return await msg("WRA Manager Not Found", "Could not locate WRA Manager.js.");

  const candidates = [];
  collectCandidates(docs, candidates);
  const spray = fm.joinPath(docs, "SprayGenX");
  if (fm.fileExists(spray)) collectCandidates(spray, candidates);

  const unique = [...new Set(candidates)];
  const ranked = [];

  for (const path of unique) {
    try {
      await download(path);
      const text = fm.readString(path);
      const score = sourceScore(text, path);
      ranked.push({ path, text, score });
    } catch (e) {}
  }

  ranked.sort((a, b) => b.score - a.score);
  const source = ranked.find(x =>
    x.text.includes("function writeHtml(d, kind)") &&
    x.text.includes("function copyDir(") &&
    x.text.includes("function sortKeys(") &&
    x.text.includes("async function projectImageFlow(")
  );

  if (!source) {
    const detail = ranked.slice(0, 5).map(x => `${basename(x.path)} (${x.score})`).join("\n");
    return await msg("Recovery Stopped", "No intact WRA Manager source was found.\n\nCandidates checked:\n" + detail);
  }

  try {
    let src = source.text;

    src = removeNamedConst(src, "MEDALLION_IMAGE_BASE64");

    if (!src.includes('templates: fm.joinPath(ROOT, "Templates")')) {
      src = src.replace(
        '  photos: fm.joinPath(ROOT, "Photos")\n};',
        '  photos: fm.joinPath(ROOT, "Photos"),\n  templates: fm.joinPath(ROOT, "Templates")\n};'
      );
    }

    src = src.replace(/\n\s*const embedded = imageDataFromImage\(img, photoPath\);\n\s*if \(embedded\) \{[\s\S]*?\n\s*\}/g, "");
    src = src.replace(/^\s*doc\.media\.project_image_data\s*=.*$/gm, "");
    src = src.replace(/^\s*doc\.media\.project_image_mime\s*=.*$/gm, "");

    src = src.replace(
      /function ensureMedia\(d\) \{[^\n]*\}/,
      `function ensureMedia(d) {
  const current = d.media && typeof d.media === "object" ? d.media : {};
  d.media = { project_image_path: current.project_image_path || "" };
  return d;
}`
    );

    const writeStart = src.indexOf("function writeHtml(d, kind) {");
    const copyStart = src.indexOf("function copyDir(", writeStart);
    if (writeStart < 0 || copyStart < 0) throw new Error("Could not isolate document HTML generator.");

    const writeHtml = `function writeHtml(d, kind) {
  const s = getSettings();
  ensureMedia(d);
  const outDir = kind === "invoice" ? DIRS.invoices : DIRS.proposals;
  const path = fm.joinPath(outDir, \`\${d.id}.html\`);
  const logoFile = materializeBrandImage(outDir, "logo",
    ["logo.png","Logo-SprayGenxLLC.PNG","Actual-Logo-SprayGenX.png","SprayGenX-Logo.png","SprayGenX-Logo.jpg","SprayGenX Logo.png"],
    "SprayGenX-Logo.png");
  const medallionFile = materializeBrandImage(outDir, "medallion",
    ["medallion.png","medallion.jpg","SprayGenX-Medallion.png","SprayGenX-Medallion.jpg","WRA-Medallion.png","WRA-Medallion.jpg"],
    "SprayGenX-Medallion.png");
  const logo = logoFile ? \`<img class="brand-logo" src="\${esc(logoFile)}" alt="Spray GenX LLC logo">\` : "";
  const seal = medallionFile ? \`<div class="seal"><img src="\${esc(medallionFile)}" alt="Spray GenX medallion"></div>\` : "";
  const html = \`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#eee;color:#111;font:15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.page{background:white;max-width:820px;margin:0 auto;min-height:100vh;padding:28px 30px 74px;box-sizing:border-box}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:3px solid #111;padding-bottom:14px;margin-bottom:14px}
.brand{max-width:55%;display:flex;align-items:flex-start;gap:12px}
.brand-logo{display:block;max-width:150px;max-height:72px;width:auto;height:auto;object-fit:contain}
.brand-copy{padding-top:1px}.brand h1{margin:0;font-size:23px}
.brand p,.customer p,.docline p{margin:3px 0;color:#444}
.customer{text-align:right;max-width:42%}.customer .label,.box h3{margin:0 0 7px;text-transform:uppercase;font-size:12px;letter-spacing:.08em;color:#444}
.customer .name{font-size:19px;font-weight:800;color:#111}
.docline{display:flex;justify-content:space-between;gap:18px;margin:0 0 18px;color:#444}.docline h2{margin:0;text-transform:uppercase;font-size:17px}
.project-photo{margin:14px 0 18px}.project-photo img{display:block;width:100%;max-height:250px;object-fit:cover;border:1px solid #ddd;border-radius:9px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.box{border:1px solid #ddd;border-radius:9px;padding:12px 14px;margin-bottom:14px}
.scope{white-space:pre-wrap}
.total-box{display:grid;grid-template-columns:106px 1fr;gap:14px;align-items:center;min-height:118px}
.total-art{display:flex;align-items:center;justify-content:center}.total-copy{min-width:0}
.price{font-size:30px;font-weight:800;text-align:right;margin:2px 0 12px}
.total-copy p:not(.price){margin:7px 0;text-align:right}
.seal{width:90px;height:90px;margin:0;opacity:.86}.seal img{display:block;width:100%;height:100%;object-fit:contain}
.terms{border-top:1px solid #ddd;margin-top:12px;padding-top:10px;font-size:12px}
@media screen and (max-width:650px){.top,.grid,.docline{display:block}.brand,.customer{max-width:none}.brand{display:flex}.customer{text-align:left;margin-top:14px}.page{padding:22px 22px 70px}.total-box{grid-template-columns:96px 1fr}}
@media print{body{background:white}.page{max-width:none;margin:0;min-height:auto}.top{display:flex!important}.brand{max-width:55%!important;display:flex!important}.customer{max-width:42%!important;text-align:right!important;margin-top:0!important}.docline{display:flex!important}.grid{display:grid!important;grid-template-columns:1fr 1fr!important}.total-box{display:grid!important;grid-template-columns:106px 1fr!important}}
</style></head><body><main class="page">
<section class="top"><div class="brand">\${logo}<div class="brand-copy"><h1>\${esc(s.companyName)}</h1><p>\${esc(s.tagline)}</p><p>\${esc(s.serviceArea)}</p><p>\${esc([s.phone,s.email].filter(Boolean).join(" | "))}</p></div></div><div class="customer"><div class="label">Customer</div><div class="name">\${esc(d.customer || "Customer")}</div><p>\${esc([d.contact,d.phone,d.email].filter(Boolean).join(" | "))}</p><p>\${esc([d.site,d.city].filter(Boolean).join(", "))}</p></div></section>
<section class="docline"><div><h2>\${esc(kind)}</h2><p><strong>\${esc(d.id)}</strong> | \${esc(d.created || today())} | \${esc(d.status || "open")}</p></div><div><p><strong>Project:</strong> \${esc(d.title)}</p><p>\${esc(d.category || "")}</p></div></section>
\${projectPhotoHtml(d, outDir)}
<section class="box"><h3>Scope Summary</h3><p class="scope">\${esc(d.summary)}</p></section>
<section class="box"><h3>Scope Details</h3><p class="scope">\${esc(d.details)}</p></section>
<section class="grid"><div class="box"><h3>Notes / Exclusions</h3><p class="scope">\${esc(d.notes)}</p></div><div class="box"><h3>Total</h3><div class="total-box"><div class="total-art">\${seal}</div><div class="total-copy"><p class="price">\${money(d.total)}</p><p>Deposit / Paid: \${money(d.deposit)}</p><p>Balance Due: \${money(d.balance_due)}</p></div></div></div></section>
<section class="terms"><p><strong>Terms:</strong> \${esc(s.defaultTerms)}</p><p><strong>Warranty:</strong> \${esc(s.warrantyNote)}</p></section>
</main></body></html>\`;
  fm.writeString(path, html);
  return path;
}

`;
    src = src.slice(0, writeStart) + writeHtml + src.slice(copyStart);

    const photoStart = src.indexOf("function projectPhotoHtml(d, outDir)");
    const downloadStart = src.indexOf("function downloadIfNeeded(", photoStart);
    if (photoStart < 0 || downloadStart < 0) throw new Error("Could not isolate old image utilities.");

    const helpers = `function projectPhotoHtml(d, outDir) {
  const file = materializeProjectImage(d, outDir);
  return file ? \`<section class="project-photo"><img src="\${esc(file)}" alt="Project photo"></section>\` : "";
}
function materializeProjectImage(d, outDir) {
  ensureMedia(d);
  const p = d && d.media ? d.media.project_image_path : "";
  if (!p || !fm.fileExists(p)) return "";
  try {
    downloadIfNeeded(p);
    const ext = /\\.png$/i.test(p) ? ".png" : ".jpg";
    const name = String(d.id || "project") + "-project-image" + ext;
    const dst = fm.joinPath(outDir, name);
    if (fm.fileExists(dst)) fm.remove(dst);
    fm.copy(p, dst);
    return name;
  } catch (e) { return ""; }
}
function hasProjectImage(d) {
  ensureMedia(d);
  const p = d && d.media ? d.media.project_image_path : "";
  return !!(p && fm.fileExists(p));
}
function materializeBrandImage(outDir, type, candidates, outputName) {
  const roots = [DIRS.templates, DIRS.photos, DIRS.root];
  let imageSource = "";
  for (const dir of roots) {
    if (!dir || !fm.fileExists(dir)) continue;
    for (const name of candidates) {
      const candidate = fm.joinPath(dir, name);
      if (fm.fileExists(candidate)) { imageSource = candidate; break; }
    }
    if (imageSource) break;
    try {
      const hit = fm.listContents(dir).find(name => /\\.(png|jpe?g)$/i.test(name) && name.toLowerCase().includes(type));
      if (hit) imageSource = fm.joinPath(dir, hit);
    } catch (e) {}
    if (imageSource) break;
  }
  if (!imageSource) return "";
  try {
    downloadIfNeeded(imageSource);
    const ext = /\\.jpe?g$/i.test(imageSource) ? ".jpg" : ".png";
    const finalName = outputName.replace(/\\.(png|jpe?g)$/i, ext);
    const dst = fm.joinPath(outDir, finalName);
    if (fm.fileExists(dst)) fm.remove(dst);
    fm.copy(imageSource, dst);
    return finalName;
  } catch (e) { return ""; }
}
`;
    src = src.slice(0, photoStart) + helpers + src.slice(downloadStart);

    src = src.replace(/\/\/ Version: .*$/m, "// Version: 2026.08.09 Linked-5 Image Files Only");

    if (/toBase64String|fromBase64String|data:image\/|project_image_data|project_image_mime/i.test(src)) {
      throw new Error("Embedded-image code still remains after recovery.");
    }

    if (!src.includes('function materializeBrandImage(') ||
        !src.includes('function materializeProjectImage(') ||
        !src.includes('class="brand">${logo}') ||
        !src.includes('class="total-art">${seal}')) {
      throw new Error("Recovery verification failed.");
    }

    try {
      new Function("return (async function(){\n" + src + "\n});");
    } catch (e) {
      throw new Error("Generated manager failed syntax check: " + e.message);
    }

    const safety = target.replace(/\.js$/i, "-pre-v7-recovery.js");
    if (!fm.fileExists(safety)) fm.copy(target, safety);
    fm.writeString(target, src);

    await msg("WRA Manager Recovered",
      "Recovered from: " + basename(source.path) +
      "\n\nThe WRA Manager now uses actual image files for the header logo, medallion, and project photo. The medallion is left of pricing.");
  } catch (e) {
    await msg("Recovery Stopped", String(e && e.message ? e.message : e));
  }
}

function collectCandidates(dir, out) {
  try {
    for (const name of FileManager.iCloud().listContents(dir)) {
      if (/^WRA Manager.*\.js$/i.test(name) || /^WRA-Manager.*\.js$/i.test(name)) {
        out.push(FileManager.iCloud().joinPath(dir, name));
      }
    }
  } catch (e) {}
}

function sourceScore(text, path) {
  let score = 0;
  if (text.includes("function writeHtml(d, kind)")) score += 20;
  if (text.includes("function copyDir(")) score += 20;
  if (text.includes("function sortKeys(")) score += 20;
  if (text.includes("async function projectImageFlow(")) score += 20;
  if (text.includes("Version: 2026.07.08 Linked-1")) score += 30;
  if (text.includes("function materializeMedallion(")) score += 5;
  if (/Repair v|Recovery v/i.test(text)) score -= 100;
  if (/before-branding/i.test(path)) score += 10;
  return score;
}

function removeNamedConst(src, name) {
  const marker = "const " + name;
  const start = src.indexOf(marker);
  if (start < 0) return src;
  const semi = src.indexOf(";", start);
  if (semi < 0) throw new Error("Could not remove old embedded image declaration safely.");
  let end = semi + 1;
  while (end < src.length && (src[end] === "\r" || src[end] === "\n")) end++;
  return src.slice(0, start) + src.slice(end);
}

function basename(path) {
  const parts = String(path || "").split("/");
  return parts[parts.length - 1] || path;
}

async function download(path) {
  try {
    const fm = FileManager.iCloud();
    if (fm.isFileDownloaded && !fm.isFileDownloaded(path)) await fm.downloadFileFromiCloud(path);
  } catch (e) {}
}

async function msg(title, body) {
  const a = new Alert();
  a.title = title;
  a.message = body;
  a.addAction("OK");
  await a.presentAlert();
}

await main();
