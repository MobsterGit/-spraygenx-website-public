#!/usr/bin/env bash
set -Eeuo pipefail

python3 - <<'PY'
import json
import sys
import urllib.request
import boto3

REGION = "us-east-1"
REPO_MARKER = "MobsterGit/-spraygenx-website-public"
RULES_URL = "https://raw.githubusercontent.com/MobsterGit/-spraygenx-website-public/main/amplify-redirects.json"

client = boto3.client("amplify", region_name=REGION)
apps = []
next_token = None
while True:
    kwargs = {"maxResults": 100}
    if next_token:
        kwargs["nextToken"] = next_token
    response = client.list_apps(**kwargs)
    apps.extend(response.get("apps", []))
    next_token = response.get("nextToken")
    if not next_token:
        break

matches = [
    app for app in apps
    if REPO_MARKER in app.get("repository", "")
    or app.get("name") == "-spraygenx-website-public"
]
if len(matches) != 1:
    print(f"ERROR: expected one Spray GenX Amplify app, found {len(matches)}", file=sys.stderr)
    for app in matches:
        print(app.get("appId"), app.get("name"), app.get("repository"), file=sys.stderr)
    sys.exit(1)

app_id = matches[0]["appId"]
with urllib.request.urlopen(RULES_URL, timeout=30) as response:
    raw_rules = json.load(response)

# Amplify's API requires optional fields such as condition to be omitted,
# not sent as JSON null.
rules = []
for rule in raw_rules:
    clean = {key: value for key, value in rule.items() if value is not None}
    if not clean.get("condition"):
        clean.pop("condition", None)
    clean["status"] = str(clean["status"])
    rules.append(clean)

client.update_app(appId=app_id, customRules=rules)
check = client.get_app(appId=app_id)["app"].get("customRules", [])
if len(check) != len(rules):
    print(f"ERROR: Amplify returned {len(check)} rules after applying {len(rules)}", file=sys.stderr)
    sys.exit(1)

print(f"SUCCESS: applied {len(rules)} redirect/rewrite rules to Amplify app {app_id}")
PY

sleep 8
printf '\nLive checks:\n'
for url in \
  "https://spraygenx.com/spray-genx-industrial-painting/" \
  "https://spraygenx.com/contact/" \
  "https://spraygenx.com/competitive-ceiling-spray-rates/" \
  "https://www.spraygenx.com/services.html"
do
  printf '%s -> ' "$url"
  curl -sSI "$url" | awk 'BEGIN{s="";l=""} /^HTTP\//{s=$2} /^[Ll]ocation:/{l=$2} END{gsub("\r","",l); print s, l}'
done
