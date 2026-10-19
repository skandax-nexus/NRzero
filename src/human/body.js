// Procedural human body with clothing (docs/ART_SPEC.md §2).
//
// The body is described as anatomical volumes (a lofted torso, tapered limb capsules with
// muscle masses, hands with fingers). Each garment is its own volume derived from that anatomy
// (inflated, smoothed the way cloth hides anatomy, cut at hems/cuffs/collars), polygonised with
// surface nets into one continuous mesh and skinned to a shared skeleton. Garment shaders add
// procedural weave or leather grain, seams, a zip, pockets, hi-vis bands and wrinkles at the
// joints through a procedural bump field, so cloth reads as cloth without any image files.
import * as THREE from 'three';
import { clamp, sstep, smin, smax, sdEll, sdCapT, sdBoxR, curve, surfaceNets, toGeometry, rngF } from './sdf.js';

const geoCache = new Map();

// ---------------------------------------------------------------- skeleton & proportions
function proportions(p) {
  const s = (p.height || 1.8) / 1.8, fem = clamp(p.sex ?? 0, 0, 1), g = p.build ?? 1, age = p.age ?? 30;
  const kid = clamp((16 - age) / 8, 0, 1);
  const sw = (1 - 0.1 * fem) * (0.94 + 0.06 * g) * (1 - 0.1 * kid); // shoulder width factor
  const hw = (1 + 0.08 * fem) * (0.96 + 0.04 * g) * (1 - 0.06 * kid); // hip width factor
  const J = {
    hips: [0, 0.975 * s, 0], spine: [0, 1.09 * s, -0.004], chest: [0, 1.30 * s, -0.012], neck: [0, 1.50 * s, -0.02], head: [0, 1.60 * s, -0.004],
    hipL: [0.093 * s * hw, 0.92 * s, 0.0], kneeL: [0.098 * s * hw, 0.50 * s, 0.008], ankleL: [0.104 * s * hw, 0.08 * s, -0.012], toeL: [0.112 * s * hw, 0.02 * s, 0.17 * s],
    clavL: [0.025 * s, 1.465 * s, 0.0], shoulderL: [0.178 * s * sw, 1.45 * s, -0.026], elbowL: [0.228 * s * sw, 1.162 * s, -0.045], wristL: [0.256 * s * sw, 0.908 * s, -0.012], fingerL: [0.268 * s * sw, 0.72 * s, 0.0],
  };
  for (const k of Object.keys(J)) if (k.endsWith('L')) { const r = k.slice(0, -1) + 'R'; J[r] = [-J[k][0], J[k][1], J[k][2]]; }
  return { s, fem, g, kid, sw, hw, J, age };
}

function buildSkeleton(P) {
  const J = P.J, bones = {}, list = [];
  const mk = (name, joint, parent) => {
    const b = new THREE.Bone(); b.name = name; const w = J[joint];
    b.userData.world = new THREE.Vector3(...w);
    if (parent) { const pw = parent.userData.world; b.position.set(w[0] - pw.x, w[1] - pw.y, w[2] - pw.z); parent.add(b); } else b.position.set(...w);
    bones[name] = b; list.push(b); return b;
  };
  const hips = mk('hips', 'hips'); const spine = mk('spine', 'spine', hips); const chest = mk('chest', 'chest', spine);
  const neck = mk('neck', 'neck', chest); mk('head', 'head', neck);
  for (const S of ['L', 'R']) {
    const sh = mk('shoulder' + S, 'clav' + S, chest); const ua = mk('upperArm' + S, 'shoulder' + S, sh);
    const fa = mk('forearm' + S, 'elbow' + S, ua); mk('hand' + S, 'wrist' + S, fa);
    const th = mk('thigh' + S, 'hip' + S, hips); const sn = mk('shin' + S, 'knee' + S, th); mk('foot' + S, 'ankle' + S, sn);
  }
  return { bones, list };
}

// bone segments used for skin weights: [bone, from joint, to joint, radius, parent bone]
function segments(P) {
  const J = P.J, s = P.s;
  const segs = [
    ['hips', [0, 0.86 * s, -0.005], J.spine, 0.15 * P.hw, null],
    ['spine', J.spine, J.chest, 0.14, 'hips'],
    ['chest', J.chest, [0, 1.47 * s, -0.02], 0.15, 'spine'],
    ['neck', [0, 1.47 * s, -0.02], [0, 1.64 * s, -0.02], 0.05, 'chest'],
  ];
  for (const S of ['L', 'R']) {
    segs.push(['shoulder' + S, J['clav' + S], J['shoulder' + S], 0.06, 'chest']);
    segs.push(['upperArm' + S, J['shoulder' + S], J['elbow' + S], 0.045, 'shoulder' + S]);
    segs.push(['forearm' + S, J['elbow' + S], J['wrist' + S], 0.035, 'upperArm' + S]);
    segs.push(['hand' + S, J['wrist' + S], J['finger' + S], 0.025, 'forearm' + S]);
    segs.push(['thigh' + S, J['hip' + S], J['knee' + S], 0.075, 'hips']);
    segs.push(['shin' + S, J['knee' + S], J['ankle' + S], 0.05, 'thigh' + S]);
    segs.push(['foot' + S, J['ankle' + S], J['toe' + S], 0.04, 'shin' + S]);
  }
  return segs.map(([bone, a, b, r, parent]) => ({ bone, a, b, r, parent }));
}

