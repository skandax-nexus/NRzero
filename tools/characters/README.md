# AfterZero character generator

Every person in the game is built here from code: no downloaded or third-party characters.

- `cast.py`: the cast. Each character is a parameter set: height, build, face shape (jaw, nose, cheek, brow),
  skin, hair style and colour, clothing (coat, robe, dress, uniform and so on), hats, scarves, satchels, aprons,
  glasses and Keeper masks.
- `build_characters.py`: the machinery (Blender as a Python module). It:
  - sculpts the body from a skeleton graph with a skin modifier;
  - shapes the head with face functions;
  - adds eyelids, brows, hair with strand shading, shoes and clothing;
  - weights everything to our own rig;
  - keyframes the animations from code: idle, walk, run, crouch (sneak), talk, nod, sad, fall.

Build (needs Python 3.13; the bpy wheel is downloaded from PyPI):

    python3.13 -m venv venv && venv/bin/pip install bpy==5.2.2
    ONLY=arin,pell venv/bin/python build_characters.py out     # quick: build some characters
    venv/bin/python build_characters.py out                    # everything -> out/cast.glb + out/anims.glb
    npx @gltf-transform/cli meshopt out/cast.glb  ../../assets/models/cast.glb
    npx @gltf-transform/cli meshopt out/anims.glb ../../assets/models/anims.glb

At runtime, `assets/js/humans.js` loads both files and maps story names to character ids. It reuses the shared
clips on every rig, because all rigs share bone names and rest orientations. It also re-tints townsfolk per person,
using skin, coat and trouser palettes.

To add a character, add an entry to `CAST`, rebuild, and (for a named role) add its name pattern to `NAMED` in `humans.js`.

## AFTERZERO costume pipeline (`wear=[...]`)

`build_humans.py` (MakeHuman bodies) builds a character with the costume pipeline whenever its spec has a `wear` list:

- `garments.py`: the garment catalogue of docs/COSTUMES.md (every top, over layer, bottom, limb piece, glove, footwear,
  skirt and head piece, plus the hair styles `waves curls puffs locs undercut fade pixie`) and the garment painters
  (panel seams, taped seams, quilting, piping, reflective strips, MOLLE, wear and grime for 2196, linen weave for the
  ancient era). Painters return colour, height (baked to a normal map) and glow (baked to an emissive map).
- `costume.py`: coverage fields -> garment layers cut from the body mesh with snapped borders (outer items cut what
  they hide back to a 2.5 cm band, so nothing is see-through), cloth tails for long hems (coats, lab coats, tunics,
  ponchos, cloaks: lofted from the hem loop, skirt-weighted, lined, with vents / splits / slits), rims, stand / funnel
  collars sewn onto the garment, the hood-down pillow, hoods up, ribbons (harness straps, belts, sashes), buckles,
  pouches, knee pads, chunky soles, gloves, caps, helmets and hair pieces. Tails, collars, hoods and straps are painted
  in the atlas "aux" region from their own 3D positions, so they match the body layers.
- `costume.drape_torso`: before a garment is finished, each 1 cm torso slice is replaced by its 2D convex hull
  (clefts, the spine groove and the gap between the breasts are bridged), small bumps on the bust are pressed flat,
  and tops hang straight down from the widest hip / buttock ring (and, for women, from the bust apex), so cloth never
  shrink-wraps the anatomy.
- `costume.band_swatches`: the overlap band a broad item leaves of each layer under it would share atlas texels with
  that item (all layers use the body uv map), so where it peeks out below a draped hem it showed the outer colour as a
  ragged fringe. Band faces sample a flat swatch of their own garment's median painted colour (aux region) instead,
  the outer item claims its own uv footprint (`layer_texels`), and the last 2.5 cm of a top / vest stand 3 mm clear
  of what they cover. Skirts stay inside any top worn over them.
- Glow is dilated into empty padding only (a baked glow swatch used to light the gadget swatch next to it).
- Triangle budgets (docs/COSTUMES.md "Mobile budgets": Kai 16 000, named NPCs 11 000, crowds and children 9 000 plus
  a 6 000-triangle low LOD) are landed by `simplify_cast.mjs` (run by `compress_cast.sh`), not by Blender: costume
  builds export the full-density mesh (Blender's collapse left stray dark triangles on faces and faceted ears;
  `BLENDER_DEC=1` brings the old in-Blender decimation back). meshoptimizer's attribute-aware simplifier locks open
  borders (hems, cuffs, hairline, hair shell edge) and keeps uv seams, and weighs normal, uv, the shading mask and a
  skin-weight embedding, so plain cloth goes first and painted detail, skin / cloth edges and joints hold. The
  armature root carries `tris_budget`, `lod_tris` (crowds and children) and `stature` (standing height, metres).
