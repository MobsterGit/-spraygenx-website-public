// Timeline Reverse Geocoder for Scriptable (iPhone/iPad)
// Reads a Google Maps Timeline JSON export, reverse-geocodes unique visit locations
// with Apple's geocoding service, caches progress, and exports a CSV with addresses.

const fm = FileManager.iCloud();
const docs = fm.documentsDirectory();
const cachePath = fm.joinPath(docs, "Timeline-Geocode-Cache.json");
const outputPath = fm.joinPath(docs, "Timeline-Destinations-Geocoded.csv");

function sleep(seconds) {
  return new Promise(resolve => Timer.schedule(seconds, false, resolve));
}

function parseGeo(s) {
  if (!s || !s.startsWith("geo:")) return null;
  const parts = s.slice(4).split(",").map(Number);
  if (parts.length !== 2 || parts.some(v => !Number.isFinite(v))) return null;
  return { latitude: parts[0], longitude: parts[1] };
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function isoDate(s) {
  if (!s) return "";
  try { return new Date(s).toISOString(); } catch (_) { return s; }
}

function firstNonEmpty(...values) {
  for (const v of values) {
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function placemarkToAddress(p) {
  if (!p) return {
    name: "", street: "", city: "", state: "", zip: "", country: "", fullAddress: ""
  };

  const street = [p.subThoroughfare, p.thoroughfare].filter(Boolean).join(" ").trim();
  const city = firstNonEmpty(p.locality, p.subAdministrativeArea);
  const state = firstNonEmpty(p.administrativeArea);
  const zip = firstNonEmpty(p.postalCode);
  const country = firstNonEmpty(p.country, p.ISOcountryCode, p.isoCountryCode);
  const name = firstNonEmpty(
    Array.isArray(p.areasOfInterest) ? p.areasOfInterest[0] : "",
    p.name
  );

  const line1 = street || (name && !/^\d+\s/.test(name) ? name : "");
  const line2 = [city, state, zip].filter(Boolean).join(", ").replace(/, ([A-Z]{2}), (\d{5})$/, ", $1 $2");
  const fullAddress = [line1, line2, country].filter(Boolean).join(", ");

  return { name, street, city, state, zip, country, fullAddress };
}

async function loadCache() {
  if (!fm.fileExists(cachePath)) return {};
  try {
    await fm.downloadFileFromiCloud(cachePath);
    return JSON.parse(fm.readString(cachePath));
  } catch (_) {
    return {};
  }
}

function saveCache(cache) {
  fm.writeString(cachePath, JSON.stringify(cache, null, 2));
}

function buildCSV(rows) {
  const headers = [
    "Rank", "Visits", "Semantic Type", "Place ID", "Latitude", "Longitude",
    "Place / POI", "Street Address", "City", "State", "ZIP", "Country",
    "Full Address", "First Visit", "Last Visit", "Google Maps"
  ];
  const lines = [headers.map(csvCell).join(",")];

  rows.forEach((r, i) => {
    const a = r.address || {};
    const maps = `https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`;
    lines.push([
      i + 1,
      r.visits,
      r.semanticType,
      r.placeID,
      r.latitude.toFixed(6),
      r.longitude.toFixed(6),
      a.name || "",
      a.street || "",
      a.city || "",
      a.state || "",
      a.zip || "",
      a.country || "",
      a.fullAddress || "",
      isoDate(r.firstVisit),
      isoDate(r.lastVisit),
      maps
    ].map(csvCell).join(","));
  });

  return lines.join("\n");
}

// 1) Pick the Google Timeline export JSON.
const inputPath = await DocumentPicker.openFile();
if (!inputPath) throw new Error("No file selected.");

const inputFM = FileManager.local();
let raw;
try {
  raw = inputFM.readString(inputPath);
} catch (_) {
  // Some Files/iCloud selections are better handled as Data.
  raw = Data.fromFile(inputPath).toRawString();
}

const timeline = JSON.parse(raw);
if (!Array.isArray(timeline)) throw new Error("The selected file is not the expected Google Timeline JSON array.");

// 2) Collapse Timeline visits into unique Google place IDs.
const byPlace = new Map();
for (const item of timeline) {
  const visit = item && item.visit;
  const tc = visit && visit.topCandidate;
  if (!tc) continue;

  const geo = parseGeo(tc.placeLocation);
  if (!geo) continue;

  const placeID = tc.placeID || `${geo.latitude.toFixed(6)},${geo.longitude.toFixed(6)}`;
  let r = byPlace.get(placeID);
  if (!r) {
    r = {
      placeID,
      latitude: geo.latitude,
      longitude: geo.longitude,
      visits: 0,
      semanticCounts: {},
      firstVisit: item.startTime || "",
      lastVisit: item.endTime || ""
    };
    byPlace.set(placeID, r);
  }

  r.visits += 1;
  const sem = tc.semanticType || "Unknown";
  r.semanticCounts[sem] = (r.semanticCounts[sem] || 0) + 1;
  if (item.startTime && (!r.firstVisit || item.startTime < r.firstVisit)) r.firstVisit = item.startTime;
  if (item.endTime && (!r.lastVisit || item.endTime > r.lastVisit)) r.lastVisit = item.endTime;
}

const rows = Array.from(byPlace.values()).map(r => {
  const bestSemantic = Object.entries(r.semanticCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";
  return { ...r, semanticType: bestSemantic };
}).sort((a, b) => b.visits - a.visits);

// 3) Resume from cache if this has been run before.
const cache = await loadCache();
let resolved = 0;
let failed = 0;

for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const key = r.placeID;

  if (cache[key] && cache[key].status === "ok") {
    r.address = cache[key].address;
    resolved++;
    continue;
  }

  let success = false;
  let lastError = "";

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const marks = await Location.reverseGeocode(r.latitude, r.longitude, "en_US");
      const p = Array.isArray(marks) && marks.length ? marks[0] : null;
      const address = placemarkToAddress(p);
      r.address = address;
      cache[key] = {
        status: "ok",
        latitude: r.latitude,
        longitude: r.longitude,
        address,
        rawPlacemark: p || null
      };
      resolved++;
      success = true;
      break;
    } catch (e) {
      lastError = String(e);
      await sleep(Math.min(1.5 * attempt, 5));
    }
  }

  if (!success) {
    r.address = cache[key]?.address || {
      name: "", street: "", city: "", state: "", zip: "", country: "", fullAddress: ""
    };
    cache[key] = {
      status: "failed",
      latitude: r.latitude,
      longitude: r.longitude,
      error: lastError,
      address: r.address
    };
    failed++;
  }

  // Save constantly so a long run can be resumed without losing work.
  if ((i + 1) % 10 === 0 || i === rows.length - 1) {
    saveCache(cache);
    const partial = buildCSV(rows.map(x => ({
      ...x,
      address: x.address || (cache[x.placeID] && cache[x.placeID].address) || {}
    })));
    fm.writeString(outputPath, partial);
  }

  // Small pause keeps Apple's geocoder happier during a large batch.
  await sleep(0.35);
}

// 4) Build final CSV from cache + current run and save/export it.
for (const r of rows) {
  if (!r.address && cache[r.placeID]) r.address = cache[r.placeID].address || {};
}

const csv = buildCSV(rows);
fm.writeString(outputPath, csv);
saveCache(cache);

const a = new Alert();
a.title = "Timeline geocoding complete";
a.message = `${rows.length} unique destinations\n${resolved} resolved\n${failed} unresolved\n\nSaved as Timeline-Destinations-Geocoded.csv in Scriptable iCloud.`;
a.addAction("Export CSV");
a.addCancelAction("Done");
const choice = await a.presentAlert();
if (choice === 0) {
  await DocumentPicker.export(outputPath);
}

Script.complete();
