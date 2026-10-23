# Face overrides (docs/CHARACTER_LOOK.md, "Faces")

`<id>.json` in this folder overrides the face of cast entry `<id>` in `cast_nrzero.py` (merged at import, after the
entry's own details are softened). No file: the entry builds exactly as before. `FACES_DIR=/other/folder` reads a
candidate set instead (its solved heights go to `/other/folder/_heights.json`), `FACES_DIR=none` ignores overrides.

```json
{
  "notes": "free text",
  "replace_details": true,
  "details": {"chin/chin-prominent-decr|incr": 0.45, "eyes/l-eye-trans-in|out": -0.25, "eyes/r-eye-trans-in|out": -0.25},
  "macro": {"muscle": 0.62, "caucasian": 0.45, "african": 0.15, "asian": 0.40},
  "skin": "b07a58", "lip": "9a5a4c", "eyes": "3a2a1c", "browThick": 0.8, "stubble": 0.85, "beard": null,
  "hair": "waves", "hairColor": "141110"
}
```

- `details`: final MakeHuman detail values (not softened), merged over the entry's softened details; `replace_details`
  drops the entry's own details first. Names: `mh.list_modifiers()`; left / right pairs go in together.
- `macro`: face-relevant macro terms only (`proportions muscle weight caucasian african asian`; the ancestry mix is
  renormalised). Sex, age and height stay the entry's (height is re-solved for `metres`).
- look keys: `skin lip eyes irisR pupilR browColor browLift browThick stubble beard beardColor blush freckles scars
  hair hairLen hairColor hairDrop locs locLen`; `null` unsets one.

Check a set before it ships:

    FACES_DIR=... MH_DATA=... ../../../tools/venv/bin/python face_metric.py OUT     # distinctness + proportions
    ONLY=kai,mira FACES_DIR=... ./face_studio.sh NAME                               # build, pack, portraits