// ---------------------------------------------------------------- anatomy volumes
function anatomy(P) {
  const { s, fem, g, J, hw, sw, kid } = P;
  const gg = 0.9 + 0.1 * g; // girth
  const bust = fem * (1 - kid);
  // torso loft: y -> half-width a, centre c, front depth bF, back depth bB
  const T = [
    [1.53, 0.062, -0.022, 0.052, 0.058], [1.495, 0.11 * sw, -0.026, 0.06, 0.066], [1.455, 0.152 * sw, -0.024, 0.078, 0.082],
    [1.40, 0.166 * sw, -0.016, 0.098 + 0.012 * bust, 0.094], [1.33, 0.158 * sw, -0.006, 0.106 + 0.03 * bust, 0.094], [1.26, 0.146 * (sw * 0.6 + 0.4), 0.0, 0.1 + 0.012 * bust, 0.092],
    [1.18, 0.136 * (1 - 0.07 * fem), 0.004, 0.094, 0.088], [1.10, 0.133 * (1 - 0.1 * fem), 0.006, 0.094, 0.086], [1.03, 0.147 * hw, 0.003, 0.094, 0.094],
    [0.96, 0.162 * hw, -0.004, 0.09, 0.112 + 0.01 * fem], [0.9, 0.158 * hw, -0.006, 0.084, 0.11 + 0.01 * fem], [0.855, 0.12 * hw, -0.004, 0.07, 0.085], [0.83, 0.05, -0.002, 0.04, 0.045],
  ];
  const ks = T.map(r => [r[0] * s, r[1] * s * gg, r[2] * s, r[3] * s * gg, r[4] * s * gg]);
  const fa = curve(ks.map(k => [k[0], k[1]])), fc = curve(ks.map(k => [k[0], k[2]])), fbF = curve(ks.map(k => [k[0], k[3]])), fbB = curve(ks.map(k => [k[0], k[4]]));
  const yTop = ks[0][0], yBot = ks[ks.length - 1][0];
  const chestY = 1.33 * s, aC = fa(chestY), bFC = fbF(chestY), bBC = fbB(chestY);
  const torso = (x, y, z, inflate = 0, n = 2.35, drape = 0) => {
    if (y > yTop + 0.03 || y < yBot - 0.03) return 0.05;
    const yy = clamp(y, yBot, yTop), c = fc(yy), dz = z - c;
    let a = fa(yy), b = dz > 0 ? fbF(yy) : fbB(yy);
    if (drape > 0 && yy < chestY) { // cloth hangs straight from the chest instead of following the waist
      const k = drape * sstep(chestY, chestY - 0.12 * s, yy);
      a = Math.max(a, a + (aC * 0.94 - a) * k); b = Math.max(b, b + ((dz > 0 ? bFC * 0.9 : bBC * 0.95) - b) * k);
    }
    a += inflate; b += inflate;
    const k = Math.pow(Math.pow(Math.abs(x / a), n) + Math.pow(Math.abs(dz / b), n), 1 / n);
    let d = (k - 1) * Math.min(a, b);
    if (y > yTop) d = Math.max(d, y - yTop); if (y < yBot) d = Math.max(d, yBot - y);
    return d;
  };
  const arm = (x, y, z, S, inflate = 0, smooth = 0) => {
    const sh = J['shoulder' + S], el = J['elbow' + S], wr = J['wrist' + S], sg = S === 'L' ? 1 : -1;
    const m = (1 - 0.18 * fem) * gg * (1 - 0.15 * kid);
    let d = sdCapT(x, y, z, sh, el, 0.043 * s * m + inflate, 0.034 * s * m + inflate);
    const dk = smooth > 0 ? 0.7 : 1; // cloth hides most of the deltoid
    d = smin(d, sdEll(x, y, z, sh[0] + sg * 0.002 * dk, sh[1] - 0.035 * s, sh[2], 0.044 * s * m * dk + inflate, (0.07 * s * m) * (smooth > 0 ? 0.8 : 1) + inflate, 0.048 * s * m * dk + inflate), 0.02 + smooth); // deltoid
    if (smooth < 0.01) d = smin(d, sdEll(x, y, z, (sh[0] + el[0]) / 2, (sh[1] + el[1]) / 2 + 0.01, sh[2] - 0.012, 0.035 * s * m, 0.08 * s, 0.04 * s * m), 0.015); // triceps / biceps mass
    // forearm: slightly flattened, muscular near the elbow
    const fd = sdCapT(x, y, z, el, wr, 0.037 * s * m + inflate, 0.026 * s * m + inflate);
    d = smin(d, fd, 0.025 + smooth);
    if (smooth < 0.01) d = smin(d, sdEll(x, y, z, el[0] + (wr[0] - el[0]) * 0.28, el[1] + (wr[1] - el[1]) * 0.28, el[2] + 0.004, 0.036 * s * m, 0.065 * s, 0.035 * s * m), 0.015);
    return d;
  };
  const leg = (x, y, z, S, inflate = 0, smooth = 0) => {
    const hp = J['hip' + S], kn = J['knee' + S], an = J['ankle' + S], sg = S === 'L' ? 1 : -1;
    const m = gg * (1 + 0.06 * fem) * (1 - 0.12 * kid);
    let d = sdCapT(x, y, z, [hp[0] + sg * 0.01, hp[1] + 0.02, hp[2]], kn, 0.083 * s * m + inflate, 0.052 * s * m + inflate);
    if (smooth < 0.01) {
      d = smin(d, sdEll(x, y, z, hp[0] + sg * 0.01, (hp[1] + kn[1]) / 2 + 0.06, hp[2] + 0.018, 0.068 * s * m, 0.17 * s, 0.07 * s * m), 0.03); // quadriceps
      d = smin(d, sdEll(x, y, z, kn[0], kn[1] + 0.005, kn[2] + 0.02, 0.045 * s, 0.04 * s, 0.04 * s), 0.02); // knee
    }
    let sd = sdCapT(x, y, z, kn, an, 0.05 * s * m + inflate, 0.034 * s * m + inflate);
    if (smooth < 0.01) sd = smin(sd, sdEll(x, y, z, kn[0] - sg * 0.004, kn[1] - 0.13 * s, kn[2] - 0.022, 0.048 * s * m, 0.11 * s, 0.045 * s * m), 0.03); // calf
    else sd = smin(sd, sdCapT(x, y, z, [kn[0], kn[1] - 0.05, kn[2] - 0.01], [an[0], an[1] + 0.06, an[2]], 0.052 * s * m + inflate, 0.046 * s * m + inflate), smooth);
    return smin(d, sd, 0.03 + smooth);
  };
  const foot = (x, y, z, S, inflate = 0) => {
    const an = J['ankle' + S], to = J['toe' + S], sg = S === 'L' ? 1 : -1;
    const heel = sdEll(x, y, z, an[0], 0.035 * s, an[2] - 0.035 * s, 0.033 * s + inflate, 0.036 * s + inflate, 0.04 * s + inflate);
    const ball = sdEll(x, y, z, an[0] + sg * 0.008, 0.03 * s, an[2] + 0.115 * s, 0.045 * s + inflate, 0.03 * s + inflate, 0.05 * s + inflate);
    const toes = sdEll(x, y, z, an[0] + sg * 0.004, 0.022 * s, to[2] - 0.025 * s, 0.041 * s + inflate, 0.022 * s + inflate, 0.035 * s + inflate);
    let d = smin(smin(heel, ball, 0.06), toes, 0.03);
    d = smin(d, sdCapT(x, y, z, [an[0], an[1] + 0.03, an[2]], [an[0], 0.04 * s, an[2] + 0.02], 0.033 * s + inflate, 0.038 * s + inflate), 0.03);
    return Math.max(d, -y + 0.001);
  };
  const neck = (x, y, z, inflate = 0) => sdCapT(x, y, z, [0, 1.45 * s, -0.024], [0, 1.61 * s, -0.022], (0.05 - 0.008 * fem) * s * gg + inflate, (0.047 - 0.007 * fem) * s * gg + inflate);
  return { torso, arm, leg, foot, neck };
}

