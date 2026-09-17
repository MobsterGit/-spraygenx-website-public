// SprayGenX Industry Insights Publisher
// Version: 2026.08.01 Fix-1
// Paste a ChatGPT-generated JSON briefing from the clipboard, preview it, and publish it.

var CFG = {
  owner: "MobsterGit",
  repo: "-spraygenx-website-public",
  branch: "main",
  tokenKey: "sgx.github.industry.publisher",
  folder: "data/regional-updates",
  site: "https://spraygenx.com/regional-updates.html"
};

var fm = FileManager.iCloud();
var localDir = fm.joinPath(fm.documentsDirectory(), "SprayGenX/IndustryInsights");
var draftPath = fm.joinPath(localDir, "draft.json");
if (!fm.fileExists(localDir)) fm.createDirectory(localDir, true);

async function msg(title, message) {
  var a = new Alert();
  a.title = title;
  a.message = message;
  a.addAction("OK");
  await a.presentAlert();
}

async function yes(title, message, action, danger) {
  var a = new Alert();
  a.title = title;
  a.message = message;
  if (danger) a.addDestructiveAction(action || "Continue");
  else a.addAction(action || "Continue");
  a.addCancelAction("Cancel");
  return (await a.presentAlert()) === 0;
}

function niceDate(iso) {
  var parts = iso.split("-").map(Number);
  var f = new DateFormatter();
  f.locale = "en_US";
  f.dateFormat = "MMMM d, yyyy";
  return f.string(new Date(parts[0], parts[1] - 1, parts[2]));
}

function esc(value) {
  var s = String(value == null ? "" : value);
  return s.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function validate(article) {
  var required = ["title", "date", "summary", "sections", "takeaway", "sources"];
  for (var i = 0; i < required.length; i++) {
    if (!(required[i] in article)) throw new Error("Missing " + required[i]);
  }
  if (!Array.isArray(article.sections) || article.sections.length === 0) {
    throw new Error("At least one section is required.");
  }
  if (!Array.isArray(article.sources)) throw new Error("Sources must be an array.");
  for (var j = 0; j < article.sections.length; j++) {
    if (!article.sections[j].heading || !article.sections[j].content) {
      throw new Error("Each section needs heading and content.");
    }
  }
  return article;
}

async function readDraft() {
  if (!fm.fileExists(draftPath)) return null;
  if (fm.isFileStoredIniCloud(draftPath) && !fm.isFileDownloaded(draftPath)) {
    await fm.downloadFileFromiCloud(draftPath);
  }
  return JSON.parse(fm.readString(draftPath));
}

function saveDraft(article) {
  fm.writeString(draftPath, JSON.stringify(article, null, 2));
}

async function token() {
  if (Keychain.contains(CFG.tokenKey)) return Keychain.get(CFG.tokenKey);
  var a = new Alert();
  a.title = "GitHub Token";
  a.message = "Paste your existing fine-grained token. It stays in iPhone Keychain.";
  a.addSecureTextField("Token");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if ((await a.presentAlert()) !== 0) return null;
  var t = a.textFieldValue(0).trim();
  if (!t) return null;
  Keychain.set(CFG.tokenKey, t);
  return t;
}

async function credential() {
  var a = new Alert();
  a.title = "GitHub Credential";
  a.message = Keychain.contains(CFG.tokenKey) ? "Token saved in iPhone Keychain." : "No token saved.";
  a.addAction("Replace Token");
  a.addDestructiveAction("Remove Token");
  a.addCancelAction("Done");
  var c = await a.presentSheet();
  if (c === 0) {
    var e = new Alert();
    e.title = "Replace Token";
    e.addSecureTextField("Token");
    e.addAction("Save");
    e.addCancelAction("Cancel");
    if ((await e.presentAlert()) === 0) {
      var t = e.textFieldValue(0).trim();
      if (t) {
        Keychain.set(CFG.tokenKey, t);
        await msg("Saved", "GitHub token updated.");
      }
    }
  } else if (c === 1 && Keychain.contains(CFG.tokenKey)) {
    if (await yes("Remove Token?", "Remove the saved token from this iPhone?", "Remove", true)) {
      Keychain.remove(CFG.tokenKey);
      await msg("Removed", "Token removed from Keychain.");
    }
  }
}

async function pasteDraft() {
  var raw = Pasteboard.pasteString();
  raw = raw ? raw.trim() : "";
  if (!raw) {
    await msg("Clipboard Empty", "Copy the structured JSON briefing from ChatGPT, then try again.");
    return;
  }
  var article;
  try {
    article = validate(JSON.parse(raw));
  } catch (e) {
    await msg("Invalid Draft", String(e.message || e));
    return;
  }
  saveDraft(article);
  await msg("Draft Saved", article.title + "\n" + niceDate(article.date) + "\n\n" + article.sections.length + " sections • " + article.sources.length + " sources");
  await preview(article);
}

async function preview(existing) {
  var article = existing || await readDraft();
  if (!article) {
    await msg("No Draft", "Paste a draft first.");
    return;
  }
  validate(article);
  var sections = "";
  for (var i = 0; i < article.sections.length; i++) {
    sections += "<section><h2>" + esc(article.sections[i].heading) + "</h2><p>" + esc(article.sections[i].content) + "</p></section>";
  }
  var sources = "<li>No sources listed.</li>";
  if (article.sources.length) {
    sources = "";
    for (var j = 0; j < article.sources.length; j++) {
      sources += '<li><a href="' + esc(article.sources[j].url) + '">' + esc(article.sources[j].title) + "</a></li>";
    }
  }
  var html = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:-apple-system;margin:0;background:#eef2f6;color:#142337}main{max-width:760px;margin:auto;padding:18px 14px 60px}.hero{background:#0d2947;color:#fff;padding:24px;border-radius:18px}.k{color:#74b9ff;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{font-size:29px;line-height:1.1;margin:9px 0}.date{opacity:.75}.summary{font-size:17px;line-height:1.5}section{background:#fff;margin-top:14px;padding:20px;border-radius:15px;box-shadow:0 4px 16px rgba(15,45,75,.08)}h2{color:#0d6099;font-size:20px;margin:0 0 10px}p{line-height:1.55;margin:0}.take{border-left:5px solid #1380c4}li{margin:8px 0}a{color:#0878bd}</style>' +
    '<main><header class="hero"><div class="k">Northeast Ohio Industry Insights</div><h1>' + esc(article.title) + '</h1><div class="date">' + esc(niceDate(article.date)) + '</div><p class="summary">' + esc(article.summary) + '</p></header>' +
    sections + '<section class="take"><h2>Practical Takeaway</h2><p>' + esc(article.takeaway) + '</p></section><section><h2>Sources</h2><ol>' + sources + '</ol></section></main>';
  var w = new WebView();
  await w.loadHTML(html);
  await w.present(true);
}

async function gh(path, t, method, body) {
  var url = "https://api.github.com/repos/" + CFG.owner + "/" + CFG.repo + path;
  var r = new Request(url);
  r.method = method || "GET";
  r.headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": "Bearer " + t,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "SprayGenX-Scriptable-Publisher"
  };
  if (body) {
    r.headers["Content-Type"] = "application/json";
    r.body = JSON.stringify(body);
  }
  var data = null;
  try { data = await r.loadJSON(); } catch (e) {}
  return { status: r.response ? r.response.statusCode : 0, data: data };
}

