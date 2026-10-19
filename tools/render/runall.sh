#!/bin/bash
# Capture several reference-view sets in a row, retrying a set when the renderer is OOM-killed (shared container).
#   bash tools/render/runall.sh <out root> "m1 high 1280 720;m1 low 844 390 --mobile;..."
# Writes <out root>/<gfx>[_mobile]/ (pngs, <mission>_<gfx>[_mobile].json, <mission>.log). See docs/RENDERING.md.
OUT=$1; [ -z "$OUT" ] || [ -z "$2" ] && { echo "usage: runall.sh <out root> \"<mission> <gfx> <W> <H> [--mobile];...\""; exit 2; }
cd "$(dirname "$0")/../.." || exit 2
IFS=';' read -ra SPECS <<< "$2"
for spec in "${SPECS[@]}"; do
  read -r mis gfx w h mob <<< "$spec"
  sub=$gfx; [ -n "$mob" ] && sub=${gfx}_mobile
  mkdir -p "$OUT/$sub"
  for try in 1 2 3 4 5 6; do
    echo "== $mis $sub try $try $(date +%T)"
    timeout 1800 node tools/render/refviews.mjs "$mis" "$gfx" "$OUT/$sub" "$w" "$h" $mob --resume >> "$OUT/$sub/$mis.log" 2>&1
    rc=$?
    echo "rc=$rc"; grep -E "^\[" "$OUT/$sub/$mis.log" | tail -1 | cut -c1-120
    [ $rc -eq 0 ] && break
  done
done
echo ALLDONE
