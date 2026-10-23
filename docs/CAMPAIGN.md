# AFTERZERO · campaign release sheet

All 23 story missions of the gameplay bible (docs/BIBLE.md) are built and listed in order in
`src/missions/index.js`; none carries `stub: true`. This sheet lists the campaign, its playtime estimates, the
flags that carry choices between missions, how saving works, and the known issues at release.

## How the campaign runs
- **New game** starts Mission 1; the runner (`game.runMissions`) plays every mission in order. When Mission 23
  returns, it has already played its ending (A, B or C), the epilogue, the credits and the post-credit clock
  ("Version one hundred and eighteen."); `src/main.js` `finale()` then marks the campaign complete and returns to
  the title with the chapter list open. (The old vertical-slice card "VERSION 17 · To Be Continued" is gone.)
- **Chapters** lists all 23 missions under six act headers (Prologue · The Zero Second, Act I · The World That
  Remembers, Act II · The Nine-Minute War, Act III · The Last Version of Earth, Act IV · The Unwritten Second,
  Finale). Progression is chained: a chapter unlocks when the mission before it is finished (the runner saves the
  index of each mission as it starts).
- **Saves** (localStorage, prefix `afterzero.`): `chapter` (furthest chapter reached), `last` (chapter Continue
  resumes), `evidence` (case board), `flags` (latest story flags), `flags.<i>` (the flags as they stood when chapter
  i began) and `complete` (the finale was reached). Starting chapter i from Continue or the chapter list restores
  `flags.<i>`, so choices made earlier (trust in Hale, Sera's trust, faction support, rescues, the M13/M15 choices,
  Mira's answers ...) carry into replayed chapters and across sessions. Within a mission, checkpoints
  (`game.checkpoint`) restore on failure.
- **Tests**: `node tools/drive.mjs "http://localhost:8765/index.html?m=<index>&dtcap=0.25&gfx=low&auto"
  tools/tests/mNN.json 960 540` completes mission NN (index = NN - 1); most missions also document a `--mobile`
  run in docs/missions/mNN.md.

## Missions and playtime
Bible target = the bible's target duration for the mission. Estimates come from each builder's design notes
(docs/missions/mNN.md, a first-time player reading and exploring) and, for Missions 1-4 (built before those notes
existed), from their content. "Expected" is the figure used for the campaign total. None of these are playtested
figures yet.

| # | Mission | Act | Setting | Bible | Main path | With optional | Expected |
|---|---|---|---|---|---|---|---|
| 1 | The Last Normal Day | Prologue | Rain City, Central Station · 2049 | 35 | 15 | 20 | 18 |
| 2 | Helix Goes Dark | Prologue | Helix facility · 2049 | 45 | 20 | 25 | 22 |
| 3 | The First Switch | Prologue | Chronolith Chamber · 2026 / 2049 / 2196 | 40 | 12 | 15 | 14 |
| 4 | The Man from the Last Day | Act I | The settlement · c. 1000 BCE | 50 | 13 | 20 | 18 |
| 5 | The Village That Never Existed | Act I | Niko's valley · c. 1000 BCE / c. 400 CE / 2049 (Reservoir 7) | 55 | 47 | 80 | 75 |
| 6 | The Clockmaker's House | Act I | Hensel's clock shop, old quarter · 2026 / 2049 / 2196 | 45 | 42 | 60 | 58 |
| 7 | The Broken Observatory | Act I | The Sky House · c. 1000 BCE / 2049 / 2196 | 65 | 70 | 95 | 90 |
| 8 | The First Death | Act I | Helix, an altered present · 21.10.2049 | 45 | 47 | 60 | 57 |
| 9 | Nine Minutes to Zero | Act II | Meridian district loop · 19.10.2049 08:05-08:14 | 60 | 62 | 80 | 78 |
| 10 | Enemies Who Remember | Act II | Block D4, Continuum detention · 2196 (Helix SL4) | 65 | 68 | 85 | 82 |
| 11 | The Inverted Hospital | Act II | Halden General · 22.10.2049 night | 50 | 48 | 65 | 62 |
| 12 | The Man Behind the Glass | Act II | Helix · 2049 / 2026 / 2196 | 70 | 72 | 95 | 90 |
| 13 | The Nine-Minute War | Act II | The Sable Yards · held second 2049 / battlefield 2196 | 75 | 88 | 110 | 102 |
| 14 | Welcome to 2196 | Act III | The Meridian Reach, Lantern Hall · 2196 | 50 | 55 | 75 | 68 |
| 15 | The City That Forgot Tomorrow | Act III | Harrow Reach · 2196 (one-day lock, 14.05.2193) | 65 | 72 | 100 | 90 |
| 16 | The Museum of Failed Worlds | Act III | Museum of Failed Worlds · 2196 / Civic Museum Store B-3 · 2049 | 55 | 57 | 85 | 72 |
| 17 | The Witness's Archive | Act III | Site Zero · 2196 / 2049 / 2026 | 70 | 67 | 90 | 82 |
| 18 | The Fracture | Act III | Lantern Hall, Varrow Gorge, Eastway, Corran Building, Test Hall C | 60 | 68 | 85 | 77 |
| 19 | The Place Outside Time | Act IV | The Unwritten Second | 60 | 51 | 80 | 68 |
| 20 | Mira's Memory | Act IV | The Threshold: Calder Row 2025, Test Hall Zero 2026, World 0907 | 55 | 45 | 78 | 68 |
| 21 | The Last Battle of the Continuum | Act IV | The Bastion on Helix Tower One · 2196 | 75 | 62 | 90 | 82 |
| 22 | The First Second | Act IV | The original activation: valley, old quarter, Ward 4, the second | 50 | 56 | 76 | 65 |
| 23 | Afterzero | Finale | The Confluence: streets, settlement, future city, original Chronolith | 90 | 79 | 110 | 95 |
| | **Total** | | | **1,330 (22.2 h)** | **1,216 (20.3 h)** | **1,679 (28.0 h)** | **1,533 (25.6 h)** |

The bible's own figure is "approximately 25.5 hours" of main story before exploration plus about 5 hours of optional
missions (25-30 hours). The expected total of about 25.6 hours sits at the low end of that range; a player who does
all optional content reaches about 28 hours. The shortfall is the Prologue and Mission 4 (about 72 minutes against a
bible target of 170): they predate the side-content standard of Missions 5-23 (see Known issues).

The bible's optional chains are folded into missions: Last Train Home (Jun: M1 → M18 bus rescue → M20 World 0907),
The Technician's Key (Iven: M2 → M8), The Clockmaker's Debt (M6), The Ninth Minute: Evidence (M9), The Survivor's
Garden (M14 → M18), The Names Beneath the City / dual archive (M15 → M16), The Unwritten Record (M19 → M23), plus
temporal shards in every mission from M5 (campaign total in `flags.shards`).

## Flags map (choices that cross missions)
Mission-local bookkeeping flags (misses, counts, `mNNdone`, `mNNshards` ...) are listed in each docs/missions/mNN.md.
These are the ones later missions read:

| Flag | Written by | Values | Read by |
|---|---|---|---|
| `metJun` | M1 | true | M18 (Jun's bus), M19, M20 (Jun in 0907), M23 |
| `m1warning` | M1 | true | M5 (ending line) |
| `trustedHale` | M2 | true / false | M5, M6, M8 (route, log, ending), M9, M11 (Hale or Brandt, bay route), M12, M13, M18, M21 (Hale ally or Brandt), M23 |
| `nikoCrossedEras`, `villageCausalChain`, `m5complete` | M5 | true / array | M22 (valley), M23 (settlement) |
| `m5_riverDiverted`, `m5_waterQuest` | M5 | true | M7 (stone 2), M14 (channel, Ama) |
| `m5_promise`, `nikoObservatoryClue` | M5 | 'tried' / 'refused', true | M7 |
| `ninthMinute`, `metHensel`, `m6done` | M6 | true | M9 (Hensel's reel), M22 (old quarter) |
| `m7aligned`, `chronolithAnticipates`, `rewindGauntlet` | M7 | true | M8 (plaque), M10 (combat) |
| `m8yara`, `timelineVersion` / `m8version` | M8 | 'saved' / 'held', 17 | M9 (Yara on radio), M10 (Prefect) |
| `m9ines`, `m9voice`, `m9anchorKV`, `m9done` | M9 | 'outside', true | M10, M12 (Chamber II), M13 |
| `metSera` / `m10metSera`, `m10released`, `m10done` | M10 | true / false | M11, M12 (Ife), M13, M14, M15, M17, M18, M21 |
| `seraTrust` | M10, M13, M14, M15, M18 | integer | M13, M14, M15, M17, M18, M21, M23 |
| `echoStep` | M10 / M12 | true | M11, M13, M17, M18 |
| `inversion`, `m11miraFile`, `m11done` | M11 | true | M12 (opening), M17 (REC 0233), M22 (Ward 4) |
| `metWitness`, `m12witnessSeen`, `m12witnessEscaped`, `witnessScar` | M12 | true | M13, M16 (the coat), M17 |
| `m13choice`, `factionChoices.m13`, `factions`, `factionSupport`, `m13senn` | M13 | 'destroy' / 'free' | M14 (trader), M15, M18 (wave-three ally), M21 (allies) |
| `returnBeacon` / `m14beacon`, `m14garden`, `seraKnowsVersions`, `m14denial` | M14 | true / 'repaired' | M16, M18 (garden beds), M23 |
| `m15choice`, `anjaAlly`, `m15lantern`, `dualArchive`, `m15mara` | M15 | 'stabilize' / 'free' | M16 (Mara, two records), M18 (Harrow Reach), M21 |
| `witnessIterations`, `photoOlderKaiMira` / `m16photo` | M16 | 1046, true | M17, M19, M20, M21, M22, M23 |
| `miraPattern`, `m17miraReel`, `miraBodyDied`, `witnessMotive` | M17 | 61, true | M18, M19, M20, M21 |
| `unwrittenSecond`, `m18miraMessage`, `m18witnessEcho`, `m18carving`, `m18manifest`, `junSecondRescue` | M18 | true / 'saved' | M19, M20 (K + M carving), M21 (Rook's memo) |
| `metOrren`, `m19child`, `m19miraAnswer`, `m19unwrittenRecord` | M19 | 'ask' / 'live' / 'sorry' | M22, M23 |
| `m20answer`, `miraLives` | M20 | 'enough' / 'unsure' / 'hand' | M21, M22, M23 |
| `m21ally`, `lastLock`, `continuumFallen` | M21 | hale / prisoners / sappers / civilians / senn / anja / lantern / sera | M23 |
| `m22together`, `witnessCausedZero` | M22 | true / false | M23 |
| `ending`, `m23preserved`, `miraSurvives`, `kaiExists`, `version` | M23 | 'A' / 'B' / 'C', {passengers, keepers, tomorrow, attempts}, 118 | sequel hook (saved with the campaign) |

Every read has a default, so a chapter started without the earlier flags (a fresh browser, `?m=` test runs) still
plays; choices change content and never block the campaign.

## Release check (23.10.2026)
- `src/missions/index.js`: 23 missions in order, no stubs, `ROADMAP` empty.
- Chapter select: 23 playable rows under six act headers, chained unlocks; finishing M23 shows the ending, epilogue,
  credits, post-credit clock and the M23 summary card, then the title with the chapter list.
- Fixed in this pass: story flags were not saved at all (`game.flags` lived only in memory, so Continue or a chapter
  start lost every earlier choice); the leftover "VERSION 17 · To Be Continued" card after the finale; the title
  footer still read "Prologue & Act I vertical slice".
- Every tools/tests/mNN.json was run once on desktop (960×540, `gfx=low`, `dtcap=0.25`, CPU SwiftShader); M23 ran
  with an extra final check that the game returns to the title with the chapter list open. All 23 completed with
  their final flags set and no page errors:

  | M | min | final check | M | min | final check |
  |---|---|---|---|---|---|
  | 1 | 5 | done (one wait timed out, see Known issues) | 13 | 16 | choice free, 5 shards, ceasefire |
  | 2 | 3 | done | 14 | 16 | beacon repaired, garden restored |
  | 3 | 3 | done | 15 | 27 | choice free, dual archive |
  | 4 | 3 | done | 16 | 19 | photo, 1,046 iterations |
  | 5 | 13 | done | 17 | 13 | Mira pattern 61, 6 shards |
  | 6 | 12 | done | 18 | 34 | Jun saved, stabilizer 100 |
  | 7 | 12 | done | 19 | 16 | answer 'ask', record kept |
  | 8 | 9 | done | 20 | 37 | answer 'unsure', 12 fragments |
  | 9 | 9 | done | 21 | 14 | ally Hale, 6 shards |
  | 10 | 7 | done | 22 | 15 | together, cause found |
  | 11 | 6 | done, file 4-07 | 23 | 15 | ending C, credits, title + 23 playable chapters |
  | 12 | 15 | done, Witness scar | | | |

  (Wall-clock minutes of the automated drive at 1-10 fps, Missions 12-23 two at a time; not playtime.)
- `eslint` on `src/`: 0 errors (4 unused-variable warnings in src/human, owned by the character pipeline).

## Known issues
Campaign
- Missions 1-4 are far shorter than their bible targets (about 72 minutes against 170) and have no shards, side
  quests or docs/missions notes; the campaign total reaches the 25-30 hour range only through Missions 5-23.
- All playtime figures are design estimates from the builders, not measured with players.
- The browser console shows one harmless 404 per load (`assets/models/cast2.json`, the optional look-v2 cast manifest
  of the character rebuild still in progress; the game falls back to `cast.glb`).
- `tools/tests/m1.json` waits for six evidence items although Mission 1 awards five (it times out on that step and
  continues); `m4.json` can race the pedestal prompt at very low frame rates.
- The release run was desktop only; the `--mobile` runs documented in docs/missions/mNN.md were not repeated in
  this pass. In the M1 run, the camera shot after the warning (test shot f7, player teleported by the test) is
  half covered by a close pink surface; check it in a normal playthrough.

Presentation (from the QA backlog, scratchpad qa_backlog.md)
- Letterbox bars cover the top line of the objective HUD in cinematics; on phones the Echo Step button overlaps the
  era badge.
- Characters: Kai's short hair renders as patchy blotches in some looks; close-up skin reads smooth; crowd builds
  have one texture each (little per-person colour variation); no secondary motion (hoods, harness); Kai keeps full
  speed on stairs.
- Costumes: no 2026 Helix lab-coat build (M20's 2026 lab), no 2196 child build, the M5 surveyor (2029) wears the 2049
  lab jacket; Continuum/Helix crowd builds bake gadget glow into textures, so emitter warnings are not driven.
- Rendering: M2's red alarm light reads as a flat disc; M7's 2196 summit and M12's 2196 atrium are dark at
  `gfx=low`; M10's pearl barriers bloom too bright at `gfx=high`; M4 trees and cliffs are faceted; Missions 1-4 lack
  the street kit (kerbs, crossings, traffic lights); no rain splashes or lamp light cones.
- Performance: the cast file is about 12 MB (+3.8 s load) and character textures load at desktop size on phone
  tiers (about 375-400 MB); crowd builds retarget motion on first use (a hitch on phones). Re-measure on a real
  phone before the store release (docs/MOBILE_RELEASE.md).
