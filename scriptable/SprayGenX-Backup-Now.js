// Spray GenX Backup Now — Scriptable Companion
// Version: 2026.07.03 Backup-1
// Purpose: one-tap iPhone backup for SprayGenX Scriptable working files.

const fm = FileManager.iCloud();
const ROOT = fm.joinPath(fm.documentsDirectory(), "SprayGenX");

const DIRS = {
  root: ROOT,
  proposals: fm.joinPath(ROOT, "Proposals"),
  invoices: fm.joinPath(ROOT, "Invoices"),
  data: fm.joinPath(ROOT, "Data"),
  logs: fm.joinPath(ROOT, "Logs"),
  backups: fm.joinPath(ROOT, "Backups"),
  exports: fm.joinPath(ROOT, "Exports")
};

setup();
await main();

function setup() {
  Object.values(DIRS).forEach(path => {
    if (!fm.fileExists(path)) fm.createDirectory(path, true);
  });
}

async function main() {
  const a = new Alert();
  a.title = "Spray GenX Backup";
  a.message = "Create a full dated backup of proposals, invoices, data, logs, and exports.";
  a.addAction("Backup Now");
  a.addAction("List Backups");
  a.addAction("Show Storage Path");
  a.addCancelAction("Close");

  const c = await a.presentSheet();
  if (c === 0) await runBackup();
  if (c === 1) await listBackups();
  if (c === 2) await notice("Storage Path", ROOT);
}

async function runBackup() {
  const stamp = makeStamp();
  const backupDir = fm.joinPath(DIRS.backups, stamp);
  fm.createDirectory(backupDir, true);

  const manifest = {
    app: "Spray GenX Backup Now",
    version: "2026.07.03 Backup-1",
    created_at: new Date().toISOString(),
    root: ROOT,
    backup_folder: backupDir,
    folders: [],
    files_copied: 0,
    errors: []
  };

  copyTrackedDir("Proposals", DIRS.proposals, fm.joinPath(backupDir, "Proposals"), manifest);
  copyTrackedDir("Invoices", DIRS.invoices, fm.joinPath(backupDir, "Invoices"), manifest);
  copyTrackedDir("Data", DIRS.data, fm.joinPath(backupDir, "Data"), manifest);
  copyTrackedDir("Logs", DIRS.logs, fm.joinPath(backupDir, "Logs"), manifest);
  copyTrackedDir("Exports", DIRS.exports, fm.joinPath(backupDir, "Exports"), manifest);

  fm.writeString(fm.joinPath(backupDir, "backup-manifest.json"), JSON.stringify(manifest, null, 2));

  await notice(
    "Backup Complete",
    `${manifest.files_copied} file(s) copied.\n\n${backupDir}`
  );
}

function copyTrackedDir(label, src, dst, manifest) {
  const before = manifest.files_copied;
  const entry = { label, source: src, destination: dst, copied: 0, status: "ok" };

  try {
    if (!fm.fileExists(src)) {
      entry.status = "missing";
      manifest.folders.push(entry);
      return;
    }
    fm.createDirectory(dst, true);
    entry.copied = copyDir(src, dst);
    manifest.files_copied += entry.copied;
  } catch (err) {
    entry.status = "error";
    entry.error = String(err);
    manifest.errors.push(`${label}: ${err}`);
    manifest.files_copied = before;
  }

  manifest.folders.push(entry);
}

function copyDir(src, dst) {
  let count = 0;
  if (!fm.fileExists(dst)) fm.createDirectory(dst, true);

  fm.listContents(src).forEach(name => {
    const s = fm.joinPath(src, name);
    const d = fm.joinPath(dst, name);

    if (fm.isDirectory(s)) {
      count += copyDir(s, d);
      return;
    }

    if (fm.fileExists(d)) fm.remove(d);
    fm.copy(s, d);
    count += 1;
  });

  return count;
}

async function listBackups() {
  if (!fm.fileExists(DIRS.backups)) return await notice("Backups", "No backup folder yet.");
  const items = fm.listContents(DIRS.backups).sort().reverse();
  await notice("Backups", items.length ? items.slice(0, 30).join("\n") : "No backups yet.");
}

function makeStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

async function notice(title, message) {
  const a = new Alert();
  a.title = title;
  a.message = String(message || "");
  a.addAction("OK");
  await a.presentAlert();
}