// ---------------------------------------------------------------- garment volumes
// Each returns { f, bmin, bmax } in rest pose. Garment cuts are planes so hems stay crisp.
function garments(P, outfit, An) {
  const { s, J } = P, out = [];
  const top = outfit.top || { type: 'tshirt' }, pants = outfit.pants || { type: 'trousers' }, shoes = outfit.shoes || { type: 'shoes' };
  const coat = outfit.coat;
  const longTop = top.type === 'tunic';
  const thick = { jacket: 0.013, armored: 0.015, sweater: 0.01, uniform: 0.007, tshirt: 0.004, tunic: 0.006, none: 0 }[top.type] ?? 0.008;
  const sleeveEnd = top.type === 'tshirt' ? 0.35 : top.type === 'tunic' ? 0.55 : top.type === 'none' ? 0 : 1.0; // fraction of the arm (shoulder->wrist) covered
  const hemY = (longTop ? 0.66 : top.type === 'jacket' || top.type === 'armored' ? 0.95 : 1.0) * s;
  const waistY = 1.055 * s;
  const bootTop = shoes.type === 'boots' ? 0.25 * s : shoes.type === 'shoes' ? 0.105 * s : 0.06 * s;
  const armAxial = (x, y, z, S) => { // 0 at shoulder, 1 at wrist (piecewise along the two segments)
    const sh = J['shoulder' + S], el = J['elbow' + S], wr = J['wrist' + S];
    const proj = (a, b) => { const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2]; return ((x - a[0]) * bx + (y - a[1]) * by + (z - a[2]) * bz) / (bx * bx + by * by + bz * bz); };
    const t1 = proj(sh, el); if (t1 < 1) return t1 * 0.53; return 0.53 + proj(el, wr) * 0.47;
  };
  const armCut = (x, y, z, S, end) => { // positive beyond the sleeve end
    const sh = J['shoulder' + S], el = J['elbow' + S], wr = J['wrist' + S];
    const A = end < 0.53 ? sh : el, B = end < 0.53 ? el : wr, tt = end < 0.53 ? end / 0.53 : (end - 0.53) / 0.47;
    const bx = B[0] - A[0], by = B[1] - A[1], bz = B[2] - A[2], L = Math.hypot(bx, by, bz);
    const px = A[0] + bx * tt, py = A[1] + by * tt, pz = A[2] + bz * tt;
    // only applies to points near this arm (x on this side)
    if ((S === 'L' ? x : -x) < 0.1 * s) return -1;
    return ((x - px) * bx + (y - py) * by + (z - pz) * bz) / L;
  };
  // ---- skin (only where it can show)
  {
    const showArms = sleeveEnd < 0.99, showLegs = shoes.type === 'sandals' || pants.type === 'wraps';
    const f = (x, y, z) => {
      let d = An.neck(x, y, z);
      if (showArms) for (const S of ['L', 'R']) { let a = An.arm(x, y, z, S); a = Math.max(a, -armCut(x, y, z, S, Math.max(0, sleeveEnd - 0.04))); d = Math.min(d, a); }
      if (shoes.type === 'sandals') for (const S of ['L', 'R']) d = Math.min(d, Math.max(smin(An.foot(x, y, z, S, -0.004), An.leg(x, y, z, S), 0.02), y - 0.2 * s));
      void showLegs;
      return d;
    };
    out.push({ id: 'skin', f, bmin: [-0.4 * s, showArms || shoes.type === 'sandals' ? 0 : 1.4 * s, -0.16 * s], bmax: [0.4 * s, 1.66 * s, 0.24 * s], h: 0.85 });
  }
  let pantsF = null, topF = null;
  // ---- trousers / cargo / wraps
  {
    const baggy = pants.type === 'wraps' ? 0.022 : pants.type === 'cargo' ? 0.014 : 0.011;
    const legEnd = shoes.type === 'boots' ? bootTop - 0.01 : shoes.type === 'sandals' ? (pants.type === 'wraps' ? 0.2 * s : 0.3 * s) : 0.065 * s;
    pantsF = (x, y, z) => {
      let d = An.torso(x, y, z, 0.008, 2.2);
      d = Math.max(d, y - waistY);
      for (const S of ['L', 'R']) {
        let l = An.leg(x, y, z, S, baggy, 0.03);
        if (pants.type === 'cargo') { const hp = J['hip' + S], sg = S === 'L' ? 1 : -1; l = smin(l, sdBoxR(x, y, z, hp[0] + sg * 0.072 * s, 0.68 * s, hp[2] + 0.005, 0.016 * s, 0.07 * s, 0.05 * s, 0.012), 0.012); }
        d = smin(d, l, 0.035);
      }
      d = Math.max(d, legEnd - y);
      if (pants.type === 'wraps') d -= 0.004 * Math.sin(y * 90) * sstep(0.6 * s, 0.25 * s, y);
      return d;
    };
    out.push({ id: 'pants', f: pantsF, bmin: [-0.3 * s, legEnd - 0.02, -0.2 * s], bmax: [0.3 * s, waistY + 0.02, 0.2 * s], h: 1 });
  }
  // ---- top (shirt / sweater / uniform / jacket / armored / tunic)
  if (top.type !== 'none') {
    const collar = top.type === 'jacket' || top.type === 'armored' ? 'high' : top.type === 'uniform' ? 'shirt' : top.type === 'sweater' ? 'crew' : 'round';
    const drape = top.type === 'jacket' || top.type === 'armored' ? 0.85 : top.type === 'sweater' ? 0.45 : top.type === 'tunic' ? 0.6 : 0.25;
    const f = (x, y, z) => {
      let d = An.torso(x, y, z, thick, 2.2, drape);
      if (longTop && y < 1.0 * s) { // tunic skirt: a smooth cone that does not follow the legs
        const t = clamp((1.0 * s - y) / (0.34 * s), 0, 1), a = (0.165 + 0.045 * t) * s * P.hw, b = (0.105 + 0.03 * t) * s;
        const k = Math.sqrt((x / a) ** 2 + ((z + 0.01) / b) ** 2); d = smin(d, (k - 1) * Math.min(a, b), 0.04);
      }
      for (const S of ['L', 'R']) {
        let a = An.arm(x, y, z, S, thick + 0.003, 0.016);
        const cut = armCut(x, y, z, S, sleeveEnd < 1 ? sleeveEnd : 0.99);
        if (cut > -0.05 * s && cut < 0 && (top.type === 'jacket' || top.type === 'armored' || top.type === 'sweater')) a -= 0.003 * sstep(-0.05 * s, -0.04 * s, cut); // cuff
        a = Math.max(a, cut);
        d = smin(d, a, 0.028);
      }
      if (y > hemY - 0.01 && y < 1.15 * s) d = Math.min(d, pantsF(x, y, z) - 0.006); // never let the trousers poke through
      if (top.type === 'jacket' || top.type === 'armored' || top.type === 'uniform') { // tailored shoulder line
        const sx = J.shoulderL[0] * 0.92;
        d = smin(d, sdCapT(x, y, z, [-sx, 1.452 * s, -0.024], [sx, 1.452 * s, -0.024], 0.036 * s + thick, 0.036 * s + thick), 0.03);
      }
      if (top.type === 'jacket' || top.type === 'armored') {
        if (y < hemY + 0.045 * s) d -= 0.0025; // hem band
        if (z > 0 && Math.abs(x) < 0.012) d -= 0.0018 * sstep(0.012, 0.006, Math.abs(x)); // zip placket
      }
      if (collar === 'high') { // stand-up collar around the neck
        const c = sdCapT(x, y, z, [0, 1.47 * s, -0.026], [0, 1.555 * s, -0.022], 0.068 * s, 0.064 * s);
        d = smin(d, Math.max(c, y - 1.555 * s), 0.02);
      }
      if (top.hood) d = smin(d, sdEll(x, y, z, 0, 1.49 * s, -0.11 * s, 0.11 * s, 0.05 * s, 0.05 * s), 0.035); // hood bunched behind the neck
      // neck opening
      const neckHole = An.neck(x, y, z, collar === 'high' ? 0.004 : collar === 'crew' ? 0.008 : 0.012) - (collar === 'round' && z > 0 ? 0.02 * sstep(1.42 * s, 1.5 * s, y) : 0);
      d = Math.max(d, -neckHole);
      d = Math.max(d, y - (collar === 'high' ? 1.555 : 1.52) * s);
      d = Math.max(d, hemY - y);
      return d;
    };
    topF = f;
    out.push({ id: 'top', f, bmin: [-0.42 * s, hemY - 0.02, -0.22 * s], bmax: [0.42 * s, 1.6 * s, 0.24 * s], h: 1 });
  }
  // ---- vest (hi-vis / tactical)
  if (outfit.vest) {
    const f = (x, y, z) => {
      let d = An.torso(x, y, z, thick + 0.016, 2.1, 0.7);
      if (topF && y > 1.0 * s && y < 1.45 * s && Math.abs(x) < 0.17 * s) d = Math.min(d, topF(x, y, z) - 0.006);
      for (const S of ['L', 'R']) { const sh = J['shoulder' + S]; d = Math.max(d, -sdEll(x, y, z, sh[0] * 0.98, sh[1] - 0.07 * s, sh[2], 0.075 * s, 0.13 * s, 0.11 * s)); }
      d = Math.max(d, -An.neck(x, y, z, 0.03));
      d = Math.max(d, y - 1.5 * s); d = Math.max(d, 1.0 * s - y);
      return d;
    };
    out.push({ id: 'vest', f, bmin: [-0.3 * s, 0.98 * s, -0.2 * s], bmax: [0.3 * s, 1.52 * s, 0.22 * s], h: 1 });
  }
  // ---- coat (long / lab)
  if (coat) {
    const lowY = (coat.type === 'long' ? 0.42 : 0.62) * s, ct = thick + 0.012;
    const f = (x, y, z) => {
      let d = An.torso(x, y, z, ct, 2.15, 1);
      if (y < 1.04 * s) {
        const t = clamp((1.04 * s - y) / (1.04 * s - lowY), 0, 1), a = (0.175 + 0.07 * t) * s * P.hw, b = (0.115 + 0.05 * t) * s;
        const k = Math.sqrt((x / a) ** 2 + ((z + 0.012) / b) ** 2); d = smin(d, (k - 1) * Math.min(a, b), 0.05);
        if (z > 0) d = Math.max(d, -(0.006 + 0.035 * t * s - Math.abs(x)) - 0.0); // front opening widens downward
      }
      for (const S of ['L', 'R']) { const a = Math.max(An.arm(x, y, z, S, ct + 0.007, 0.025), armCut(x, y, z, S, 0.97)); d = smin(d, a, 0.05); }
      if (topF && y > 0.9 * s) d = Math.min(d, topF(x, y, z) - 0.007);
      if (y > lowY && y < 1.1 * s) d = Math.min(d, pantsF(x, y, z) - 0.008);
      const c = sdCapT(x, y, z, [0, 1.46 * s, -0.03], [0, 1.57 * s, -0.026], 0.078 * s, 0.072 * s); // collar
      d = smin(d, Math.max(c, y - 1.57 * s), 0.02);
      d = Math.max(d, -An.neck(x, y, z, 0.012));
      d = Math.max(d, y - 1.57 * s); d = Math.max(d, lowY - y);
      return d;
    };
    out.push({ id: 'coat', f, bmin: [-0.46 * s, lowY - 0.02, -0.26 * s], bmax: [0.46 * s, 1.62 * s, 0.26 * s], h: 1.1 });
  }
  // ---- belt
  if (outfit.belt != null && !longTop && !coat && hemY > 1.0 * s) {
    const by = 1.035 * s;
    const f = (x, y, z) => Math.max(An.torso(x, y, z, 0.014, 2.2), Math.abs(y - by) - 0.019 * s, -An.torso(x, y, z, 0.002, 2.2));
    out.push({ id: 'belt', f, bmin: [-0.25 * s, by - 0.04, -0.2 * s], bmax: [0.25 * s, by + 0.04, 0.2 * s], h: 0.7 });
  }
  if (outfit.sash != null) {
    const by = (longTop ? 1.0 : 1.03) * s;
    const f = (x, y, z) => Math.max(An.torso(x, y, z, thick + 0.012, 2.2) + 0.003 * Math.sin(x * 120 + z * 80), Math.abs(y - by) - 0.04 * s, -An.torso(x, y, z, thick - 0.004, 2.2));
    out.push({ id: 'sash', f, bmin: [-0.26 * s, by - 0.06, -0.22 * s], bmax: [0.26 * s, by + 0.06, 0.22 * s], h: 0.8 });
  }
  // ---- footwear
  {
    const f = (x, y, z) => {
      let d = 1;
      for (const S of ['L', 'R']) {
        let b = An.foot(x, y, z, S, shoes.type === 'boots' ? 0.009 : shoes.type === 'sandals' ? 0.002 : 0.006);
        b = Math.min(b, Math.max(An.foot(x, y, z, S, 0.013), y - 0.018 * s)); // sole lip
        if (shoes.type === 'boots') { const an = J['ankle' + S]; b = smin(b, sdCapT(x, y, z, [an[0], 0.06 * s, an[2] - 0.008], [an[0], bootTop, an[2] - 0.004], 0.05 * s, 0.052 * s), 0.035); }
        if (shoes.type === 'sandals') b = Math.max(b, y - 0.022 * s); // just the sole
        d = Math.min(d, b);
      }
      d = Math.max(d, y - bootTop);
      return Math.max(d, -y);
    };
    out.push({ id: 'shoes', f, bmin: [-0.2 * s, -0.01, -0.12 * s], bmax: [0.2 * s, bootTop + 0.02, 0.24 * s], h: 0.75 });
  }
  return out;
}

