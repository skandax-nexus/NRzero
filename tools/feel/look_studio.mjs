// Character look audit (docs/CHARACTER_LOOK.md): studio captures of cast templates (head and shoulders / waist up /
// full body, three-quarter view) in the page of tools/cast.html, so the cast module instance is shared and the cast
// file loads once. Same lights as the cast viewer (RoomEnvironment 0.6 + warm key + cool rim).
//   node tools/feel/look_studio.mjs <outdir> <id1,id2,...> [size=640] [--shots=head,mid,full,hand]
//        [--light=default,front,side,back,top] (key direction per pass) [--clip=idle] [--t=0.7] [--seq] (head shot every
//        0.25 s of the idle for 4 s: blink / micro-motion check) [--query=k=v] (extra cast.html params, e.g. look=classic)
//        [--life=20] (facial life over 20 s, see below) [--shots=eye] (eyes close-up) [--dbg=oily,red,...] (src/human/skin.js analysis channels) [--apply] (call lookPerson by hand)
/* global window */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path';
const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
const flag = n => { const a = args.find(x => x === '--' + n || x.startsWith('--' + n + '=')); return a ? (a.includes('=') ? a.split('=').slice(1).join('=') : true) : null; };
const [out, idsArg, size = '640'] = pos; fs.mkdirSync(out, { recursive: true });
const ids = idsArg.split(',');
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'] });
const p = await (await b.newContext({ viewport: { width: 300, height: 200 } })).newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:8765/tools/cast.html?ids=' + ids[0] + '&cols=1' + (flag('query') ? '&' + flag('query') : ''));
await p.waitForFunction('window.LAB_DONE === true', null, { timeout: 300000, polling: 500 });
await p.evaluate(async ([S, APPLY]) => {
  const THREE = await import('three');
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const C = await import('/src/human/cast3d.js'); const SK = await import('/src/human/skin.js');
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(S, S); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a2028);
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.6;
  const key = new THREE.DirectionalLight(0xffe6cc, 2.6); scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 1.4); rim.position.set(-3, 2, -2); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  window.ST = { SK, THREE, C, r, scene, key, rim, cam, cur: null,
    async load(id, clip = 'idle', t = 0.7) {
      if (this.cur) scene.remove(this.cur.root);
      const p = C.makePerson(id, { seed: 7 }); if (APPLY && !p.face) SK.lookPerson(p, 7);
      if (SK.look.idle) await SK.look.idle();     // the look's template analysis runs in a worker
      scene.add(p.root); p.play(clip, 0); const a = p.actions[p.current]; if (a) a.time = 0; p.update(t); this.cur = p; return p.height;
    },
    light(mode) { const P = { front: [1.2, 2.2, 3], side: [3.2, 1.6, 0.2], back: [-1.5, 2.0, -3], top: [0.2, 4, 0.6] }[mode] || [2, 3, 3]; key.position.set(...P); key.intensity = 2.6; },
    shot(kind) {
      const p = this.cur, B = p.bones; p.root.updateMatrixWorld(true);
      const v = n => B[n].getWorldPosition(new THREE.Vector3());
      const h = v('head'), hp = v('hips'), hand = B.hand_L ? v('hand_L') : hp;
      const az = 0.38;   // three-quarter view from the person's left-front
      let tgt, d, fov;
      if (kind === 'eye') { const fw = new THREE.Vector3(0, 0, 1).applyQuaternion(p.root.quaternion); tgt = h.clone().add(new THREE.Vector3(0, 0.085, 0)).addScaledVector(fw, 0.07); d = 0.36; fov = 30; }
      else if (kind === 'head') { tgt = h.clone().add(new THREE.Vector3(0, 0.05, 0.03)); d = 0.75; fov = 30; }
      else if (kind === 'hand') { tgt = hand.clone(); tgt.y -= 0.05; d = 0.55; fov = 30; }
      else if (kind === 'mid') { tgt = h.clone().lerp(hp, 0.5); d = 1.75; fov = 34; }
      else { tgt = new THREE.Vector3(hp.x, p.height * 0.52, hp.z); d = 3.3; fov = 34; }
      cam.fov = fov; cam.updateProjectionMatrix();
      cam.position.set(tgt.x + Math.sin(az) * d, tgt.y + (kind === 'full' ? 0.1 : 0.0), tgt.z + Math.cos(az) * d); cam.lookAt(tgt);
      r.render(scene, cam); return r.domElement.toDataURL('image/png');
    } };
}, [+size, !!flag('apply')]);
const shots = (flag('shots') || 'head,mid,full').split(',');
const lights = (flag('light') || 'default').split(',');
for (const id of ids) {
  const t0 = Date.now();
  await p.evaluate(([id, clip, t]) => window.ST.load(id, clip, t), [id, flag('clip') || 'idle', +(flag('t') || 0.7)]);
  const dbgs = flag('dbg') ? String(flag('dbg')).split(',') : [''];
  for (const D of dbgs) {
  if (D) await p.evaluate(([id, clip, t, D]) => { window.ST.SK.look.dbg = D; return window.ST.load(id, clip, t); }, [id, flag('clip') || 'idle', +(flag('t') || 0.7), D]);
  for (const L of lights) {
    await p.evaluate(L => window.ST.light(L), L);
    for (const s of shots) {
      const url = await p.evaluate(s => window.ST.shot(s), s);
      fs.writeFileSync(path.join(out, `${id}_${s}${L === 'default' ? '' : '_' + L}${D ? '_' + D : ''}.png`), Buffer.from(url.split(',')[1], 'base64'));
    }
  }
  }
  if (flag('seq')) {     // idle over time: head shot every 0.25 s for 4 s (blink / micro-motion check)
    for (let i = 0; i < 16; i++) {
      const url = await p.evaluate(async ([id, t]) => { await window.ST.load(id, 'idle', t); return window.ST.shot('head'); }, [id, 0.7 + i * 0.25]);
      fs.writeFileSync(path.join(out, `${id}_seq${String(i).padStart(2, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
    }
  }
  if (flag('life')) {    // facial life on one continuously updated person: --life=<seconds> at 30 fps; the lid closure,
    // gaze and brow of every frame go to <id>_life.json, a head shot every 0.1 s for the first 3 s to <id>_lifeNN.png
    const secs = +flag('life') || 20;
    await p.evaluate(([id]) => window.ST.load(id, 'idle', 0.7), [id]);
    const rec = [];
    for (let f = 0; f < secs * 30; f++) {
      const shoot = f < 90 && f % 3 === 0;
      const r = await p.evaluate(shoot => {
        const c = window.ST.cur; c.update(1 / 30);
        const url = shoot ? window.ST.shot('head') : (window.ST.shot('none'), null);
        const u = c.face && c.face.uniforms; return { url, lid: u ? +u.azEye.value.z.toFixed(3) : null, gx: u ? +u.azEye.value.x.toFixed(3) : null, gy: u ? +u.azEye.value.y.toFixed(3) : null, brow: u ? +u.azExpr.value.x.toFixed(3) : null };
      }, shoot);
      if (r.url) fs.writeFileSync(path.join(out, `${id}_life${String(f / 3).padStart(2, '0')}.png`), Buffer.from(r.url.split(',')[1], 'base64'));
      delete r.url; rec.push(r);
    }
    fs.writeFileSync(path.join(out, `${id}_life.json`), JSON.stringify(rec));
  }
  console.log(id, 'done', ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
await b.close();
