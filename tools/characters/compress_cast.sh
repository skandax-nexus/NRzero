#!/bin/bash
# compress_cast.sh RAW.glb OUT.glb: WebP atlases (quality 74) + meshopt geometry -> the shipped cast (about 11.7 MB for
# the 66-character nrzero cast). GLTFLoader decodes EXT_texture_webp and EXT_meshopt_compression natively.
set -e
TMP=$(mktemp -d)
npx --yes @gltf-transform/cli webp "$1" "$TMP/w.glb" --quality ${WEBPQ:-74}
npx --yes @gltf-transform/cli meshopt "$TMP/w.glb" "$2"
rm -rf "$TMP"
ls -la "$2"