// ---------------------------------------------------------------- hands
function handVolume(P, S, gloved) {
  const { s, fem } = P, sg = S === 'L' ? 1 : -1, J = P.J, w = J['wrist' + S];
  const m = s * (1 - 0.1 * fem) * (gloved ? 1.06 : 1);
  // local frame: fingers down (-y), palm facing the thigh (-x for the left hand), thumb forward (+z)
  const fingers = [ // z offset, length, radius
    [0.026, 0.078, 0.0088], [0.009, 0.088, 0.0092], [-0.009, 0.083, 0.0088], [-0.025, 0.066, 0.0078],
  ];
  return (x, y, z) => {
    const lx = (x - w[0]) * sg / m, ly = (y - w[1]) / m, lz = (z - w[2]) / m;
    let d = sdBoxR(lx, ly, lz, 0.0, -0.05, 0.0, 0.013, 0.043, 0.04, 0.012); // palm
    d = smin(d, sdCapT(lx, ly, lz, [0, 0.01, 0], [0, -0.02, 0], 0.026, 0.024), 0.02); // wrist
    for (const [fz, len, r] of fingers) { // three phalanges each, curling toward the palm
      let p0 = [0.001, -0.088, fz], a = 0.18;
      const segL = [len * 0.42, len * 0.32, len * 0.26];
      for (let k = 0; k < 3; k++) {
        a += 0.22 + k * 0.08;
        const p1 = [p0[0] - Math.sin(a) * segL[k], p0[1] - Math.cos(a) * segL[k], p0[2] - fz * 0.04];
        d = smin(d, sdCapT(lx, ly, lz, p0, p1, r * (1 - k * 0.1), r * (0.93 - k * 0.1)), 0.004);
        p0 = p1;
      }
    }
    // thumb: from the base of the palm, forward and down
    const t0 = [-0.006, -0.03, 0.03], t1 = [-0.014, -0.058, 0.052], t2 = [-0.02, -0.08, 0.058];
    d = smin(d, sdCapT(lx, ly, lz, t0, t1, 0.013, 0.0105), 0.012);
    d = smin(d, sdCapT(lx, ly, lz, t1, t2, 0.0102, 0.0088), 0.004);
    return d * m;
  };
}

