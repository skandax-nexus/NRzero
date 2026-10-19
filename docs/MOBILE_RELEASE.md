# AFTERZERO on phones: testing and store release

AFTERZERO runs on phones and tablets in the browser, installs as a PWA (Progressive Web App) that works offline,
and ships to Google Play and the App Store through a Capacitor wrapper. This document covers
how to try it on a phone, how to host it, and how to build, sign and submit the store apps.

## 1. What the mobile build includes

| Area | Where | Notes |
|---|---|---|
| Touch controls | `src/core/touch.js`, `styles.css` | Floating left stick (push to the rim to sprint), right-thumb drag to look, contextual HAND button that shows the prompt (with a hold ring for hold actions), JUMP, CROUCH, EYE (Residue Vision, once unlocked), era buttons (once Temporal Switching unlocks, in the HUD era colours), CASE BOARD, PAUSE. Multi-touch. Haptics through `navigator.vibrate` where it exists (not on iOS Safari). |
| Device detection | `touch.js`, `engine.js` | Touch UI turns on for touch-first devices and hides again when a keyboard is used. The quality tier comes from the device class, `deviceMemory`, core count and GPU name. |
| Landscape | `index.html` (`#rotate`), `styles.css` | Portrait shows a "rotate your device" screen and pauses play. Tapping Begin requests fullscreen and a landscape orientation lock where the browser supports them; a refusal is handled. |
| Safe areas | `styles.css` | `env(safe-area-inset-*)` (or Capacitor's `--safe-area-inset-*`) on every edge element. |
| Page guards | `styles.css`, `touch.js` | No pinch or double-tap zoom, scrolling, rubber-band bounce, text selection, long-press callouts or tap highlights. Scrollable panels keep `pan-y`. |
| Audio | `game.js` | The AudioContext is created or resumed on the first real gesture (touchend, click or key). Hiding the app suspends audio and pauses the game. |
| Performance | `engine.js` | `high` (desktop, unchanged), `medium` and `low` tiers, plus adaptive resolution (see section 3). |
| PWA | `manifest.webmanifest`, `sw.js`, `icons/` | Installable, fullscreen, landscape, works offline. |
| Store apps | `package.json`, `capacitor.config.json`, `scripts/build-www.mjs` | Capacitor 8 (Android + iOS). |

URL switches for testing (these can be combined):

| Switch | Effect |
|---|---|
| `?touch=1` / `?touch=0` | Force the touch UI on (desktop testing with a mouse) or off (a tablet with a keyboard) |
| `?gfx=auto\|high\|medium\|low` | Quality tier (default `auto`, also in Pause → Graphics) |
| `?adaptive=1` / `?adaptive=0` | Force adaptive resolution on or off. It is off by default under automation (`navigator.webdriver`), so test screenshots stay sharp. |
| `?sw=1` | Allow the service worker on `localhost` (it is skipped there by default so edits are never served stale) |
| `?m=0..3` | Jump to a mission |

## 2. Try it on a phone

### Same Wi-Fi (fastest)
```sh
npm install                      # once: http-server and the Capacitor CLI (exact pinned versions)
npm start                        # = http-server -p 8765 -c-1 .   (without installing: npx http-server@14.1.1 -p 8765 -c-1 .)
# find the computer's LAN address: ipconfig getifaddr en0 (macOS) / hostname -I (Linux) / ipconfig (Windows)
# on the phone, open  http://<lan-ip>:8765/
```
Plain-HTTP LAN pages cannot use a service worker (no offline mode) and iOS will not install them as a full PWA.
Everything else works. On Android Chrome, Begin goes fullscreen and locks landscape. On iPhone Safari,
which has no element fullscreen, rotate the phone to landscape or use the hosted build below with
*Add to Home Screen*.

### Hosted over HTTPS (full PWA)
```sh
npm run build:web                # writes www/ with a stamped, cache-first service worker
npm run serve:www                # optional: build, then serve www/ at http://localhost:8766/ to smoke-test it
```
The build fails (and leaves no `www/`) when a module import, an import-map target, a file linked from
`index.html` or a manifest icon is missing, so a broken bundle never reaches a phone. `www/` is a build
output and is ignored by git. To test the release service worker on localhost, open `http://localhost:8766/?sw=1`.
Deploy the **contents of `www/`** to any static HTTPS host (GitHub Pages, Netlify, Cloudflare Pages,
Firebase Hosting, S3 + CloudFront). Then on the phone:
- Android Chrome: menu → *Install app* (or the install banner).
- iPhone/iPad Safari: Share → *Add to Home Screen*. It launches fullscreen with the status bar hidden.

Host settings:
- Serve `sw.js` with `Cache-Control: no-cache` so browsers pick up new releases right away.
- Serve `manifest.webmanifest` as `application/manifest+json` (most hosts already do).
- Build again for every release. The service worker version is a hash of the files, so a new build
  replaces the old offline cache on the next visit.

Deploying the repository folder without building also works. The unbuilt `sw.js` (version
`afterzero-dev`) is network-first, so it never serves stale code. It still caches what it loads for offline play.

### Debugging on the device
- Android: enable USB debugging, connect, then open `chrome://inspect` on the desktop.
- iOS: Settings → Safari → Advanced → Web Inspector, connect to a Mac, then Safari → Develop → *your iPhone*.
- Desktop emulation: Chrome DevTools device toolbar in landscape (e.g. 844×390, 667×375), or `?touch=1`.
- Automated: `node tools/drive.mjs "<url>?m=0&dtcap=0.25&gfx=low&auto" tools/tests/m1.json 844 390 --mobile --outdir=<dir>`.

## 3. Performance tiers

| | high (desktop default) | medium (phones) | low (low-end phones) |
|---|---|---|---|
| Pixel ratio cap | 1.75 | 1.5 (desktop: 1) | 1.0 (desktop: 0.75) |
| Adaptive resolution | off | 0.6–1.0 × cap, holds 30+ fps | 0.6–1.0 × cap |
| Shadows | PCF soft, as authored | PCF, maps capped at 1024² | off |
| Bloom | full | half resolution | off |
| Post | Output pass + cinema pass | fused single pass, 1 tap unless an effect runs | same as medium |
| Canvas MSAA | on (as before) | off (the scene renders through composer targets anyway) | off |

`auto` picks `high` on desktop. On phones and tablets it picks `medium`, or `low` when the device reports at most
3 GB of memory, has 4 or fewer cores (Android), or has a known entry-level GPU (Adreno 3xx–5xx/610/612,
Mali-4xx/T/G31/G51/G52/G57, PowerVR, software renderers).

Adaptive resolution measures the median frame time each second. Below about 28 fps it lowers the render
scale by 0.1–0.15. Above about 50 fps for two seconds it raises it by 0.05. A phone in Low Power Mode
(30 fps cap) is left alone. If a raise makes the frame rate drop again, the scale steps back and that
scale is not tried again for 30 s (doubling up to 4 min on repeated failures), so the resolution never
see-saws. Gaps over a second (app in the background) start a fresh measurement.

For world and character code:
```js
game.onQuality((quality, s) => { /* s.hints.characterDetail, crowd, drawDistance, maxLights, particles */ });
window.addEventListener('afterzero:quality', e => e.detail.quality);
game.engine.quality;          // 'high' | 'medium' | 'low'
game.engine.stats;            // { sceneCalls, sceneTriangles, calls, triangles, fps, frameMs, pixelRatio, scale }
```
`renderer.info.render` now counts the whole frame (shadow maps, scene and post), not just the last pass.
Phone scene budget (ART_SPEC §4): ≤ 250 draw calls, ≤ 700k triangles, ≤ 6 dynamic lights, ≤ 1 shadow-casting light.

## 4. Store builds with Capacitor

Prerequisites: Node 22+, and for Android, Android Studio (current stable, with its bundled JDK and the
Android SDK it proposes). For iOS: a Mac with current Xcode and an Apple Developer Program membership.

```sh
npm install                      # Capacitor CLI/core/android/ios, pinned to exact versions
npm run cap:add:android          # once: builds www/, creates android/, locks landscape
npm run cap:add:ios              # once (on a Mac): creates ios/, landscape + status bar hidden
npm run cap:android              # every release: rebuild www/, cap sync, open Android Studio
npm run cap:ios                  # every release: rebuild www/, cap sync, open Xcode
```
`capacitor.config.json` sets the app id `nexus.skandax.afterzero`, the name, `webDir: www`, the dark
background, no WebView zoom or scroll, and `SystemBars.hidden` (fullscreen). `scripts/build-www.mjs
--patch-native` (run by the scripts above) sets `android:screenOrientation="sensorLandscape"` on
`MainActivity`. In `Info.plist` it sets landscape-only orientations, `UIStatusBarHidden`,
`UIRequiresFullScreen`. It is safe to run repeatedly. `www/` is regenerated on every build and is
git-ignored. Commit `android/` and `ios/` once they exist: the native projects hold signing settings and the
icon assets.

### Android (Google Play)
1. **Icons.** In Android Studio: `app/res` → New → *Image Asset* → Launcher Icons (Adaptive). Use
   `icons/icon-maskable-512.png` as the foreground on a `#02040a` background. Use `icons/store/play-icon-512.png` for the Play listing.
2. **Version.** In `android/app/build.gradle`, raise `versionCode` (an integer, +1 every upload) and set `versionName` (e.g. `0.1.0`).
3. **Upload key** (once; keep it and its passwords outside the repository):
   ```sh
   keytool -genkey -v -keystore afterzero-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias afterzero
   ```
4. **Signed bundle.** In Android Studio: Build → *Generate Signed App Bundle / APK* → **Android App Bundle**
   → choose the keystore → `release`. The output is `android/app/release/app-release.aab`.
   From the command line instead:
   `npx cap build android --keystorepath ../afterzero-upload.jks --keystorepass … --keystorealias afterzero --keystorealiaspass … --androidreleasetype AAB`.
5. **Play Console.** Create the app (Game, Free), keep **Play App Signing** on (Google holds the app signing
   key and you keep the upload key), then upload the AAB to **Internal testing** and install it from the tester link.
   New personal developer accounts must run a closed test before production access. At the time of writing
   that means 12 testers for 14 days; check the current rule in Play Console.
6. Complete *App content* (privacy policy, ads: none, data safety, content rating, target audience)
   and the store listing (section 6). Promote the build to production.

### iOS (App Store / TestFlight)
1. `npm run cap:ios` opens the iOS project in Xcode. Capacitor 8 uses Swift Package Manager by default, so CocoaPods is not needed.
2. Target **App** → *Signing & Capabilities*: choose your Team. Set the bundle identifier to
   `nexus.skandax.afterzero` and leave *Automatically manage signing* on.
3. *General*: set the Display Name `AFTERZERO`, Version (`0.1.0`) and Build (+1 every upload). Check that the
   iPhone and iPad orientations are both landscape only (already patched). *Requires full screen* is on.
4. `Assets.xcassets` → **AppIcon**: drop in `icons/store/app-store-icon-1024.png` (single-size, opaque, no alpha).
5. `Info.plist`: add `ITSAppUsesNonExemptEncryption` = `NO`. The game uses no encryption beyond HTTPS.
6. Choose *Any iOS Device (arm64)* → Product → **Archive** → Organizer → *Distribute App* → *App Store
   Connect* → Upload.
7. In App Store Connect, create the app record with the same bundle id. When processing finishes, the build
   appears in **TestFlight**: add internal testers (up to 100, no review), or external testers (needs Beta
   App Review). Then attach the build to a version, complete the listing (section 6) and *Submit for Review*.

## 5. Release QA (on real devices)
Test a matrix of at least one mid-range Android (Adreno 6xx or Mali-G7x), one low-end Android
(2–3 GB RAM), an iPhone 12-class phone, a notched iPhone in both landscape directions, and an iPad.
- Touch: move, look and tap at once; sprint at the rim; hold the HAND button until the ring fills; crouch
  toggle; jump; Residue Vision (Mission 2+); era buttons (Mission 3); case board; pause; dialogue taps
  and choices; the mural puzzle (Mission 4); scrolling in the Chapters, Dossier and Case Board panels.
- Layout: nothing under the notch or home indicator; text readable at 667×375; rotate to portrait and back
  (the game pauses, then resumes from the menu).
- Lifecycle: home button, incoming call or lock screen, then return. The game must be paused and silent.
  First tap starts the audio, including with the iOS silent switch off.
- Performance: 30+ fps after a minute of play (watch for heat), and no audio crackle.
- Offline (PWA build): load once, enable airplane mode, relaunch from the home screen, and play.
- Saves: progress and settings survive an app restart (stored in `localStorage` on the device).

## 6. Store listing checklist

**Text**
- Name: AFTERZERO. Subtitle (iOS, 30 chars): "The Last Version of Earth". Google short description (80 chars).
- Full description (max 4000 chars), keywords (iOS, 100 chars), category **Games → Adventure**, support e-mail, marketing URL (optional).
- **Privacy policy URL**: both stores require one, even when no data is collected. It can be a short static page.

**Graphics**
| Store | Asset | Size |
|---|---|---|
| Google Play | App icon | 512×512 PNG, `icons/store/play-icon-512.png` |
| Google Play | Feature graphic | 1024×500, `icons/store/feature-graphic-1024x500.png` |
| Google Play | Phone screenshots | 2–8, 16:9 landscape, e.g. 1920×1080 (each side 320–3840 px) |
| Google Play | Tablet screenshots | 7" and 10", e.g. 1920×1200 / 2560×1600 (recommended, needed for tablet promotion) |
| App Store | App icon | 1024×1024, opaque, `icons/store/app-store-icon-1024.png` |
| App Store | iPhone 6.9" screenshots | 2868×1320 landscape (or 6.5": 2688×1242), 1–10 |
| App Store | iPad 13" screenshots | 2752×2064 landscape, 1–10 (required while the app runs on iPad) |
| Both | App preview / promo video | optional, 15–30 s, captured from gameplay |

