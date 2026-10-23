#!/bin/bash
# face_studio.sh NAME [--no-build] [--base=DIR] [--views=front,three,profile] [--lights=studio,game] [--size=512]
#
# Studio portraits of cast builds (docs/CHARACTER_LOOK.md, "Faces"): builds only the ids in ONLY (CAST=nrzero,
# with FACES_DIR's face overrides when set) into a staging folder OUTSIDE the repo, packs them as the game ships them
# (pack_cast2.mjs: triangle budgets with the face importance, phone + HD atlases), then renders front, three-quarter
# and profile head shots under a neutral studio light and one in-game light (Rain City night: sodium key, cyan rim,
# wet blue ambient), plus one contact sheet per id and a front-view overview sheet.
#
#   ONLY=kai,mira FACES_DIR=/path/to/candidates tools/characters/face_studio.sh kai_try1
#   ONLY=kai,mira tools/characters/face_studio.sh shipped --no-build --base=/home/user/NRzero/assets/models
#
# Output: $FACE_STAGE/NAME/{raw,pack,shots}, sheets in $FACE_STAGE/NAME/shots/sheet_<id>.png and overview.png.
# FACE_STAGE defaults to the faces work folder of the look workflow; the folder is served by a CORS http-server
# on port FACE_PORT (8793), started here when it is not running. The game's own server must be on 8765.
set -e
NAME=$1; shift || true
[ -z "$NAME" ] && { sed -n 2,16p "$0"; exit 1; }
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
FACE_STAGE=${FACE_STAGE:-/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/feel/faces/stage}
FACE_PORT=${FACE_PORT:-8793}
MH_DATA=${MH_DATA:-/home/user/tools/mh/makehuman/data}
PY=${PY:-/home/user/tools/venv/bin/python}
BUILD=1; BASE=""; REST=()
for a in "$@"; do
  case $a in
    --no-build) BUILD=0 ;;
    --base=*) BASE=${a#--base=}; BUILD=0 ;;
    *) REST+=("$a") ;;
  esac
done
D=$FACE_STAGE/$NAME
mkdir -p "$D"
case "$D" in "$ROOT"/*) echo "staging must be outside the repo ($D)"; exit 1 ;; esac
[ -z "$ONLY" ] && { echo "set ONLY=id1,id2,..."; exit 1; }
if [ $BUILD = 1 ]; then
  T0=$(date +%s)
  (cd "$HERE" && CAST=nrzero MH_DATA=$MH_DATA ONLY=$ONLY FACES_DIR=${FACES_DIR:-} nice -n 5 "$PY" build_humans.py "$D/raw" > "$D/build.log" 2>&1) || { tail -30 "$D/build.log"; exit 1; }
  echo "build $(( $(date +%s) - T0 ))s: $(grep -c '^built' "$D/build.log") characters"
  export GT_MODS=${GT_MODS:-$(dirname "$(dirname "$(ls -d ~/.npm/_npx/*/node_modules/@gltf-transform/core | head -1)")")}
  rm -rf "$D/pack"
  (cd "$HERE" && nice -n 5 node pack_cast2.mjs "$D/raw/cast.glb" "$D/pack" > "$D/pack.log" 2>&1) || { tail -20 "$D/pack.log"; exit 1; }
  rm -f "$D/raw/cast.glb"          # the raw export is large; the pack is what the game loads
  BASE=$D/pack
fi
[ -z "$BASE" ] && BASE=$D/pack
# the viewer needs the shared clips and the index beside the cast file
for f in anims.glb anims_extra.glb cast_index.json; do [ -f "$BASE/$f" ] || cp "$ROOT/assets/models/$f" "$BASE/" 2>/dev/null || true; done
case "$BASE" in
  "$ROOT"/*) URL="http://localhost:8765/${BASE#"$ROOT"/}/" ;;
  "$FACE_STAGE"/*) URL="http://localhost:$FACE_PORT/${BASE#"$FACE_STAGE"/}/"
    if ! curl -s -o /dev/null "http://localhost:$FACE_PORT/"; then
      (cd "$FACE_STAGE" && setsid nohup http-server -p "$FACE_PORT" -s -c-1 --cors . < /dev/null > /dev/null 2>&1 &)
      sleep 2
    fi ;;
  *) echo "base must be inside the repo or FACE_STAGE"; exit 1 ;;
esac
nice -n 5 node "$HERE/face_studio.mjs" "$URL" "$D/shots" "$ONLY" "${REST[@]}"
python3 "$HERE/face_sheet.py" rows "$D/shots" "$ONLY"
echo "sheets: $D/shots/sheet_<id>.png, $D/shots/overview.png"
