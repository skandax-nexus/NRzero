import * as THREE from 'three';
import { Game } from './core/game.js';
import { CAST } from './story/cast.js';
import { MISSIONS, ROADMAP } from './missions/index.js';
import { chronolith, sky, facadeTextures, rng, Motes } from './world/kit.js';
import { Character } from './core/character.js';
import { enterImmersive, fullscreenAvailable } from './core/touch.js';

const $ = id => document.getElementById(id);
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('afterzero.' + k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('afterzero.' + k, JSON.stringify(v)); } catch {} } };

const game = new Game();
window.__game = game;

// ---------- title scene: the cover image, rendered live ----------
function buildTitleScene() {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x02040a); s.fog = new THREE.FogExp2(0x0a1020, 0.012);
  game.scene = s; game.engine.setScene(s);
  s.environmentIntensity = 0.3;
  s.add(sky(0x050a18, 0x2a4a70, { left: 0xc0602a, sun: 0xff9a40, sunDir: [-0.7, 0.12, -1], stars: 0.8 }));
  s.add(new THREE.HemisphereLight(0x4a5a7a, 0x100808, 0.5));
  const warm = new THREE.DirectionalLight(0xffa860, 2.4); warm.position.set(-30, 10, -40); s.add(warm);
  const cool = new THREE.DirectionalLight(0x7fd0ff, 2.0); cool.position.set(30, 14, -30); s.add(cool);
  const ring = chronolith(2.6, { power: 0.8 }); ring.position.set(0, 9, -26); s.add(ring);
  const glow = new THREE.PointLight(0x9fe8ff, 200, 60, 1.6); glow.position.set(0, 9, -22); s.add(glow);
  // ground of black rock
  const rock = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 80, 80), new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.35, metalness: 0.2 }));
  const p = rock.geometry.attributes.position; const r = rng(3);
  for (let i = 0; i < p.count; i++) p.setZ(i, (r() - 0.5) * 0.6 + Math.max(0, Math.abs(p.getX(i)) - 8) * 0.08 * r());
  rock.geometry.computeVertexNormals(); rock.rotation.x = -Math.PI / 2; s.add(rock);
  // left: ancient towers (warm); right: future spires (cool)
  const R = rng(9);
  for (let k = 0; k < 18; k++) {
    const left = k < 9, h = 10 + R() * 30, x = (left ? -1 : 1) * (14 + R() * 40), z = -40 - R() * 60;
    const mat = left ? new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.9, emissive: 0x2a1408, emissiveIntensity: 0.4 })
      : new THREE.MeshPhysicalMaterial({ color: 0x1a2430, metalness: 0.9, roughness: 0.15, emissiveMap: facadeTextures(k % 6, 'glass').emissive, emissive: 0x9fdfff, emissiveIntensity: 0.8 });
    const geo = left ? new THREE.CylinderGeometry(1.5 + R() * 2, 3 + R() * 3, h, 8) : new THREE.CylinderGeometry(0.4 + R(), 2.5 + R() * 2, h, 6);
    const m = new THREE.Mesh(geo, mat); m.position.set(x, h / 2, z); s.add(m);
    if (left) { const dome = new THREE.Mesh(new THREE.SphereGeometry(2 + R() * 2, 16, 8, 0, 7, 0, Math.PI / 2), mat); dome.position.set(x, h, z); s.add(dome); }
  }
  // floating islands (future)
  for (let k = 0; k < 6; k++) { const isl = new THREE.Mesh(new THREE.ConeGeometry(3 + R() * 4, 6, 7), new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.9 })); isl.rotation.x = Math.PI; isl.position.set(20 + R() * 40, 18 + R() * 20, -50 - R() * 40); s.add(isl); }
  const kai = new Character(CAST.kai.look); kai.root.position.set(0, 0, -3); kai.root.rotation.y = Math.PI; s.add(kai.root);
  const motes = new Motes(400, [-20, 0, -40, 20, 20, 5], 0xffd9a0, 0.12, 0.4); s.add(motes.mesh);
  const cam = game.engine.camera; cam.fov = 50; cam.updateProjectionMatrix();
  game.titleUpdate = (dt, t) => {
    ring.userData.update(t); kai.update(dt); motes.update(dt);
    cam.position.set(Math.sin(t * 0.07) * 1.5, 1.5 + Math.sin(t * 0.11) * 0.2, 4.2); cam.lookAt(0, 4.5, -20);
  };
}

