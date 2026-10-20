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
- `gx_<type>`: the emissive part, its own skinned node; node extras `gadget`, `slot: 'glow'`, `idle` (rest level),
  `segs`, `seg_mode`, `bone`; material `<id>_glow_<hex>` (extras `slot: 'glow'`, `glow: <hex>`, one per colour);
  vertex attribute `_gseg` = segment index (chronolith glyphs 0..6, echo vents 0..1, shard / vial index).
- `gp_<type>`: hand props (staff, spear, umbrella, phone, scanner, jar ...), extras `gadget`, `prop: 'hand'`.
- The armature root carries `gadgets`: JSON [{type, bone, glow, idle, segs, seg_mode, prop, node, color, baked}].
- Budgets under 11 000 triangles (crowds, children) bake glow into the atlas emissive at its idle level: no gx_ nodes.

The build log prints each gadget's triangle cost. Viewer close-ups: `tools/cast.html?base=...&ids=kai&cols=1&focus=head&d=0.5`
(`focus=<bone>` aims at a bone, `fy` lifts the aim, `glow=<level>` lights every gadget). `GADGET_DEBUG=1` prints the
forearm radius profile used to find sleeve hems.