Capture screenshots on devices or simulators, or with the headless helper at an exact size. For example:
`node tools/shoot.mjs "http://localhost:8765/index.html?m=0&gfx=high&touch=1" shot.png 1920 1080 --until="__game.control" --wait=3000`.
Use real gameplay frames with the touch UI visible on phone shots.

**Privacy and data**
- The game collects **no data**: no accounts, analytics, ads, tracking or in-app purchases.
  Progress and settings stay on the device (`localStorage`).
- Google Play *Data safety*: "No data collected", "No data shared".
- App Store privacy label: **Data Not Collected**.
- The only network access is the Google Fonts stylesheet and fonts, and the game falls back to system fonts offline.
  If you want zero third-party requests in the native apps, bundle the three OFL fonts locally.

**Content rating** (IARC questionnaire in Play Console; age rating questionnaire in App Store Connect)
- Answer from the actual content: peril, surveillance drones, a hostile machine, falls and a train accident
  rescue. No blood or gore, no sexual content, no drugs, no gambling, no user-generated content and no chat.
  Expect roughly PEGI 7–12 / ESRB E10+ / Apple 9+, but the questionnaire decides.
- Ads: none. In-app purchases: none. Target audience: 13+ is a safe choice for the story's themes.

## 7. Troubleshooting
- *No sound on iPhone*: check the ringer switch. WebAudio follows it. The first tap starts the audio.
- *Stuck in portrait in the app*: run `node scripts/build-www.mjs --patch-native` after `cap add`, then rebuild.
- *Old version after a deploy*: deploy `www/` from `npm run build:web` (new SW version), serve `sw.js` with `no-cache`.
- *Black bars or content under the notch on Android*: keep `viewport-fit=cover` (in `index.html`) and
  `SystemBars.insetsHandling: "css"` (in `capacitor.config.json`).
