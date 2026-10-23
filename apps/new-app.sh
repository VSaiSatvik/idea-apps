#!/usr/bin/env bash
# Usage: ./new-app.sh <dir> <extra npm packages...>  — copies the verified Expo base and shared kit
set -euo pipefail
cd "$(dirname "$0")"
NAME=$1; shift
mkdir -p "$NAME"
cp circles/package.json circles/package-lock.json circles/tsconfig.json "$NAME"/
cp -r circles/assets "$NAME"/
mkdir -p "$NAME/src" "$NAME/app"
cp -r _shared/src/* "$NAME/src/"
cp _shared/app/*.tsx "$NAME/app/"
cd "$NAME"
node -e "const p=require('./package.json');p.name='$NAME';require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))"
npm install --no-audit --no-fund 2>&1 | tail -2
if [ $# -gt 0 ]; then npm install --no-audit --no-fund "$@" 2>&1 | tail -2; fi
echo "created $NAME"
