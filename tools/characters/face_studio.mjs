// face_studio.mjs BASE_URL OUTDIR id1,id2,... [--views=front,three,profile] [--lights=studio,game] [--size=512]
// Head portraits of cast builds for the face work (docs/CHARACTER_LOOK.md, "Faces"); face_studio.sh calls it.
// BASE_URL is a cast folder the viewer can load (cast2.json + parts, or cast.glb) with anims.glb beside it.
// Every person stands in the rest pose (head level, eyes forward, no idle sway or blink), so the same view of two
// builds is directly comparable. The camera aims between the eye bones (head bone fallback).
//   views:  front (0 deg), three (three-quarter, 35 deg to the person's left), profile (90 deg)
//   lights: studio (neutral: soft white key with a face shadow, fill, rim, grey background)
//           game   (Rain City night: sodium street-lamp key from above right, cyan rim from behind left, wet blue ambient)
// Writes OUTDIR/<id>_<view>_<light>.png and OUTDIR/shots.json (camera, eye positions, triangle counts per id).
/* global window */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
const flag = (n, d) => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const [base, out, idsArg] = pos;
if (!idsArg) { console.log('usage: face_studio.mjs BASE_URL OUTDIR id1,id2 [--views=] [--lights=] [--size=]'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const ids = idsArg.split(',');
const views = flag('views', 'front,three,profile').split(',');
const lights = flag('lights', 'studio,game').split(',');
const size = +flag('size', 512);
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'] });
const p = await (await b.newContext({ viewport: { width: 320, height: 200 } })).newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
await p.goto('http://localhost:8765/tools/cast.html?ids=' + ids[0] + '&cols=1&base=' + encodeURIComponent(base));
await p.waitForFunction('window.LAB_DONE === true', null, { timeout: 600000, polling: 500 });
await p.evaluate(async (S) => {
  const THREE = await import('three');
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const C = await import('/src/human/cast3d.js');
  let SK = null;
  try { SK = await import('/src/human/skin.js'); } catch { /* classic runtime */ }
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(S, S); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const env = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
  const L = {};
  const dir = (c, i) => { const l = new THREE.DirectionalLight(c, i); scene.add(l, l.target); return l; };
  L.key = dir(0xffffff, 1); L.key.castShadow = true; L.key.shadow.mapSize.set(1024, 1024); L.key.shadow.bias = -0.0004; L.key.shadow.normalBias = 0.01;
  Object.assign(L.key.shadow.camera, { left: -0.3, right: 0.3, top: 0.3, bottom: -0.3, near: 0.1, far: 8 });
  L.fill = dir(0xffffff, 1); L.rim = dir(0xffffff, 1);
  L.hemi = new THREE.HemisphereLight(0x000000, 0x000000, 0); scene.add(L.hemi);
  const cam = new THREE.PerspectiveCamera(24, 1, 0.02, 50);
  const set = (l, col, i, pos) => { l.color.set(col); l.intensity = i; l.userData.rel = pos; };
  const LIGHTS = {
    studio() {
      scene.background = new THREE.Color(0x3a3d42); scene.environment = env; scene.environmentIntensity = 0.55;
      set(L.key, 0xfff3e6, 2.5, [0.9, 0.75, 1.6]); set(L.fill, 0xe8eeff, 0.55, [-1.6, 0.2, 1.0]); set(L.rim, 0xffffff, 1.3, [-0.8, 1.2, -1.6]);
      L.hemi.intensity = 0;
    },
    game() {
      scene.background = new THREE.Color(0x0b0f17); scene.environment = env; scene.environmentIntensity = 0.16;
      set(L.key, 0xffbf80, 1.7, [1.3, 1.6, 0.7]); set(L.fill, 0x6a4cff, 0.25, [-1.4, -0.2, 0.8]); set(L.rim, 0x5fd8ff, 2.0, [-1.0, 0.7, -1.4]);
      L.hemi.color.set(0x24344f); L.hemi.groundColor.set(0x0a0c10); L.hemi.intensity = 0.55;
    },
  };
  window.FS = {
    cur: null,
    async load(id) {
      if (this.cur) scene.remove(this.cur.root);
      const pr = C.makePerson(id, { seed: 7 });
      if (SK && SK.look && SK.look.idle) await SK.look.idle();
      scene.add(pr.root);
      const B = pr.bones;
      // rest pose: the template's own node transforms (head level, eyes forward, no idle sway, no blink), so every
      // build is framed the same way (skeleton.pose() is not used: the bind matrices of some builds sit off scale)
      const rest = {};
      for (const k in B) rest[k] = [B[k].position.clone(), B[k].quaternion.clone(), B[k].scale.clone()];
      pr.play('idle', 0); pr.update(0.0001);
      if (pr.mixer) pr.mixer.stopAllAction();
      for (const k in B) { B[k].position.copy(rest[k][0]); B[k].quaternion.copy(rest[k][1]); B[k].scale.copy(rest[k][2]); }
      pr.root.updateMatrixWorld(true);
      const v = n => B[n] && B[n].getWorldPosition(new THREE.Vector3());
      const eL = v('eye_L'), eR = v('eye_R');
      let eyes = eL && eR ? eL.clone().add(eR).multiplyScalar(0.5) : null;
      if (!eyes) { const h = v('head'); eyes = h.add(new THREE.Vector3(0, 0.075, 0.075)); }
      this.cur = pr; this.eyes = eyes;
      // triangles in total and on the face (atlas body mesh, all three corners inside the face box in the rest pose:
      // 7.5 cm either side of the eyes, 13 cm below to 7 cm above them, in front of the ears): the simplifier's share
      let tris = 0, faceTris = 0;
      const pv = new THREE.Vector3();
      pr.root.traverse(o => {
        if (!o.isMesh || !o.visible || !o.geometry.index) return;
        const n = o.geometry.index.count / 3; tris += n;
        if (!o.isSkinnedMesh || /^(gh_|gx_|gp_)/.test(o.name) || o.userData.lod) return;
        const P = o.geometry.attributes.position, I = o.geometry.index.array;
        const inside = i => {
          pv.fromBufferAttribute(P, i);
          if (o.applyBoneTransform) o.applyBoneTransform(i, pv);
          pv.applyMatrix4(o.matrixWorld);
          return Math.abs(pv.x - eyes.x) < 0.075 && pv.y > eyes.y - 0.13 && pv.y < eyes.y + 0.07 && pv.z > eyes.z - 0.05;
        };
        for (let t = 0; t < n; t++) if (inside(I[3 * t]) && inside(I[3 * t + 1]) && inside(I[3 * t + 2])) faceTris++;
      });
      return { eyes: eyes.toArray().map(x => +x.toFixed(4)), eyeBones: !!(eL && eR), tris, faceTris, height: pr.height };
    },
    shot(view, light) {
      LIGHTS[light]();
      const az = { front: 0, three: 0.61, profile: Math.PI / 2 }[view];
      const tgt = this.eyes.clone().add(new THREE.Vector3(0, -0.015, 0));
      const d = 0.72;
      cam.position.set(tgt.x + Math.sin(az) * d, tgt.y + 0.01, tgt.z + Math.cos(az) * d); cam.lookAt(tgt);
      for (const k of ['key', 'fill', 'rim']) {      // lights are placed relative to the face (the person faces +z)
        const [x, y, z] = L[k].userData.rel; L[k].position.set(tgt.x + x, tgt.y + y, tgt.z + z); L[k].target.position.copy(tgt);
      }
      r.render(scene, cam);
      return r.domElement.toDataURL('image/png');
    },
  };
}, size);
const meta = {};
for (const id of ids) {
  const t0 = Date.now();
  try {
    meta[id] = await p.evaluate(id => window.FS.load(id), id);
  } catch (e) { console.log(id, 'LOAD FAILED', e.message.slice(0, 200)); continue; }
  for (const L of lights) for (const v of views) {
    const url = await p.evaluate(([v, L]) => window.FS.shot(v, L), [v, L]);
    fs.writeFileSync(path.join(out, `${id}_${v}_${L}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log(id, ((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(meta[id]));
}
let prev = {};
try { prev = JSON.parse(fs.readFileSync(path.join(out, 'shots.json'), 'utf8')); } catch { /* first run */ }
fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify({ ...prev, ...meta }, null, 1));
await b.close();