- Crowd low LOD: `<id>_lod`, a second index list over the same vertex buffers (only an index buffer more; hidden,
  extras `lod: 1`); `person.setLOD(1)` in cast3d.js swaps it in. It samples the same atlas (its mip chain stands in
  for the 512 LOD atlas).
- Bound edges (`costume.bind_edges`): for 2026 / 2049 cloth, the faces along a garment's own hem loops sample a
  gradient swatch keyed on the distance from the hem (the coverage field), so every hem ends in a crisp, even
  binding (hi-vis vests: a dark 7 mm bound edge) instead of sharing texels with the layer below (a fuzzy fringe).
  Worn 2196 and ancient cloth keep their frayed hems.
- One material per character: `baseColorTexture`, `normalTexture` and, when anything glows, `emissiveTexture` with
  `emissiveFactor` 1 (three.js shows it as `emissiveMap`). The glow colour is in the material's `extras.glow`.

Pick the cast module with `CAST=<name>` (`cast_<name>.py`; default `cast_humans`, AfterZero's cast):

    cd tools/characters
    CAST=test MH_DATA=/path/to/makehuman/data ONLY=t_kai,t_coat ../../../tools/venv/bin/python build_humans.py OUT
    CAST=test TEST_ALL=1 MH_DATA=... venv/bin/python build_humans.py OUT      # + one outfit per garment type
    npx --yes @gltf-transform/cli meshopt OUT/cast.glb OUT/cast.min.glb

`cast_test.py` holds four sample costumes (a 2049 techwear man, a 2049 woman in a long sealed coat, a 2196 survivor
with a hooded poncho, an ancient settler) and, with `TEST_ALL=1`, a coverage set that wears every garment type.
The generator's `anims.glb` is procedural: never copy it over `assets/models/anims.glb` (motion capture). To view a
build, copy the real `assets/models/anims.glb` next to it and open `tools/cast.html?base=<url of OUT>/&ids=...`
(`&rot=180` back view, `&clip=walk&t=0.35`, `&clip=bind`).

## Gadgets (`gear=[...]`, `gadgets.py`)

A costume spec lists hard-surface gadgets in `gear` (a name, `(name, {options})`, or `period:<name>` for ancient
props); `gadgets.era_ok` refuses tech in the settlement and period props anywhere else. Each gadget is bevelled
geometry placed by rays on the dressed body (outermost layer), coloured from flat palette swatches in the atlas aux
region, and weighted 100 % to one bone (straps and cords copy the cloth weights under them). Wrist bands fit the
limb at both edges and never straddle a sleeve hem (under a loose sleeve they sit on the skin and peek out).

glTF output the runtime uses (`src/human/cast3d.js` → `person.gadgets`, `setGadget(type, level)`, `showProp(type, on)`):
- `gx_<id>`: the character's one glow group (one draw call): every gadget's emissive part and smoked lens in one
  skinned mesh. Per vertex `_gcol` = the glow colour (linear rgb, black on a lens) and `_gid` = (gadget index / 32,
  glow segment / 32, opacity: 1 glow, 0.34 lens). Node extras: `slot: 'glow'`, `gadgets` (JSON list of types in index
  order), `idle` (JSON list of rest levels), `props`, `glass`. Material `<id>_glow` (alpha-blended when the group holds
  a lens). The runtime drives one level and one visibility per gadget index through a uniform array (all glow
  colours share the one material / shader program).
- `gp_<type>`: hand props (staff, spear, umbrella, phone, scanner, jar ...), extras `gadget`, `prop: 'hand'`.
- Smoked lens planes (AR glasses, the AR monocle) are part of the glow group (opacity in `_gid`.z). Crowds with baked
  glow leave the lens out (one draw call).
- `continuum_armor`: the Continuum's ceramic plates as rigid gadget geometry (chamfered pearl plates with a darker edge
  and a graphite side wall, each weighted 100 % to one bone), so no plate bends at a joint.
- The armature root carries `gadgets`: JSON [{type, bone, glow, idle, segs, seg_mode, prop, node, color, baked}].
- Budgets under 11 000 triangles (crowds, children) bake glow into the atlas emissive at its idle level: no gx_ nodes.
- Long hand props (umbrella, staff, spear) hide themselves while the crouch or sit clip plays (cast3d.js).

The build log prints each gadget's triangle cost. Viewer close-ups: `tools/cast.html?base=...&ids=kai&cols=1&focus=head&d=0.5`
(`focus=<bone>` aims at a bone, `fy` lifts the aim, `glow=<level>` lights every gadget). `GADGET_DEBUG=1` prints the
forearm radius profile used to find sleeve hems.
