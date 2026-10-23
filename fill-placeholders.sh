#!/usr/bin/env bash
# Usage: ./fill-placeholders.sh https://your-api.onrender.com your-github-username you@example.com
# Replaces the placeholders in every app.json and in the privacy pages, then rebuilds the pages.
set -euo pipefail
API="$1"; GH="$2"; MAIL="$3"
for f in apps/*/app.json; do
  sed -i.bak -e "s#https://YOUR-BACKEND.onrender.com#${API}#" -e "s#YOUR-GITHUB-USERNAME#${GH}#" -e "s#YOUR-SUPPORT-EMAIL#${MAIL}#" "$f" && rm "$f.bak"
done
sed -i.bak "s#YOUR-SUPPORT-EMAIL#${MAIL}#" docs/build.py && rm docs/build.py.bak
python3 docs/build.py
grep -l "YOUR-" apps/*/app.json docs/*.html docs/privacy/*.html && echo "^ still has placeholders" || echo "All placeholders filled."