function showTitle() {
  game.abort(); game.audio.allBeds?.(0);
  buildTitleScene();
  $('title').classList.remove('hidden');
  $('btn-continue').classList.toggle('hidden', !store.get('chapter', 0));
  game.ui.fade(0, 1200);
  if (game.audio.ctx) game.audio.setTheme('title');
}

async function startAt(i) {
  game.audio.init(); game.audio.setVolume(+$('vol').value);
  await game.ui.fade(1, 800);
  game.titleUpdate = null;
  $('title').classList.add('hidden'); $('panel').classList.add('hidden');
  game.ui.evidence = store.get('evidence', []);
  game.paused = false;
  game.input.lock();
  await game.runMissions(MISSIONS, i, idx => { store.set('chapter', Math.max(store.get('chapter', 0), idx)); store.set('last', idx); });
  if (game.running) { store.set('evidence', game.ui.evidence); await finale(); }
}

async function finale() {
  // End-of-slice card + roadmap of remaining acts.
  game.ui.show('hud', false); game.input.unlock();
  await game.ui.chapterCard('VERSION 17', 'To Be Continued', 'The Chronolith has been anticipating you, Kai.', 5000);
  game.running = false;
  showTitle(); openPanel('chapters');
}

function openPanel(kind) {
  const body = $('panel-body'); $('panel').classList.remove('hidden');
  if (kind === 'dossier') {
    const ids = ['kai', 'mira', 'witness', 'sera', 'rook', 'niko', 'tala', 'iven', 'jun', 'hale'];
    body.innerHTML = '<h2>DOSSIER</h2><div class="dossier">' + ids.map(id => { const c = CAST[id]; return `<div class="dos"><img src="${game.ui.portraits[id] || ''}" alt=""><div><h3>${c.name}</h3><h4>${c.role}</h4><p>${c.bio}</p></div></div>`; }).join('') + '</div>';
  } else if (kind === 'controls' && game.touch.enabled) {
    body.innerHTML = `<h2>CONTROLS</h2><div class="controls">
      <span><b class="tk">LEFT THUMB</b></span><span>Move — the stick appears where your thumb lands. Push to the rim to sprint</span>
      <span><b class="tk">RIGHT THUMB</b></span><span>Drag anywhere on the right to look around</span>
      <span><b class="tk">HAND</b></span><span>Interact — appears when something is in reach; keep holding when it shows HOLD</span>
      <span><b class="tk">JUMP · CROUCH</b></span><span>Jump · crouch / sneak (drones see less of you)</span>
      <span><b class="tk">EYE</b></span><span>Residue Vision — see temporal echoes (from Mission 2)</span>
      <span><b class="tk">2026 · 2049 · 2196</b></span><span>Temporal State Switch (from Mission 3) — costs Chronolith stability</span>
      <span><b class="tk">CASE BOARD · PAUSE</b></span><span>Top-right corner</span>
      <span><b class="tk">TAP</b></span><span>Advance dialogue; choices are buttons</span></div>`;
  } else if (kind === 'controls') {
    body.innerHTML = `<h2>CONTROLS</h2><div class="controls">
      <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Move</span>
      <span><kbd>Mouse</kbd></span><span>Look (click the game to capture the mouse)</span>
      <span><kbd>Shift</kbd></span><span>Sprint</span>
      <span><kbd>C</kbd></span><span>Crouch / sneak — drones see less of you</span>
      <span><kbd>Space</kbd></span><span>Jump · advance dialogue</span>
      <span><kbd>E</kbd></span><span>Interact (hold when prompted)</span>
      <span><kbd>F</kbd></span><span>Residue Vision — see temporal echoes (from Mission 2)</span>
      <span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> / <kbd>Q</kbd></span><span>Temporal State Switch (from Mission 3) — costs Chronolith stability</span>
      <span><kbd>J</kbd></span><span>Case board — evidence you have found</span>
      <span><kbd>Esc</kbd></span><span>Pause</span>
      <span><kbd>Wheel</kbd></span><span>Camera distance</span></div>`;
  } else if (kind === 'chapters') {
    const unlocked = store.get('chapter', 0);
    body.innerHTML = '<h2>CHAPTERS</h2><div class="chapters">' + MISSIONS.map((m, i) =>
      `<div class="chap ${i > unlocked ? 'locked' : ''}" data-i="${i}"><div class="n">${i + 1}</div><div><h3>${m.title.toUpperCase()}</h3><p>${m.act} — ${m.sub}</p></div></div>`).join('') +
      ROADMAP.map(r => `<div class="chap future"><div class="n">${r.n}</div><div><h3>${r.title.toUpperCase()}</h3><p>${r.act} — ${r.text}</p></div></div>`).join('') + '</div>';
    body.querySelectorAll('.chap[data-i]').forEach(el => el.addEventListener('click', () => { const i = +el.dataset.i; if (i <= unlocked) { immersive(); startAt(i); } }));
  }
}