// ---------------------------------------------------------------- skin weights
// Smooth weights: a soft-min over distances to the bone segments (minus each segment's radius),
// limited to four bones, so joints, armpits and the crotch blend instead of tearing.
const CHAIN = { upperArm: 0, forearm: 1, hand: 2, thigh: 0, shin: 1, foot: 2 };
function skinWeights(positions, segs, boneIndex) {
  const n = positions.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const extra = new Float32Array(n * 3); // limb axial (m, continuous along the chain), around angle, fold mask
  const lenOf = sg => Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1], sg.b[2] - sg.a[2]);
  const segBy = Object.fromEntries(segs.map(sg => [sg.bone, sg]));
  const chainOff = sg => { // length of the limb above this segment
    const base = sg.bone.replace(/[LR]$/, ''), S = sg.bone.slice(-1);
    if (!(base in CHAIN)) return 0;
    const order = base === 'upperArm' || base === 'forearm' || base === 'hand' ? ['upperArm', 'forearm', 'hand'] : ['thigh', 'shin', 'foot'];
    let o = 0; for (const b of order) { if (b === base) break; const q = segBy[b + S]; if (q) o += lenOf(q); }
    return o;
  };
  const offs = segs.map(chainOff), lens = segs.map(lenOf);
  const d = new Float32Array(segs.length), tt = new Float32Array(segs.length);
  const sigma = 0.018;
  for (let v = 0; v < n; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    let dmin = 1e9, im = 0;
    for (let i = 0; i < segs.length; i++) {
      const { a, b } = segs[i], bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], L2 = bx * bx + by * by + bz * bz;
      const t = clamp(((x - a[0]) * bx + (y - a[1]) * by + (z - a[2]) * bz) / L2, 0, 1);
      d[i] = Math.max(0, Math.hypot(x - a[0] - bx * t, y - a[1] - by * t, z - a[2] - bz * t) - segs[i].r); tt[i] = t;
      if (d[i] < dmin) { dmin = d[i]; im = i; }
    }
    // candidates: the nearest segment, plus segments within reach; joints share by position along the bone
    const cand = [];
    for (let i = 0; i < segs.length; i++) {
      const w = Math.exp(-(d[i] - dmin) / sigma);
      if (w > 0.02) cand.push([segs[i].bone, w]);
    }
    // the parent of the nearest segment takes over smoothly near the joint (a bone's start bends with its parent)
    const best = segs[im], fromStart = tt[im] * lens[im];
    if (best.parent && fromStart < 0.05) { const k = 0.5 * (1 - sstep(0, 0.05, fromStart)); for (const c of cand) c[1] *= 1 - k; cand.push([best.parent, k * cand.reduce((s2, c) => s2 + c[1], 0) / Math.max(1e-6, 1 - k)]); }
    const merged = {}; for (const [bn, w] of cand) merged[bn] = (merged[bn] || 0) + w;
    const top = Object.entries(merged).sort((p1, p2) => p2[1] - p1[1]).slice(0, 4);
    const sum = top.reduce((s2, c) => s2 + c[1], 0) || 1;
    for (let k = 0; k < 4; k++) { si[v * 4 + k] = k < top.length ? boneIndex[top[k][0]] : 0; sw[v * 4 + k] = k < top.length ? top[k][1] / sum : 0; }
    const bn = best.bone, isLimb = /Arm|forearm|thigh|shin/.test(bn);
    const L = lens[im], fs = tt[im] * L;
    const nearJoint = bn.startsWith('upperArm') || bn.startsWith('thigh') ? L - fs : bn.startsWith('forearm') || bn.startsWith('shin') ? fs : 1;
    extra[v * 3] = isLimb ? offs[im] + fs : y;
    extra[v * 3 + 1] = isLimb ? Math.atan2(x - (best.a[0] + best.b[0]) / 2, z - (best.a[2] + best.b[2]) / 2) : Math.atan2(x, z);
    extra[v * 3 + 2] = isLimb ? Math.exp(-((nearJoint / 0.08) ** 2)) * 0.9 + 0.12 : (bn === 'hips' || bn === 'spine' ? 0.3 : 0.12);
  }
  return { si, sw, extra };
}

