# AFTERZERO: The Last Version of Earth

A cinematic temporal-reality thriller, playable in the browser. Built from the
*AFTERZERO Complete Gameplay Bible* as the vertical slice its production roadmap
asks for: the full Prologue ("The Zero Second") and the opening of Act I.

## Run it

No build step. Serve the folder with any static server and open it in a browser with WebGL2
(desktop Chrome, Edge, Firefox or Safari; Android Chrome; iPhone and iPad Safari):

```sh
npm install && npm start   # http-server on http://localhost:8765/
# or, without installing:  npx http-server@14.1.1 -p 8765 -c-1 .   /   python3 -m http.server 8765
```

Opening `index.html` directly from disk will not work, because ES modules need HTTP.

**Phones and tablets** are played in landscape with on-screen touch controls; the game also installs as
an offline PWA and ships to Google Play and the App Store through Capacitor. `npm run build:web` writes the
release bundle to `www/`. See [docs/MOBILE_RELEASE.md](docs/MOBILE_RELEASE.md) for phone testing, hosting
and store builds.

## What's in the slice

| # | Mission | Highlights |
|---|---------|-----------|
| 1 | The Last Normal Day | Rain City 2049, three optional anomalies, Rook's call, Checkpoint C, the Zero Second: time freezes and you pull civilians out from under a derailing train |
| 2 | Helix Goes Dark | Lockdown stealth against drones, Residue Vision echoes, three power cells, the Warden that rewinds damage, a trust choice, the child's drawing |
| 3 | The First Switch | Bind to the Chronolith; switch between 2026, 2049 and 2196. Connect a cable in the past and watch it appear, twenty-three years old, in the present |
| 4 | The Man from the Last Day | The ancient settlement at sunset, Niko and Tala, three fragments of the Telling, the mural puzzle, a Helix card three thousand years old |

The Chapters screen lists the remaining 19 missions of the campaign as the road ahead.

## Controls

| Input | Action |
|-------|--------|
| WASD · Mouse | Move · look (click the game to capture the mouse) |
| Shift · C · Space | Sprint · crouch · jump |
| E | Interact (hold when prompted) |
| F | Residue Vision (from Mission 2) |
| 1 2 3 / Q | Temporal state switch (from Mission 3); costs Chronolith stability |
| J · Esc | Case board · pause |

On touch screens: left thumb moves (push to the rim to sprint), right thumb drags to look, and the
HAND button interacts. JUMP, CROUCH, the EYE (Residue Vision), the era buttons, CASE BOARD and PAUSE are on
screen. Tap to advance dialogue.

## How it is built

Everything is generated in code. There are no downloaded models, textures or audio files.

- **Rendering**: Three.js r170 (vendored in `vendor/`), ACES tone mapping, soft shadows,
  bloom, and a custom cinematic pass for temporal ripples, chromatic aberration, freeze and grain.
- **Characters** (`src/core/character.js`): articulated procedural humanoids with physical
  skin, leather and fabric materials, sculpted faces, blinking, lip movement, hair styles,
  procedural walk, run and crouch, plus a holographic "echo" mode. Portraits are rendered live.
- **Audio** (`src/core/audio.js`): a generative WebAudio score following the music bible.
  It has the three-note Kai and Mira motif, era instrumentation, rain and wind beds, and silence at the Zero Second.
- **Systems**: temporal state manager with per-era geometry and collision, residue echoes,
  drones with vision cones, checkpoints, an evidence case board and saved chapter progress.
- **Missions** (`src/missions/`): each is an async script over a small, abortable API.

Graphics quality (Auto, High, Medium, Low) is in the pause menu. Auto uses High on desktop and Medium or
Low with adaptive resolution on phones.
