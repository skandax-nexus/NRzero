// head_a eyes: eyeball with a recessed iris (real parallax under the cornea), a wet corneal/conjunctival
// shell for catchlights, lid occlusion shading that follows the gaze, a tear line on the lower lid and
// the caruncle. Iris and sclera textures are drawn procedurally (Canvas 2D or typed arrays). Our own art.
import * as THREE from 'three';
import { mulberry32, clamp } from './head_a_util.js';

const GEO_CACHE = new Map();
const TEX_CACHE = new Map();
const MM = 0.001;

function makeCanvas(w, h) {
  if (typeof document !== 'undefined' && document.createElement) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const OC = globalThis.OffscreenCanvas;
  return OC ? new OC(w, h) : null;
}

// eyeball: iris cone + sclera sphere in eye-local space (+z = gaze), polar UV (iris fills r_uv < 0.25)
export function eyeballGeometry(R, detail) {
  const key = R.toFixed(6) + detail;
  let g = GEO_CACHE.get(key);
  if (g) return g;
  const nP = detail === 'high' ? 40 : detail === 'medium' ? 24 : 12;
  const rI = 5.9 * MM * (R / (12 * MM)), thL = Math.asin(Math.min(0.95, rI / R)), zL = R * Math.cos(thL);
  const rings = [];
  const irisR = detail === 'low' ? [0, 0.35, 0.7, 1] : [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.82, 0.92, 1];
  for (const f of irisR) rings.push({ rho: f * rI, z: zL + 0.30 * MM * (1 - f) * (1 - f * 0.4) - 0.05 * MM * f, uvr: 0.25 * f });
  const nS = detail === 'high' ? 12 : detail === 'medium' ? 7 : 4, thMax = 150 * Math.PI / 180;
  for (let k = 1; k <= nS; k++) { const f = Math.pow(k / nS, 1.25), th = thL + (thMax - thL) * f; rings.push({ rho: R * Math.sin(th), z: R * Math.cos(th), uvr: 0.25 + 0.25 * f }); }
  const pos = [], uv = [], idx = [];
  pos.push(0, 0, rings[0].z); uv.push(0.5, 0.5);
  for (let r = 1; r < rings.length; r++) for (let m = 0; m <= nP; m++) {
    const a = (m / nP) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    pos.push(rings[r].rho * c, rings[r].rho * s, rings[r].z); uv.push(0.5 + rings[r].uvr * c, 0.5 + rings[r].uvr * s);
  }
  for (let m = 0; m < nP; m++) idx.push(0, 1 + m, 2 + m);
  for (let r = 1; r < rings.length - 1; r++) {
    const a0 = 1 + (r - 1) * (nP + 1), a1 = 1 + r * (nP + 1);
    for (let m = 0; m < nP; m++) idx.push(a0 + m, a1 + m, a1 + m + 1, a0 + m, a1 + m + 1, a0 + m + 1);
  }
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the iris normals point forward (flat-ish disc), the sclera normals radially
  const n = g.getAttribute('normal');
  for (let i = 0; i < n.count; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const rho = Math.hypot(x, y);
    if (rho <= rI * 1.001 && z >= zL - 1e-6) { const t = rho / rI; n.setXYZ(i, x / rI * 0.25 * t, y / rI * 0.25 * t, 1); }
    else n.setXYZ(i, x / R, y / R, z / R);
  }
  for (let i = 0; i < n.count; i++) { const v = new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i)).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  g.userData = { rI, zL };
  GEO_CACHE.set(key, g);
  return g;
}

