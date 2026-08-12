// Timeline Reverse Geocoder for Scriptable (iPhone/iPad)
// Reads a Google Maps Timeline JSON export, reverse-geocodes unique visit locations,
// caches progress, and exports a CSV with addresses.
//
// SAFE RESUME VERSION:
// - Only tries a small batch per run.
// - Never re-geocodes successful cache entries.
// - Retries failed entries on later runs.
// - Stops early when Scriptable/Apple appears to be throttling requests.
// - Saves after every location so iOS suspension does not lose progress.

const fm = FileManager.iCloud();
const docs = fm.documentsDirectory();
const cachePath = fm.joinPath(docs, "Timeline-Geocode-Cache.json");
const outputPath = fm.joinPath(docs, "Timeline-Destinations-Geocoded.csv");

const BATCH_SIZE = 20;
const REQUEST_PAUSE_SECONDS = 1.5;
const RETRY_PAUSE_SECONDS = 4;
const MAX_ATTEMPTS_PER_LOCATION = 2;
const STOP_AFTER_CONSECUTIVE_THROTTLES = 2;

function sleep(seconds) {
  // Scriptable Timer.schedule() uses MILLISECONDS.
  return new Promise(resolve => Timer.schedule(seconds * 1000, false, resolve));
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

function emptyAddress() {
  return { name: "", street: "", city: "", state: "", zip: "", country: "", fullAddress: "" };
}

function placemarkToAddress(p) {
  if (!p) return emptyAddress();

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
  const line2 = [city, state, zip].filter(Boolean).join(", ")
    .replace(/, ([A-Z]{2}), (\d{5})$/, ", $1 $2");
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

function applyCache(rows, cache) {
  for (const r of rows) {
    const cached = cache[r.placeID];
    if (cached && cached.address) r.address = cached.address;
  }
}

function saveProgress(rows, cache) {
  applyCache(rows, cache);
  saveCache(cache);
  fm.writeString(outputPath, buildCSV(rows));
}

function looksThrottled(message) {
  const s = String(message || "").toLowerCase();
  return s.includes("rate limit") ||
    s.includes("being limited") ||
    s.includes("too many requests") ||
    (s.includes("geocod") && s.includes("limited"));
}

async function main() {
  // 1) Pick the ORIGINAL Google Timeline JSON, not the cache JSON.
  const inputPath = await DocumentPicker.openFile();
  if (!inputPath) return;

  const inputFM = FileManager.local();
  let raw;
  try {
    raw = inputFM.readString(inputPath);
  } catch (_) {
    raw = Data.fromFile(inputPath).toRawString();
  }

  const timeline = JSON.parse(raw);
  if (!Array.isArray(timeline)) {
    throw new Error(
      "That is not the original Google Timeline JSON. Select the Timeline export, not Timeline-Geocode-Cache.json."
    );
  }

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

  // 3) Resume from the cache. Only unresolved locations enter this run's batch.
  const cache = await loadCache();
  applyCache(rows, cache);

  const resolvedBefore = rows.filter(r => cache[r.placeID]?.status === "ok").length;
  const unresolved = rows.filter(r => cache[r.placeID]?.status !== "ok");

  if (unresolved.length === 0) {
    saveProgress(rows, cache);
    const done = new Alert();
    done.title = "Timeline geocoding complete";
    done.message = `${rows.length} unique destinations\nAll ${rows.length} are resolved.\n\nThe CSV is ready.`;
    done.addAction("Export CSV");
    done.addCancelAction("Done");
    const choice = await done.presentAlert();
    if (choice === 0) await DocumentPicker.export(outputPath);
    return;
  }

  const batch = unresolved.slice(0, BATCH_SIZE);
  let attempted = 0;
  let resolvedThisRun = 0;
  let failedThisRun = 0;
  let consecutiveThrottles = 0;
  let stoppedForThrottle = false;

  const start = new Alert();
  start.title = "Timeline Geocoder";
  start.message = `${resolvedBefore} of ${rows.length} resolved\n${unresolved.length} remaining\n\nThis run will try up to ${batch.length} locations and save after each one.`;
  start.addAction("Run Batch");
  start.addCancelAction("Cancel");
  if (await start.presentAlert() !== 0) return;

  for (let i = 0; i < batch.length; i++) {
    const r = batch[i];
    const key = r.placeID;
    let success = false;
    let lastError = "";
    let throttleHit = false;

    attempted++;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_LOCATION; attempt++) {
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
          rawPlacemark: p || null,
          resolvedAt: new Date().toISOString()
        };

        resolvedThisRun++;
        consecutiveThrottles = 0;
        success = true;
        break;
      } catch (e) {
        lastError = String(e);
        throttleHit = looksThrottled(lastError);
        if (throttleHit) break;
        if (attempt < MAX_ATTEMPTS_PER_LOCATION) await sleep(RETRY_PAUSE_SECONDS);
      }
    }

    if (!success) {
      r.address = cache[key]?.address || emptyAddress();
      cache[key] = {
        status: "failed",
        latitude: r.latitude,
        longitude: r.longitude,
        error: lastError,
        address: r.address,
        lastTriedAt: new Date().toISOString()
      };
      failedThisRun++;

      if (throttleHit) consecutiveThrottles++;
      else consecutiveThrottles = 0;
    }

    saveProgress(rows, cache);

    if (consecutiveThrottles >= STOP_AFTER_CONSECUTIVE_THROTTLES) {
      stoppedForThrottle = true;
      break;
    }

    if (i < batch.length - 1) await sleep(REQUEST_PAUSE_SECONDS);
  }

  // 4) Finish this batch and report remaining work.
  saveProgress(rows, cache);
  const resolvedTotal = rows.filter(r => cache[r.placeID]?.status === "ok").length;
  const remaining = rows.length - resolvedTotal;

  const a = new Alert();
  a.title = remaining === 0 ? "Timeline geocoding complete" : "Timeline batch complete";
  a.message = [
    `${resolvedTotal} of ${rows.length} resolved`,
    `${remaining} still unresolved`,
    "",
    `This run: ${attempted} attempted`,
    `${resolvedThisRun} resolved`,
    `${failedThisRun} failed`,
    stoppedForThrottle ? "" : null,
    stoppedForThrottle
      ? "Stopped early because the geocoder appears to be throttling. Your progress is saved; run the script again later."
      : null,
    "",
    "Timeline-Destinations-Geocoded.csv has been updated."
  ].filter(v => v != null).join("\n");

  a.addAction("Export CSV");
  a.addCancelAction("Done");
  const choice = await a.presentAlert();
  if (choice === 0) await DocumentPicker.export(outputPath);
}

await main();
Script.complete();
