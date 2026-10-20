#!/bin/bash
# compress_cast.sh RAW.glb OUT.glb: WebP atlases (quality 74) + 8-bit _MASK (skin / gloss / hair) + meshopt geometry ->
# the shipped cast (about 13.9 MB for the 66-character nrzero cast). GLTFLoader decodes EXT_texture_webp,
# EXT_meshopt_compression and KHR_mesh_quantization natively (cast3d.js reads _mask as a normalized attribute).
set -e
TMP=$(mktemp -d)
npx --yes @gltf-transform/cli webp "$1" "$TMP/w.glb" --quality ${WEBPQ:-74}
# meshopt's default level leaves custom attributes as float32: quantize _MASK first
npx --yes @gltf-transform/cli quantize "$TMP/w.glb" "$TMP/q.glb" --pattern "_*" --quantize-generic 8
npx --yes @gltf-transform/cli meshopt "$TMP/q.glb" "$2"
rm -rf "$TMP"
ls -la "$2"