// wet shell: cornea dome over the iris joined to a thin film over the sclera
export function wetShellGeometry(R, detail) {
  const key = 'w' + R.toFixed(6) + detail;
  let g = GEO_CACHE.get(key);
  if (g) return g;
  const nP = detail === 'high' ? 40 : 20;
  const rI = 5.9 * MM * (R / (12 * MM)), Rc = 7.8 * MM * (R / (12 * MM));
  const thL = Math.asin(rI / R), zL = R * Math.cos(thL), zc = zL - Math.sqrt(Rc * Rc - rI * rI);
  const ths = [];
  const nT = detail === 'high' ? 18 : 9;
  for (let k = 0; k <= nT; k++) ths.push((k / nT) * 78 * Math.PI / 180);
  const pos = [], idx = [];
  const rad = (th) => { // radius along direction th from the eyeball centre: max(sphere film, cornea dome), smooth
    const film = R + 0.06 * MM;
    // ray from origin at angle th intersecting the cornea sphere (centre (0,0,zc), radius Rc)
    const c = Math.cos(th), b = zc * c, disc = b * b - (zc * zc - Rc * Rc);
    const dome = disc > 0 ? b + Math.sqrt(disc) : 0;
    const k = 0.25 * MM, h = clamp(0.5 + 0.5 * (dome - film) / k, 0, 1);
    return film + (dome - film) * h + k * h * (1 - h);
  };
  pos.push(0, 0, rad(0));
  for (let r = 1; r < ths.length; r++) for (let m = 0; m <= nP; m++) {
    const a = (m / nP) * Math.PI * 2, rr = rad(ths[r]);
    pos.push(rr * Math.sin(ths[r]) * Math.cos(a), rr * Math.sin(ths[r]) * Math.sin(a), rr * Math.cos(ths[r]));
  }
  for (let m = 0; m < nP; m++) idx.push(0, 1 + m, 2 + m);
  for (let r = 1; r < ths.length - 1; r++) {
    const a0 = 1 + (r - 1) * (nP + 1), a1 = 1 + r * (nP + 1);
    for (let m = 0; m < nP; m++) idx.push(a0 + m, a1 + m, a1 + m + 1, a0 + m, a1 + m + 1, a0 + m + 1);
  }
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  GEO_CACHE.set(key, g);
  return g;
}

const lin = (c) => Math.round(Math.max(0, Math.min(255, c)));
function hexRGB(h) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255]; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
const css = (c, a = 1) => `rgba(${lin(c[0])},${lin(c[1])},${lin(c[2])},${a})`;

