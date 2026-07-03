// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: images;
// Spray GenX Legacy Photo Manager
// Version: 2026.07.03
// Safe test build: does not migrate, rename, or overwrite existing proposal/invoice files.
// Reads your existing object-based indexes and Data/*.json records.

const fm = FileManager.iCloud()
const root = fm.joinPath(fm.documentsDirectory(), "SprayGenX")

const DIRS = {
  root,
  proposals: fm.joinPath(root, "Proposals"),
  invoices: fm.joinPath(root, "Invoices"),
  data: fm.joinPath(root, "Data"),
  logs: fm.joinPath(root, "Logs"),
  templates: fm.joinPath(root, "Templates"),
  backups: fm.joinPath(root, "Backups"),
  photos: fm.joinPath(root, "Photos"),
  portfolio: fm.joinPath(root, "Portfolio")
}

const FILES = {
  proposalIndex: fm.joinPath(DIRS.logs, "proposal_index.json"),
  invoiceIndex: fm.joinPath(DIRS.logs, "invoice_index.json"),
  photoIndex: fm.joinPath(DIRS.logs, "photo_index.json"),
  portfolioIndex: fm.joinPath(DIRS.portfolio, "portfolio_index.json"),
  documentLog: fm.joinPath(DIRS.logs, "document_log.csv")
}

ensureSafeFiles()
await main()

async function main() {
  const a = new Alert()
  a.title = "Spray GenX Photos"
  a.message = "Legacy-safe photo and portfolio layer. Existing invoices/proposals are not rewritten except when you explicitly attach a photo reference to one JSON record."
  a.addAction("Open Proposal")
  a.addAction("Open Invoice")
  a.addAction("Add Photo To Proposal")
  a.addAction("Add Photo To Invoice")
  a.addAction("View Photo Index")
  a.addAction("Create Portfolio Draft")
  a.addAction("Backup Now")
  a.addAction("Show Folder Paths")
  a.addCancelAction("Cancel")
  const c = await a.present()
  if (c === 0) return await openIndexedDoc(FILES.proposalIndex, "Open Proposal")
  if (c === 1) return await openIndexedDoc(FILES.invoiceIndex, "Open Invoice")
  if (c === 2) return await addPhotoFlow(FILES.proposalIndex, "Proposal")
  if (c === 3) return await addPhotoFlow(FILES.invoiceIndex, "Invoice")
  if (c === 4) return await openFile(FILES.photoIndex)
  if (c === 5) return await createPortfolioDraftFlow()
  if (c === 6) return await showMessage("Backup Created", createBackup())
  if (c === 7) return await showPaths()
}

async function openIndexedDoc(indexPath, title) {
  const item = await pickIndexedDocument(indexPath, title, "Select document")
  if (!item) return
  await openFile(item.filePath)
}

async function addPhotoFlow(indexPath, label) {
  const item = await pickIndexedDocument(indexPath, "Add Photo", "Select " + label.toLowerCase())
  if (!item) return
  const record = readJSON(item.jsonPath, null) || item
  record.docNo = record.docNo || item.docNo
  record.docType = record.docType || item.docType || label.toLowerCase()
  const stage = await pickStage()
  if (!stage) return
  const caption = await promptText("Caption", "Optional caption", "")
  const img = await Photos.fromLibrary()
  if (!img) return
  createBackupIfNeeded("photo-add")
  const photo = savePhotoImage(record, img, stage, caption)
  savePhotoReference(record, item.jsonPath, photo)
  await showMessage("Photo Added", `${record.docNo}\n${stage}\n\n${photo.path}`)
}

function savePhotoImage(record, img, stage, caption) {
  const docNo = record.docNo || "UNKNOWN"
  const docFolder = fm.joinPath(DIRS.photos, safeName(docNo))
  const stageFolder = fm.joinPath(docFolder, stage)
  ensureDir(docFolder)
  ensureDir(stageFolder)
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)
  const filename = `${safeName(docNo)}_${stage}_${stamp}.jpg`
  const path = fm.joinPath(stageFolder, filename)
  fm.writeImage(path, img)
  return {
    linkedDocNo: docNo,
    docType: record.docType || "",
    client: record.client || "",
    project: record.project || "",
    stage,
    caption: caption || "",
    path,
    favorite: false,
    portfolio: false,
    website: false,
    added: new Date().toISOString()
  }
}

function savePhotoReference(record, jsonPath, photo) {
  const idx = readJSON(FILES.photoIndex, {})
  if (!idx[photo.linkedDocNo]) idx[photo.linkedDocNo] = []
  idx[photo.linkedDocNo].push(photo)
  writeJSON(FILES.photoIndex, idx)

  if (jsonPath && fm.fileExists(jsonPath)) {
    const full = readJSON(jsonPath, record) || record
    full.photos = Array.isArray(full.photos) ? full.photos : []
    full.photos.push(photo)
    writeJSON(jsonPath, full)
  }
}

