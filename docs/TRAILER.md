# AFTERZERO · the theatrical trailer

Storyboard and beat map for the AFTERZERO cinematic trailer and its 30-second store cut. This page and the files
it describes are the contract between the storyboard, the trailer recorder, the six shot groups, the score, and the
edit. The tables in the generated section below come from `tools/trailer/storyboard.py`. That script writes
`tools/trailer/trailer.json` and `tools/trailer/shots/g1.json` … `g6.json`. Change the script and run it again
(`python3 tools/trailer/storyboard.py`). Don't edit the generated files by hand.

## Logline

*In 2049, one second of Rain City stops. A temporal engineer walks out of it alone, and sees his sister, who has
been dead for twenty-three years, in the crowd. The machine that pulled him through every age of his world was
waiting for him before the first fire. In the future it is remembered as the thing he used to end the world.*

## Rules this trailer follows

- **The owner's request.** It is a production-level cinematic trailer for the game. It has music, voiced lines and
  realistic humans, and it shows the maps and infrastructure. The footage is our own **real in-engine footage**.
  Missions are played and staged at run time by `tools/trailer/director.js`, and no game code changes. There is no
  stock footage, no image or music from the internet, and no imitation of a named artist or of a franchise theme.
- **Score.** The score is an original composition that follows the music bible (docs/BIBLE.md section 6): 78 BPM for
  the main theme, 64 for Mira, 54 for the Witness, 118 for the Nine-Minute War, and silence used as storytelling.
  Openly licensed instrument samples (CC0, CC BY or MIT) may be used as instruments if they clearly beat the game's
  procedural instruments. Every such licence is recorded in the "Licences" section and in `assets/trailer/CREDITS.txt`.
- **Voices.** The voices are the game's own Piper LibriTTS voices for its characters (CC BY 4.0, credit on the end
  card and in CREDITS.txt). Every line is the exact text and speaker the game uses, so the recorded clip in
  `assets/voice/` can be reused.
- **Comfort.** There are no full-screen white flashes and no strobing (docs/MISSION_GUIDE.md quality bar). Era
  switches use the game's own switch distortion.
- **Spoilers.** Only missions 1-18 appear. Missions 19-23 are never loaded or shown. The trailer teases and does not
  reveal: no identity reveals, no ending beats, nothing from the last third of the story. See "Spoiler notes".

## Format

| | |
|---|---|
| Length | 117.1 s (see the generated beat map), 24 fps |
| Render (recorder) | 1280×590 (2.167:1; the farm cannot afford 1920 wide, see "Director", Resolution), `gfx=high` (SMAA, GTAO, DOF in cinematic shots), JPEG q95 frames |
| Trailer output | 1920×1080 H.264 + AAC, the centre 1920×804 band of each frame (2.39:1) letterboxed in 16:9 |
| Store cut | 30 s, the full 2.167:1 render frame (1280×590, scaled up), in-app footage only, no cards (app-preview style) |
| Handles | 12 frames before and after every shot (`handles`), so every cut can slip by up to half a second |
| Frames | `tools/trailer/frames/<shot>/%05d.jpg` in the scratchpad; shot clips: `…/trailer/clips/<shot>.mp4` |

The render frame is 2.167:1 (1280×590; designed as 1920×886) and not 16:9. The trailer only ever shows the 2.39 band, and
the store cut only the 2.167 band. Drawing the unused rows would cost about 18 % more SwiftShader time for nothing.
Compose every shot for the 2.39 band (536 of 590 rows, centred; 804 of 886 at the design size). The edit scales the band
up to the 1920×1080 output. The store cut gets 27 extra rows at the top and bottom.

## Structure

1. **The quiet hook (0:00–0:35): an intimate human moment in the 2049 rain, then the Zero Second.** A slow crane
   down a neon street in the rain. A child's toy falls and un-falls into her hand: "Mister, your wrist is glowing."
   The Chronolith band on Kai's wrist flares. A street clock runs backward. A train's light grows on the platform,
   and then everything stops: one second of total silence, a derailing train hanging in frozen sparks and rain. Kai
   walks through the held station, the only thing moving. In the crowd a woman with Mira's face looks at him and
   comes apart like light. Over black, the voice from every speaker in the city: "Kai Varen. Do not build the machine."
