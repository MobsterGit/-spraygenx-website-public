const PURCHASE_HISTORY_URL = "https://www.homedepot.com/c/view-your-purchase-history";
const PRO_XTRA_URL = "https://www.homedepot.com/c/Pro_Xtra";

async function menu() {
  const a = new Alert();
  a.title = "Spray GenX - Home Depot";
  a.message = "iPhone launcher for Home Depot Pro Xtra purchase history and receipt downloads.";
  a.addAction("Open Purchase History");
  a.addAction("Open Pro Xtra");
  a.addAction("Desktop Setup Help");
  a.addCancelAction("Cancel");
  return await a.presentAlert();
}

async function help() {
  const a = new Alert();
  a.title = "Safari desktop setup";
  a.message = "Open Home Depot Purchase History in Safari, use Website Settings / Request Desktop Website, then return to Purchase History and use Home Depot's receipt download/export controls. Keep downloads together in iCloud so they can later be matched to Timeline-All-Visits.csv.";
  a.addAction("Open Purchase History");
  a.addCancelAction("Done");
  const c = await a.presentAlert();
  if (c === 0) Safari.open(PURCHASE_HISTORY_URL);
}

const c = await menu();
if (c === 0) Safari.open(PURCHASE_HISTORY_URL);
else if (c === 1) Safari.open(PRO_XTRA_URL);
else if (c === 2) await help();
Script.complete();
