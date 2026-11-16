#!/bin/sh
# shared/core.js 를 웹 앱과 확장에 복사한다. core.js 를 고친 뒤 부른다.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cp "$ROOT/shared/core.js" "$ROOT/web/core.js"
cp "$ROOT/shared/core.js" "$ROOT/extension/core.js"
echo "core.js 복사 완료"