2. **The world opens (0:35–1:15): four ages of one world.** It is cut on the beat of the main theme (78 BPM): Helix
   in lockdown red (Rook), the Chronolith, and the first switch, where one room becomes 2026, 2196 and 2049 ("Which
   one is real?" / "All of them. That's why this is dangerous."). Then the ancient valley at golden hour and Niko ("You
   came before the first fire." / "I've never been here." / "That is what the others said."). The same valley floods
   into Helix's Reservoir 7. The Sky House turns from dawn to Helix's floodlit night under Mira's recorded voice
   ("It's been waiting for you."). The clockmaker opens his door: "You're late." Then 2196, overgrown and beautiful,
   with Sera's verdict over it: "In my time, your face is on every memorial." / "For saving the world?" / "For ending
   it." The trailer lands on Kai's bronze statue. The Witness is teased last: seen only from behind, a grey-haired man
   in a long coat taps three notes on the glass, and the older voice says "…do not let him see the ninth minute."
   Card: SOMEONE HAS BEEN HERE BEFORE YOU.
3. **The accelerating montage (1:15–1:57), cut to the Nine-Minute War cue (118 BPM).** The shots run two bars, then
   one bar, then half a bar: Meridian freezing at 08:14, Echo Step, upward rain, the 2196 war, Sera ("This is not the
   future." / "The future that survives long enough to remember us."), the ruined Sky House, Harrow Reach,
   Yara in the field, the flooded Eastway, the Continuum spire, the falling Corran tower, the drowned valley, the
   storm on Lantern Hall, Kai's face torn between eras, and the held Sable Yards. Then a hard **silence** (1.2 s).
   Then the final image: Kai alone before the ring. Tagline: **A SECOND THAT SHOULD NOT EXIST**. Title: **AFTERZERO ·
   THE LAST VERSION OF EARTH**. The button: Kai lifts his hand to the ring, Iven says "Don't touch it. Varen.
   Don't—", and the trailer cuts to black on the switch. End card: title, "Play on mobile and web", and a credits
   line.

## Card copy

| card | text | style |
|---|---|---|
| c1 | SOMEONE HAS BEEN HERE BEFORE YOU | `line`: one line of small caps, a thin serif, off-white at 80 %, centred in the 2.39 band, 8-frame fade in and out |
| tagline | A SECOND THAT SHOULD NOT EXIST | `line` |
| title | AFTERZERO / THE LAST VERSION OF EARTH | `title`: the wordmark (wide-tracked), with the subtitle at 30 % of its size below it. It fades in over the score's suspended chord. No light sweeps and no flashes |
| end | AFTERZERO / Play on mobile and web / An original game · in-engine footage · original score · voices: Piper TTS, LibriTTS voices (CC BY 4.0) / Piano: Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0) · orchestral samples: VSCO-2 Community Edition (CC0) | `end`: the wordmark, the platform line, and the credits line in small type |
| black0, black1, silence | (none) | `black`: pure black. black1 carries the voice; `silence` carries nothing at all |

The copy is from the game's own vocabulary. "Someone has been here before you" points at the seventeen arrivals
(Niko) and at the Witness without naming either. The tagline comes from the bible's main-theme brief ("the feeling of a
second that should not exist").

## Score direction (bible section 6)

The score is one continuous original cue with seven sections. The exact times, BPM and notes are in the generated
music table.

- **Instruments:** felt or prepared piano; low strings (cello and basses); bowed metal; breath-like textures; restrained
  frame drum and hand percussion; glass harmonics; a sub drone. Breathy flute and plucked strings appear only in the
  ancient valley. There is no synthwave, no "braam", no trailer boom, no vocals, and no choir with lyrics.
- **Motif:** the three notes E-B-A, Kai and Mira's shared memory. It is played on piano in the hook, closer and warmer
  under Mira, slower and lower in bowed bass for the Witness, and tapped on glass as the Witness's last notes. It ends
  the trailer on a piano A that does not resolve.
- **The two silences are part of the score:** 1.0 s at the Zero Second (19.75 s: rain, crowd and music all stop) and
  1.2 s before the final image (97.37 s).
- **Tempo map:** the hook is rubato around 78. The world section is 78 BPM, and every cut lands on a beat. The Witness
  drops to 54. The montage is 118 BPM: 2-bar, then 1-bar, then half-bar cuts, with a slipping downbeat every seventh
  bar (the Nine-Minute War brief). The title section is 78 BPM.
- **Mix:** dialogue first. The score ducks 6 dB under every line. The final mix targets -14 LUFS integrated with
  -1 dBTP peaks for web and stores (an EBU R128 check with ffmpeg `ebur128`).

## Sound design (bible section 7)

- **Rain** is the hook's bed. It stops dead at the Zero Second and comes back only as the held-rain shimmer.
- **The temporal switch** is the game's switch stinger. It plays on every era flicker and on every `switch`
  transition, and is pitched up a little each time in s11.
- **The causal-consequence resonance** is a low metallic resonance followed by a brief dropout. It plays at 20.75 s
  (after the silence) and when the valley floods (51.15 s).
- **Chronolith glass:** the band flare (13.2 s), the three notes on the glass (70.2 s) and the final ring hum.
- **Montage impacts** are reversed (incoming whistles reversed into dry cracks), never booms.

## Spoiler notes

- **Missions 19-23** are never loaded. Every shot URL is `?m=0` … `?m=17`. `storyboard.py --check` and the
  recorder can assert that no URL has m ≥ 18. Mission 18 shots use its own chapter switch (`&m18part=1|3|4`) and show
  only places (Lantern Hall, the Eastway, the Corran tower), never the ending on the Long Array.
- **The Witness** is shown only from behind (s19: his back, his coat and grey hair, with Kai in focus beyond the glass).
  His face, his wrist scar and his line "The person you become when you refuse to let go" are excluded. "To become
  me" (mission 9) is excluded too. Only "You have nine minutes." is used. The voice of "Do not build the machine" is
  the PA voice of mission 1 and is not attributed. The recording line "…do not let him see the ninth minute" is a
  mission 6 tease.
- **Mira:** her mission 1 glimpse (a public beat of the first mission) and her mission 7 recorded voice. Nothing
  about her body, her pattern or the original experiment (missions 16-17) is used, and nothing from mission 18's
  ending ("I remember the first world").
- **Excluded as reveals or last-third beats:** VERSION 17 and the memorial "first death" (mission 8; only Yara frozen
  in the field is shown), Mira's file (mission 11), the second Chronolith and the scar (mission 12), the stabilizer
  choice (mission 13), the photograph and the 1,046 iterations (mission 16), the Witness's archive and its motive
  (mission 17), the Unwritten Second (mission 18), and every ending.
- **The statue** ("ARCHITECT OF THE FRACTURE", mission 14) and Sera's "For ending it" are the stakes. They are a
  tease the game itself plays as an accusation the story questions, and are not a resolution.

## Licences

| asset | licence | credit |
|---|---|---|
| Footage | our own: in-engine captures of AFTERZERO (Three.js r170, vendored, MIT) | — |
| Voices | Piper TTS (MIT) with LibriTTS-high voices (LibriTTS corpus, CC BY 4.0, openslr.org/60) | "Voices: Piper TTS, LibriTTS voices (CC BY 4.0)" on the end card; per-character speaker ids in `assets/trailer/CREDITS.txt` |
| Score | original composition for this trailer (`tools/trailer/sound/score.py`, see "Sound") | — |
| Instrument samples: piano | Salamander Grand Piano V3 by Alexander Holm, **CC BY 3.0** (archive.org/details/SalamanderGrandPianoV3), via the npm packages `@audio-samples/piano-velocity2/4/6/8/12` and `piano-release` 1.0.5 (packaging by Jan Forst, MIT). Plays every piano note in the score. | "Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0)" on the end card and in `assets/trailer/CREDITS.txt` |
| Instrument samples: orchestra | Versilian Studios Chamber Orchestra 2 Community Edition (VSCO-2 CE), **CC0 1.0** (github.com/sgossner/VSCO-2-CE), as the edited excerpts in the npm package `tiny-orchestra` 0.2.0 (Marian Becher, CC0 1.0). Plays the strings, harp, flute, horn and timpani. | not required; credited anyway |
| Sound design | our own: synthesised from physical recipes in `tools/trailer/sound/sfx.py`; the crowd murmur is a babble of the game's own recorded voices | — |

## Render budget and how to work

- **Frames.** The recordings total 3200 frames (2810 cut frames plus 12-frame handles on both sides of 36 shots), in
  six groups of 498-559 frames. Render size and cost are set in "Director" below (`trailer.json` `render`, currently
  1280×590). In the storyboard previews, a mission load plus its setup took 1-9 minutes per shot (the load average was
  13-22), and setups with long `until` chains (s19, s21) take the longest.
- **Before rendering a group**, run `node tools/trailer/preview.mjs gN` (one browser) and look at every strip. The
  storyboard verdicts are in each shot's `preview` field and in the shot list. Set `approved: true` only after looking
  at the frames.
- **Camera keys are resolution-independent.** `fov` is vertical, for the 2.167:1 frame at any size.

## Open questions

1. **Score instruments (resolved).** The score uses sampled piano (Salamander V3, CC BY 3.0) and strings, harp, flute,
   horn and timpani (VSCO-2 CE, CC0). In an A/B test these clearly beat the game's procedural instruments; the bowed
   metal, glass, frame drum and breath textures remain our own synthesis. See "Sound".
2. **Unrecorded line.** Hensel's "Not today." (mission 6) is not in assets/voice: the voice build skips ternary
   lines. The trailer does not use it, but every line it does use is recorded. The key it would get is `1qshwuv`.
3. **Mission 1 shop windows.** The shop-window canvases show bright random product squares that read as noise in
   s01, s02 and s04. The run-time dimming in the setup does not reach them (static batching). A one-line material
   change in mission 1 would fix them for the game too. That change belongs to the missions workflow.
4. **Weak shots** (see the preview column): s15 (flat dawn sky at the Sky House), s28 (the flood does not read) and
   s34 (the held second does not read). Each has an alternative in its notes. They are one-second montage shots or a
   dissolve, so the edit survives either way.
5. **Spoiler line.** Is "For ending it." over the statue acceptable to the owner? It is the game's own mission 10
   line and the stakes of Act III's opening, but it is the strongest claim in the trailer.
6. **Length.** The trailer is 117 s. To get it under 90 s, drop s09, s16, s25 and s29 and shorten the hook by 8 s.
   The beat map keeps the music sections intact either way.

<!-- BEGIN GENERATED (tools/trailer/storyboard.py) -->

## Beat map

Total **117.08 s** (2810 frames at 24 fps), 36 shots, 7 cards. Hits (cuts on the score's grid): 19.75, 35.00, 45.00, 51.17, 61.17, 68.83, 75.00, 79.08, 81.08, 83.12, 85.17, 87.21, 88.21, 89.25, 90.25, 91.29, 92.29, 93.29, 94.33, 95.33, 96.38, 97.38, 98.58, 105.08, 112.08.

| time | dur | picture | in | VO (speaker: line) | music | sound |
|---|---|---|---|---|---|---|
| 0:00.00 | 1.50 | *card black0*: (black) | cut |  | 0.00 **rain** | 0.00 rain bed (Rain City) |
| 0:01.50 | 6.00 | **s01** (M1) Rain City at night: a slow crane down through the rain onto Kai walking the wet centre line toward Helix. | dip |  | 1.50 **hook · AFTERZERO main theme, intimate** (78 BPM) |  |
| 0:07.50 | 4.50 | **s02** (M1) The toy that un-falls: a child drops a toy, it lands, then rises back into her hand along the same arc. | cut | 10.60 child: "Mister, your wrist is glowing." |  | 9.90 toy un-fall: reverse whoosh |
| 0:12.00 | 2.50 | **s03** (M1) Kai's wrist: the Chronolith band glows, then flares as the street pulls toward one moment. | cut |  |  | 13.20 Chronolith glass chime |
| 0:14.50 | 3.00 | **s04** (M1) The street clock outside Chrono Repair runs backward, one second per second. | cut |  |  | 14.50 reversed clock ticks |
| 0:17.50 | 2.25 | **s05** (M1) Central Station platform: people waiting in the rain; a train's light swells up the track. | cut |  | 17.50 **approach** (78 BPM) | 17.60 train horn |
| 0:19.75 | 4.00 | **s06** (M1) The Zero Second: the derailing train hangs in the air, sparks and rain frozen around it. | cut |  | 19.75 **SILENCE · the Zero Second**<br>20.75 **the held second** | 19.75 the Zero Second: total silence<br>20.75 causal-consequence resonance |
| 0:23.75 | 4.00 | **s07** (M1) Kai walks alone through the frozen station: the only thing still moving. | cut | 24.00 kai: "…Nothing is moving. The rain. The train. Me — only me." |  | 24.00 Kai's footsteps in the held rain |
| 0:27.75 | 4.50 | **s08** (M1) In the crowd, a woman with Mira's face looks at Kai, then comes apart like light. | cut | 28.95 kai: "…Mira?" | 27.75 **Mira · memory without a body** (64 BPM) | 28.60 motif sting |
| 0:32.25 | 2.75 | *card black1*: (black) | cut | 32.35 voice: "Kai Varen. Do not build the machine." | 32.25 **the voice** |  |
| 0:35.00 | 2.29 | **s09** (M2) Helix lobby in lockdown red: Dr. Elias Rook, the director, holds Kai's gaze. | cut |  | 35.00 **world · main theme expands** (78 BPM) | 35.00 lockdown alarm (muffled) |
| 0:37.29 | 3.08 | **s10** (M3) The Chronolith: a black ring older than the building, turning in its sealed chamber. | cut | 38.55 kai: "The Chronolith." |  |  |
| 0:40.38 | 4.62 | **s11** (M3) The first switch: Kai reaches for the ring and the room flickers through 2026, 2196 and back to 2049. | cut | 41.00 kai: "Which one is real?"<br>42.45 voice: "All of them. That's why this is dangerous." |  | 40.38 temporal switch ×4 |
| 0:45.00 | 3.08 | **s12** (M4) The ancient settlement at golden hour: a valley built around a ring of stone. | switch |  | 45.00 **world · the past** (78 BPM) | 45.00 temporal switch (transition) |
| 0:48.08 | 3.08 | **s13** (M4) Niko, keeper of the Telling, reads the ring on Kai's wrist: "You came before the first fire." | cut | 48.50 niko: "(trim) The ring on your wrist is the Ring in our valley. You came before the first fire."<br>50.20 kai: "I've never been here." |  |  |
| 0:51.17 | 4.58 | **s14** (M5) One valley, two ages: the thriving village switches to Helix's drowned Reservoir 7. | switch | 51.75 niko: "That is what the others said." |  | 51.17 temporal switch + causal resonance |
| 0:55.75 | 3.08 | **s15** (M7) The Sky House: the observatory at dawn c. 1000 BCE switches to Helix's floodlit 2049 night. | dissolve | 56.00 mirarec: "(trim) It doesn't record you, Kai. It's been waiting for you. Every instrument in this house points at one night — the night you were born." | 55.75 **world · night glass** (78 BPM) |  |
| 0:58.83 | 2.33 | **s16** (M6) The clockmaker opens his door before Kai knocks: "You're late." | cut | 59.55 oskar: "You're late." |  | 58.83 door, rain |
| 1:01.17 | 4.58 | **s17** (M14) Welcome to 2196: Rain City a hundred and forty-seven years on, overgrown, silent, beautiful. | switch | 61.80 sera: "In my time, your face is on every memorial."<br>64.50 kai: "For saving the world?" | 61.17 **world · beautiful catastrophe** (78 BPM) | 61.17 temporal switch (transition) |
| 1:05.75 | 3.08 | **s18** (M14) The memorial square: a bronze statue of Kai before a ring, "ARCHITECT OF THE FRACTURE". | cut | 66.60 sera: "For ending it." |  |  |
| 1:08.83 | 3.88 | **s19** (M12) The man behind the glass: from behind a grey-haired man in a long coat, Kai beyond the glass. He taps three notes. | dip | 70.40 recording: "…do not let him see the ninth minute." | 68.83 **the Witness** (54 BPM) | 70.20 three notes on glass |
| 1:12.71 | 2.29 | *card c1*: SOMEONE HAS BEEN HERE BEFORE YOU | dip |  | 72.71 **card · breath** |  |
| 1:15.00 | 4.08 | **s20** (M9) Montage: Meridian Square at 08:14:00 — the whole district stops, then rewinds to 08:05. | cut | 75.30 voice: "You have nine minutes." | 75.00 **montage · the Nine-Minute War** (118 BPM) | 75.00 heartbeat at 08:14 |
| 1:19.08 | 2.00 | **s21** (M12) Montage: Echo Step — Kai leaves an afterimage and slips through the jammed lockdown shutter. | cut |  |  | 79.08 Echo Step |
| 1:21.08 | 2.04 | **s22** (M11) Montage: Halden General's reversed East Corridor: a gurney, a cylinder and glass fly back to where they were at 08:14. | cut |  |  | 81.08 inversion: reversed rain swell |
| 1:23.12 | 2.04 | **s23** (M13) Montage: 2196, the same yards are a battlefield; shells arc out of the stabilizer's ring. | cut | 83.30 sera: "This is not the future." |  | 83.12 returned shells |
| 1:25.17 | 2.04 | **s24** (M15) Sera Voss, who leads the survivors of 2196, at the shimmering veil of Harrow Reach. | cut | 85.30 sera: "The future that survives long enough to remember us." | 87.21 **montage · half-bar cuts** (118 BPM) |  |
| 1:27.21 | 1.00 | **s25** (M7) Montage: dusk on the ruined summit, 2196; the scavenger chief Dace on the pillar, gauntlet glowing. | cut |  | 87.21 **montage · half-bar cuts** (118 BPM) |  |
| 1:28.21 | 1.04 | **s26** (M15) Montage: Harrow Reach, the city that relives one day, under the Lantern's beam. | cut |  |  |  |
| 1:29.25 | 1.00 | **s27** (M8) Montage: Dr. Yara Lind, stopped mid-stride inside the containment field for three days. | cut |  |  |  |
| 1:30.25 | 1.04 | **s28** (M18) Montage: the Eastway at night, the sea of 2196 poured into 2049's highway. | cut |  |  | 90.25 flood siren |
| 1:31.29 | 1.00 | **s29** (M10) Montage: the Continuum spire grafted onto the ruin of Helix, dusk, 2196. | cut |  |  |  |
| 1:32.29 | 1.00 | **s30** (M18) Montage: the Corran Building, its upper floors torn away by the storm. | cut |  |  | 92.29 tower collapse groan |
| 1:33.29 | 1.04 | **s31** (M5) Montage: Reservoir 7, dead trees standing in the water over a village that never existed. | switch |  |  | 93.29 temporal switch (transition)<br>94.33 storm front |
| 1:34.33 | 1.00 | **s32** (M18) Montage: the storm front bearing down on Lantern Hall as its anchor fails. | cut |  |  | 94.33 storm front |
| 1:35.33 | 1.04 | **s33** (M3) Montage: Kai's face in the ring light as the room tears between eras. | cut |  |  |  |
| 1:36.38 | 1.00 | **s34** (M13) Montage: the Sable Yards held in one second — people mid-step, rain hanging in the air. | switch |  |  | 96.38 temporal switch (transition) |
| 1:37.38 | 1.21 | *card silence*: (black) | cut |  | 97.38 **SILENCE** | 97.38 silence |
| 1:38.58 | 4.00 | **s35** (M3) Final image: Kai alone before the Chronolith, small against the ring. | cut |  | 98.58 **title · main theme reprise** (78 BPM) | 98.58 Chronolith hum |
| 1:42.58 | 2.50 | *card tagline*: A SECOND THAT SHOULD NOT EXIST | dip |  |  |  |
| 1:45.08 | 4.50 | *card title*: AFTERZERO / THE LAST VERSION OF EARTH | dip |  |  |  |
| 1:49.58 | 2.50 | **s36** (M3) Button: Kai lifts his hand to the ring. Iven: "Don't touch it. Varen. Don't—" Cut on the switch. | dip | 109.90 iven: "Don't touch it. Varen. Don't—" | 109.58 **button** | 111.90 temporal switch |
| 1:52.08 | 5.00 | *card end*: AFTERZERO / Play on mobile and web / An original game · in-engine footage · original score · voices: Piper TTS, LibriTTS voices (CC BY 4.0) / Piano: Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0) · orchestral samples: VSCO-2 Community Edition (CC0) | cut |  | 112.08 **end card** | 112.08 rain tail |

## Shot list

Times are trailer times. `rec` is the recorded length including both handles. Camera keys and actions are in the group files.

| shot | group | mission | trailer | cut (fr) | rec (fr) | camera | grade | on screen | light and mood | preview |
|---|---|---|---|---|---|---|---|---|---|---|
| s01 | g1 | 1 | 0:01.50 | 144 | 168 | path, 3 keys, fov 46→42 | rain2049 | Kai (walking away from camera), umbrella crowd on both pavements | Neon blade signs, puddle glow, rain streaks lit by the lamps; Helix tower rings at the vanishing point. | **ok**: Crane reads; the m1 shop-window canvases (bright product squares) stay visible on the left at 1080p. |
| s02 | g1 | 1 | 0:07.50 | 108 | 132 | path, 2 keys, fov 31→29 | rain2049 | The station child (yellow coat, red boots), her mother under a red umbrella | Low, child eye-level, in profile along the pavement: lamps and umbrellas recede behind her; the toy's cyan eye and its reverse trail. | **ok**: Toy falls, lands, rises (visible at the middle frame). The shop canvases behind her are still bright; a passer-by may cross at the head. |
| s03 | g1 | 1 | 0:12.00 | 60 | 84 | path, 2 keys, fov 30→28, anchored | rain2049 | Kai (hand and band only, idle) | Macro close-up, DOF on the band; out-of-focus neon and rain behind. | **ok**: Band flare reads at 2.2 s; hand idle sway moves the anchored camera slightly. |
| s04 | g1 | 1 | 0:14.50 | 72 | 96 | path, 2 keys, fov 30→27 | rain2049 | none (passers-by in the background) | Across the street through the rain: the clock face lit warm over Chrono Repair, hands visibly turning back, passers-by under umbrellas crossing frame. | **ok**: Hands visibly turn back; the clock is a simple prop, so it stays mid-frame, not macro. |
| s05 | g2 | 1 | 0:17.50 | 54 | 78 | path, 2 keys, fov 40→39 | rain2049 | Jun Park (transit operator), three civilians on the platform, Kai (foreground left) | Warm platform canopy light, the yellow edge strip, the stopped station clock. | **ok**: Kai left, the train headlight swells at the end; cut before the freeze. |
| s06 | g2 | 1 | 0:19.75 | 96 | 120 | path, 2 keys, fov 40→38 | rain2049 | Frozen civilians, Jun | The freeze grade (desaturated, cold); sparks as hanging points of light; rain as beads. | **ok**: Derailing train hangs with frozen sparks in the freeze grade. |
| s07 | g2 | 1 | 0:23.75 | 96 | 120 | path, 2 keys, fov 40→40, anchored | rain2049 | Kai (tracking side-on), frozen commuters and umbrellas between camera and Kai | Frozen rain beads catch the station light; Kai the only warm, moving figure. | **ok**: Kai walks through the held station in the freeze grade. |
| s08 | g2 | 1 | 0:27.75 | 108 | 132 | path, 2 keys, fov 24→22 | rain2049 | Mira (close-up, looking at Kai), crowd behind | Helix entrance glow behind her; her violet dissolve (the mission's ghost shader). | **ok**: She is solid at the cut-in, violet at the middle, gone at the cut-out. Check her sharpness (DOF) at full size. |
| s09 | g1 | 2 | 0:35.00 | 55 | 79 | path, 2 keys, fov 34→32 | rain2049 | Rook (close-up), Kai (soft foreground shoulder) | Emergency lighting after the lockdown: red key, cyan rim. | **ok**: Rook faces camera in the lockdown red. |
| s10 | g3 | 3 | 0:37.29 | 74 | 98 | path, 2 keys, fov 46→43 | rain2049 | Kai (small, foreground left, looking up at the ring); Iven by the consoles | The ring's cyan core light; the chamber in shadow, its rim light strip on the floor. | **ok**: Ring, Kai and Iven read; the clean lab is bright (exposure lowered to 0.82 for all mission 3 shots). |
| s11 | g3 | 3 | 0:40.38 | 111 | 135 | path, 2 keys, fov 40→38, shake 0.15 | rain2049 | Kai (three-quarter back, hand toward the ring) | 2026: amber work lights, scaffolds, plastic sheets; 2049: clean cyan lab; 2196: green-grey ruin. Same ring in all three. | **ok**: Iven foreground, Kai at the ring; the 2196 flicker (green growth) reads. |
| s12 | g4 | 4 | 0:45.00 | 74 | 98 | path, 2 keys, fov 44→48 | ancient | Kai walking in, Tala and villagers | Low warm sun, long shadows, dust motes; the stone ring at the heart of the village. | **ok**: Golden hour, villagers, the stone ring; faceted low-poly trees (known mission 4 item). |
| s13 | g4 | 4 | 0:48.08 | 74 | 98 | path, 2 keys, fov 32→30 | ancient | Niko (close-up), Kai (soft foreground shoulder) | Warm key from the low sun, cool sky fill; shallow focus. | **ok**: Niko medium close-up framed by the village Ring. |
| s14 | g4 | 5 | 0:51.17 | 110 | 134 | path, 2 keys, fov 50→49 | ancient | Villagers in the lanes (thriving); dead trees standing in the water (flooded) | Golden hour to overcast 2049 daylight; water level rises over the same houses. | **ok**: Thriving village switches to the flooded reservoir with dead trees. |
| s15 | g4 | 7 | 0:55.75 | 74 | 98 | path, 2 keys, fov 48→47 | ancient | Keepers and acolytes on the court (too small to read) | Over the drum toward the sunrise, then the same view at night: a starfield over Helix floodlights and scaffolds. | **weak**: The dawn sky renders flat grey from this angle; the night half reads (stars, floodlights). Try a lower angle on the Sun Gate. |
| s16 | g2 | 6 | 0:58.83 | 56 | 80 | path, 2 keys, fov 34→32 | rain2049 | Oskar Hensel (78, clockmaker) in his doorway, Kai (foreground shoulder) | Rain on the old quarter, warm shop light from inside the door. | **ok**: Hensel in his doorway, warm shop light, Kai's shoulder. |
| s17 | g5 | 14 | 1:01.17 | 110 | 134 | path, 2 keys, fov 50→49 | ruin2196 | Kai (tiny, at the landing) | Morning haze, trees on the roofs, the broken tram viaduct; birds. | **ok**: Overgrown tower canyon with haze and the temporal zones. |
| s18 | g5 | 14 | 1:05.75 | 74 | 98 | path, 2 keys, fov 40→38 | ruin2196 | Kai (back to camera, small, looking up at his own statue) | Low angle, the statue against the bright sky; candles and stones at the plinth. | **ok**: Strong: Kai under his own statue, plaque legible. |
| s19 | g6 | 12 | 1:08.83 | 93 | 117 | path, 2 keys, fov 32→30 | rain2049 | The Witness (back and shoulder only, never his face), Kai behind the glass (in focus) | Test Hall C lights up on him; the gallery glass reflects; his coat a dark silhouette. | **ok**: Strong: the Witness only from behind, Kai beyond the glass. His face and wrist never face camera. |
| s20 | g6 | 9 | 1:15.00 | 98 | 122 | path, 2 keys, fov 42→40 | rain2049 | Continuum troopers in white armour, commuters, the tram | Morning light on the square; the freeze desaturates it as the reset arrives. | **ok**: The freeze arrives at the end (desaturation). Few people read in the square at preview size. |
| s21 | g6 | 12 | 1:19.08 | 48 | 72 | path, 2 keys, fov 50→50 | rain2049 | Kai and his afterimage | Lockdown red on the shutter, cyan afterimage. | **ok**: Strong: the cyan afterimage stays as Kai slips through the shutter. |
| s22 | g5 | 11 | 1:21.08 | 49 | 73 | path, 2 keys, fov 48→46 | rain2049 | Kai at the threshold (edge of frame) | Hospital corridor in night emergency light; the reversal chevrons on the floor; debris travelling backward. | **ok**: Debris in flight with the reversal rings; the corridor itself is plain. |
| s23 | g6 | 13 | 1:23.12 | 49 | 73 | path, 2 keys, fov 48→48, shake 0.12 | ruin2196 | Unwritten fighters behind the barricade (small) | Smoke and dust, tracer light from the spire. | **ok**: The spire and its field ring at dusk; tracer timing not caught in three stills: check at full rate. |
| s24 | g3 | 15 | 1:25.17 | 49 | 73 | path, 2 keys, fov 30→29, anchored | ruin2196 | Sera Voss (close-up, the veil of the lock behind her) | Amber light of the lock's edge, her face half in shadow. | **ok**: Sera close-up at the veil; the skyline behind her is simple boxes. |
| s25 | g4 | 7 | 1:27.21 | 24 | 48 | path, 2 keys, fov 44→43 | ruin2196 | Dace (scavenger boss), scavenger lookouts | Sunset behind the broken rim, Venus low in the west, green gauntlet glow. | **ok**: Armillary, scavengers and their gauntlet glow against the dusk. |
| s26 | g6 | 15 | 1:28.21 | 25 | 49 | path, 2 keys, fov 48→48 | ruin2196 | none (crowds too small to read) | The plaza and the Hollow Archive's copper dome in the amber haze of the lock. | **ok**: The plaza and the copper dome in the amber haze; plain but readable for one second. |
| s27 | g5 | 8 | 1:29.25 | 24 | 48 | path, 2 keys, fov 40→39 | rain2049 | Yara (frozen) | Containment rings, cold field light. | **ok**: Strong: Yara frozen mid-stride inside the containment rings. |
| s28 | g5 | 18 | 1:30.25 | 25 | 49 | path, 2 keys, fov 50→50 | rain2049 | none (the stalled N4 bus far down the road) | Night rain on flood water, wrecked traffic, highway lights. | **weak**: Night highway with wrecked traffic in rain; the flood is not legible at preview size. |
| s29 | g6 | 10 | 1:31.29 | 24 | 48 | path, 2 keys, fov 44→44 | ruin2196 | none | Dusk, the pearl spire lit gold. | **ok**: The pearl spire against the dusk skyline. |
| s30 | g5 | 18 | 1:32.29 | 24 | 48 | path, 2 keys, fov 54→54 | ruin2196 | none | Looking up the broken tower into storm light. | **ok**: Looking up the ruined tower. |
| s31 | g4 | 5 | 1:33.29 | 25 | 49 | path, 2 keys, fov 52→52 | neutral | none | Flat overcast light on the water, the dam across the valley. | **ok**: Dead trees in the reservoir, overcast. |
| s32 | g5 | 18 | 1:34.33 | 24 | 48 | path, 2 keys, fov 50→50 | ruin2196 | Survivors in the hall (small) | Violet storm light over the iron trusses. | **ok**: Lantern Hall trusses under violet storm light. |
| s33 | g3 | 3 | 1:35.33 | 25 | 49 | path, 2 keys, fov 40→39, shake 0.35 | rain2049 | Kai (medium shot, facing camera, the ring behind camera) | Hard cyan key from the ring core, era colour washing over his face on each switch. | **ok**: Kai medium shot; 2196 then 2026 wash over him. |
| s34 | g6 | 13 | 1:36.38 | 24 | 48 | path, 2 keys, fov 44→44 | rain2049 | Held residents, a courier, an umbrella | Grey dawn, beads of rain frozen in the air. | **weak**: A rainy 2049 street; that it is held (people mid-step, rain in the air) does not read at preview size. |
| s35 | g3 | 3 | 1:38.58 | 96 | 120 | path, 2 keys, fov 40→38 | rain2049 | Kai (silhouette, back to camera, centred) | Symmetric, the ring core the only bright thing; slow push-in. | **ok**: Symmetric final image, Kai small before the ring. |
| s36 | g3 | 3 | 1:49.58 | 60 | 84 | path, 2 keys, fov 34→32 | rain2049 | Iven Marr (soft foreground shoulder, right), Kai at the ring | Over Iven's shoulder; ring flare at the end. | **ok**: Over Iven's shoulder; the ring flares into the switch at the end. |

### Groups

| group | shots | frames | missions |
|---|---|---|---|
| g1 | s01 s02 s03 s04 s09 | 559 | 1, 2 |
| g2 | s05 s06 s07 s08 s16 | 530 | 1, 6 |
| g3 | s10 s11 s24 s33 s35 s36 | 559 | 3, 15 |
| g4 | s12 s13 s14 s15 s25 s31 | 525 | 4, 5, 7 |
| g5 | s17 s18 s22 s27 s28 s30 s32 | 498 | 8, 11, 14, 18 |
| g6 | s19 s20 s21 s23 s26 s29 s34 | 529 | 9, 10, 12, 13, 15 |

### How each shot is reached

- **s01** `index.html?m=0&dtcap=0.25&gfx=high&auto`. Setup: eval `(()=>{let n=0; __game.scene.traverse(o=>{if(!o.isMesh) return; for(const m of [].concat(o.…`; eval `__game.player.place(0.5, 0.15, 15.5, Math.PI)`; wait 0.5 s. Actions: t 0.2: down KeyW.
- **s02** `index.html?m=0&dtcap=0.25&gfx=high&auto`. Setup: eval `(()=>{let n=0; __game.scene.traverse(o=>{if(!o.isMesh) return; for(const m of [].concat(o.…`; eval `__game.player.place(-4.2, 0.15, -8.5, Math.PI * 0.8)`; until `(__game.time % 4) > 3.45 && (__game.time % 4) < 3.55` (8 s). Actions: t 3.6: `DIR.actor('child').talk = 1.4`. The toy loop runs on game time (4 s): the setup waits for cycle 3.5 so the cut holds hand, fall, floor, un-fall, hand. VO "Mister, your wrist is glowing." lands on the un-fall. Pavement walkers can cross the lens at the head: if one does, add 4 s (one toy cycle) to the setup wait.
- **s03** `index.html?m=0&dtcap=0.25&gfx=high&auto`. Setup: eval `(()=>{let n=0; __game.scene.traverse(o=>{if(!o.isMesh) return; for(const m of [].concat(o.…`; eval `__game.player.place(-1.0, 0.15, -20, Math.PI)`; wait 1.0 s. Actions: t 1.7: `DIR.actor('kai').wristBoost = 9`.
- **s04** `index.html?m=0&dtcap=0.25&gfx=high&auto`. Setup: eval `(()=>{let n=0; __game.scene.traverse(o=>{if(!o.isMesh) return; for(const m of [].concat(o.…`; wait 0.5 s.
- **s05** `index.html?m=0&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.player.place(0, 0.15, -79, Math.PI)`; until `__game.interactables.some(i => i.prompt.includes('badge'))` (30 s); eval `__game.use('badge')`; until `__game.flags.gate` (40 s); eval `__game.player.place(2, 0.15, -98, Math.PI)`; wait 1.0 s. Actions: t 0.3: `__game.player.place(3, 0.15, -106, Math.PI)`. The mission freezes ~2.2 s after Kai crosses z -104 (action at t 0.3): cut out on the frame before the freeze.
- **s06** `index.html?m=0&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.player.place(0, 0.15, -79, Math.PI)`; until `__game.interactables.some(i => i.prompt.includes('badge'))` (30 s); eval `__game.use('badge')`; until `__game.flags.gate` (40 s); eval `__game.player.place(2, 0.15, -98, Math.PI)`; wait 1.0 s; eval `__game.player.place(3, 0.15, -106, Math.PI)`; until `__game.flags.frozen` (30 s); wait 0.3 s.
- **s07** `index.html?m=0&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.player.place(0, 0.15, -79, Math.PI)`; until `__game.interactables.some(i => i.prompt.includes('badge'))` (30 s); eval `__game.use('badge')`; until `__game.flags.gate` (40 s); eval `__game.player.place(2, 0.15, -98, Math.PI)`; wait 1.0 s; eval `__game.player.place(3, 0.15, -106, Math.PI)`; until `__game.flags.frozen` (30 s); until `__game.flags.frozen && __game.control` (40 s); eval `__game.player.place(-1.5, 0.15, -100.5, 2.6)`; wait 0.3 s. Actions: t 0.0: down KeyW.
- **s08** `index.html?m=0&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.player.place(0, 0.15, -79, Math.PI)`; until `__game.interactables.some(i => i.prompt.includes('badge'))` (30 s); eval `__game.use('badge')`; until `__game.flags.gate` (40 s); eval `__game.player.place(2, 0.15, -98, Math.PI)`; wait 1.0 s; eval `__game.player.place(3, 0.15, -106, Math.PI)`; until `__game.flags.frozen` (30 s); until `__game.flags.frozen && __game.control` (40 s); eval `[0,1,2].forEach(()=>{const it=__game.interactables.find(i=>i.prompt.includes('safety')); i…`; until `__game.actors.mira && __game.actors.mira.root.visible` (60 s). The mission fades her out (alpha 0.7 / s) right after Kai's line: about 1.6 s solid, 1.4 s dissolve.
- **s09** `index.html?m=1&dtcap=0.25&gfx=high&auto`. Setup: wait 5.0 s; eval `(()=>{const g=__game, r=g.actors.rook; g.control=false; r.root.visible=true; r.root.positi…`; wait 1.5 s. Actions: t 1.1: `DIR.actor('rook').talk = 1.4`. Rook walks out of the lobby when control returns (4 s); the setup waits for that, brings him back and holds the drones off (control=false).
- **s10** `index.html?m=2&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.engine.renderer.toneMappingExposure = 0.82`; eval `__game.player.place(-1.1, 0, 5.4, Math.PI)`; wait 1.0 s.
- **s11** `index.html?m=2&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.engine.renderer.toneMappingExposure = 0.82`; eval `__game.player.place(0, 0, 0.95, Math.PI)`; wait 0.8 s. Actions: t 0.8: `(v => { const c = __game.scene.children.find(o => o.userData && o.user`; t 0.8: `DIR.actor('kai').pose = 'work'; DIR.actor('kai').wristBoost = 12`; t 1.5: `DIR.era('2026', 0.45)`; t 1.55: `__game.engine.setGrade('helix2026')`; t 2.35: `DIR.era('2196', 0.45)`; t 2.4: `__game.engine.setGrade('ruin2196')`; t 3.15: `DIR.era('2026', 0.4)`; t 3.2: `__game.engine.setGrade('helix2026')`; t 3.95: `DIR.era('2049', 0.5)`; t 4.0: `__game.engine.setGrade('rain2049')`. DIR.era drives the switch on game time (temporal.switchTo runs on wall time and would be skipped by a frame-stepped capture).
- **s12** `index.html?m=3&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.player.place(0, 0, 21.5, Math.PI)`; wait 0.6 s. Actions: t 0.3: down KeyW.
- **s13** `index.html?m=3&dtcap=0.25&gfx=high&auto`. Setup: eval `(()=>{const g=__game, n=g.actors.niko; g.player.place(1.14, 0.6, -4.1, 2.57); n.root.rotat…`; wait 1.0 s. Actions: t 0.9: `DIR.actor('niko').talk = 1.5`.
- **s14** `index.html?m=4&dtcap=0.25&gfx=high&auto`. Setup: wait 0.8 s. Actions: t 2.6: `DIR.era('flooded', 1.0)`; t 3.0: `__game.engine.setGrade('neutral')`.
- **s15** `index.html?m=6&dtcap=0.25&gfx=high&auto`. Setup: wait 0.8 s. Actions: t 2.2: `DIR.era('2049', 1.0)`; t 2.6: `__game.engine.setGrade('rain2049')`.
- **s16** `index.html?m=5&dtcap=0.25&gfx=high&auto`. Setup: until `__game.control && __game.interactables.some(i=>i.prompt.includes('Knock'))` (600 s); eval `__game.player.place(0, 0, 9.8, Math.PI); __game.use('Knock')`; until `__game.actors.oskar && __game.actors.oskar.root.visible && __game.actors.oskar.r` (30 s). The mission stages this scene itself after the knock; the path holds its close shot a little longer.
- **s17** `index.html?m=13&dtcap=0.25&gfx=high&auto`. Setup: wait 0.8 s.
- **s18** `index.html?m=13&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.player.place(-6.0, 0, -46.8, -2.903)`; wait 0.8 s.
- **s19** `index.html?m=11&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.player.place(0, 0, -6.4, Math.PI)`; until `__game.actors.witness && __game.actors.witness.root.visible` (40 s); wait 3.4 s. Spoiler rule: his face and wrist are never in frame.
- **s20** `index.html?m=8&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.player.place(-31, 7.2, -24, Math.PI / 2)`; wait 0.5 s; eval `import('/src/systems/loops.js').then(m => { const L = m.loopState.active; L.skipTo(535.4);…`. The loop fires its reset at loop time 538.6 (DUR - 1.4): about 3.2 s after the skip. The reset waits while game.cine is set, so this shot must not hold the camera through game.cine (the default).
- **s21** `index.html?m=11&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.player.place(0, 0, -6.4, Math.PI)`; until `__game.control && document.getElementById('objective-text').textContent.includes` (240 s); eval `__game.player.place(10, 0, 0.4, Math.PI)`; until `__m12.S.seen && __m12.S.seen.glimpse1 && __game.control` (120 s); eval `__game.player.place(10, 0, -16.2, Math.PI)`; until `__game.control && document.getElementById('objective-text').textContent.includes` (120 s); eval `__game.player.place(10, 0, -19.9, Math.PI); __game.player.yaw = Math.PI`; wait 0.6 s. Actions: t 0.7: `__m12.echo.trigger()`. Setup follows tools/tests/m12.json up to the shutter.
- **s22** `index.html?m=10&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.player.place(14.6, 0, 3.2, Math.PI / 2)`; wait 1.5 s. The corridor's hazards cycle (land, return, hold) on their own schedule; check the strip that one is in flight.
- **s23** `index.html?m=12&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.player.place(2, 0, 51, Math.PI)`; until `__game.temporal.current === '2196'` (60 s); wait 2.0 s. Actions: t 0.6: `__m13.W.tracer([0, 9, -2], [-4, 0.5, 42], 1.6, 7)`; t 1.3: `__m13.W.tracer([0, 9, -2], [3, 0.5, -40], 1.6, 7)`.
- **s24** `index.html?m=14&dtcap=0.25&gfx=high&auto`. Setup: wait 0.8 s; eval `(()=>{const s=__game.actors.sera; s.root.rotation.y=-Math.PI/2; s.lookTarget=null; return …`. Actions: t 0.62: `DIR.actor('sera').talk = 2.6`. VO from mission 13 ("The future that survives long enough to remember us."); her mouth moves with it (talk action).
- **s25** `index.html?m=6&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.temporal.setImmediate('2196'); __game.player.place(-7.9, 21.06, -21.6, Math.PI / 2)`; wait 0.8 s.
- **s26** `index.html?m=14&dtcap=0.25&gfx=high&auto`. Setup: wait 0.5 s.
- **s27** `index.html?m=7&dtcap=0.25&gfx=high&auto`. Setup: wait 0.8 s.
- **s28** `index.html?m=17&dtcap=0.25&gfx=high&auto&m18part=3`. Setup: wait 0.8 s.
- **s29** `index.html?m=9&dtcap=0.25&gfx=high&auto`. Setup: wait 0.5 s.
- **s30** `index.html?m=17&dtcap=0.25&gfx=high&auto&m18part=4`. Setup: wait 0.8 s. ?m18part=4 is mission 18's own chapter start (development switch); nothing from later missions is loaded.
- **s31** `index.html?m=4&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.temporal.setImmediate('flooded')`; wait 0.8 s.
- **s32** `index.html?m=17&dtcap=0.25&gfx=high&auto&m18part=1`. Setup: wait 0.8 s.
- **s33** `index.html?m=2&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.engine.renderer.toneMappingExposure = 0.82`; eval `__game.player.place(0, 0, 0.95, Math.PI)`; eval `(v => { const c = __game.scene.children.find(o => o.userData && o.userData.disc); if (c) c…`; wait 0.8 s. Actions: t 0.55: `DIR.era('2196', 0.3)`; t 1.05: `DIR.era('2026', 0.3)`; t 1.5: `DIR.era('2049', 0.3)`.
- **s34** `index.html?m=12&dtcap=0.25&gfx=high&auto`. Setup: wait 0.5 s.
- **s35** `index.html?m=2&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.engine.renderer.toneMappingExposure = 0.82`; eval `__game.player.place(0, 0, 4.6, Math.PI); __game.actors.iven.root.visible = false`; eval `(v => { const c = __game.scene.children.find(o => o.userData && o.userData.disc); if (c) c…`; wait 1.0 s.
- **s36** `index.html?m=2&dtcap=0.25&gfx=high&auto`. Setup: eval `__game.engine.renderer.toneMappingExposure = 0.82`; eval `__game.player.place(0, 0, 1.0, Math.PI)`; eval `(()=>{const i=__game.actors.iven; i.root.position.set(2.9,0,4.6); i.lookTarget=__game.play…`; wait 0.8 s. Actions: t 0.8: `DIR.actor('iven').talk = 2.2`; t 1.6: `DIR.actor('kai').pose = 'work'`; t 2.3: `(v => { const c = __game.scene.children.find(o => o.userData && o.user`; t 2.3: `DIR.actor('kai').wristBoost = 14`; t 2.55: `DIR.era('2196', 0.9)`. The edit cuts to black on the first frame of the switch distortion (about t 2.6).

## VO script

Every line is the game's own: exact text and speaker id, so the recorded clip is reused.

| time | speaker | line | mission | recorded key | trim |
|---|---|---|---|---|---|
| 10.60 | child | Mister, your wrist is glowing. | 1 | `a3vccu` |  |
| 24.00 | kai | …Nothing is moving. The rain. The train. Me — only me. | 1 | `1mxi9tr` |  |
| 28.95 | kai | …Mira? | 1 | `1apo1ny` |  |
| 32.35 | voice | Kai Varen. Do not build the machine. | 1 | `1kqxwai` |  |
| 38.55 | kai | The Chronolith. | 2 | `tic1bp` |  |
| 41.00 | kai | Which one is real? | 3 | `17yoic2` |  |
| 42.45 | voice | All of them. That's why this is dangerous. | 3 | `8g0b9u` |  |
| 48.50 | niko | The ring on your wrist is the Ring in our valley. You came before the first fire. | 4 | `1nqqt7g` | 1.78–3.2 s |
| 50.20 | kai | I've never been here. | 4 | `1nj55dj` |  |
| 51.75 | niko | That is what the others said. | 4 | `1915njc` |  |
| 56.00 | mirarec | It doesn't record you, Kai. It's been waiting for you. Every instrument in this house points at one night — the night you were born. | 7 | `1w7a1pr` | 0.0–2.95 s |
| 59.55 | oskar | You're late. | 6 | `w80eae` |  |
| 61.80 | sera | In my time, your face is on every memorial. | 10 | `mz37we` |  |
| 64.50 | kai | For saving the world? | 10 | `akh5rp` |  |
| 66.60 | sera | For ending it. | 10 | `1bo9mx7` |  |
| 70.40 | recording | …do not let him see the ninth minute. | 6 | `1ut2v8m` |  |
| 75.30 | voice | You have nine minutes. | 9 | `f16rch` |  |
| 83.30 | sera | This is not the future. | 13 | `1jmejt5` |  |
| 85.30 | sera | The future that survives long enough to remember us. | 13 | `15c3wvq` |  |
| 109.90 | iven | Don't touch it. Varen. Don't— | 3 | `axhhnj` |  |

## Music map

| time | section | BPM | direction |
|---|---|---|---|
| 0.00 | rain | free | No score. Rain City bed fades up from silence: rain, far traffic, a murmur of the crowd. |
| 1.50 | hook · AFTERZERO main theme, intimate | 78 | Felt piano alone: the three-note motif E-B-A (Kai and Mira's shared memory), rubato, lots of air. A low cello pedal joins at 7.5. Breath-like texture, no drums. Minor mode with a suspended chord. |
| 17.50 | approach | 78 | A muted low piano ostinato starts to drift off the grid (Kai's "need to fix it" cell); bowed metal swells under the train horn pair (311 / 370 Hz, from the game). |
| 19.75 | SILENCE · the Zero Second | free | One second of digital silence: rain, crowd and score all stop (bible section 7, silence as storytelling). |
| 20.75 | the held second | free | Free time: glass harmonics, a sub drone, the causal-consequence resonance; nothing on the beat. |
| 27.75 | Mira · memory without a body | 64 | The motif on felt piano, closer and warmer, one warm cello harmonic; unresolved. A reversed tail, used once. |
| 32.25 | the voice | free | Everything drops to a low sub and one sustained cello note under the voice. |
| 35.00 | world · main theme expands | 78 | Piano motif plus low strings in octaves; slowly expanding; every cut lands on a beat. |
| 45.00 | world · the past | 78 | Frame drum on beats 1 and 3, breathy flute counter-line, plucked strings and water texture for the valley (no cultural pastiche). |
| 55.75 | world · night glass | 78 | Glass tones and sparse piano for the observatory night and the clockmaker; strings hold. |
| 61.17 | world · beautiful catastrophe | 78 | Wide strings, distant brass, processed wind; sparse piano; no heavy drums (bible 2196 cue). |
| 68.83 | the Witness | 54 | The motif slower and lower in bowed bass and bowed metal, irregular pulse; the three glass taps are its last notes. |
| 72.71 | card · breath | free | Near silence; one reversed glass swell rises into the montage downbeat. |
| 75.00 | montage · the Nine-Minute War | 118 | Precise layered percussion (frame drum, low toms, ticks), short string ostinati; every 7th bar slips by an eighth; brief gaps and reversed impacts before hits; no trailer booms. |
| 87.21 | montage · half-bar cuts | 118 | All layers; the string ostinato doubles; a reversed impact before every second cut; the last bar thins to ticks alone. |
| 97.38 | SILENCE | free | Hard stop: 1.2 s of digital silence. |
| 98.58 | title · main theme reprise | 78 | Piano motif alone, then cello; strings bloom under the tagline; the hopeful suspended chord on the title card, its top note left unresolved. |
| 109.58 | button | free | Only diegetic sound: ring hum, Iven's voice, the switch stinger, then silence on the cut. |
| 112.08 | end card | free | One low piano A ringing out under a rain tail; fade over the last second. |

## Sound-design cues

| time | cue | notes |
|---|---|---|
| 0.00 | rain bed (Rain City) | Fade in over 1.5 s; the game's rain + crowd beds. |
| 9.90 | toy un-fall: reverse whoosh | The toy rises back into her hand (the game's rewind voice, soft). |
| 13.20 | Chronolith glass chime | The band flares on Kai's wrist. |
| 14.50 | reversed clock ticks | Each tick with its pre-echo; one per second. |
| 17.60 | train horn | The game's 311 / 370 Hz sawtooth pair, then rail hiss rising. |
| 19.75 | the Zero Second: total silence | 1.0 s, rain included. |
| 20.75 | causal-consequence resonance | Low metallic resonance followed by a brief dropout (bible section 7). |
| 24.00 | Kai's footsteps in the held rain | The only moving sound; glass-harmonic shimmer from the frozen drops. |
| 28.60 | motif sting | The game's motif stinger as Mira looks at Kai. |
| 35.00 | lockdown alarm (muffled) | Helix alarm through glass, two pulses. |
| 40.38 | temporal switch ×4 | The switch stinger on each era flicker in s11 (t 41.4, 42.2, 43.0, 43.8). |
| 45.00 | temporal switch (transition) | Into the ancient valley; wind and water bed. |
| 51.17 | temporal switch + causal resonance | The valley floods; the dam hum under it. |
| 58.83 | door, rain | Hensel's door opening in the rain. |
| 61.17 | temporal switch (transition) | Into 2196: wind, birds, a far bell. |
| 70.20 | three notes on glass | E-B-A tapped on the gallery glass (the game's glass voice), 0.55 s apart. |
| 75.00 | heartbeat at 08:14 | As Meridian freezes; then the rewind ripple. |
| 79.08 | Echo Step | Afterimage swish, a doubled transient. |
| 81.08 | inversion: reversed rain swell | Rain played backward under the upward rain. |
| 83.12 | returned shells | Reversed impacts, never a boom: incoming whistle reversed into a dry crack. |
| 90.25 | flood siren | Surge siren, one wail. |
| 92.29 | tower collapse groan | Low steel groan. |
| 93.29 | temporal switch (transition) | Into the drowned valley. |
| 94.33 | storm front | Wind roar with the anchor hum failing. |
| 96.38 | temporal switch (transition) | Into the held yards. |
| 97.38 | silence | 1.2 s. |
| 98.58 | Chronolith hum | Low ring hum under the final image. |
| 111.90 | temporal switch | The cut to black lands on it. |
| 112.08 | rain tail | Light rain under the end card. |

## Store cut (30 s)

App-preview style: in-app footage only, no cards and no letterbox, the full 2.167:1 render frame delivered at 1920×886 (`store_cut_size`). Cut it from the shot clips, never from the 1080 output. `in` is seconds into the shot clip.

| # | shot | in | dur | starts at |
|---|---|---|---|---|
| 1 | s01 | 1.0 | 3.6 | 0.0 |
| 2 | s07 | 0.6 | 3.0 | 3.6 |
| 3 | s11 | 0.9 | 3.5 | 6.6 |
| 4 | s14 | 1.2 | 3.5 | 10.1 |
| 5 | s17 | 0.8 | 3.0 | 13.6 |
| 6 | s21 | 0.4 | 2.0 | 16.6 |
| 7 | s22 | 0.5 | 2.0 | 18.6 |
| 8 | s23 | 0.4 | 2.0 | 20.6 |
| 9 | s28 | 0.2 | 1.5 | 22.6 |
| 10 | s30 | 0.2 | 1.5 | 24.1 |
| 11 | s35 | 0.5 | 4.4 | 25.6 |

Total 30.0 s. Audio: the montage cue from 75.0 s, re-cut to 30 s and ending on the title chord, with no VO except "You have nine minutes." Store rules forbid on-screen text that is not in the app.

## The shot spec (the contract)

`tools/trailer/trailer.json` is the edit and the beat map. `tools/trailer/shots/gN.json` holds the shots, one group
per recorder agent. These are the fields everyone reads. New fields may be added; existing fields are never renamed.

**trailer.json**: `fps` 24 · `width`/`height` are the **output** (1920×1080) · `length` (s) · `order` (shot ids in
edit order) · `timeline[]` `{t, dur, shot | card, transition: cut | dissolve | dip | switch, frames, at_frame}` ·
`vo[]` `{t, speaker, text, key, mission, key_pending, clip_in, clip_out, notes}` · `cards[]` `{id, t, dur, text,
style: black | line | title | end}` · `music[]` `{t, section, bpm (null = free time), notes}` · `hits[]` (s) ·
`silences[]` `{t, dur, what}` · `sfx[]` `{t, cue, notes}` · `store_cut[]` `{shot, in, dur}` (in = seconds into the shot
clip, which starts at the head handle) · extensions: `render` `{width, height, gfx}` (what the recorder
draws: 2.167:1, currently 1280×590, see Director), `output` `{width, height, letterbox 2.39, active_height 804}`, `handles`, `store_cut_size`.

- `transition` says how an event **begins**. `dip` comes up from black over 6 frames. `dissolve` is a 6-frame cross
  dissolve. `switch` is a hard cut in which the last 4 frames of the outgoing shot and the first 4 frames of the
  incoming shot carry the game's switch distortion (render it with `DIR.shift`, or let the edit add a matching
  warp), and the switch stinger lands on the cut.
- `vo[].key` is the recorded clip `assets/voice/<key>.m4a`, or null when the line has not been recorded yet. In that
  case `key_pending` is the key the voice build will give it (FNV-1a of "speaker|text", base 36, as in
  src/core/voice.js). `clip_in` and `clip_out` trim a longer recorded line to the part the trailer uses. The cut
  points were found with ffmpeg `silencedetect`.

**shots/gN.json** `{shots: [...]}`, one per shot: `id`, `group`, `mission`, `beat`, `url` (relative to the static
server, always `index.html?m=<mission-1>&dtcap=0.25&gfx=high&auto`), `ready` (JS that is true when the mission can be
staged), `setup[]`, `frames` (cut + 2 × handles), `handles` 12, `camera`, `actions[]`, `grade`, `approved` (false
until a reviewer passes the shot's frames), `notes`. Extensions: `fps`, `cut_frames`, `characters`, `lighting`,
`sound`.

- `setup[]` runs once after `ready`, before frame 0. Each step is one of: `{eval: js}`; `{down|up|press: KeyCode}`;
  `{wait: s}` (simulated game seconds, not drawn); `{until: js, timeout: s}`. `wait` and `until` take an optional
  `pace`: by default setup runs no faster than real time (`pace` 1), because mission scripts mix game time with
  wall-clock waits (dialogue autoplay, `temporal.switchTo`) the way `tools/tests/*.json` playthroughs expect. `pace` 0
  runs flat out.
- `actions[]` `{t, eval | down | up | press}` run before the frame at shot time `t`. Shot time is seconds from frame 0,
  and frame 0 is the first frame of the head handle, so the cut-in is at t = 0.5 s.
- `camera.mode`:
  - `path`: keyframes `{t, p, l, fov (vertical, for the 1920×886 frame), roll (deg), focus (m or null)}`. The global
    `ease` (`inOut` | `sine` | `linear` | `in` | `out`) runs from the first key to the last. Positions go through
    Catmull-Rom, so multi-key moves never stop at a key. `shake` 0..1 adds a smooth hand-held drift.
    Extensions: `anchor` (JS for a moving point, such as a character root or a bone; the keys are then offsets from
    it), `anchorLive` (re-read the anchor every frame, default true), `focusOn` (JS for the depth-of-field
    target, which overrides `focus`), and `hold` (true also parks the pose in `game.cine`. Leave it off: several
    missions treat `game.cine` as "a cutscene is running" and pause, for example the Meridian reset).
  - `follow`: the game's own third-person camera behind Kai, driven by scripted input. `camera.orbit {yaw, pitch,
    dist}` sets it at frame 0.
  - `game`: the mission's own cinematic camera (`game.shot`) as authored.
- `grade`: the engine's era grade, set at frame 0 (`engine.setGrade`, settled). An action can change it mid-shot (the
  era-switch shots do), and it blends over about a second.

## How shots are reached and staged (tools/trailer/director.js)

The recorder loads `url` and waits for `ready`. It then evaluates `tools/trailer/director.js` in the page, which
takes over the frame loop the way `tools/render/refhelper.js` does: frames are only simulated and drawn on request.
Then it runs `setup[]`, calls `DIR.begin(shot)` and, for each frame, runs the due `actions` and `DIR.frame(i, true)`.
That call steps the game exactly 1/24 s, poses the camera, draws, and returns the frame. Between frames the page
must get at least one `requestAnimationFrame` turn: mission scripts await `game.wait` / `waitFor` through rAF polling,
and stall if frames are stepped back to back without yielding. `preview.mjs` waits 18 ms after each undrawn frame. `tools/trailer/preview.mjs`
does exactly this at 640×296 for three frames per shot (cut-in, middle, cut-out). It writes one strip per shot for
review:

    node tools/trailer/preview.mjs g3 [--shots=s10,s11] [--w=640] [--h=296] [--at=in,mid,out|keys|0,40] [--resume]

Director helpers the shots use:

- `DIR.era(id, dur)`: an era switch driven by **game time**. The game's `temporal.switchTo` animates its distortion
  on wall time, which a frame-stepped capture would skip. This helper raises `uShift`, swaps the era at the midpoint
  (visibility, `apply()`, the `onSwitch` listeners, the band flare) and lowers it again.
- `DIR.actor(id)`, `DIR.freeze(on)`, `DIR.pose(p, l, fov, roll)`, `DIR.sim(s)`, `DIR.until(js, timeout)`.
- Staging at run time, with no game code changed: place Kai (`player.place`), bring a character back or turn them
  (`actors.rook.root…`), set `lookTarget`, play a pose clip (`char.pose = 'work' | 'look' | …`), lip movement on a
  trailer VO line (`char.talk = seconds`), the band flare (`char.wristBoost`), the Chronolith core power (the ring's
  `userData.disc` uniform), dimming the mission 1 shop-window canvases, firing mission 13's return-ring tracers
  (`__m13.W.tracer`), Echo Step (`__m12.echo.trigger()`), and jumping the Meridian loop (`loopState.active.skipTo`,
  through a dynamic import of `/src/systems/loops.js`, which is the same module instance the game uses).
- Missions that expose debug handles: `window.__m12`, `__m13` and `__m18` (`ch3`). Mission 18 starts at a chapter with
  `&m18part=N`.

<!-- END GENERATED -->

## Director

`tools/trailer/director.mjs` renders one shot of the shot spec (`tools/trailer/shots/*.json`) from the real game,
frame by frame, in headless Chromium (SwiftShader). It is built on the approach of `tools/render/record.mjs`
(docs/RENDERING.md §12.2) and works for any built mission 1-18 (`?m=0` is mission 1; never point a shot at 19-23).

```sh
node tools/trailer/director.mjs s07                         # final frames of shot s07 (found in shots/*.json)
node tools/trailer/director.mjs tools/trailer/shots/g2.json#s07 --preview   # every 4th frame, 640 wide
node tools/trailer/director.mjs s07 --still=0,48,95          # look-dev stills at full size
node tools/trailer/director.mjs s07 --from=0 --to=23         # part of the shot; --force re-renders
```

| output | where (`<OUT>` = `/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/trailer`, env `TRAILER_OUT`) |
|---|---|
| final | `<OUT>/frames/<id>/%05d.jpg` (JPEG q95, `trailer.json` width × height), `meta.json` (spec hash), `progress.json` |
| `--preview` | `<OUT>/preview/<id>/%05d.jpg` (640 wide at the render aspect; frame numbers of the final), `<OUT>/preview/<id>.mp4` (real pace), `<OUT>/preview/<id>_sheet.jpg` (contact sheet) |
| `--still` | `<OUT>/stills/<id>/%05d.jpg` (always re-rendered) |

**Time.** Every time in a shot (camera keys, actions) is seconds from frame 0 of the rendered clip, handles included:
frame `f` shows shot time `f / fps`. The edit's usable range is `[handles, frames − handles)`.

**How a shot runs.**
1. `page.js` is injected before the game's modules: `Math.random` becomes a seeded generator (shot `seed`, default
   20490314), and when `window.__game` appears the rAF loop is made inert (`game.step` and `engine.render` are no-ops
   for it). Playwright's fake clock is installed and paused: timers, `requestAnimationFrame`, `performance.now()` and
   `Date` only move when the director advances them. The whole game, mission scripts and `?auto` dialogue included,
   runs on virtual time, independent of how slow the software renderer is.
2. Load: the URL gets `dtcap=0.25&adaptive=0&auto` if missing. The director steps the world `readyDt` (0.1 s) at a time,
   waiting for network idle before each step, until `ready` is true (`readyTimeout`, 900 game s). Title-screen frames do
   not advance game time, so the mission timeline does not depend on when loading finished.
3. Shot start: `Math.random` is re-seeded, HUD / dialogue / subtitles / prompts / touch controls / debug overlays are
   hidden (only the WebGL canvas is captured anyway), the game's letterbox is switched off for good (the edit adds the
   trailer letterbox), the grade is set (`engine.setGrade(grade, { instant })`).
4. `setup` runs in order: `{"eval": js}`, `{"down"|"up"|"press": "KeyW"}`, `{"wait": s}` and
   `{"until": js, "timeout": s}` (game seconds, simulated without drawing in `setupDt` = 0.1 s steps; `"dt"` per step
   overrides). An `until` that times out fails the shot (exit 3).
5. Frames: for frame `f` the actions with `t ≤ f / fps` run, the world steps exactly 1/fps (`game.step`, then the
   virtual clock advances by the same amount), the shot camera is posed and `engine.render()` runs — with the composer
   on frames that are drawn, without it ("dry") on frames that are not. Dry frames run every CPU-side part of the
   renderer (facades, static batching, probe captures, grade and focus smoothing), so a frame does not depend on which
   frames before it were drawn.
6. Eye adaptation is snapped on frame 0 (`engine.settlePost()`) and then held (`"exposure": "lock"`, the default): a
   trailer shot keeps one exposure, and no frame depends on how many frames were drawn before it. `"adapt"` lets it
   adapt (resumes then draw up to 24 frames before the first missing one to re-converge).

**Resumable and deterministic.** Frames are written atomically (`.tmp` + rename). A restart re-simulates without drawing
up to the first missing frame (plus frame 0, which is always drawn to snap the exposure). `meta.json` holds a hash of
everything that changes pixels (url, ready, setup, frames, camera, actions, grade, exposure, ss, blur, extras, seed,
size, fps, director version): a changed spec deletes the stale frames; editing `beat`, `notes` or `approved` does not.
One director per shot and output (`.lock`; a second one exits with code 5).
Verified: frame 60 of `t_walk` rendered alone (`--still=60`: frames 1-59 simulated dry) is bit-identical to the farm's
frame 60, which was rendered continuously after a stop / restart at frame 17 (PSNR ∞, max difference 0). Adjacent-frame
differences across the restart seams of both test shots (t_iven 29→30, t_walk 16→17) are the same as anywhere else in
the shot. Earlier development runs on m1 matched at 46-51 dB (JPEG-block noise, invisible) before the title-screen and
clock fixes made runs exact.

**Camera** (`camera`, the storyboard's fields plus a few extensions):

| field | meaning |
|---|---|
| `mode` | `"path"` keyframed camera · `"follow"` without position keys: the game's own third-person camera behind Kai, driven by scripted input (`orbit {yaw, pitch, dist}` at frame 0, `keys[0].fov`) · `"follow"` with position keys: an operator camera (below) · `"game"` the mission's own camera (gameplay, `game.shot` cinematics) as authored |
| `keys` | `[{ t, p: [x,y,z], l: [x,y,z], fov, roll, focus }]`: position and look target through a time-aware Catmull-Rom (cubic Hermite with finite-difference velocities: C1 in time, multi-key moves never stop at a key), fov / roll / focus the same way; `fov` is vertical |
| `ease` | `"inOut"` (default, cubic), `"linear"`, `"in"`, `"out"`, `"sine"`, applied from the first key to the last |
| `shake` | 0-1 hand-held drift: smooth deterministic noise in shot time, ±4 cm and ±0.34° at 1 (the storyboard previews' amplitudes) |
| `focus` (per key) | depth-of-field focus distance in metres along the view axis (`engine.focus`, high tier); a `null` key takes its nearest numeric neighbour; all `null` = no DOF |
| `focusOn` | the DOF subject, overrides `focus`: an actor id (`"iven"`: its head), a JS expression returning a Vector3 / Object3D (`"DIR.actor('kai').head"`), or `[x,y,z]` |
| `rig` | the game's dialogue key + rim lights follow the focus subject (default on, as in `game.shot`); `false` keeps them off |
| `anchor`, `anchorLive` | path keys are offsets from a moving point: a JS expression (a character root, a bone), re-read every frame unless `anchorLive: false` |
| `target`, `lag`, `yawLag`, `frame`, `yaw` | operator follow: offsets in the frame of `target` (`"kai"` default, or an actor id; `x` right, `y` up, `z` along its facing, positive = in front), with operator lag on position (0.3 s) and heading (0.8 s); `"frame": "world"` for world axes, a fixed `yaw` |

**Storyboard compatibility.** The shot files from `tools/trailer/storyboard.py` run unchanged: `page.js` serves the
`DIR` helper names that `tools/trailer/director.js` defines for the storyboard previews (`tools/trailer/preview.mjs`), and
the camera fields `anchor`, `anchorLive`, `focusOn` (JS) and the orbit `follow` behave the same. Differences, all in
favour of the final frames: everything runs on virtual time (no real-time `pace`), path positions use the time-aware
Hermite form of Catmull-Rom (identical at the keys, slightly different between unevenly spaced keys), exposure is
held from frame 0, and the frames are JPEG q95. Checked with `--preview` on s03 (camera anchored to Kai's hand,
`focusOn` JS, band flare) and s33 (three `DIR.era` switches).

**Characters and story state** (from `setup` / `actions` evals; `TR` is the page helper, `DIR` the storyboard's helper
names, `__game` the game):
`TR.place(id, x, y, z, ry)` (`kai` moves the player), `TR.act(id, 'sit'|'work'|'look'|'nod'|'sad'|'fall'|'talk'|'idle'|null)`
(pose clips through the character API), `TR.clip(id, name, fade, speed)` forces any motion-capture clip (`idle`,
`walk_slow`, `walk`, `jog`, `run`, `sprint`, `crouch`, `talk`, `nod`, `look`, `sit`, `work`, `sad`, `fall`; `null` releases),
`TR.look(id, 'kai' | 'camera' | [x,y,z] | null)`, `TR.talk(id, seconds)` (talk gesture + mouth), `TR.walk(id, [[x,z],...], speed)`,
`TR.freeze(id)`, `TR.hide(id)`. Kai walks under game physics with `{"down": "KeyW"}` (direction from
`__game.player.camYaw`; `__game.control = true`). Story flags: `__game.flags.<name> = ...`. The storyboard API is served by `page.js` as well: `DIR.actor(id)`,
`DIR.era(id, dur)` (era switch on game time: distortion up, swap at the midpoint with the onSwitch listeners and the band
flare, distortion down), `DIR.shift(v)`, `DIR.freeze(on)`, `DIR.pose(p, l, fov, roll)`, `DIR.sim(s)`, `DIR.until(js, s)`,
`DIR.t` / `DIR.i` (shot time / frame). `temporal.switchTo` also works as in the game, because its wall-clock animation
runs on the virtual clock. Setup `pace` is ignored: every wait is virtual, so no setup needs real-time pacing.

**Quality.** Shots render with `gfx=high` (SMAA, GTAO, bloom, DOF, full interior mapping). Trailer-only extras per shot:
`"ss": 1.5 | 2` supersampling (renders larger, high-quality downscale; for shots that alias: fences, cables, distant
facades), `"blur": { "samples": 4, "shutter": 0.5 }` sub-frame accumulation motion blur (the frame interval is split
into `samples / shutter` steps and the last `samples` are averaged: a 180° shutter; for whip pans and fast moves),
`"extras": { "crowdFar": 30 }` (crowd people stay on their full build up to 30 m instead of 14 m),
`"extras": { "shadowMap": 4096 }` (sharper sun shadows). Measured on `t_walk` frame 60 at 1280×590: plain 5.9 s,
`"ss": 2` 14.4 s (2.4×; also averages the film grain away and is slightly brighter, so keep it for whole shots),
`"blur": 4` 24.7 s (4.2×): use them where they show.

**Resolution.** Benchmark on the heaviest street (mission 1 rain street, `gfx=high`, 230 draw calls / 0.5 M triangles,
8 drawn frames each, mean wall seconds per frame including the game step and the JPEG; this container's 4 cores shared
with the missions workflow's headless playthroughs, load average 9-23):

| size | one renderer | two renderers at once (each) | frames per hour, two renderers |
|---|---|---|---|
| 1280×720 | 5.7 s (load 9) | 16.2-18.1 s (load 22) | ~420 |
| 1920×1080 | 18.3 s (load 11) | 28.9-30.2 s (load 18) | ~240 |
| 1280×590 (chosen, the 2.167:1 render frame) | — | 8.6-11.0 s (load 20-25, farm test shots) | ~740 |

The storyboard's 36 shots are 3 200 frames. At 1920 wide (1920×886 ≈ 0.82 × the 1080 cost) that is ~11 h of farm time,
at 1280×720 ~7.5 h, at 1280×590 ~4.3 h plus ~1 min of loading per shot: 1280 wide, the floor, is the only width that
fits the ~4 h budget under this load, and the 2.167:1 frame saves the 18 % of rows the edit never shows.
`trailer.json` `render` is `{ width: 1280, height: 590 }` (written by `tools/trailer/storyboard.py`, `RENDER`); the
edit scales the 2.39 band (536 rows) to the 1920×1080 output. Re-run the benchmark with
`node tools/trailer/director.mjs <shot> --still=4,5,6,7,8,9,10,11 --size=1920x886` when the machine is quieter: the
director reads the size from `trailer.json` `render` (else `width` / `height`), so a bigger render is a one-line change.

## Render farm

`tools/trailer/farm.mjs` is the background render queue.

```sh
node tools/trailer/farm.mjs start    # starts in the background (nohup); a no-op while a farm runs
node tools/trailer/farm.mjs status   # per-shot progress, s/frame, estimated time left
node tools/trailer/farm.mjs stop     # stops the farm and its renderers; frames on disk are kept
```

- Renders every shot with `"approved": true` in `tools/trailer/shots/*.json` (group files and `test.json`) whose final
  frames are incomplete or stale (spec hash changed), with at most 2 directors at once (`FARM_JOBS`), each under
  `nice -n 10`. The shot files are re-read every 5 s, so shots approved while the farm runs are picked up.
- Each finished shot is encoded to `<OUT>/clips/<id>.mp4` (x264 `-crf 12 -preset slow`, yuv420p, 24 fps) with a
  `clips/<id>.json` (spec hash): a re-rendered shot is re-encoded.
- A director that fails 3 times gives the shot up (status `FAILED`, reasons in the log) until its spec changes.
- The farm exits when nothing is left to render or encode. Lock `<OUT>/farm.lock`, log `<OUT>/farm.log`,
  state `<OUT>/farm-state.json`.
- Kill-safe: frames are written atomically and every director resumes at its first missing frame, so `stop` (or a
  container restart) followed by `start` loses at most the frames in flight.
- Director exit codes: 0 done, 2 usage, 3 `ready` / `until` timed out, 4 crash (page or browser), 5 another director
  holds the shot (the farm retries in 60 s).

Verification (2026-10-22, `tools/trailer/shots/test.json`, two eras): `t_iven` (mission 2, Helix 2026: a push-in on Iven,
who looks up, rises, turns to Kai and talks, focus and dialogue rig on him; 144 frames) and `t_walk` (mission 1, Rain City
2049: an operator follow leading Kai down the rainy street; 120 frames) rendered through the farm at 1280×590, two
directors at once. The farm was stopped at frames 30 / 17 and started again; both shots resumed at their first missing
frame, finished at 8.2 / 8.9 s per frame (load average 20-25) and were encoded to `clips/t_iven.mp4` and
`clips/t_walk.mp4` (h264, 1280×590, yuv420p, 24 fps, 144 / 120 frames), after which the farm exited by itself.
Their `approved` flags are back to false so the production farm skips them.

## Final-frame QC

`tools/trailer/qc.py` checks the farm's output, shot by shot (run it with the trailer venv,
`/home/user/tools/trailer-venv/bin/python tools/trailer/qc.py [ids...] [--force]`; a shot whose frames and clip have not
changed since its last check is skipped). For every approved shot with a clip it writes `<OUT>/qc/<id>/sheet.jpg` and
`<OUT>/qc/<id>/qc.json`, and `<OUT>/qc/summary.json` for a full run.

- **Contact sheet**: 6 frames spread evenly over the part the edit uses (`[handles, frames − handles)`), the 2.39
  band marked in yellow. Below them is a strip with per-frame band luma (white) and frame-to-frame change (orange).
  Flicker candidates are marked blue, pops red, local pops and colour steps with violet ticks, and the handles shaded.
- **clip**: ffprobe reports h264, yuv420p, the render size, and a frame count equal to the spec's `frames`. The clip's
  spec hash matches the frames' hash.
- **black / freeze**: ffmpeg `blackdetect` (≥ 0.08 s) and `freezedetect` (−70 dB, ≥ 0.25 s) on the clip. Frames whose
  band luma is under 6/255 count as black. Runs of 4 or more frames with no measurable change count as frozen.
- **flicker**: a one-frame band-luma excursion from a 5-frame median (more than 2/255 and 6 %).
- **pop**: a frame-to-frame change over 3/255 and 3× its 9-frame median: a staging jump, an object popping in or out,
  a focus snap, or a cut.
- **local pop**: a 32×64 px block that steps to a new value in one frame and keeps it, more than 18/255 and 5× the
  block's own change around that frame: an object or LOD popping, or one building relit. Flagged at 3 or more blocks,
  or a step of 40/255 or more. Single blocks are usually just motion.
- **colour step**: a one-frame step in the band's mean RGB, more than 0.8/255 and 4× its neighbours: an
  environment-probe swap or a grade snap.
- **grade**: band mean RGB at the start, middle and end of the used range. A drift inside one shot shows up here.

The numbers only point at frames worth a look. Each candidate is judged on the sheet and the frames around it.
Intended events also trip them: era switches, flares, impact flashes and dissolves.

Pass of 2026-10-22, all 36 shots: no black, frozen or format faults, and no HUD, debug or letterbox remnants on any
sheet. Four shots were fixed at run time in their specs and re-rendered:

| shot | fault | fix |
|---|---|---|
| s02 | From ~3.7 s the band light (cyan, strength 10) washed the child's face out to a flat porcelain white: doll-like, with the skin hue gone. | The light rises to 3.5. Her skin tone stays, with a cool rim on the forehead and hair. |
| s03 | A focus pop: the depth of field snapped from the child to the band between frames 26 and 27. The director re-aims the focus every frame, and the engine's focus smoothing does not run on frame-stepped renders. | `focusOn` pulls focus itself over 0.8–1.4 s, with a smoothstep interpolated in 1/distance. |
| s05 | Flicker in the last 0.7 s (frames 50–66). The 25-strength nose spot raised specular fireflies on the shop shutters and the platform glass, with HDR peaks far above the lamps. The bloom spread them into large soft squares that jumped from frame to frame. | The bloom high-pass input is clamped at 16 per pixel, so the lamps keep their glare and the fireflies lose theirs. The bloom strength ramps from 0.75 to 1.55 starting at 1.9 s, so the glare still swells to the white-out at the cut-out. |
| s20 | A lighting pop at frame 56 (2.3 s, inside the cut). During the loop's run-up to the reset the scene's light signature changed. The engine re-captured its environment probe and swapped it in within one frame: the left building turned from warm brick to cold grey and the whole frame cooled. | The probe the director settles at the shot camera on frame 0 is frozen from frame 1 (`scene.userData.autoEnv = false`). The morning light now holds until the freeze grade. |

Any shot can get the probe swap: the probe re-captures when fog, background, environment intensity or the number of
visible lights changes, at most once every 2 s, and a re-capture swaps in at once. A shot whose world changes while it
runs gets a colour step 2 s or more in, when the re-capture finishes (it takes about 14 frames). Freeze the probe for it the way s20 does.

Intended, not faults (the edit relies on them): the s03 band flare (frame 41, on the 13.2 s chime). The s08 dissolve onset
(frame 67). The era switches in s11 (4×), s14, s15 (one dark transitional frame at 48), s33 (2× in the cut) and s36
(the distortion builds from frame 64; the 2196 flip is frame 72, just past the last used frame 71). s21's Echo Step:
the trigger flash at frame 27, then Kai's body arcs over the shutter and fades out by frame 36 while the afterimage holds.
The four impact flashes of s23. The light-on in s19's head handle (frame 8). The reset in s20's tail handle (frame 115).

Look-dev notes from the pass, not faults: s09's HELIX lettering is cut at the top of the 2.39 band. In s01 two street
lamps leave the top edge during the crane down (frames 97–99), and their bloom goes with them (−2/255 band luma),
mostly above the 2.39 band. The s09 corridor's alarm lights flash, as the game's lockdown lighting does. In s07 a frozen
commuter enters frame left on the last used frame. s29, s26 and s30 are near-static 1-second holds, with frame change ≤ 0.9/255.

## Sound

Everything the trailer sounds like is rebuilt by one command (outputs outside the repo, in the session scratchpad
`trailer/audio/`, or `$TRAILER_AUDIO`):

```sh
tools/trailer/build_audio.sh         # samples, score, sound design, VO, both mixes, verification report (~5 min CPU, nice 10)
tools/trailer/build_audio.sh mix     # only remix + report from the stems on disk
FORCE=1 tools/trailer/build_audio.sh # ignore the up-to-date checks
```

It is resumable: each stage is skipped while its outputs are newer than its inputs (`trailer.json`, its own script and
the shared DSP modules). It creates the venv `/home/user/tools/trailer-venv` (numpy, scipy, soundfile, matplotlib) if
it is missing.

| file | what it does |
|---|---|
| `tools/trailer/sound/fetch_samples.sh` | `npm pack`s the pinned sample packages, checks their sha256, unpacks each into its own empty folder under `/home/user/tools/trailer-samples` (nothing in them is run) |
| `tools/trailer/sound/dsp.py` | shared DSP: filters, a stereo algorithmic-hall IR generator (early reflections + band-wise decaying tail; presets room, street, plate, hall 2.8 s, cathedral 5.5 s, space 8 s) used by FFT convolution, a compressor, sidechain ducker, 4×-oversampled true-peak limiter, 24-bit WAV I/O |
| `tools/trailer/sound/sampler.py` | the multisample player: Salamander piano (5 velocity layers with crossfades, key-release noise, sustain-pedal ring, a `felt` control that darkens the hammer into a felt piano), VSCO-2 CE instruments (loop points, measured per-sample tuning, attack/release envelopes, each note doubled into a small detuned section), cubic Hermite repitching |
| `tools/trailer/sound/textures.py` | our own synthesis: modal bowed metal, glass harmonics (struck and bowed), sub drone, breath, frame drum, low tom, clock tick, reversed swells, reversed impact tails |
| `tools/trailer/sound/score.py` | the composition (every note is written out in `compose()`), the humanised players, the bus mix → `stems/music.wav` and per-bus stems `music_{piano,strings,winds,perc,texture,glass,sub}.wav`; `--store` writes the 30 s cue |
| `tools/trailer/sound/sfx.py` | sound design and ambience on the cue table → `stems/sfx.wav` (= `sfx_amb.wav` + `sfx_fx.wav`); `--store` |
| `tools/trailer/vo.py` | the voice-over → `stems/vo.wav` + `stems/vo.json` (actual onset, end, source, loudness per line); `--store`; `--check-synth` |
| `tools/trailer/sound/mix.py` | ducking, bus glue, limiter, two-pass loudness → `trailer_mix.wav/.m4a`, `store_mix.wav/.m4a` |
| `tools/trailer/sound/analyze.py` | listening proxies and the report: spectrogram + level + VO-against-mix pictures (`pictures/`), `report.json` |
| `tools/trailer/sound/ab_test.py` | the instrument A/B below (`ab/`) |

Deliverables in `trailer/audio/`: `trailer_mix.wav` (117.083 s, 48 kHz, 24-bit stereo) and `trailer_mix.m4a` (AAC
256k) for the edit; `store_mix.wav/.m4a` (30.0 s); stems `stems/music.wav`, `stems/sfx.wav`, `stems/vo.wav` (plus
the per-bus music stems and the ambience/effects split) and `store/{music,sfx,vo}.wav`, all sample-aligned to t = 0 of
the edit.

### Instruments: procedural or sampled (A/B)

`ab_test.py` plays the same 12 s motif phrase (piano E-B-A over a cello pedal) through a numpy port of the game's
procedural piano/cello/reverb (`src/core/audio.js`) and through the sampler. Listening proxies (`ab/metrics.txt`,
`ab/ab.png`):

| | envelope range | sharpest 20 ms rise | spectrum |
|---|---|---|---|
| procedural (game) | 17.2 dB | 5.1 dB | five fixed partials per note, a smeared steady-state envelope, the cello a filtered sawtooth |
| sampled | 29.5 dB | 26.7 dB | real hammer transients, inharmonic and sympathetic partials, a natural decay per note |

The sampled version has real attacks and a recorded instrument's decay and spectrum, which the procedural one cannot
fake, so the score uses samples for piano and orchestra. The game's own instruments are untouched (no edit to
`src/core/audio.js` was needed). The temporal colours that no sample library has (bowed metal, glass, breath) are our
own synthesis, as is the restrained percussion (frame drum, toms, ticks), so nothing sounds like a stock trailer kit.

### The score

One continuous original cue on the AFTERZERO motif **E5-B5-A5** (MIDI 76-83-81, the game's `title` / `memory`
theme), A minor / Aeolian with suspended and lydian colours, following the music map above to the hundredth of a second.
Each section has a tempo map whose anchors are the cut times from `trailer.json` (`Clock` in `score.py`), so the hits
land on the frame even where 24 fps rounds a bar. Humanisation: Gaussian timing jitter (4-12 ms per note, none on
the hit downbeats), ±5 % velocity, chord notes spread 12 ms like a player's hand, strings started early by a fixed
bow lag (30-70 ms), rubato written into the hook's note times. 394 notes in the trailer cue, 243 in the store cue.

| time | section | what plays |
|---|---|---|
| 1.5-17.5 | hook, rubato ~78 | felt piano alone: E-B-A over A and F roots, pedalled, much air; breath texture; a cello A pedal enters at 7.5 (s02); the piano rests under the child's line; at 12.0 the motif is left hanging on B; a suspended D under the reversed clock |
| 17.5-19.75 | approach | a muted low-piano ostinato (the "need to fix it" cell) drifting off the grid and speeding up; celli/basses swell; a D♯ in the violas against the train horns; bowed metal |
| 19.75-20.75 | **silence** | digital zero in every stem and the master |
| 20.75-27.75 | the held second, free time | sub drone, a bowed-metal swell, five glass harmonics and two bowed-glass sustains, nothing on a beat |
| 27.75-32.25 | Mira, 64 | the motif on felt piano, closer and darker, a high cello line; B left unresolved; the reversed A5 tail used once, into black |
| 32.25-35.0 | the voice | a 55 Hz sub and one cello E under the PA voice |
| 35.0-45.0 | world A, 78 | timpani + basses/celli in octaves on the downbeat; the motif on piano; F, then C (s11's switch, strings open upward), then a G-sus crescendo with timpani roll into the cut |
| 45.0-51.17 | the past, 78 | harp arpeggios, frame drum on 1 and 3 with hand slaps, a breathy flute counter-line for two bars (the valley alive), pizzicato on the downbeat |
| 51.17-55.75 | the flood | sforzando-piano low strings and timpani on the switch, flute gone, two piano notes |
| 55.75-61.17 | night glass | held strings, glass tones, sparse piano |
| 61.17-68.83 | beautiful catastrophe | wide strings over F (A-C-E, then B-D on top), distant horns, timpani, sparse high piano; at 65.75 a cold B♭ chord under "For ending it." |
| 68.83-72.71 | the Witness, 54 | bowed basses low and weary, bowed metal, sub, an irregular tom pulse; the register is left clear for the three glass taps (sound design) |
| 72.71-75.0 | card breath | one reversed glass swell into the montage downbeat |
| 75.0-97.375 | montage, 118 | 11 bars: clock ticks in 3+3+2, a spiccato string ostinato (celli, violas from bar 3, violins doubling from the half-bar cuts), basses, frame drum from bar 3, toms from bar 4, distant horns from bar 5, distorted breath from bar 7; the ostinato slips an eighth from beat 24; gaps before the hits at beats 8, 16, 24 filled by reversed impacts, reversed impacts before every second half-bar cut; the last bar thins to ticks alone; +2 dB growth across the section |
| 97.375-98.583 | **silence** | digital zero |
| 98.58-109.58 | title, 78 | the piano motif alone, then the cello sings it lower; strings bloom under the tagline; at the title (105.08) an F-lydian chord (F C G A E) for basses, celli, violas, violins and horns with timpani and piano, **B5 on top, never resolved**; glass |
| 109.58-112.08 | button | the score fades out in 0.25 s: only Iven, the ring hum and the switch |
| 112.08-117.08 | end card | **one low piano A (A1 + A2) ringing out**, unresolved after the B above it, fading over the last second |

Bus mix: piano, strings, winds, perc, texture, glass and sub buses, each with its own reverb send (hall for the
instruments, cathedral for the textures, an 8 s "space" for the glass, a dry sub), a little extra hall on the
acoustic buses, gentle bus compression on the percussion, a soft program compressor (1.8:1), a 28 Hz high-pass.
Silences are gated with 4 ms ramps so nothing clicks or rings into them.

**Store cut.** `score.py --store` re-lays the montage material to the store-cut picture (one bar-anchor per cut at
~118 BPM), lets it breathe before the last shot and ends on the title chord with the motif's first two notes, fading
out by 30.0 s.

### Sound design

All synthesised in `sfx.py` from physical recipes (no outside recordings): rain is thousands of droplet impacts and
puddle bubbles over wet hiss, wind is gusting noise with whistling resonances, water is bubble chirps and lapping,
birds are FM calls, bells/glass/metal are modal, footsteps, doors and impacts are excitation plus resonance. The crowd
murmur is a babble of the game's own recorded mission 1 voices, too dense and far to understand. Every cue in the
sound-design table is placed at its time:

- **Beds:** 2049 Rain City (rain, far traffic, crowd, the station canopy), the held-rain glass shimmer, the 2026 Helix
  lab hum and muffled alarm, the valley (wind, stream, birds), the drowned reservoir and dam hum, the clockmaker's
  rain and clocks, 2196 (wind, birds, a far bell, structure groans), the gallery air, a light rain tail on the end card.
- **Temporal:** the switch effect (a swept band-pass bank with a time-grain stutter, pitched up on each flicker in s11),
  the causal-consequence resonance (a low inharmonic metal resonance at 55 / 49 Hz with a brief dropout, at 20.75
  and 51.17), Chronolith glass (the band flare, the three taps E-B-A on the gallery glass at 70.2 / 70.75 / 71.3, the final
  ring hum), the rewind ripple, the Echo Step swish.
- **Montage:** restrained physical impacts on the cuts (reversed incoming whistles into dry cracks, a heartbeat, the
  flood siren's one wail, the tower groan, the storm front with the anchor failing); no braams, no booms.
- **Silences:** both beats are digital zero (filtered first, gated last, so no tail rings in).

### Voice-over

`vo.py` places the 20 storyboard lines. Every one reuses the game's recorded clip (`assets/voice/<key>.m4a`, the same
performance the player hears); a line without a clip would be synthesised with the same Piper LibriTTS speaker, pace
and ffmpeg treatment as the game, by importing `tools/voice/build_voices.py` read-only (its `CHARACTERS`, `FILTERS`,
`cast_voices`, `clean_for_tts`); `vo.py --check-synth` exercises that path on "The Chronolith.". Per line: the
storyboard's `clip_in`/`clip_out` trims (snapped to the quietest 20 ms between words), trimmed to the speech with 12 ms
of lead-in and 120 ms of tail, a 75 Hz high-pass, +1.5 dB presence at 3.2 kHz, a 4 ms / 30 ms fade (de-click), evened to
-23 LUFS (BS.1770, gated), a touch of 0.55 s room (none on the PA voice, which carries its own cathedral), and placed so
the first word starts at the beat-map time. A line that runs over a cut is cut with the picture (5 ms ramp); Iven's
"Don't—" breaks off by itself at 111.92, just before the cut to black at 112.083.

### Mix and loudness

`mix.py`: VO +5 dB; the score ducks 6 dB under every line (sidechain on the VO stem, 50 ms look-ahead, 60 ms attack,
450 ms release), the sound design 3 dB; a gentle bus glue (1.6:1) and master compressor (1.4:1); the silence beats
forced to digital zero in the master. Loudness: the gain is iterated against the verifying meter (ffmpeg `ebur128`)
with a 4×-oversampled true-peak limiter in the loop (ceiling -1.6 dBTP), then ffmpeg `loudnorm` runs its second pass
in linear mode with the measured values (a pure gain, no dynamic processing), and `ebur128` verifies the written file.

### Verification (`report.json`, `pictures/`)

| | integrated | true peak | LRA | clipped samples | clicks |
|---|---|---|---|---|---|
| trailer mix (117.083 s) | -14.0 LUFS | -1.6 dBTP | 8.9 LU | 0 | 0 |
| store mix (30.0 s) | -14.0 LUFS | -1.6 dBTP | 4.1 LU | 0 | 0 |
| trailer_mix.m4a (AAC 256k) | -14.1 LUFS | -1.3 dBTP | 9.0 LU | | |
| store_mix.m4a (AAC 256k) | -14.0 LUFS | -1.6 dBTP | 4.1 LU | | |

- **Silences:** 19.75-20.75 and 97.375-98.583 are digital zero (peak -inf) in the mix.
- **VO onsets** (first word measured in the mix stem against the beat map): all 20 lines within -2…+62 ms (under
  1.5 frames), most of the late ones being soft consonants the detector hears after the placed start.
- **Intelligibility:** speech-band (300-3400 Hz) VO-to-background ratio under every line, after ducking, 18-48 dB;
  the lowest are "All of them…" (18.4 dB, over the s11 switches) and the recording's "…ninth minute" (18.3 dB, under the
  glass taps).
- **Hits:** every hit in `trailer.json` is a music onset within ±10 ms of the cut, or a cut to silence (19.75,
  97.375), except 112.08 (+17 ms), 98.58 (+27 ms, the piano's soft attack) and 61.17 (+73 ms, a soft string entry).
- **Pictures:** `pictures/mix_full.png` (spectrogram, peak/RMS, VO against the mix) and the three section pictures,
  `store_mix.png`, `ab/ab.png`; all were looked at.
- **Stems:** music -22.8 LUFS, sfx -25.7 LUFS, VO -20.2 LUFS (before the mix gains).
- **Reproducible:** a `FORCE=1` rebuild into an empty directory (2026-10-22) gave bit-identical mixes and stems (md5);
  every random choice is seeded.
