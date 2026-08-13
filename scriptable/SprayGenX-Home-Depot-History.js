// Spray GenX - Home Depot Desktop Purchase History launcher
// iPhone-first helper for opening Home Depot purchase history in Safari
// so desktop-only CSV/export controls can be used.

const PURCHASE_HISTORY_URL = "https://www.homedepot.com/c/view-your-purchase-history";
const PRO_XTRA_URL = "https://www.homedepot.com/c/Pro_Xtra";

async function openDesktopHelp() {
  const a = new Alert();
  a.title = "Home Depot Desktop Export";
  a.message = [
    "1. Home Depot will open in Safari.",
    "2. In Safari, tap the page menu (••• / aA).",
    "3. Choose Request Desktop Website.",
    "4. Return to Purchase History if needed.",
    "5. Use Home Depot's desktop Export / CSV controls.",
    "6. Save the file to iCloud Drive so it can be matched with Timeline-All-Visits.csv."
  ].join("\n\n");
  a.addAction("Open Purchase History");
  a.addCancelAction("Done");
  const c = await a.presentAlert();
  if (c === 0) Safari.open(PURCHASE_HISTORY_URL);
}

const a = new Alert();
a.title = "Spray GenX - Home Depot";
a.message = "Open Home Depot Purchase History in Safari and use the desktop site for CSV exports.";
a.addAction("Open Desktop Purchase History");
a.addAction("Desktop Export Instructions");
a.addAction("Open Pro Xtra");
a.addCancelAction("Cancel");

const choice = await a.presentAlert();

if (choice === 0) {
  Safari.open(PURCHASE_HISTORY_URL);
} else if (choice === 1) {
  await openDesktopHelp();
} else if (choice === 2) {
  Safari.open(PRO_XTRA_URL);
}

Script.complete();