// iris + sclera texture (polar layout matching eyeballGeometry)
export function eyeTexture(eyeColor, seed, size) {
  const key = eyeColor + ':' + seed + ':' + size;
  let t = TEX_CACHE.get(key);
  if (t) return t;
  const cv = makeCanvas(size, size);
  const R = mulberry32((seed * 7919 + 13) >>> 0);
  const base = hexRGB(eyeColor);
  const lum = (base[0] * 0.3 + base[1] * 0.59 + base[2] * 0.11) / 255;
  const S = size, C = S / 2;
  if (cv) {
    const g = cv.getContext('2d');
    // sclera: warm ivory, greyer and pinker toward the back, faint veins converging on the limbus
    const sg = g.createRadialGradient(C, C, S * 0.25, C, C, S * 0.5);
    sg.addColorStop(0, 'rgb(226,218,206)'); sg.addColorStop(0.35, 'rgb(214,203,192)'); sg.addColorStop(0.75, 'rgb(196,170,160)'); sg.addColorStop(1, 'rgb(160,120,112)');
    g.fillStyle = sg; g.fillRect(0, 0, S, S);
    g.lineCap = 'round';
    const nV = 26;
    for (let k = 0; k < nV; k++) {
      // veins come mostly from the canthi (left / right of the eye)
      const side = R() < 0.5 ? 0 : Math.PI;
      let a = side + (R() - 0.5) * 1.6, r = 0.5 * S;
      g.beginPath(); g.moveTo(C + Math.cos(a) * r, C + Math.sin(a) * r);
      const w = 0.25 + R() * 0.9;
      const end = 0.27 + R() * 0.12;
      while (r > end * S) { r -= S * 0.012; a += (R() - 0.5) * 0.09; g.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r); }
      g.strokeStyle = `rgba(${150 + R() * 40},${40 + R() * 25},${40 + R() * 20},${0.10 + R() * 0.16})`; g.lineWidth = w * S / 512 * 1.4; g.stroke();
    }
    // iris
    const rI = S * 0.25;
    const outer = mix(base, [base[0] * 0.55, base[1] * 0.55, base[2] * 0.6], 0.6);
    const inner = lum > 0.25 ? mix(base, [190, 150, 80], 0.35) : mix(base, [120, 75, 35], 0.45);
    const ig = g.createRadialGradient(C, C, rI * 0.18, C, C, rI);
    ig.addColorStop(0, css(inner)); ig.addColorStop(0.42, css(mix(inner, base, 0.6))); ig.addColorStop(0.55, css(base)); ig.addColorStop(0.9, css(outer)); ig.addColorStop(1, css(mix(outer, [20, 18, 18], 0.5)));
    g.fillStyle = ig; g.beginPath(); g.arc(C, C, rI, 0, Math.PI * 2); g.fill();
    // radial fibres (light and dark), slightly wavy
    const nF = Math.round(S * 0.9);
    for (let k = 0; k < nF; k++) {
      const a0 = R() * Math.PI * 2, r0 = rI * (0.2 + R() * 0.15), r1 = rI * (0.55 + R() * 0.45);
      const light = R() < 0.5;
      const col = light ? mix(base, [235, 215, 175], 0.35 + R() * 0.3) : mix(base, [10, 8, 6], 0.4 + R() * 0.4);
      g.strokeStyle = css(col, 0.10 + R() * 0.22); g.lineWidth = (0.4 + R() * 0.9) * S / 512;
      g.beginPath();
      const steps = 6;
      for (let q = 0; q <= steps; q++) { const f = q / steps, r = r0 + (r1 - r0) * f, a = a0 + Math.sin(f * 3 + a0 * 5) * 0.03; if (q) g.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r); else g.moveTo(C + Math.cos(a) * r, C + Math.sin(a) * r); }
      g.stroke();
    }
    // crypts (dark lacunae between fibres)
    for (let k = 0; k < 40; k++) {
      const a = R() * Math.PI * 2, r = rI * (0.4 + R() * 0.45), w = rI * (0.025 + R() * 0.05), h = rI * (0.06 + R() * 0.12);
      g.save(); g.translate(C + Math.cos(a) * r, C + Math.sin(a) * r); g.rotate(a);
      g.fillStyle = css(mix(base, [5, 4, 3], 0.65), 0.18 + R() * 0.2); g.beginPath(); g.ellipse(0, 0, h, w, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    // collarette: an irregular light ring around the pupil zone
    g.strokeStyle = css(mix(inner, [230, 200, 150], 0.3), 0.45); g.lineWidth = rI * 0.045;
    g.beginPath();
    for (let q = 0; q <= 72; q++) { const a = q / 72 * Math.PI * 2, r = rI * (0.4 + 0.035 * Math.sin(a * 7 + seed) + 0.02 * Math.sin(a * 13)); if (q) g.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r); else g.moveTo(C + Math.cos(a) * r, C + Math.sin(a) * r); }
    g.closePath(); g.stroke();
    // limbal ring
    const lg = g.createRadialGradient(C, C, rI * 0.8, C, C, rI * 1.06);
    lg.addColorStop(0, 'rgba(15,12,12,0)'); lg.addColorStop(0.62, 'rgba(15,12,12,0.6)'); lg.addColorStop(0.8, 'rgba(15,12,12,0.75)'); lg.addColorStop(1, 'rgba(60,50,48,0)');
    g.fillStyle = lg; g.beginPath(); g.arc(C, C, rI * 1.06, 0, Math.PI * 2); g.fill();
    // pupil with a soft edge
    const pr = rI * 0.32;
    const pg = g.createRadialGradient(C, C, pr * 0.8, C, C, pr * 1.12);
    pg.addColorStop(0, 'rgba(4,4,5,1)'); pg.addColorStop(0.75, 'rgba(6,5,5,0.95)'); pg.addColorStop(1, 'rgba(6,5,5,0)');
    g.fillStyle = pg; g.beginPath(); g.arc(C, C, pr * 1.12, 0, Math.PI * 2); g.fill();
    t = new THREE.CanvasTexture(cv);
  } else {
    const data = new Uint8Array(S * S * 4);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const r = Math.hypot(i - C, j - C) / S;
      const k = (j * S + i) * 4;
      let c = [214, 203, 192];
      if (r < 0.25) c = r < 0.08 ? [5, 5, 5] : base;
      data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = 255;
    }
    t = new THREE.DataTexture(data, S, S); t.needsUpdate = true;
  }
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  TEX_CACHE.set(key, t);
  return t;
}

