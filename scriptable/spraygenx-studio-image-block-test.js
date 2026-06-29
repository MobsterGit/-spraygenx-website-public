// Spray GenX Studio — Image Block Test
// Scriptable iOS test script
//
// What this does now:
// 1. Stores your GitHub token in Scriptable Keychain (never in this file)
// 2. Lets you select one or more photos from your iPhone
// 3. Uploads them as JPEG files into images/library/<category>/
// 4. Creates one Image Block in data/image-library.json
// 5. Commits everything to GitHub
//
// Important:
// - This is a private/admin script. Do not publish a real token in GitHub.
// - Use a fine-grained GitHub token with Contents: Read and Write for this repo only.
// - This test writes directly to the public repo. Later, this can move to a private Studio repo.

// -------------------------
// CONFIG
// -------------------------
const OWNER = "MobsterGit";
const REPO = "-spraygenx-website-public";
const BRANCH = "main";
const IMAGE_LIBRARY_PATH = "data/image-library.json";
const TOKEN_KEY = "SPRAYGENX_GITHUB_TOKEN";
const JPEG_QUALITY = 0.86;

// Default publishing behavior for a new Image Block.
const DEFAULT_SITE_LOCATIONS = ["library", "latest", "search"];

// -------------------------
// HELPERS
// -------------------------
function nowStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value) {
  return String(value || "untitled")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}

