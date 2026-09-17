// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: wrench;
// Spray GenX WRA Manager - Branding Repair v6
// Image-file-only repair. Restores branding and project-image handling using real files.

async function main() {
  const fm = FileManager.iCloud();
  const docs = fm.documentsDirectory();
  const targets = [
    fm.joinPath(docs, "WRA Manager.js"),
    fm.joinPath(docs, "SprayGenX/WRA Manager.js"),
    fm.joinPath(docs, "SprayGenX/WRA-Manager.js")
  ];
  const target = targets.find(p => fm.fileExists(p));
  if (!target) return await msg("WRA Manager Not Found", "Could not locate WRA Manager.js.");

  await download(target);
  const backup = target.replace(/\.js$/i, "-before-branding-fix.js");
  const sourcePath = fm.fileExists(backup) ? backup : target;
  await download(sourcePath);

  try {
    let src = fm.readString(sourcePath);

    // Remove any old embedded medallion declaration by locating the declaration and its ending semicolon.
    src = removeNamedConst(src, "MEDALLION_IMAGE_BASE64");

    // Remove old embedded-image setup lines from writeHtml.
    src = src.replace(/^\s*const medallionFile = materializeMedallion\(outDir\);\s*$/gm, "");
    src = src.replace(/^\s*const medallionSrc = .*;\s*$/gm, "");
    src = src.replace(/^\s*const seal = .*medallionSrc.*;\s*$/gm, "");

    // Add Templates directory once.
    if (!src.includes('templates: fm.joinPath(ROOT, "Templates")')) {
      src = src.replace(
        '  photos: fm.joinPath(ROOT, "Photos")\n};',
        '  photos: fm.joinPath(ROOT, "Photos"),\n  templates: fm.joinPath(ROOT, "Templates")\n};'
      );
    }

    // Path-only project media metadata.
    src = src.replace(
      /function ensureMedia\(d\) \{[^\n]*\}/,
      'function ensureMedia(d) { d.media = d.media && typeof d.media === "object" ? d.media : {}; if (d.media.project_image_path === undefined) d.media.project_image_path = ""; delete d.media.project_image_data; delete d.media.project_image_mime; return d; }'
    );

    // Remove old image-data assignments when selecting/removing a project photo.
    src = src.replace(/\n\s*const embedded = imageDataFromImage\(img, photoPath\);\n\s*if \(embedded\) \{[\s\S]*?\n\s*\}/g, "");
    src = src.replace(/^\s*doc\.media\.project_image_data\s*=.*$/gm, "");
    src = src.replace(/^\s*doc\.media\.project_image_mime\s*=.*$/gm, "");

    // Install file-based branding setup in writeHtml.
    const setupNeedle = '  const path = fm.joinPath(outDir, `${d.id}.html`);';
    if (!src.includes(setupNeedle)) throw new Error("Could not locate HTML output path.");
    if (!src.includes('const logoFile = materializeBrandImage(')) {
      const setupInsert = [
        setupNeedle,
        '  const logoFile = materializeBrandImage(outDir, "logo", ["logo.png","Logo-SprayGenxLLC.PNG","Actual-Logo-SprayGenX.png","SprayGenX-Logo.png","SprayGenX-Logo.jpg","SprayGenX Logo.png"], "SprayGenX-Logo.png");',
        '  const medallionFile = materializeBrandImage(outDir, "medallion", ["medallion.png","medallion.jpg","SprayGenX-Medallion.png","SprayGenX-Medallion.jpg","WRA-Medallion.png","WRA-Medallion.jpg"], "SprayGenX-Medallion.png");',
        '  const logo = logoFile ? `<img class="brand-logo" src="${esc(logoFile)}" alt="Spray GenX LLC logo">` : "";',
        '  const seal = medallionFile ? `<div class="seal"><img src="${esc(medallionFile)}" alt="Spray GenX medallion"></div>` : "";'
      ].join("\n");
      src = src.replace(setupNeedle, setupInsert);
    }

    // Layout changes: header logo and compact Total box.
    src = src.replace(
      '.brand{max-width:52%}.brand h1{margin:0;font-size:29px}',
      '.brand{max-width:55%;display:flex;align-items:flex-start;gap:12px}.brand-logo{display:block;max-width:150px;max-height:72px;width:auto;height:auto;object-fit:contain}.brand-copy{padding-top:1px}.brand h1{margin:0;font-size:23px}'
    );
    src = src.replace(
      '.scope{white-space:pre-wrap}.price{font-size:30px;font-weight:800;text-align:right}.terms{border-top:1px solid #ddd;margin-top:18px;padding-top:12px;font-size:13px;padding-right:190px}.seal{width:96px;height:96px;margin:26px auto 0;opacity:.82}.seal img{display:block;width:100%;height:100%;object-fit:contain}',
      '.scope{white-space:pre-wrap}.total-box{display:grid;grid-template-columns:106px 1fr;gap:14px;align-items:center;min-height:118px}.total-art{display:flex;align-items:center;justify-content:center}.total-copy{min-width:0}.price{font-size:30px;font-weight:800;text-align:right;margin:2px 0 12px}.total-copy p:not(.price){margin:7px 0;text-align:right}.terms{border-top:1px solid #ddd;margin-top:12px;padding-top:10px;font-size:12px}.seal{width:90px;height:90px;margin:0;opacity:.86}.seal img{display:block;width:100%;height:100%;object-fit:contain}'
    );
    src = src.replace(
      '@media screen and (max-width:650px){.top,.grid,.docline{display:block}.brand,.customer{max-width:none}.customer{text-align:left;margin-top:18px}.page{padding:24px 24px 104px}.terms{padding-right:0}}',
      '@media screen and (max-width:650px){.top,.grid,.docline{display:block}.brand,.customer{max-width:none}.brand{display:flex}.customer{text-align:left;margin-top:14px}.page{padding:22px 22px 70px}.total-box{grid-template-columns:96px 1fr}}'
    );
    src = src.replace(
      '.grid{display:grid!important;grid-template-columns:1fr 1fr!important}}</style>',
      '.grid{display:grid!important;grid-template-columns:1fr 1fr!important}.total-box{display:grid!important;grid-template-columns:106px 1fr!important}}</style>'
    );
    src = src.replace(
      '<section class="top"><div class="brand"><h1>${esc(s.companyName)}</h1><p>${esc(s.tagline)}</p><p>${esc(s.serviceArea)}</p><p>${esc([s.phone,s.email].filter(Boolean).join(" | "))}</p></div><div class="customer">',
      '<section class="top"><div class="brand">${logo}<div class="brand-copy"><h1>${esc(s.companyName)}</h1><p>${esc(s.tagline)}</p><p>${esc(s.serviceArea)}</p><p>${esc([s.phone,s.email].filter(Boolean).join(" | "))}</p></div></div><div class="customer">'
    );
    src = src.replace(
      '<div class="box"><h3>Total</h3><p class="price">${money(d.total)}</p><p>Deposit / Paid: ${money(d.deposit)}</p><p>Balance Due: ${money(d.balance_due)}</p>${seal}</div>',
      '<div class="box"><h3>Total</h3><div class="total-box"><div class="total-art">${seal}</div><div class="total-copy"><p class="price">${money(d.total)}</p><p>Deposit / Paid: ${money(d.deposit)}</p><p>Balance Due: ${money(d.balance_due)}</p></div></div></div>'
    );

    // Replace the whole utility region between copyDir and sortKeys. This avoids depending on any old helper names.
    const utilStart = src.indexOf('function copyDir(');
    const utilEnd = src.indexOf('function sortKeys(', utilStart);
    if (utilStart < 0 || utilEnd < 0) throw new Error("Could not locate stable utility boundaries.");

    const utilities = `function copyDir(src, dst) { if (!fm.fileExists(src)) return; ensure(dst); fm.listContents(src).forEach(n => { const s = fm.joinPath(src, n), d = fm.joinPath(dst, n); if (fm.isDirectory(s)) copyDir(s, d); else { if (fm.fileExists(d)) fm.remove(d); fm.copy(s, d); } }); }
function projectPhotoHtml(d, outDir) {
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
function hasProjectImage(d) { ensureMedia(d); return !!(d.media.project_image_path && fm.fileExists(d.media.project_image_path)); }
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
function downloadIfNeeded(path) { try { if (fm.isFileDownloaded && !fm.isFileDownloaded(path)) fm.downloadFileFromiCloud(path); } catch (e) {} }
`;
    src = src.slice(0, utilStart) + utilities + src.slice(utilEnd);

    src = src.replace('// Version: 2026.07.08 Linked-1', '// Version: 2026.08.09 Linked-4 Image-File Branding');

    // Remove legacy embedded project-media property names anywhere left in the manager.
    src = src.replace(/^.*project_image_data.*$/gm, "");
    src = src.replace(/^.*project_image_mime.*$/gm, "");

    // Structural verification before any write.
    if (!src.includes('function materializeBrandImage(')) throw new Error("Brand image helper missing after transform.");
    if (!src.includes('function materializeProjectImage(')) throw new Error("Project image helper missing after transform.");
    if (!src.includes('class="brand">${logo}')) throw new Error("Header logo markup missing after transform.");
    if (!src.includes('class="total-art">${seal}')) throw new Error("Medallion-left layout missing after transform.");

    // Syntax preflight: compile the completed manager inside an async function before writing it.
    try {
      new Function('return (async function(){\n' + src + '\n});');
    } catch (syntaxError) {
      throw new Error("Generated WRA Manager failed syntax check: " + syntaxError.message);
    }

    const safety = target.replace(/\.js$/i, "-pre-v6-repair.js");
    if (!fm.fileExists(safety)) fm.copy(target, safety);
    fm.writeString(target, src);

    await msg("WRA Manager Repaired", "Repair v6 completed. The manager now uses image files for the header logo, medallion, and project photo. The medallion is positioned left of the pricing.");
  } catch (e) {
    await msg("Repair Stopped", String(e && e.message ? e.message : e));
  }

  Script.complete();
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
