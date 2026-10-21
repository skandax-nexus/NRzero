#!/bin/bash
# compress_cast.sh RAW.glb OUT.glb: per-character triangle budgets + crowd low LOD (simplify_cast.mjs), WebP atlases
# (quality 70), 8-bit custom attributes (_MASK skin / gloss / hair, _GCOL / _GID gadget glow), then meshopt geometry
# (position 14 bits, texcoord 12, normal 8, level high) -> the shipped cast (target 12 MB or less for the 66-character
# nrzero cast). GLTFLoader decodes EXT_texture_webp, EXT_meshopt_compression and KHR_mesh_quantization natively
# (cast3d.js reads the custom attributes as normalized values).
set -e
TMP=$(mktemp -d)
npx --yes @gltf-transform/cli --version > /dev/null
# the npx cache that holds @gltf-transform/* (and its meshoptimizer) for simplify_cast.mjs
export GT_MODS=${GT_MODS:-$(dirname "$(dirname "$(ls -d ~/.npm/_npx/*/node_modules/@gltf-transform/core | head -1)")")}
node "$(dirname "$0")/simplify_cast.mjs" "$1" "$TMP/s.glb"
npx --yes @gltf-transform/cli webp "$TMP/s.glb" "$TMP/w.glb" --quality ${WEBPQ:-70}
# meshopt's default level leaves custom attributes as float32: quantize them first
npx --yes @gltf-transform/cli quantize "$TMP/w.glb" "$TMP/q.glb" --pattern "_*" --quantize-generic 8
# meshopt (level high: position 14 bits, texcoord 12, octahedral normals) without a second reorder: the LODs share buffers
node "$(dirname "$0")/simplify_cast.mjs" --pack "$TMP/q.glb" "$2"
rm -rf "$TMP"
ls -la "$2"