// ---------- menus ----------
// Phones: starting play goes fullscreen + landscape (must happen inside the tap itself).
function immersive() { if (game.touch.enabled) enterImmersive(); }

$('menu').addEventListener('click', e => {
  const act = e.target.dataset.act; if (!act) return;
  game.audio.init(); game.audio.setTheme('title');
  if (act === 'new') { immersive(); store.set('evidence', []); startAt(0); }
  else if (act === 'continue') { immersive(); startAt(store.get('last', 0)); }
  else openPanel(act);
});
$('panel-close').addEventListener('click', () => $('panel').classList.add('hidden'));
$('pause').addEventListener('click', e => {
  const p = e.target.dataset.p; if (!p) return;
  if (p === 'resume') game.pause(false);
  if (p === 'journal') { game.ui.show('pause', false); game.toggleJournal(true); }
  if (p === 'restart') { game.pause(false); game.restoreCheckpoint(); }
  if (p === 'controls') { $('title').classList.remove('hidden'); $('menu').style.visibility = 'hidden'; openPanel('controls'); const close = () => { $('title').classList.add('hidden'); $('menu').style.visibility = ''; $('panel-close').removeEventListener('click', close); }; $('panel-close').addEventListener('click', close); }
  if (p === 'quit') { store.set('evidence', game.ui.evidence); game.ui.fade(1, 600).then(showTitle); }
  if (p === 'fullscreen') enterImmersive();
});
$('vol').addEventListener('input', e => game.audio.setVolume(+e.target.value));
// Graphics: 'auto' picks the tier for this device (desktop: high; phones: medium or low + adaptive resolution).
function applyGfx(v) {
  if (![...$('gfx').options].some(o => o.value === v)) v = 'auto';
  $('gfx').value = v;
  game.engine.setQuality(v === 'auto' ? game.engine.device.tier : v, { auto: v === 'auto' });
}
$('gfx').addEventListener('change', e => { applyGfx(e.target.value); store.set('gfx', e.target.value); });
$('look-sens').value = game.touch.sensitivity;
$('look-sens').addEventListener('input', e => game.touch.setSensitivity(+e.target.value));
$('haptics').checked = game.touch.haptics;
$('haptics').addEventListener('change', e => game.touch.setHaptics(e.target.checked));
$('btn-fullscreen').classList.toggle('hidden', !fullscreenAvailable() || window.self !== window.top);
$('journal').addEventListener('click', () => game.toggleJournal(false));

// ---------- boot ----------
(async () => {
  applyGfx(new URLSearchParams(location.search).get('gfx') || store.get('gfx', 'auto'));
  registerServiceWorker();
  await new Promise(r => setTimeout(r, 50));
  await game.init();
  game.start();
  game.paused = true; // world loop idle until a mission starts
  $('loading').classList.add('done');
  showTitle();
  const params = new URLSearchParams(location.search);
  if (params.has('m')) { game.audio.init(); startAt(+params.get('m')); }
})();

// ---------- offline play (PWA) ----------
// Only on a real https origin as a top-level page: never inside iframes / sandboxes (artifact previews),
// native shells (Capacitor serves files itself) or the localhost dev server (stale caches while editing;
// add ?sw=1 to test it there).
function registerServiceWorker() {
  try {
    const nav = window.navigator, local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (!('serviceWorker' in nav) || !window.isSecureContext || !/^https?:$/.test(location.protocol)) return;
    if (window.self !== window.top || window.Capacitor || (local && !new URLSearchParams(location.search).has('sw'))) return;
    nav.serviceWorker.register('sw.js').catch(() => {});
  } catch { /* sandboxed: no service worker */ }
}
