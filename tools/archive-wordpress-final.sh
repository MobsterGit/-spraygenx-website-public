#!/usr/bin/env bash
set -Eeuo pipefail

B="/home/bitnami/wpbackup"
W="/opt/bitnami/wordpress"
R="MobsterGit/spraygenx-wordpress-media-archive"
TAG="wordpress-media-2026-08-02"
TMP="/tmp/sgx-wordpress-final"

mkdir -p "$B"
echo "[$(date -Is)] Starting final WordPress preservation backup"

command -v wp >/dev/null
command -v gh >/dev/null
gh auth status >/dev/null

VISIBILITY="$(gh repo view "$R" --json visibility --jq '.visibility')"
if [ "$VISIBILITY" != "PRIVATE" ]; then
  echo "ERROR: $R is not private. Aborting."
  exit 1
fi

sudo rm -rf "$TMP"
sudo mkdir -p "$TMP/wxr"
sudo chmod 777 "$TMP" "$TMP/wxr"
sudo rm -f /tmp/wordpress-database.sql /tmp/wordpress-database.sql.gz

echo "[$(date -Is)] Exporting database"
sudo wp db export /tmp/wordpress-database.sql --path="$W"
sudo gzip -f /tmp/wordpress-database.sql
sudo mv /tmp/wordpress-database.sql.gz "$B/wordpress-database.sql.gz"
sudo chown bitnami:bitnami "$B/wordpress-database.sql.gz"

echo "[$(date -Is)] Exporting WordPress XML content"
sudo wp export --dir="$TMP/wxr" --path="$W"
sudo tar -C "$TMP" -czf "$B/wordpress-content-export.tar.gz" wxr
sudo chown bitnami:bitnami "$B/wordpress-content-export.tar.gz"

echo "[$(date -Is)] Archiving themes, plugins, and wp-content without uploads"
sudo tar -C "$W" \
  --exclude="wp-content/uploads" \
  --exclude="wp-content/cache" \
  --exclude="wp-content/upgrade" \
  --exclude="wp-content/ai1wm-backups" \
  --exclude="wp-content/updraft" \
  -czf "$B/wordpress-code-no-uploads.tar.gz" wp-content
sudo chown bitnami:bitnami "$B/wordpress-code-no-uploads.tar.gz"

echo "[$(date -Is)] Creating site inventory"
{
  echo "Backup date: $(date -Is)"
  echo "Instance: WordPress-s-2"
  echo "WordPress path: $W"
  echo
  echo "WORDPRESS VERSION"
  sudo wp core version --path="$W"
  echo
  echo "SITE URL"
  sudo wp option get siteurl --path="$W"
  echo
  echo "HOME URL"
  sudo wp option get home --path="$W"
  echo
  echo "ACTIVE THEME"
  sudo wp theme list --status=active --format=table --path="$W"
  echo
  echo "ALL THEMES"
  sudo wp theme list --format=table --path="$W"
  echo
  echo "ALL PLUGINS"
  sudo wp plugin list --format=table --path="$W"
  echo
  echo "CRON EVENTS"
  sudo wp cron event list --format=table --path="$W" || true
  echo
  echo "DATABASE SIZE"
  sudo wp db size --human-readable --path="$W" || true
} > "$B/wordpress-inventory.txt"

echo "[$(date -Is)] Creating legacy URL inventory"
sudo wp eval '
$fh = fopen("php://output", "w");
fputcsv($fh, array("ID","post_type","post_status","post_title","url"));
$posts = get_posts(array(
  "post_type" => "any",
  "post_status" => "any",
  "numberposts" => -1,
  "orderby" => "ID",
  "order" => "ASC"
));
foreach ($posts as $p) {
  $url = ($p->post_type === "attachment") ? wp_get_attachment_url($p->ID) : get_permalink($p->ID);
  fputcsv($fh, array($p->ID, $p->post_type, $p->post_status, $p->post_title, $url));
}
' --path="$W" > "$B/wordpress-urls.csv"

if [ -f "$W/.htaccess" ]; then
  sudo cp "$W/.htaccess" "$B/wordpress-htaccess.txt"
  sudo chown bitnami:bitnami "$B/wordpress-htaccess.txt"
fi

echo "[$(date -Is)] Verifying local archives"
gzip -t "$B/wordpress-database.sql.gz"
tar -tzf "$B/wordpress-content-export.tar.gz" >/dev/null
tar -tzf "$B/wordpress-code-no-uploads.tar.gz" >/dev/null

FILES=(
  "$B/wordpress-database.sql.gz"
  "$B/wordpress-content-export.tar.gz"
  "$B/wordpress-code-no-uploads.tar.gz"
  "$B/wordpress-inventory.txt"
  "$B/wordpress-urls.csv"
)
if [ -f "$B/wordpress-htaccess.txt" ]; then
  FILES+=("$B/wordpress-htaccess.txt")
fi

sha256sum "${FILES[@]}" > "$B/EXTRA-SHA256SUMS.txt"
FILES+=("$B/EXTRA-SHA256SUMS.txt")

if ! gh release view "$TAG" --repo "$R" >/dev/null 2>&1; then
  gh release create "$TAG" --repo "$R" \
    --title "WordPress Media Archive - 2026-08-02" \
    --notes "Full preservation backup of the former Spray GenX AWS Lightsail WordPress site."
fi

echo "[$(date -Is)] Uploading backup assets to private GitHub release"
gh release upload "$TAG" "${FILES[@]}" --repo "$R" --clobber

echo "[$(date -Is)] Verifying GitHub release assets"
gh release view "$TAG" --repo "$R" --json assets \
  --jq '.assets[] | [.name, .size] | @tsv' | tee "$B/github-release-assets.txt"

echo "[$(date -Is)] Backup and upload completed successfully"
echo "DONE"

sudo rm -rf "$TMP"
printf 'y\n' | gh auth logout --hostname github.com --user MobsterGit >/dev/null 2>&1 || true