async function createPortfolioDraftFlow() {
  const item = await pickIndexedDocument(FILES.proposalIndex, "Portfolio Draft", "Select proposal")
  if (!item) return
  const record = readJSON(item.jsonPath, null) || item
  const photosByDoc = readJSON(FILES.photoIndex, {})
  const photos = photosByDoc[record.docNo || item.docNo] || []
  if (!photos.length) {
    const proceed = await confirm("No Photos", "No attached photos were found. Create a draft anyway?")
    if (!proceed) return
  }
  const title = await promptText("Portfolio Title", "Title", record.project || item.project || "Completed Project")
  if (title === null) return
  const category = await promptText("Category", "commercial-ceilings, cabinets, floors, etc.", "completed-work")
  if (category === null) return
  const id = slug(title) + "-" + new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)
  const portfolio = {
    id,
    linkedDocNo: record.docNo || item.docNo || "",
    slug: slug(title),
    title,
    summary: "Completed Spray GenX painting project.",
    customer: record.client || item.client || "",
    location: "",
    date: new Date().toISOString().slice(0, 10),
    category,
    categories: [category],
    tags: ["painting", "refinishing", "completed work"],
    status: "draft",
    visible: false,
    weight: 25,
    priority: 25,
    views: { library: true, latest: true, search: true },
    siteLocations: ["library", "latest", "search"],
    fallback: "latest",
    cover: photos[0] ? photos[0].path : "",
    images: photos.map(p => ({ path: p.path, caption: p.caption || "", alt: title, visible: true, role: p.stage || "" }))
  }
  const path = fm.joinPath(DIRS.portfolio, id + ".json")
  writeJSON(path, portfolio)
  const idx = readJSON(FILES.portfolioIndex, {})
  idx[id] = { id, linkedDocNo: portfolio.linkedDocNo, title, status: "draft", path }
  writeJSON(FILES.portfolioIndex, idx)
  await showMessage("Portfolio Draft Created", path)
}

async function pickIndexedDocument(indexPath, title, message) {
  const index = readJSON(indexPath, {})
  const keys = Object.keys(index).sort().reverse()
  if (!keys.length) {
    await showMessage("No Documents", "No saved documents were found in the index.")
    return null
  }
  const a = new Alert()
  a.title = title
  a.message = message
  keys.slice(0, 30).forEach(k => {
    const item = index[k] || {}
    a.addAction(`${k} • ${item.project || "Untitled"} • ${item.price || "$0.00"}`)
  })
  a.addCancelAction("Cancel")
  const c = await a.present()
  if (c === -1) return null
  return index[keys[c]]
}

async function pickStage() {
  const a = new Alert()
  a.title = "Photo Stage"
  a.addAction("Before")
  a.addAction("During")
  a.addAction("After")
  a.addAction("Finished")
  a.addCancelAction("Cancel")
  const c = await a.present()
  if (c === -1) return null
  return ["Before", "During", "After", "Finished"][c]
}

async function promptText(title, placeholder, existing) {
  const a = new Alert()
  a.title = title
  a.addTextField(placeholder, existing || "")
  a.addAction("Save")
  a.addCancelAction("Cancel")
  const c = await a.present()
  if (c === -1) return null
  return a.textFieldValue(0)
}

async function confirm(title, message) {
  const a = new Alert()
  a.title = title
  a.message = message
  a.addAction("Continue")
  a.addCancelAction("Cancel")
  return await a.present() !== -1
}

function createBackupIfNeeded(label) {
  const day = new Date().toISOString().slice(0, 10)
  const marker = fm.joinPath(DIRS.backups, `.last_${label}_${day}`)
  if (fm.fileExists(marker)) return
  createBackup()
  fm.writeString(marker, "done")
}

function createBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupRoot = fm.joinPath(DIRS.backups, stamp)
  ensureDir(backupRoot)
  copyDir(DIRS.data, fm.joinPath(backupRoot, "Data"))
  copyDir(DIRS.logs, fm.joinPath(backupRoot, "Logs"))
  copyDir(DIRS.proposals, fm.joinPath(backupRoot, "Proposals"))
  copyDir(DIRS.invoices, fm.joinPath(backupRoot, "Invoices"))
  copyDir(DIRS.photos, fm.joinPath(backupRoot, "Photos"))
  copyDir(DIRS.portfolio, fm.joinPath(backupRoot, "Portfolio"))
  return backupRoot
}

function copyDir(src, dst) {
  if (!fm.fileExists(src)) return
  ensureDir(dst)
  fm.listContents(src).forEach(name => {
    const s = fm.joinPath(src, name)
    const d = fm.joinPath(dst, name)
    if (fm.isDirectory(s)) copyDir(s, d)
    else {
      if (fm.fileExists(d)) fm.remove(d)
      fm.copy(s, d)
    }
  })
}

function ensureSafeFiles() {
  Object.values(DIRS).forEach(ensureDir)
  if (!fm.fileExists(FILES.photoIndex)) writeJSON(FILES.photoIndex, {})
  if (!fm.fileExists(FILES.portfolioIndex)) writeJSON(FILES.portfolioIndex, {})
}

function ensureDir(path) {
  if (!fm.fileExists(path)) fm.createDirectory(path, true)
}

async function openFile(path) {
  if (!path || !fm.fileExists(path)) {
    await showMessage("Missing File", "File was not found:\n" + path)
    return
  }
  await QuickLook.present(path)
}

async function showPaths() {
  await showMessage("Spray GenX Paths", `Root:\n${DIRS.root}\n\nData:\n${DIRS.data}\n\nProposals:\n${DIRS.proposals}\n\nInvoices:\n${DIRS.invoices}\n\nPhotos:\n${DIRS.photos}\n\nPortfolio:\n${DIRS.portfolio}\n\nBackups:\n${DIRS.backups}`)
}

function readJSON(path, fallback) {
  try {
    if (!fm.fileExists(path)) return fallback
    return JSON.parse(fm.readString(path))
  } catch (e) {
    return fallback
  }
}

function writeJSON(path, obj) {
  fm.writeString(path, JSON.stringify(obj, null, 2))
}

function safeName(str) {
  return String(str || "").trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_")
}

function slug(str) {
  return safeName(str).toLowerCase().replace(/_/g, "-")
}

async function showMessage(title, message) {
  const a = new Alert()
  a.title = title
  a.message = String(message || "")
  a.addAction("OK")
  await a.present()
}
