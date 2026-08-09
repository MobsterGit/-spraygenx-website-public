// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: wrench;
// Spray GenX WRA Manager - Image Branding Repair v3
// Restores the pre-branding backup when present, then applies syntax-safe image-file branding changes.

function transformWra(source) {
  let src = String(source || "");

  src = src.split("\n").filter(line => !line.startsWith("const MEDALLION_IMAGE_BASE64 = ")).join("\n");

  if (!src.includes('templates: fm.joinPath(ROOT, "Templates")')) {
    src = src.replace(
      '  photos: fm.joinPath(ROOT, "Photos")\n};',
      '  photos: fm.joinPath(ROOT, "Photos"),\n  templates: fm.joinPath(ROOT, "Templates")\n};'
    );
  }

  const oldBrandSetup = [
    '  const medallionFile = materializeMedallion(outDir);',
    '  const medallionSrc = `data:image/jpeg;base64,${MEDALLION_IMAGE_BASE64}`;',
    '  const seal = `<div class="seal"><img src="${medallionSrc}" alt="Spray GenX medallion"></div>`;'
  ].join("\n");

  const newBrandSetup = [
    '  const logoFile = materializeBrandImage(outDir, "logo", ["logo.png","Logo-SprayGenxLLC.PNG","Actual-Logo-SprayGenX.png","SprayGenX-Logo.png","SprayGenX-Logo.jpg","SprayGenX Logo.png"], "SprayGenX-Logo.png");',
    '  const medallionFile = materializeBrandImage(outDir, "medallion", ["medallion.png","medallion.jpg","SprayGenX-Medallion.png","SprayGenX-Medallion.jpg","WRA-Medallion.png","WRA-Medallion.jpg"], "SprayGenX-Medallion.png");',
    '  const logo = logoFile ? `<img class="brand-logo" src="${esc(logoFile)}" alt="Spray GenX LLC logo">` : "";',
    '  const seal = medallionFile ? `<div class="seal"><img src="${esc(medallionFile)}" alt="Spray GenX medallion"></div>` : "";'
  ].join("\n");

  if (src.includes(oldBrandSetup)) src = src.replace(oldBrandSetup, newBrandSetup);

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

  const helperStart = src.indexOf('function materializeMedallion(outDir) {');
  if (helperStart >= 0) {
    const helperEnd = src.indexOf('function downloadIfNeeded(', helperStart);
    if (helperEnd < 0) throw new Error('Could not locate downloadIfNeeded after materializeMedallion.');
    const helper = `function materializeBrandImage(outDir, type, candidates, outputName) {
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
    src = src.slice(0, helperStart) + helper + src.slice(helperEnd);
  }

  src = src.replace('// Version: 2026.07.08 Linked-1', '// Version: 2026.08.09 Linked-2 Image Branding Fix');

  if (src.includes('MEDALLION_IMAGE_BASE64')) throw new Error('Base64 medallion reference still remains after repair.');
  if (!src.includes('function materializeBrandImage(')) throw new Error('Image-file branding helper was not installed.');
  if (!src.includes('class="total-art">${seal}')) throw new Error('Medallion-left total layout was not installed.');
  if (!src.includes('class="brand">${logo}')) throw new Error('Header logo layout was not installed.');

  return src;
}

if (typeof FileManager !== "undefined") {
  const fm = FileManager.iCloud();
  const docs = fm.documentsDirectory();
  const targets = [
    fm.joinPath(docs, "WRA Manager.js"),
    fm.joinPath(docs, "SprayGenX/WRA Manager.js"),
    fm.joinPath(docs, "SprayGenX/WRA-Manager.js")
  ];
  const target = targets.find(path => fm.fileExists(path));

  if (!target) {
    const a = new Alert();
    a.title = "WRA Manager Not Found";
    a.message = "Could not find WRA Manager.js.";
    a.addAction("OK");
    await a.presentAlert();
  } else {
    if (fm.isFileDownloaded && !fm.isFileDownloaded(target)) await fm.downloadFileFromiCloud(target);

    const backup = target.replace(/\.js$/i, "-before-branding-fix.js");
    let sourcePath = target;
    if (fm.fileExists(backup)) sourcePath = backup;
    if (fm.isFileDownloaded && !fm.isFileDownloaded(sourcePath)) await fm.downloadFileFromiCloud(sourcePath);

    try {
      const repaired = transformWra(fm.readString(sourcePath));
      const safety = target.replace(/\.js$/i, "-pre-repair-v3.js");
      if (fm.fileExists(target) && !fm.fileExists(safety)) fm.copy(target, safety);
      fm.writeString(target, repaired);

      const a = new Alert();
      a.title = "WRA Manager Repaired";
      a.message = "Restored the clean backup and applied the image-file branding layout. Logo is in the header; medallion is left of pricing.";
      a.addAction("OK");
      await a.presentAlert();
    } catch (e) {
      const a = new Alert();
      a.title = "Repair Stopped";
      a.message = String(e && e.message ? e.message : e);
      a.addAction("OK");
      await a.presentAlert();
    }
  }
  Script.complete();
}