async function getFile(path, t) {
  var x = await gh("/contents/" + path + "?ref=" + encodeURIComponent(CFG.branch), t, "GET", null);
  if (x.status === 404) return null;
  if (x.status < 200 || x.status >= 300) throw new Error((x.data && x.data.message) || "Unable to read " + path);
  return x.data;
}

async function putFile(path, text, t, commitMessage, sha) {
  var body = {
    message: commitMessage,
    content: Data.fromString(text).toBase64String(),
    branch: CFG.branch
  };
  if (sha) body.sha = sha;
  var x = await gh("/contents/" + path, t, "PUT", body);
  if (x.status < 200 || x.status >= 300) throw new Error((x.data && x.data.message) || "Unable to write " + path);
}

async function publish() {
  var article = await readDraft();
  if (!article) {
    await msg("No Draft", "Paste a draft first.");
    return;
  }
  validate(article);
  var t = await token();
  if (!t) return;
  if (!await yes("Publish Industry Insights?", article.title + "\n" + niceDate(article.date) + "\n\nThis publishes directly to the live website.", "Publish", false)) return;
  var file = article.date + ".json";
  var articlePath = CFG.folder + "/" + file;
  var indexPath = CFG.folder + "/index.json";
  var oldArticle = await getFile(articlePath, t);
  await putFile(articlePath, JSON.stringify(article, null, 2) + "\n", t, "Publish Northeast Ohio Industry Insights for " + article.date, oldArticle ? oldArticle.sha : null);
  var oldIndex = await getFile(indexPath, t);
  var index = { updated_at: null, updates: [] };
  if (oldIndex && oldIndex.content) {
    var decoded = Data.fromBase64String(oldIndex.content.replace(/\n/g, "")).toRawString();
    index = JSON.parse(decoded);
  }
  index.updated_at = new Date().toISOString();
  var remaining = (index.updates || []).filter(function(x) { return x !== file; });
  index.updates = [file].concat(remaining).slice(0, 52);
  await putFile(indexPath, JSON.stringify(index, null, 2) + "\n", t, "Update Industry Insights archive for " + article.date, oldIndex ? oldIndex.sha : null);
  var done = new Alert();
  done.title = "Published";
  done.message = "The article was committed to GitHub. GitHub Pages may take a minute or two to refresh.";
  done.addAction("Open Website");
  done.addAction("Done");
  if ((await done.presentAlert()) === 0) Safari.open(CFG.site);
}

async function clearDraft() {
  if (!fm.fileExists(draftPath)) {
    await msg("No Draft", "No local draft exists.");
    return;
  }
  if (await yes("Delete Local Draft?", "This does not remove anything already published.", "Delete", true)) {
    fm.remove(draftPath);
    await msg("Deleted", "Local draft removed.");
  }
}

async function main() {
  var d = await readDraft();
  var a = new Alert();
  a.title = "Industry Insights Publisher";
  a.message = d ? "Draft: " + niceDate(d.date) + "\n" + d.title : "No local draft saved.";
  a.addAction("Paste Draft from Clipboard");
  a.addAction("Preview Draft");
  a.addAction("Publish Draft");
  a.addAction("GitHub Credential");
  a.addDestructiveAction("Clear Local Draft");
  a.addCancelAction("Close");
  var c = await a.presentSheet();
  try {
    if (c === 0) await pasteDraft();
    else if (c === 1) await preview(null);
    else if (c === 2) await publish();
    else if (c === 3) await credential();
    else if (c === 4) await clearDraft();
  } catch (e) {
    console.error(e);
    await msg("Publisher Error", String(e.message || e));
  }
}

await main();
Script.complete();