// ---------------------------------------------------------------- cloth & skin materials
const DUMMY = (() => { const t = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1); t.needsUpdate = true; return t; })();
const CLOTH_GLSL = /* glsl */`
  varying vec3 vRest; varying vec3 vRestN; varying vec3 vFold;
  uniform float uWeave, uLeather, uFoldAmt, uKnit, uSeam, uZip, uQuilt, uStripe, uScale;
  uniform vec3 uStripeY; uniform float uPocket, uPocketY, uScale2;
  float hsh(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hsh(i), hsh(i + vec3(1,0,0)), f.x), mix(hsh(i + vec3(0,1,0)), hsh(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hsh(i + vec3(0,0,1)), hsh(i + vec3(1,0,1)), f.x), mix(hsh(i + vec3(0,1,1)), hsh(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float clothHeight() {
    vec3 p = vRest * uScale; vec3 an = abs(normalize(vRestN)); an /= (an.x + an.y + an.z);
    float px = max(1e-5, length(fwidth(vRest))); // pixel footprint (m): fade detail that would alias
    float aa = 1.0 - smoothstep(0.15, 0.5, px * 1200.0 / 6.283);
    float h = 0.0;
    if (uWeave > 0.0 && aa > 0.0) { // weave seen on three planes
      float wx = sin(p.y * 1200.0) * sin(p.z * 1200.0), wy = sin(p.x * 1200.0) * sin(p.z * 1200.0), wz = sin(p.x * 1200.0) * sin(p.y * 1200.0);
      h += aa * uWeave * 0.00006 * (wx * an.x + wy * an.y + wz * an.z);
    }
    float aaK = 1.0 - smoothstep(0.15, 0.5, px * 700.0 / 6.283);
    if (uKnit > 0.0) h += aaK * uKnit * 0.00035 * abs(sin(p.x * 700.0 + sin(p.y * 700.0) * 0.6)) * abs(sin(p.y * 700.0));
    float aaL = 1.0 - smoothstep(0.2, 0.6, px * 900.0 / 6.283);
    if (uLeather > 0.0) h += uLeather * (aaL * 0.00018 * vnoise(p * 900.0) - 0.0005 * pow(vnoise(p * 140.0), 3.0) + 0.0002 * vnoise(p * 300.0));
    // wrinkles: rings around the limb near the joints, broken up by noise, plus soft drape
    float fa = vFold.x * 100.0;
    float wr = sin(fa * 1.5 + 6.0 * vnoise(vRest * 18.0));
    h += uFoldAmt * vFold.z * 0.002 * wr * (0.4 + 0.6 * vnoise(vRest * 30.0 + 7.0));
    h += uFoldAmt * 0.0013 * (vnoise(p * 28.0) - 0.5);
    if (uLeather > 0.0) { // creases: ridged noise stretched around the body
      float cr = 1.0 - abs(vnoise(vec3(vRest.x * 55.0, vRest.y * 70.0 + vnoise(vRest * 20.0) * 3.0, vRest.z * 55.0)) * 2.0 - 1.0);
      h -= uLeather * 0.00045 * pow(cr, 10.0);
    }
    if (uSeam > 0.0) { // shoulder seam (top of the shoulder) and armhole ring
      float sx = abs(vRest.x);
      h -= uSeam * 0.0005 * (1.0 - smoothstep(0.0, 0.004, abs(vRest.z + 0.03))) * step(0.07, sx) * step(1.38 * uScale2, vRest.y);
    }
    if (uPocket > 0.0 && vRest.z > 0.03) { // welt pockets at the hips
      float px2 = abs(vRest.x), py2 = vRest.y;
      float edge = (1.0 - smoothstep(0.0, 0.0035, abs(py2 - uPocketY))) * step(0.06, px2) * step(px2, 0.13);
      h -= uPocket * 0.0009 * edge;
    }
    if (uQuilt > 0.0) h -= uQuilt * 0.0012 * smoothstep(0.9, 1.0, abs(sin(p.y * 70.0)));

    if (uZip > 0.0 && vRest.z > 0.0) { // front zip: a raised tape with teeth
      float zx = abs(vRest.x);
      h += uZip * (0.0008 * (1.0 - smoothstep(0.004, 0.007, zx)) + 0.0004 * step(zx, 0.0035) * step(0.5, fract(vRest.y * 380.0)));
    }
    return h;
  }
  vec2 dHdxy_fwd() { float h = clothHeight(); return vec2(dFdx(h), dFdy(h)) / max(1e-6, length(fwidth(vRest))); }
  vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
    vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) ); vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) ); vec3 vN = surf_norm;
    vec3 R1 = cross( vSigmaY, vN ); vec3 R2 = cross( vN, vSigmaX ); float fDet = dot( vSigmaX, R1 ) * faceDirection;
    vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 ); return normalize( abs( fDet ) * surf_norm - vGrad );
  }
`;