function cleanCsv(value) {
  return String(value || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function b64FromString(str) {
  return Data.fromString(str).toBase64String();
}

async function getToken() {
  if (Keychain.contains(TOKEN_KEY)) return Keychain.get(TOKEN_KEY);

  const a = new Alert();
  a.title = "GitHub Token";
  a.message = "Paste a fine-grained GitHub token with Contents read/write for this repo. It will be saved in Scriptable Keychain.";
  a.addSecureTextField("GitHub token");
  a.addAction("Save Token");
  a.addCancelAction("Cancel");
  const result = await a.presentAlert();
  if (result === -1) throw new Error("Token setup cancelled.");
  const token = a.textFieldValue(0).trim();
  if (!token) throw new Error("No token entered.");
  Keychain.set(TOKEN_KEY, token);
  return token;
}

async function githubRequest(method, path, body) {
  const token = await getToken();
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  const req = new Request(url + (method === "GET" ? `?ref=${encodeURIComponent(BRANCH)}` : ""));
  req.method = method;
  req.headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "SprayGenX-Studio-Scriptable"
  };
  if (body) {
    req.headers["Content-Type"] = "application/json";
    req.body = JSON.stringify(body);
  }
  const json = await req.loadJSON();
  if (req.response.statusCode < 200 || req.response.statusCode > 299) {
    throw new Error(`${method} ${path} failed: ${req.response.statusCode}\n${JSON.stringify(json, null, 2)}`);
  }
  return json;
}

async function fetchJsonFile(path) {
  const file = await githubRequest("GET", path);
  const decoded = Data.fromBase64String(file.content.replace(/\n/g, "")).toRawString();
  return { json: JSON.parse(decoded), sha: file.sha };
}

async function putFile(path, contentBase64, message, sha = null) {
  const body = {
    message,
    content: contentBase64,
    branch: BRANCH
  };
  if (sha) body.sha = sha;
  return githubRequest("PUT", path, body);
}

async function chooseFromList(title, message, items, allowCancel = true) {
  const a = new Alert();
  a.title = title;
  if (message) a.message = message;
  items.forEach(item => a.addAction(item.label || item));
  if (allowCancel) a.addCancelAction("Cancel");
  const idx = await a.presentAlert();
  if (idx === -1) return null;
  return items[idx];
}

async function promptBlockDetails(categories) {
  const a = new Alert();
  a.title = "New Image Block";
  a.message = "Create the project record once. The site can reuse it everywhere.";
  a.addTextField("Title", "Weston Commercial Interior");
  a.addTextField("Summary", "Completed Spray GenX project.");
  a.addTextField("Tags, comma separated", "painting, refinishing, completed work");
  a.addTextField("Weight 0-100", "25");
  a.addTextField("Site locations", DEFAULT_SITE_LOCATIONS.join(", "));
  a.addAction("Continue");
  a.addCancelAction("Cancel");
  const result = await a.presentAlert();
  if (result === -1) return null;

  const title = a.textFieldValue(0).trim() || "Untitled Image Block";
  const summary = a.textFieldValue(1).trim() || "Completed Spray GenX project.";
  const tags = cleanCsv(a.textFieldValue(2));
  const weight = Math.max(0, Math.min(100, Number(a.textFieldValue(3)) || 25));
  const siteLocations = cleanCsv(a.textFieldValue(4));

  const categoryChoice = await chooseFromList(
    "Category",
    "Choose the primary category. You can add multi-category editing later.",
    categories.map(c => ({ label: c.label, id: c.id })),
    true
  );
  if (!categoryChoice) return null;

  return { title, summary, tags, weight, siteLocations, category: categoryChoice.id };
}

async function pickImages() {
  const images = [];
  while (true) {
    const img = await Photos.fromLibrary();
    if (img) images.push(img);

    const a = new Alert();
    a.title = `${images.length} photo${images.length === 1 ? "" : "s"} selected`;
    a.message = "Add another photo to this same Image Block?";
    a.addAction("Add Another");
    a.addAction("Done");
    const choice = await a.presentAlert();
    if (choice === 1) break;
  }
  return images;
}

function makeBlock(details, uploadedPaths) {
  const stamp = nowStamp();
  const slug = slugify(details.title);
  const views = {};
  details.siteLocations.forEach(v => { views[v] = true; });

  return {
    id: `${slug}-${stamp}`,
    slug,
    title: details.title,
    summary: details.summary,
    customer: "",
    location: "",
    date: todayISO(),
    category: details.category,
    categories: [details.category],
    tags: details.tags,
    status: "published",
    visible: true,
    weight: details.weight,
    priority: details.weight,
    views,
    siteLocations: details.siteLocations.length ? details.siteLocations : DEFAULT_SITE_LOCATIONS,
    fallback: "latest",
    cover: uploadedPaths[0] || "",
    images: uploadedPaths.map((path, i) => ({
      path,
      caption: "",
      alt: details.title,
      visible: true,
      role: i === 0 ? "cover" : ""
    }))
  };
}

async function main() {
  const action = await chooseFromList("Spray GenX Studio Test", "Choose an action.", [
    { label: "Create Image Block + Upload Photos", id: "create" },
    { label: "View Token Status", id: "token" },
    { label: "Reset GitHub Token", id: "reset" }
  ], true);
  if (!action) return;

  if (action.id === "token") {
    const a = new Alert();
    a.title = "Token Status";
    a.message = Keychain.contains(TOKEN_KEY) ? "GitHub token is saved in Scriptable Keychain." : "No token saved yet.";
    a.addAction("OK");
    await a.presentAlert();
    return;
  }

  if (action.id === "reset") {
    if (Keychain.contains(TOKEN_KEY)) Keychain.remove(TOKEN_KEY);
    const a = new Alert();
    a.title = "Token Reset";
    a.message = "Token removed. You will be asked for a new one next time.";
    a.addAction("OK");
    await a.presentAlert();
    return;
  }

  const { json: library, sha } = await fetchJsonFile(IMAGE_LIBRARY_PATH);
  library.categories = Array.isArray(library.categories) ? library.categories : [];
  library.blocks = Array.isArray(library.blocks) ? library.blocks : [];

  const details = await promptBlockDetails(library.categories);
  if (!details) return;

  const selected = await pickImages();
  if (!selected.length) throw new Error("No images selected.");

  const stamp = nowStamp();
  const slug = slugify(details.title);
  const uploadedPaths = [];

  for (let i = 0; i < selected.length; i++) {
    const imageData = Data.fromJPEG(selected[i], JPEG_QUALITY);
    const filename = `${slug}-${stamp}-${String(i + 1).padStart(3, "0")}.jpg`;
    const path = `images/library/${details.category}/${filename}`;
    await putFile(path, imageData.toBase64String(), `Upload image for ${details.title}`);
    uploadedPaths.push(path);
  }

  const block = makeBlock(details, uploadedPaths);
  library.version = library.version || 2;
  library.updated = todayISO();
  library.notes = library.notes || "Spray GenX Studio Image Block database.";
  library.blocks.unshift(block);

  await putFile(
    IMAGE_LIBRARY_PATH,
    b64FromString(JSON.stringify(library, null, 2) + "\n"),
    `Add image block: ${details.title}`,
    sha
  );

  const done = new Alert();
  done.title = "Image Block Published";
  done.message = `${details.title}\n\nUploaded ${uploadedPaths.length} image${uploadedPaths.length === 1 ? "" : "s"}.\nUpdated ${IMAGE_LIBRARY_PATH}.`;
  done.addAction("Done");
  await done.presentAlert();
}

main().catch(async error => {
  console.error(error);
  const a = new Alert();
  a.title = "Studio Test Error";
  a.message = String(error.message || error);
  a.addAction("OK");
  await a.presentAlert();
});
