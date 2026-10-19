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