function clothMaterial(kind, color, opts = {}) {
  const leather = kind === 'leather', synth = kind === 'synthetic', metal = kind === 'metal', skin = kind === 'skin';
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: leather ? 0.5 : synth ? 0.55 : skin ? 0.55 : metal ? 0.3 : 0.86, metalness: metal ? 0.85 : 0,
    sheen: leather || metal ? 0 : skin ? 0.6 : 0.35, sheenRoughness: 0.8, sheenColor: skin ? new THREE.Color(0xd0402c) : new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.18),
    clearcoat: leather ? 0.22 : synth ? 0.15 : 0, clearcoatRoughness: leather ? 0.55 : 0.35, bumpMap: DUMMY, bumpScale: 1,
    vertexColors: !!opts.vertexColors,
  });
  const U = {
    uWeave: { value: !leather && !synth && !metal && !skin ? 1 : 0 }, uLeather: { value: leather ? 1 : 0 }, uFoldAmt: { value: skin || metal ? 0 : leather ? 0.8 : 1 },
    uKnit: { value: opts.knit ? 1 : 0 }, uSeam: { value: opts.seam ? 1 : 0 }, uZip: { value: opts.zip ? 1 : 0 }, uQuilt: { value: opts.quilt ? 1 : 0 },
    uStripe: { value: opts.stripe ? 1 : 0 }, uStripeY: { value: new THREE.Vector3(...(opts.stripeY || [0, 0, 0])) }, uScale: { value: opts.scale || 1 },
    uPocket: { value: opts.pocketY ? 1 : 0 }, uPocketY: { value: opts.pocketY || 0 }, uScale2: { value: opts.s || 1 },
  };
  mat.userData.uniforms = U;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aFold; varying vec3 vRest; varying vec3 vRestN; varying vec3 vFold;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position; vRestN = normal; vFold = aFold;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <bumpmap_pars_fragment>', CLOTH_GLSL)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * (0.82 + 0.4 * vnoise(vRest * 9.0)), 0.05, 1.0);`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (uStripe > 0.5) { // retro-reflective bands on hi-vis vests
          float b1 = 1.0 - smoothstep(0.012, 0.016, abs(vRest.y - uStripeY.x)), b2 = 1.0 - smoothstep(0.012, 0.016, abs(vRest.y - uStripeY.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.8, 0.8), max(b1, b2));
        }
        diffuseColor.rgb *= 0.92 + 0.16 * vnoise(vRest * 18.0);`);
    if (skin) sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.10, 0.035, 0.025);`);
  };
  mat.customProgramCacheKey = () => 'afz-cloth';
  return mat;
}