// one eye: group placed at the eyeball centre (head space), rotated for gaze
export function createEye(o) {
  const { center, radius: R, side, eyeColor, seed, detail, lidUp = 0.37, lidLo = -0.45 } = o;
  const group = new THREE.Group();
  group.position.set(center[0], center[1], center[2]);
  const ball = eyeballGeometry(R, detail);
  const tex = eyeTexture(eyeColor, seed, detail === 'high' ? 512 : detail === 'medium' ? 256 : 128);
  const occU = { uRot: { value: new THREE.Matrix3() }, uR: { value: R }, uLid: { value: new THREE.Vector2(lidUp, lidLo) }, uSide: { value: side } };
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32, metalness: 0, envMapIntensity: 0.6 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, occU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat3 uRot;\nvarying vec3 vEyeH;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEyeH = uRot * position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uR; uniform vec2 uLid; uniform float uSide;\nvarying vec3 vEyeH;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 q = vEyeH / uR;
        float u = q.x * uSide;
        // upper lid shadow band (lid + lashes), lower lid contact, canthal and socket darkening
        float up = smoothstep(uLid.x - 0.28, uLid.x + 0.06, q.y + 0.03 * u * u);
        float lo = smoothstep(uLid.y + 0.16, uLid.y - 0.05, q.y);
        float cn = smoothstep(0.55, 0.98, abs(q.x));
        float back = smoothstep(0.62, 0.15, q.z);
        float occ = clamp(1.0 - 0.62 * up - 0.28 * lo - 0.35 * cn - 0.5 * back, 0.12, 1.0);
        diffuseColor.rgb *= occ;
      }`);
  };
  const ballMesh = new THREE.Mesh(ball, mat);
  ballMesh.name = 'eyeball';
  group.add(ballMesh);
  let wet = null;
  if (detail !== 'low') {
    const wmat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.035, metalness: 0, envMapIntensity: 1.6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    wet = new THREE.Mesh(wetShellGeometry(R, detail), wmat);
    wet.name = 'eyeWet';
    wet.renderOrder = 2;
    group.add(wet);
  }
  const rot = new THREE.Matrix3();
  return {
    group, ballMesh, wet,
    setRotation(rx, ry) {
      group.rotation.set(rx, ry, 0);
      group.updateMatrix();
      rot.setFromMatrix4(group.matrix);
      occU.uRot.value.copy(rot);
    },
    dispose() { mat.dispose(); if (wet) wet.material.dispose(); },
  };
}

// tear line: thin glossy strip along the lower lid where it meets the globe (head space points)
export function tearLineGeometry(pts, center, width) {
  const pos = [], idx = [];
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k];
    const d = [p[0] - center[0], p[1] - center[1], p[2] - center[2]];
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    const n = [d[0] / l, d[1] / l, d[2] / l];
    // lift slightly off the globe and spread toward the lid edge (+y) and the eye (-y)
    pos.push(p[0] + n[0] * 0.00008, p[1] + n[1] * 0.00008 + width * 0.6, p[2] + n[2] * 0.00008);
    pos.push(p[0] + n[0] * 0.00025, p[1] + n[1] * 0.00025 - width * 0.4, p[2] + n[2] * 0.00025 + width * 0.3);
  }
  for (let k = 0; k < pts.length - 1; k++) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
