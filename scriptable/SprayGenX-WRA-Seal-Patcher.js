// Spray GenX WRA Seal Patcher for Scriptable
// Adds a small bottom-right company seal to generated proposal/invoice HTML.
// Run once in Scriptable after importing/downloading SprayGenX-WRA-Manager.js.

const fm = FileManager.iCloud();
const docs = fm.documentsDirectory();
const targetName = "SprayGenX-WRA-Manager.js";
const targetPath = fm.joinPath(docs, targetName);

if (!fm.fileExists(targetPath)) {
  await show("Manager not found", `Could not find ${targetName} in Scriptable Documents. Import/download the manager script first, then run this patcher.`);
  return;
}

let source = fm.readString(targetPath);

if (source.includes("company-seal")) {
  await show("Already patched", "The bottom-right Spray GenX seal is already installed in this manager script.");
  return;
}

const cssNeedle = ".page{max-width:800px;margin:0 auto;background:#fff;min-height:100vh;padding:36px;box-sizing:border-box}";
const cssPatch = ".page{max-width:800px;margin:0 auto;background:#fff;min-height:100vh;padding:36px 36px 116px;box-sizing:border-box;position:relative}.company-seal{position:absolute;right:30px;bottom:26px;width:96px;height:96px;border:2px solid #111;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:10px;line-height:1.15;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#111;background:rgba(255,255,255,.78)}.company-seal span{display:block;font-size:8px;font-weight:700;letter-spacing:.04em;margin-top:3px}.company-seal:before{content:\"\";position:absolute;inset:6px;border:1px solid #111;border-radius:50%;opacity:.65}";

const htmlNeedle = "</section></main></body></html>`;";
const htmlPatch = "</section><aside class=\"company-seal\"><div>${escapeHtml(settings.companyName)}<span>Proposal Seal</span><span>${escapeHtml(settings.serviceArea)}</span></div></aside></main></body></html>`;";

if (!source.includes(cssNeedle) || !source.includes(htmlNeedle)) {
  await show("Patch stopped", "The manager file was found, but its HTML template did not match the expected version. No changes were made.");
  return;
}

const backupPath = fm.joinPath(docs, `SprayGenX-WRA-Manager.backup-${new Date().toISOString().replace(/[:.]/g, "-")}.js`);
fm.writeString(backupPath, source);
source = source.replace(cssNeedle, cssPatch).replace(htmlNeedle, htmlPatch);
fm.writeString(targetPath, source);

await show("Seal installed", `Patched ${targetName}. A backup copy was saved at:\n${backupPath}\n\nOpen or regenerate a proposal preview to test the small bottom-right seal.`);

async function show(title, message) {
  const a = new Alert();
  a.title = title;
  a.message = message;
  a.addAction("OK");
  await a.presentAlert();
}