// ---------------------------------------------------------------- public API
export function createBody(params = {}) {
  const p = { height: 1.8, sex: 0, build: 1, age: 30, skin: 0xc68e6a, seed: 1, detail: 'high', outfit: {}, ...params };
  const P = proportions(p), An = anatomy(P);
  const { bones, list } = buildSkeleton(P);
  bones.hips.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  const boneIndex = Object.fromEntries(list.map((b, i) => [b.name, i]));
  const segs = segments(P);
  const root = new THREE.Group(); root.name = 'body';
  root.add(bones.hips);
  const res = p.detail === 'low' ? 0.03 : p.detail === 'medium' ? 0.019 : 0.0125;
  const o = p.outfit || {};
  const top = o.top || { type: 'tshirt', color: 0x777777 };
  const materials = {};
  const matFor = id => {
    if (materials[id]) return materials[id];
    let m;
    if (id === 'skin') m = clothMaterial('skin', p.skin);
    else if (id === 'top') m = clothMaterial(top.material === 'leather' ? 'leather' : top.material === 'synthetic' ? 'synthetic' : 'fabric', top.color ?? 0x555555, { zip: top.type === 'jacket' || top.type === 'armored', seam: true, knit: top.type === 'sweater', quilt: top.type === 'armored', pocketY: top.type === 'jacket' ? 1.04 * P.s : 0, s: P.s });
    else if (id === 'coat') m = clothMaterial(o.coat.material === 'leather' ? 'leather' : 'fabric', o.coat.color ?? 0x333333, { seam: true });
    else if (id === 'vest') m = clothMaterial('synthetic', o.vest.color, { stripe: (o.vest.color & 0xff0000) > 0xa00000, stripeY: [1.24 * P.s, 1.12 * P.s, 0], zip: true });
    else if (id === 'pants') m = clothMaterial('fabric', o.pants?.color ?? 0x2a2c30, {});
    else if (id === 'belt') m = clothMaterial('leather', o.belt ?? 0x2a1d14);
    else if (id === 'sash') m = clothMaterial('fabric', o.sash ?? 0x9b3b24);
    else if (id === 'shoes') m = clothMaterial('leather', o.shoes?.color ?? 0x1b1611);
    else if (id === 'gloves') m = clothMaterial('leather', o.gloves ?? 0x1d1a17);
    materials[id] = m; return m;
  };
  const shapeOf = v => (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'color').map(([k, x]) => [k, shapeOf(x)])) : typeof v === 'string' || typeof v === 'boolean' ? v : v == null ? 0 : 1);
  const key = JSON.stringify([p.height, p.sex, p.build, p.age < 16 ? p.age : 30, shapeOf(o), res]); // colours do not change geometry
  let parts = geoCache.get(key);
  if (!parts) {
    parts = [];
    for (const gmt of garments(P, o, An)) {
      const m = surfaceNets(gmt.f, gmt.bmin, gmt.bmax, res * (gmt.h || 1));
      if (!m.index.length) continue;
      parts.push({ id: gmt.id, mesh: m });
    }
    for (const S of ['L', 'R']) {
      const f = handVolume(P, S, o.gloves != null), w = P.J['wrist' + S];
      const m = surfaceNets(f, [w[0] - 0.08, w[1] - 0.22 * P.s, w[2] - 0.08], [w[0] + 0.08, w[1] + 0.035, w[2] + 0.1], p.detail === 'low' ? 0.011 : p.detail === 'medium' ? 0.0075 : 0.0052);
      parts.push({ id: o.gloves != null ? 'gloves' : 'skin', mesh: m, hand: S });
    }
    for (const part of parts) {
      const g = toGeometry(part.mesh), pos = part.mesh.positions;
      const { si, sw, extra } = skinWeights(pos, part.hand ? segs.filter(sg => sg.bone.endsWith(part.hand) && /hand|forearm/.test(sg.bone)) : segs, boneIndex);
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      g.setAttribute('aFold', new THREE.Float32BufferAttribute(extra, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
      g.computeBoundingSphere();
      part.geo = g;
    }
    geoCache.set(key, parts);
  }
  const meshes = [];
  for (const part of parts) {
    const sm = new THREE.SkinnedMesh(part.geo, matFor(part.id));
    sm.name = part.id + (part.hand ? '_hand' + part.hand : '');
    sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false;
    root.add(sm); sm.bind(skeleton, new THREE.Matrix4());
    meshes.push(sm);
  }
  // rigid accessories on bones
  const sockets = { handL: new THREE.Object3D(), handR: new THREE.Object3D(), back: new THREE.Object3D() };
  sockets.handL.position.set(0.004, -0.085 * P.s, 0.012); bones.handL.add(sockets.handL);
  sockets.handR.position.set(-0.004, -0.085 * P.s, 0.012); bones.handR.add(sockets.handR);
  sockets.back.position.set(0, 0.05, -0.16 * P.s); bones.chest.add(sockets.back);
  let wristRing = null;
  if (o.wristMark) {
    wristRing = new THREE.Mesh(new THREE.TorusGeometry(0.03 * P.s, 0.0035, 8, 28), new THREE.MeshStandardMaterial({ color: 0x0b2a33, emissive: 0x2fd8ff, emissiveIntensity: 1.6, roughness: 0.3 }));
    const el = P.J.elbowL, wr = P.J.wristL;
    wristRing.position.set((wr[0] - el[0]) * 0.86, (wr[1] - el[1]) * 0.86, (wr[2] - el[2]) * 0.86);
    wristRing.lookAt(new THREE.Vector3(wr[0] - el[0], wr[1] - el[1], wr[2] - el[2]).add(wristRing.position)); // ring around the forearm axis
    bones.forearmL.add(wristRing);
  }
  if (o.bracelets != null) for (const S of ['L', 'R']) {
    const el = P.J['elbow' + S], wr = P.J['wrist' + S];
    for (let k = 0; k < 2; k++) {
      const b = new THREE.Mesh(new THREE.TorusGeometry(0.031 * P.s, 0.0028, 6, 22), clothMaterial('metal', o.bracelets));
      b.position.set((wr[0] - el[0]) * (0.82 + k * 0.06), (wr[1] - el[1]) * (0.82 + k * 0.06), (wr[2] - el[2]) * (0.82 + k * 0.06));
      b.lookAt(new THREE.Vector3(wr[0] - el[0], wr[1] - el[1], wr[2] - el[2]).add(b.position)); bones['forearm' + S].add(b);
    }
  }
  if (o.strap) { // shoulder strap across the chest (bag strap)
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0.12, 1.47], [0.05, 1.36], [-0.06, 1.2], [-0.15, 1.04]].map(([x, y]) => {
      const z = An.torso(x, y * P.s, 0) < 0 ? 0 : 0; void z;
      return new THREE.Vector3(x * P.s, y * P.s - P.J.chest[1], frontZ(An, x * P.s, y * P.s) + 0.016 - P.J.chest[2]);
    })), 24, 0.011, 4, false);
    g.scale(1, 1, 1);
    const m = new THREE.Mesh(g, clothMaterial('leather', 0x2a221c)); m.scale.set(1, 1, 1); m.castShadow = true;
    m.geometry.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, 1)); bones.chest.add(m);
    const back = m.clone(); back.geometry = g.clone(); back.geometry.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, -1)); void back;
  }
  if (top.type === 'armored') { // collar plate and low-profile shoulder plates in dark gunmetal
    const pm = clothMaterial('metal', 0x4a525c); pm.roughness = 0.38; pm.side = THREE.DoubleSide;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.078 * P.s, 0.09 * P.s, 0.045 * P.s, 28, 1, true, -2.0, 4.0), pm);
    col.position.set(0, 0.17 * P.s, -0.014); col.rotation.y = Math.PI; bones.chest.add(col);
    for (const S of ['L', 'R']) {
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.062 * P.s, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.3), pm);
      sp.scale.set(0.95, 0.45, 1.0); sp.position.set((S === 'L' ? 1 : -1) * 0.004, 0.012, 0); sp.rotation.z = (S === 'L' ? -1 : 1) * 0.45; bones['upperArm' + S].add(sp);
    }
  }
  const api = {
    root, skeleton, bones, sockets, wristRing, materials, meshes, proportions: P,
    dispose() { for (const m of Object.values(materials)) m.dispose(); },
  };
  return api;
}

function frontZ(An, x, y) { let z = 0.3; while (z > -0.1 && An.torso(x, y, z, 0.012, 2.2) > 0) z -= 0.002; return z; }
void rngF; void smax;
