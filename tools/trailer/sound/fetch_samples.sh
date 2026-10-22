#!/usr/bin/env bash
# Fetch the openly licensed instrument samples the trailer score plays (pinned versions, sha256-checked).
#   Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0 (npm packaging by Jan Forst, MIT): velocity layers 2/4/6/8/12 + release noises
#   VSCO-2 Community Edition by Versilian Studios, CC0 1.0 (edited excerpts in tiny-orchestra 0.2.0, CC0 1.0)
# Samples live outside the repo (they are build inputs, not game assets): $TRAILER_SAMPLES or /home/user/tools/trailer-samples.
# Each tarball is unpacked into its own empty directory; nothing in it is executed.
set -euo pipefail
DIR=${TRAILER_SAMPLES:-/home/user/tools/trailer-samples}
mkdir -p "$DIR/dl" "$DIR/x"
PKGS=(
  "tiny-orchestra@0.2.0 tiny-orchestra-0.2.0.tgz 18707b7b2c635bd45b2562ddb7704f5db5ef7136d66e45c04fd63272454334d2"
  "@audio-samples/piano-velocity2@1.0.5 audio-samples-piano-velocity2-1.0.5.tgz 06780c1e5c2f5af6380be80dece7edd088d3a1a9d64e72277f674b5f8dfea99a"
  "@audio-samples/piano-velocity4@1.0.5 audio-samples-piano-velocity4-1.0.5.tgz d4109ec1b6e7c9fe10eeff53195b386cb7225b74675c1c17a03a8e8ab094faed"
  "@audio-samples/piano-velocity6@1.0.5 audio-samples-piano-velocity6-1.0.5.tgz e6231e57d00db22457d2f4c9270165bd648a121d9abb063df5f97bfb56e82f03"
  "@audio-samples/piano-velocity8@1.0.5 audio-samples-piano-velocity8-1.0.5.tgz 53e86caef9fc0696ea293a62fa0b0b1cfce21c9a035d65fa0190ad24da2252d3"
  "@audio-samples/piano-velocity12@1.0.5 audio-samples-piano-velocity12-1.0.5.tgz e1c3182e8b0c6d055ee544fc3b3693c00d9e36c24a0a4e5c0eda2486fbcfedbd"
  "@audio-samples/piano-release@1.0.5 audio-samples-piano-release-1.0.5.tgz 75303df9cfb82e63d90edf30a5ab32bef0c07dec999a4d7b1c36cc14f2c44485"
)
for row in "${PKGS[@]}"; do
  read -r spec file sum <<<"$row"
  if [ ! -f "$DIR/dl/$file" ]; then (cd "$DIR/dl" && npm pack --silent "$spec" >/dev/null); fi
  echo "$sum  $DIR/dl/$file" | sha256sum -c --quiet - || { echo "checksum mismatch: $file" >&2; exit 1; }
  name=${file%.tgz}
  if [ ! -d "$DIR/x/$name/package" ]; then mkdir -p "$DIR/x/$name" && tar xzf "$DIR/dl/$file" -C "$DIR/x/$name"; fi
done
echo "samples ready in $DIR/x"
