// The people's look at run time (docs/CHARACTER_LOOK.md, "Plan"): physically based skin, eyes, hair and cloth shading
// for the cast's one-atlas people, plus facial life (blinks, saccades, gaze, lids that follow the gaze).
//
// Everything here works on the shipped cast (assets/models/cast.glb) without a rebuild:
// - per template, once: the atlas mesh is analysed in its rest pose (eye spheres and lids from the eye / lash pieces,
//   face landmarks, ears, lips from the painted atlas, hands, hair shell, concavity, contact with cloth and hair) and the
//   result is stored as four small vertex attributes (`azFace`, `azFace2`, `azHairT`, `azDet`) shared by every clone;
// - per person: the atlas material is cloned (same shader program for everyone) with its own uniforms for the eyes;
//   mesh.onBeforeRender places the eyes once a frame from the head bone, h.update(dt) advances blinks and saccades.
// The eyes are the MakeHuman cornea shells, textured with a painted disc: the iris moves by shifting the disc lookup
// (the shell is a sphere, so the shift reads as a rotation), the lids close by painting lid skin over the shell above a
// lid line, and the painted catch-light is replaced by the scene's real reflections on a wet cornea.
//
// Tiers (the engine's quality, read from realism.getQuality() when a program compiles; a tier switch recompiles):
// high: everything (pore / weave detail maps, wrinkle relief, iris parallax); medium: pore detail on skin and wrinkle
// relief; low: no detail maps or relief (region shading, eyes, hair and the facial life only cost a few ALU).
// Run-time switches (A/B): ?look=classic (the old shader, nothing here runs), or any of
// ?look=nolight,nopores,noeyes,noface,nohair,nocloth,noskin; ?look=dbg:<channel> paints one analysis channel
// (oily, red, cav, thin, lips, brow, crow, nail, tip, det); ?looktier=high|medium|low forces a tier.
import * as THREE from 'three';
import { getQuality } from '../world/realism.js';
import { analyseData } from './skin_analyse.js';

const Q = new globalThis.URLSearchParams(globalThis.location ? globalThis.location.search : '');
const LOOKQ = (Q.get('look') || '').split(',').filter(Boolean);
// DEFAULT_ON: the new look is the default; false keeps it behind ?look=new while it is being verified
const DEFAULT_ON = true;
export const look = {
  classic: LOOKQ.includes('classic') || (!DEFAULT_ON && !LOOKQ.includes('new')),
  off: new Set(LOOKQ.filter(s => s.startsWith('no')).map(s => s.slice(2))),
  dbg: (LOOKQ.find(s => s.startsWith('dbg:')) || '').slice(4),
  tier: Q.get('looktier') || null,
  stats: { templates: 0, prepMs: 0, mainMs: 0, persons: 0 },
  sync: Q.has('looksync'), waitIdle: [],
};
const on = k => !look.off.has(k);
const tierName = () => look.tier || (() => { try { return getQuality(); } catch { return 'medium'; } })();
const TIER = { low: 0, medium: 1, high: 2 };

// ages and sexes of the builds (assets/models/cast_index.json); a person whose entry has not arrived yet starts at 30
const AGES = {};
try {
  globalThis.fetch?.(new globalThis.URL('../../assets/models/cast_index.json', import.meta.url).href).then(r => (r.ok ? r.json() : null))
    .then(j => { for (const c of (j && j.characters) || []) AGES[c.id] = { age: c.age, sex: c.sex }; for (const f of ageWait) f(); ageWait.length = 0; })
    .catch(() => {});
} catch { /* no fetch (node) */ }
const ageWait = [];

// ------------------------------------------------------------------------------------------------------------------
// detail maps (our own, generated once): skin pores + fine creases, and a fabric weave. RG = normal xy, B = cavity.
// ------------------------------------------------------------------------------------------------------------------
let detailMaps = null;
function hash2(x, y, s) { let h = Math.imul(x * 374761393 + y * 668265263 + s * 2147483647, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function heightToTexture(N, H, cav, strength) {
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, xl = (x + N - 1) % N, xr = (x + 1) % N, yu = (y + N - 1) % N, yd = (y + 1) % N;
    const dx = (H[y * N + xr] - H[y * N + xl]) * strength, dy = (H[yd * N + x] - H[yu * N + x]) * strength;
    const l = Math.hypot(dx, dy, 1);
    data[i * 4] = Math.round((-dx / l * 0.5 + 0.5) * 255); data[i * 4 + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255);
    data[i * 4 + 2] = Math.round(Math.max(0, Math.min(1, cav[i])) * 255); data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  return t;
}
function makeDetailMaps() {
  const N = 256;
  // skin: a 3 cm tile. Pores (jittered grid, ~0.35 mm dimples, slightly exaggerated so they register in close-ups), a
  // net of fine shallow creases (two crossing families, warped), soft bumps. Cavity: pores and creases dark.
  const H = new Float32Array(N * N), C = new Float32Array(N * N).fill(1);
  const cell = 7, G = N / cell | 0;
  for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
    for (let k = 0; k < 2; k++) {
      const px = (gx + hash2(gx, gy, 1 + k)) * N / G, py = (gy + hash2(gx, gy, 3 + k)) * N / G;
      const r = 1.1 + 1.4 * hash2(gx, gy, 5 + k), d = 0.5 + 0.5 * hash2(gx, gy, 7 + k);
      for (let oy = -4; oy <= 4; oy++) for (let ox = -4; ox <= 4; ox++) {
        const x = Math.floor(px) + ox, y = Math.floor(py) + oy, ddx = x + 0.5 - px, ddy = y + 0.5 - py;
        const g = Math.exp(-(ddx * ddx + ddy * ddy) / (2 * r * r)) * d;
        const i = ((y + N) % N) * N + ((x + N) % N);
        H[i] -= g; C[i] = Math.min(C[i], 1 - 0.55 * g);
      }
    }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N * Math.PI * 2, v = y / N * Math.PI * 2;
    const w1 = Math.sin(u * 3 + Math.sin(v * 2) * 1.3) * 1.6, w2 = Math.sin(v * 4 + Math.sin(u * 3) * 1.1) * 1.4;
    const l1 = Math.pow(Math.abs(Math.sin((u + v) * 9 + w1)), 14), l2 = Math.pow(Math.abs(Math.sin((u - v) * 11 + w2)), 14);
    const soft = 0.25 * Math.sin(u * 5 + Math.sin(v * 7)) * Math.sin(v * 6 + Math.sin(u * 4));
    const i = y * N + x;
    H[i] += -0.18 * (l1 + l2) + soft * 0.3;
    C[i] = Math.min(C[i], 1 - 0.12 * (l1 + l2));
  }
  const pores = heightToTexture(N, H, C, 0.55);
  // weave: a 2 cm tile, plain weave of 24 threads, each thread rounded, over / under alternating, slub noise
  const W = new Float32Array(N * N), WC = new Float32Array(N * N), T = 24, P = N / T;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const tx = Math.floor(x / P), ty = Math.floor(y / P), fx = (x % P) / P, fy = (y % P) / P;
    const warpUp = ((tx + ty) & 1) === 0;
    const slub = 0.85 + 0.3 * hash2(tx, 0, 11) * hash2(Math.floor(y / (P * 3)), tx, 12);
    const warp = Math.sin(fx * Math.PI) * (warpUp ? 1 : 0.55) * slub, weft = Math.sin(fy * Math.PI) * (warpUp ? 0.55 : 1) * (0.85 + 0.3 * hash2(ty, 1, 13));
    const i = y * N + x;
    W[i] = Math.max(warp, weft) + 0.05 * hash2(x, y, 14);
    WC[i] = 0.55 + 0.45 * Math.max(warp, weft);
  }
  const weave = heightToTexture(N, W, WC, 0.9);
  return { pores, weave };
}

// ------------------------------------------------------------------------------------------------------------------
// template analysis (rest pose, mesh space; once per geometry, shared by every clone)
// ------------------------------------------------------------------------------------------------------------------
// the atlas, read back small for the analysis (lips, hair colour): { S, data, flipY }, or null where it cannot be drawn
function atlasPixels(tex, S = 256) {
  try {
    const img = tex && tex.image; if (!img || !img.width) return null;
    const cv = globalThis.OffscreenCanvas ? new globalThis.OffscreenCanvas(S, S) : Object.assign(globalThis.document.createElement('canvas'), { width: S, height: S });
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, S, S);
    return { S, data: cx.getImageData(0, 0, S, S).data, flipY: !!tex.flipY };
  } catch { return null; }
}

// ------------------------------------------------------------------------------------------------------------------
// shader
// ------------------------------------------------------------------------------------------------------------------
const DBG = { oily: 'vAzFace.x', bd: 'vAzFace.x * azHair', tilt: 'azTilt + 0.5', red: 'vAzFace.y', cav: 'vAzFace.z', thin: 'vAzFace.w', lips: 'vAzFace2.x', brow: 'vAzFace2.y', crow: 'vAzFace2.z', nail: 'vAzFace2.w', tip: 'vAzHairT.w', det: 'fract( vAzDet )', tan: 'normalize( vAzHairT.xyz ) * 0.5 + 0.5', face: 'gl_FrontFacing ? vec3( 1.0, 0.2, 0.2 ) : vec3( 0.2, 0.2, 1.0 )', mask: 'vAzMask', nrm: 'normal * 0.5 + 0.5' };
function lightsChunk() {
  let s = THREE.ShaderChunk.lights_physical_pars_fragment;
  const a = 'vec3 irradiance = dotNL * directLight.color;';
  const b = 'reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );';
  const c = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
  if (!s.includes(a) || !s.includes(b) || !s.includes(c)) return s;
  s = s.replace(a, `${a}
    float azNL = dot( geometryNormal, directLight.direction );
    float azW = azSkin * AZ_WRAP + azHair * 0.2 + azCloth * 0.08;
    vec3 azIrr = ( vec3( dotNL ) + ( saturate( ( azNL + azW ) / ( 1.0 + azW ) ) - dotNL ) * mix( vec3( 1.0 ), vec3( 1.0, 0.42, 0.3 ), azSkin ) ) * directLight.color;
    // thin skin (ears, nostril wings, lids) lets red light through from behind (medium / high: per-light cost)
    #if AZ_TIER > 0
    if ( azExtra > 0.5 && azThin > 0.01 ) {
      float azBack = pow( saturate( dot( geometryViewDir, - directLight.direction ) ), 3.0 ) * 0.7 + saturate( - azNL ) * 0.25;
      azIrr += azThin * azBack * vec3( 1.0, 0.28, 0.16 ) * directLight.color;
    }
    #endif`);
  s = s.replace(b, `{ vec3 azSp = irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
    #if AZ_TIER > 0
    if ( azExtra > 0.5 && azHair > 0.01 ) azSp = mix( azSp, azHairSpec( directLight.direction, geometryViewDir, geometryNormal ) * directLight.color * saturate( azNL * 0.6 + 0.4 ), azHair * AZ_HAIRK );
    if ( azExtra > 0.5 && azEyeK > 0.5 ) azSp += ( 1.0 - azLidK ) * directLight.color * ( pow( saturate( dot( geometryNormal, normalize( directLight.direction + geometryViewDir ) ) ), 900.0 ) * 2.5 * saturate( azNL * 4.0 ) );
    #endif
    #if AZ_TIER > 1
    if ( azCloth > 0.01 ) azSp += azCloth * material.diffuseColor * directLight.color * ( pow( 1.0 - saturate( dot( geometryNormal, geometryViewDir ) ), 4.0 ) * saturate( azNL + 0.35 ) * 0.5 );
    #endif
    reflectedLight.directSpecular += azSp; }`);
  s = s.replace(c, 'reflectedLight.directDiffuse += azIrr * BRDF_Lambert( material.diffuseColor );');
  // Kajiya-Kay strands: a white primary lobe shifted toward the root, a tinted secondary lobe toward the tip, broken
  // up along the strands by the painted strand stripes
  return `vec3 azHairSpec( vec3 L, vec3 V, vec3 N ) {
    vec3 H = normalize( L + V );
    vec3 T1 = normalize( azTv + N * ( azShift - 0.1 ) ), T2 = normalize( azTv + N * ( azShift + 0.14 ) );
    float d1 = dot( T1, H ), d2 = dot( T2, H );
    float s1 = pow( sqrt( max( 0.0, 1.0 - d1 * d1 ) ), 110.0 ), s2 = pow( sqrt( max( 0.0, 1.0 - d2 * d2 ) ), 28.0 );
    return vec3( s1 * 0.12 * azSparkle ) + azHairTint * s2 * 0.25 * ( 0.5 + 0.5 * azSparkle );
  }
` + s;
}

function patch(sh, U, tier, dbg, far = false) {
  const T = tier;
  Object.assign(sh.uniforms, U);
  sh.defines = sh.defines || {};
  sh.defines.AZ_TIER = T;
  sh.defines.AZ_WRAP = on('light') ? '0.3' : '0.5';
  sh.defines.AZ_HAIRK = on('hair') ? '0.88' : '0.0';
  if (on('eyes') && U.azEyeC.value.z > 0 && !far) sh.defines.AZ_EYES = 1;
  if (U.azV2) sh.defines.AZ_EYEBONE = 1;      // look v2 builds: real eye, lid and jaw bones (src/human/rig2.js)
  // hero pipeline: people with strand cards (rig2.js) wear the hair volume as the dark layer under the cards: finer
  // baby hairs at its edge, fainter streaks, a soft sheen (the cards carry the strand highlights)
  if (U.azCards) { sh.defines.AZ_CARDS = 1; sh.defines.AZ_HAIRK = on('hair') ? '0.4' : '0.0'; }
  if (far) sh.defines.AZ_FAR = 1;
  if (on('skin')) sh.defines.AZ_SKIN = 1;
  if (on('pores') && T > 0) sh.defines.AZ_PORES = 1;
  if (on('cloth') && T > 1) sh.defines.AZ_WEAVE = 1;
  if (on('light')) sh.defines.AZ_LIGHT = 1;
  sh.vertexShader = `attribute vec3 azMask; attribute vec4 azFace; attribute vec4 azFace2; attribute vec4 azHairT; attribute float azDet;
varying vec3 vAzMask; varying vec4 vAzFace; varying vec4 vAzFace2;
#if AZ_TIER > 0
varying vec4 vAzHairT; varying vec3 vAzRest; varying float vAzDet;
#else
varying float vAzTip;
#endif
uniform vec4 azExpr;
` + sh.vertexShader
    .replace('#include <begin_vertex>', `#include <begin_vertex>
	vAzMask = azMask; vAzFace = azFace; vAzFace2 = azFace2;
	#if AZ_TIER > 0
	vAzDet = azDet; vAzRest = position;
	#else
	vAzTip = azHairT.w;
	#endif
	// micro-expressions on the rest mesh: the brows lift (azExpr.x; skin vertices carry the lift weight in azHairT.w)
	transformed.y += step( 0.5, azMask.r ) * azHairT.w * azExpr.x * 0.0028;`)
    .replace('#include <skinnormal_vertex>', `#include <skinnormal_vertex>
	#if AZ_TIER > 0
	{ vec3 azTo = azHairT.xyz;
	#ifdef USE_SKINNING
	  azTo = ( skinMatrix * vec4( azTo, 0.0 ) ).xyz;
	#endif
	  vAzHairT = vec4( normalMatrix * azTo, azHairT.w ); }
	#endif`);
  // (the low tier interpolates 11 floats instead of 23: no strand tangent, rest position or texel density)
  let F = `varying vec3 vAzMask; varying vec4 vAzFace; varying vec4 vAzFace2;
#if AZ_TIER > 0
varying vec4 vAzHairT; varying vec3 vAzRest; varying float vAzDet;
#else
varying float vAzTip;
#endif
#if AZ_TIER == 0
#define vAzHairT vec4( 0.0, 1.0, 0.0, vAzTip )
#endif
uniform vec4 azEye; uniform vec4 azEyeC; uniform vec4 azLid; uniform vec4 azLook; uniform vec3 azHairTint; uniform vec3 azEyeX; uniform vec3 azEyeY; uniform vec3 azEyeZ;
uniform vec4 azEyeL; uniform vec4 azEyeR; uniform vec4 azCrown; uniform vec3 azLidSkin; uniform vec3 azLashC; uniform vec3 azIrisC; uniform vec4 azMouth;
#ifdef AZ_PORES
uniform sampler2D azPoreMap;
#endif
#ifdef AZ_WEAVE
uniform sampler2D azWeaveMap;
#endif
float azSkin = 0.0; float azGloss = 0.0; float azHair = 0.0; float azCloth = 0.0; float azThin = 0.0; float azCav = 0.0;
float azExtra = 1.0; float azTilt = 0.0; float azEyeK = 0.0; float azLidK = 0.0; float azTear = 0.0; float azShift = 0.0; float azSparkle = 1.0; float azMicro = 1.0; vec3 azTv = vec3( 0.0, 1.0, 0.0 );
` + sh.fragmentShader;
  F = F.replace('void main() {', `void main() {
	azSkin = vAzMask.r; azGloss = vAzMask.g; azHair = vAzMask.b;
	azCloth = saturate( 1.0 - azSkin - azHair ) * ( 1.0 - smoothstep( 0.12, 0.5, azGloss ) );
	azThin = vAzFace.w * azSkin; azCav = vAzFace.z;
	azTv = normalize( vAzHairT.xyz + vec3( 0.0, 1e-4, 0.0 ) );`);
  // ---- albedo: eyes (gaze, lids, catch-light), skin regions, hair root to tip
  F = F.replace('#include <map_fragment>', `
#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
#ifdef AZ_EYES
	vec2 azE = ( vMapUv - azEyeC.xy ) / azEyeC.z; azE.y = - azE.y;
	vec2 azS = vec2( 0.0 );
	bool azIsEye = azGloss > 0.9 && azSkin < 0.1 && azHair < 0.1 && dot( azE, azE ) < 1.3;
	if ( azIsEye ) {
		// the iris disc read at the gaze-shifted place (the shell is a sphere: the shift reads as the eye turning)
		azEyeK = 1.0;
		azS = azE - azEye.xy;
	#ifdef AZ_EYEBONE
		azS = azE;
	#endif
	#if AZ_TIER > 1
		// iris depth: the iris sits behind the cornea, so it shifts against the view direction
		{ vec3 azVw = normalize( ( vec4( normalize( vViewPosition ), 0.0 ) * viewMatrix ).xyz );
		  float azIr = smoothstep( 0.42, 0.3, length( azS ) );
		  azS -= azIr * 0.07 * vec2( dot( azVw, azEyeX ), dot( azVw, azEyeY ) ) / max( 0.4, dot( azVw, azEyeZ ) ); }
	#endif
		float azSl = length( azS ); if ( azSl > 0.97 ) azS *= 0.97 / azSl;
		sampledDiffuseColor = texture2D( map, azEyeC.xy + vec2( azS.x, - azS.y ) * azEyeC.z );
		// the painted catch-light (fixed in the texture) gives way to the iris colour
		vec2 azDc = azS - vec2( -0.17, 0.17 ); float azWc = exp( - dot( azDc, azDc ) / 0.006 );
		sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, azIrisC, min( 1.0, azWc * 1.5 ) );
		// upper lid line (closes with azEye.z, drops when looking down), lid shadow, lash line, tear meniscus
		float azLy = mix( azLid.x + 0.07, azLid.y - 0.03, azEye.z ) - azEye.w - 0.4 * azE.x * azE.x * ( 1.0 - azEye.z );
		azLidK = smoothstep( -0.012, 0.012, azE.y - azLy );
	#ifdef AZ_EYEBONE
		azLy = 0.55; azLidK = 0.0;      // the real lid covers the eyeball; a soft shade under it stays
	#endif
		float azShade = 1.0 - 0.55 * ( 1.0 - smoothstep( 0.0, 0.17, azLy - azE.y ) );
		azShade *= 1.0 - 0.3 * smoothstep( 0.35, 0.75, abs( azE.x ) );
		sampledDiffuseColor.rgb *= azShade;
		azTear = smoothstep( 0.05, 0.0, abs( azE.y - azLid.y - 0.02 ) ) * ( 1.0 - azLidK );
		vec3 azLidC = mix( azLidSkin * vec3( 0.86, 0.76, 0.74 ), azLashC, smoothstep( 0.05, 0.0, azE.y - azLy ) * 0.85 );
		sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, azLidC, azLidK );
		azSkin = max( azSkin, azLidK ); azGloss *= 1.0 - azLidK; azCav = max( azCav, 0.25 * ( 1.0 - azLidK ) );
	}
#endif
	diffuseColor *= sampledDiffuseColor;
#endif`);
  F = F.replace('#include <color_fragment>', `#include <color_fragment>
#ifdef AZ_SKIN
	if ( azSkin > 0.01 && azEyeK < 0.5 ) {
		vec3 azC = diffuseColor.rgb;
		// blood under the skin: cheeks, nose, ears, knuckles redder; eye sockets darker and cooler; lips; nails paler
		azC *= mix( vec3( 1.0 ), vec3( 1.05, 0.93, 0.92 ), vAzFace.y * azSkin );
		azC *= mix( vec3( 1.0 ), vec3( 0.86, 0.85, 0.9 ), vAzFace.z * azSkin * 0.8 );
		azC = mix( azC, azC * vec3( 1.04, 0.92, 0.92 ), vAzFace2.x * azSkin * 0.5 );
		azC = mix( azC, azC * vec3( 1.05, 1.0, 1.0 ) + vec3( 0.035, 0.025, 0.025 ), vAzFace2.w * azSkin );
		// complexion: blotches and, with age, spots (rest-space noise, so they stay on the body); not on the low tier
	#if AZ_TIER > 0
		{ vec3 azP = vAzRest * 70.0; float azN = sin( azP.x * 1.7 + sin( azP.y * 2.3 ) ) * sin( azP.y * 1.9 + sin( azP.z * 2.9 ) ) * sin( azP.z * 2.1 + sin( azP.x * 3.1 ) );
		  azC *= 1.0 + azSkin * ( 0.03 * azN - azLook.x * 0.09 * smoothstep( 0.55, 0.9, azN ) );
		  azC = mix( azC, azC * vec3( 1.04, 0.95, 0.94 ), azSkin * 0.25 * smoothstep( -0.2, 0.6, azN ) ); }
	#endif
	#if AZ_TIER > 0 && !defined( AZ_FAR )
		// speech: the lips part along the mouth line (the closed cast mouth has no interior: a dark opening is shaded in)
		if ( azMouth.w > 0.01 ) {
			vec3 azMd = vAzRest - azMouth.xyz;
			float azSy = 0.0011 + 0.0026 * azMouth.w;
			float azMo = azMouth.w * exp( - azMd.y * azMd.y / ( azSy * azSy ) ) * ( 1.0 - smoothstep( 0.010, 0.022, abs( azMd.x ) ) ) * step( -0.012, azMd.z );
			azC = mix( azC, vec3( 0.045, 0.012, 0.01 ), saturate( azMo * 1.3 ) );
			azCav = max( azCav, saturate( azMo ) );
		}
	#endif
		diffuseColor.rgb = azC;
	}
#endif
	if ( azHair > 0.01 ) {
		// root to tip: darker roots, lighter sun-touched tips; strand-to-strand variation drives the highlight shift
		float azL = dot( diffuseColor.rgb, vec3( 0.3, 0.55, 0.15 ) ), azB = dot( azHairTint, vec3( 0.3, 0.55, 0.15 ) ) + 1e-3;
		float azV = clamp( azL / azB - 1.0, -1.0, 1.0 );
		// strands: a fine streak pattern across the strand direction (angle around the crown, rest space), faded out
		// where a strand gets thinner than a pixel; it shifts and breaks up the highlight and the colour
		float azN = 0.0;
	#if AZ_TIER > 0
		vec3 azRc = vAzRest - azCrown.xyz;
		float azTh = atan( azRc.x, azRc.z ), azAl = length( azRc ) * 30.0;
		azN = sin( azTh * 400.0 + 1.7 * sin( azAl * 7.0 ) ) * 0.5 + sin( azTh * 923.0 + 0.8 * sin( azAl * 11.0 ) ) * 0.3 + sin( azTh * 228.0 + azAl * 3.0 ) * 0.2;
		float azSk = 1.0 - smoothstep( 1.0, 3.0, fwidth( azTh * 400.0 ) );
		azN *= azSk;
	#endif
	#if AZ_TIER > 0
	#ifndef AZ_FAR
		if ( AZ_HAIRK > 0.0 && azHair > 0.5 ) {
			// clumps of strands (~4 mm): the normal rolls across each clump, so the highlight breaks into strands
		#ifdef AZ_CARDS
			float azSx = azTh * 110.0 + 0.35 * sin( azAl * 1.3 ), azId = floor( azSx ), azFr = fract( azSx );
		#else
			float azSx = azTh * 40.0 + 0.35 * sin( azAl * 1.3 ), azId = floor( azSx ), azFr = fract( azSx );
		#endif
			float azRn = fract( sin( azId * 12.9898 + 78.233 ) * 43758.5453 );
			float azCk = 1.0 - smoothstep( 0.35, 0.9, fwidth( azSx ) );
			azTilt = ( azFr - 0.5 ) * 1.1 * azCk;
			diffuseColor.rgb *= 1.0 + ( azRn - 0.5 ) * 0.22 * azCk;
			// frayed tips: near the shell's edge each clump ends at its own length and tapers to a point
			float azBd = vAzFace.x * 0.03, azW = abs( azFr - 0.5 ) * 2.0;
		#ifdef AZ_CARDS
			if ( azBd < 0.007 * azRn * ( 0.2 + 0.8 * azW ) * azCk + 0.0015 * azW * azCk ) discard;
		#else
			if ( azBd < 0.014 * azRn * ( 0.2 + 0.8 * azW ) * azCk + 0.0025 * azW * azCk ) discard;
		#endif
		}
	#endif
	#endif
		azShift = azV * 0.08 + azN * 0.12; azSparkle = 0.45 + 0.9 * smoothstep( -0.6, 0.8, azN + azV * 0.5 );
	#ifdef AZ_CARDS
		azN *= 0.45;
	#endif
		diffuseColor.rgb *= 1.0 + 0.16 * azN * azHair;
		diffuseColor.rgb *= mix( 1.0, mix( 0.74, 1.14, vAzHairT.w ), azHair );
	}`);
  // ---- roughness by region (skin, lips, nails, hair, cornea, tear line)
  F = F.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
	{ float azRs = mix( 0.56, 0.38, vAzFace.x );
	  azRs = mix( azRs, 0.3, vAzFace2.x ); azRs = mix( azRs, 0.28, vAzFace2.w ); azRs += azLook.x * 0.06;
	#ifdef USE_ROUGHNESSMAP
	  azRs = mix( azRs, texelRoughness.g, 0.75 );      // look v2 builds bake skin roughness (T-zone, lips, nails, pores)
	#endif
	#ifndef AZ_SKIN
	  azRs = 0.5;
	#endif
	  float azRg = azEyeK > 0.5 ? mix( 0.035, 0.02, azTear ) : 0.07;
	  roughnessFactor = mix( mix( mix( roughnessFactor, azRs, azSkin ), 0.44, azHair ), azRg, azGloss ); }`);
  // ---- normals: pore / weave detail (tier-gated), wrinkle relief with age
  F = F.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#if AZ_TIER > 0
	if ( azHair > 0.5 && azTilt != 0.0 ) { vec3 azB = cross( normal, azTv ); normal = normalize( normal + azB * ( azTilt * inversesqrt( max( dot( azB, azB ), 1e-6 ) ) ) ); }
	{ float azDist = length( vViewPosition );
	  float azFade = 1.0 - smoothstep( 1.0, 3.2, azDist );
	  vec3 azQ0 = dFdx( - vViewPosition ), azQ1 = dFdy( - vViewPosition );
	#if defined( AZ_SKIN ) && AZ_TIER > 1
	  if ( azFade > 0.0 && azSkin > 0.5 && azEyeK < 0.5 && azLook.x > 0.02 ) {
		// forehead lines and crow's feet (rest space, so they move with the skin), deeper with age
		vec3 azP = vAzRest;
		// a few broken forehead lines, each with its own depth along its length
		float azPh = azP.y * 680.0 + 2.0 * sin( azP.x * 55.0 ) + 0.7 * sin( azP.x * 131.0 );
		float azLi = floor( azPh / 6.2832 + 0.5 );
		float azBr = smoothstep( 0.1, 0.7, sin( azP.x * ( 70.0 + 23.0 * fract( azLi * 0.618 ) ) + azLi * 2.4 ) * 0.5 + 0.5 );
		float azH = - pow( 0.5 + 0.5 * cos( azPh ), 10.0 ) * azBr * vAzFace2.y * smoothstep( 0.2, 0.9, vAzFace2.y ) * ( 1.0 - smoothstep( 0.6, 1.6, fwidth( azPh ) ) );
		// crow's feet: a few fine lines fanning out from the outer eye corner
		vec3 azEc = azP.x > azEyeL.x * 0.5 + azEyeR.x * 0.5 ? azEyeL.xyz : azEyeR.xyz;
		vec2 azD = azP.xy - azEc.xy - vec2( sign( azP.x - azEc.x ) * azEyeL.w * 0.42, 0.0 );
		float azCa = atan( azD.y, abs( azD.x ) ) * 7.0 + sin( length( azD ) * 400.0 ) * 0.3;
		azH -= pow( 0.5 + 0.5 * cos( azCa ), 14.0 ) * vAzFace2.z * smoothstep( 0.004, 0.009, length( azD ) ) * ( 1.0 - smoothstep( 0.6, 1.6, fwidth( azCa ) ) );
		azH *= azLook.x * 0.00035 * azFade;
		vec2 azHd = vec2( dFdx( azH ), dFdy( azH ) );
		vec3 azR1 = cross( azQ1, normal ), azR2 = cross( normal, azQ0 ); float azDet = dot( azQ0, azR1 ) * faceDirection;
		normal = normalize( abs( azDet ) * normal - sign( azDet ) * ( azHd.x * azR1 + azHd.y * azR2 ) );
	  }
	#endif
	#if defined( AZ_PORES ) || defined( AZ_WEAVE )
	  bool azDoSkin = false, azDoCloth = false;
	  #ifdef AZ_PORES
	  azDoSkin = azSkin > 0.5 && azEyeK < 0.5;
	  #endif
	  #ifdef AZ_WEAVE
	  azDoCloth = azCloth > 0.5 && azFade > 0.0;
	  #endif
	  if ( azFade > 0.0 && ( azDoSkin || azDoCloth ) ) {
		vec2 azDuv = vMapUv * vAzDet / ( azDoSkin ? 0.03 : 0.02 );
		vec4 azDn;
		#if defined( AZ_PORES ) && defined( AZ_WEAVE )
		  azDn = azDoSkin ? texture2D( azPoreMap, azDuv ) : texture2D( azWeaveMap, azDuv );
		#elif defined( AZ_PORES )
		  azDn = texture2D( azPoreMap, azDuv );
		#else
		  azDn = texture2D( azWeaveMap, azDuv );
		#endif
		float azK = azFade * ( azDoSkin ? 0.5 + 0.2 * vAzFace.x : 0.75 );
		vec2 azNxy = ( azDn.xy * 2.0 - 1.0 ) * azK;
		vec3 azS0 = vec3( dFdx( azDuv ), 0.0 ), azS1 = vec3( dFdy( azDuv ), 0.0 );
		vec3 azR1 = cross( azQ1, normal ), azR2 = cross( normal, azQ0 );
		vec3 azT = azR1 * azS0.x + azR2 * azS1.x, azBt = azR1 * azS0.y + azR2 * azS1.y;
		float azM = max( dot( azT, azT ), dot( azBt, azBt ) );
		if ( azM > 0.0 ) { float azSc = inversesqrt( azM ); normal = normalize( azT * ( azNxy.x * azSc ) + azBt * ( azNxy.y * azSc ) + normal * sqrt( max( 0.0, 1.0 - dot( azNxy, azNxy ) ) ) ); }
		azMicro = mix( 1.0, azDn.b, azFade );
	  }
	#endif
	}
#endif`);
  // ---- after the physical material is set up: pores break up the specular, wet hair never turns to vinyl
  F = F.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
	material.roughness = min( 1.0, material.roughness + ( 1.0 - azMicro ) * 0.25 * azSkin );
	material.roughness = mix( material.roughness, max( material.roughness, 0.36 ), azHair );
	// the cornea: a wet, nearly smooth surface (no geometry roughness: the shell is small and curved)
	// (its tear film reflects a little more than the 4 % of a dry dielectric, so catch-lights read in dim places)
	if ( azEyeK > 0.5 ) { material.roughness = mix( mix( 0.09, 0.06, azTear ), material.roughness, azLidK ); material.specularColor *= mix( 2.2, 1.0, azLidK ); }
	material.specularColor *= mix( 1.0, azMicro, azSkin );`);
  F = F.replace('#include <lights_physical_pars_fragment>', lightsChunk());
  // the per-light extras (translucency, strand highlights, the cornea's catch-light) only for directional and spot
  // lights (sun, moon, the dialogue key and rim): city scenes add up to 19 point lights, each would pay them again
  {
    let lb = THREE.ShaderChunk.lights_fragment_begin;
    const pk = '#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )', sk = '#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )';
    if (lb.includes(pk) && lb.includes(sk)) { lb = lb.replace(pk, 'azExtra = 0.0;\n' + pk).replace(sk, 'azExtra = 1.0;\n' + sk); F = F.replace('#include <lights_fragment_begin>', lb); }
  }
  // ---- indirect light: occlusion in cavities and contacts; a fresnel sheen driven by the scene's own ambient (no
  // constant studio fill: faces darken in the dark and take the place's colour)
  F = F.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
	{ float azAo = 1.0 - azCav * 0.65;
	  reflectedLight.indirectDiffuse *= azAo; reflectedLight.indirectSpecular *= azAo * azAo * ( 1.0 - 0.55 * azHair );
	#ifdef AZ_SKIN
	  // light that travelled under the skin comes out redder (multiple scattering): a small red shift of the ambient
	  reflectedLight.indirectDiffuse *= mix( vec3( 1.0 ), vec3( 1.04, 0.98, 0.95 ), azSkin * ( 1.0 - azEyeK ) );
	#endif
	  float azF = pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 4.0 );
	#ifdef AZ_LIGHT
	  reflectedLight.indirectDiffuse += material.diffuseColor * ( irradiance + iblIrradiance ) * RECIPROCAL_PI * azF * ( azSkin * 0.6 + azCloth * 0.4 + azHair * 0.3 );
	#else
	  reflectedLight.indirectDiffuse += material.diffuseColor * ( vec3( 0.045, 0.048, 0.058 ) + vec3( 0.07, 0.08, 0.1 ) * pow( azF, 0.75 ) ) * ( 1.0 - 0.5 * azGloss );
	#endif
	}`);
  if (dbg && DBG[dbg]) F = F.replace('#include <dithering_fragment>', `#include <dithering_fragment>\n\tgl_FragColor = vec4( vec3( ${DBG[dbg]} ), 1.0 );`);
  sh.fragmentShader = F;
}

// ------------------------------------------------------------------------------------------------------------------
// per person: material, uniforms, facial life
// ------------------------------------------------------------------------------------------------------------------
let mainCam = null;
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// far: the variant for people more than FAR m from the camera (no eye branch, no frayed hair tips: invisible there)
const FAR = 8;
function lookMaterial(src, U, info, far = false) {
  const m = src.clone();
  m.userData = { ...src.userData, azSkin: true, azLook: true, azFar: far };
  const tierKey = () => { const t = TIER[tierName()] ?? 1; return t; };
  m.customProgramCacheKey = () => 'azlook' + tierKey() + '|' + [...look.off].join('') + look.dbg + (U.azEyeC.value.z > 0 && !far ? 'e' : '') + (far ? 'f' : '') + (U.azV2 ? 'b' : '') + (U.azCards ? 'c' : '');
  m.onBeforeCompile = sh => {
    const t = tierKey();
    if (t > 0 && (on('pores') || on('cloth'))) { detailMaps ??= makeDetailMaps(); U.azPoreMap = { value: detailMaps.pores }; U.azWeaveMap = { value: detailMaps.weave }; }
    patch(sh, U, t, look.dbg, far);
  };
  void info;
  m.needsUpdate = true;
  return m;
}

/**
 * Hook for makePerson (cast3d.js): gives person handle `h` the look shading and facial life. No-op with ?look=classic.
 * Adds h.face = { blink(), look(worldPoint|null), state } (optional for callers: feature-detect h.face).
 */
export function lookPerson(h, seed = 1) {
  if (look.classic || !h || !h.meshes) return h;
  const atlas = h.meshes.filter(o => o.isSkinnedMesh && [].concat(o.material).some(m => m && m.userData && m.userData.slot === 'atlas'));
  if (!atlas.length) return h;
  // the body: the biggest non-LOD atlas mesh (hand props such as staffs share the atlas material and come first)
  const main = atlas.filter(o => !o.userData.lod && !o.userData.gadget).sort((x, y) => y.geometry.attributes.position.count - x.geometry.attributes.position.count)[0] || atlas[0];
  const g = main.geometry;
  const info = g.userData.azLook;
  if (info) return info.failed ? h : applyLook(h, seed, atlas, main, info);
  // a template seen for the first time: analysed in a worker (or at once with look.sync); the person keeps the
  // classic shading until the result is in
  request(main, h.id).then(inf => { if (!inf.failed) applyLook(h, seed, atlas, main, inf); });
  return h;
}

// ---- the analysis: one job per template geometry, in a worker when there is one
const jobs = new Map();
let worker = null, jobId = 0;
const now = () => (globalThis.performance ? globalThis.performance.now() : Date.now());
function extract(mesh) {
  const g = mesh.geometry, A = g.attributes, n = A.position.count;
  const PA = new Float32Array(n * 3), NA = new Float32Array(n * 3), MK = new Float32Array(n * 3);
  const UV = A.uv ? new Float32Array(n * 2) : null, SKI = A.skinIndex ? new Uint16Array(n * 4) : null, SKW = A.skinWeight ? new Float32Array(n * 4) : null;
  for (let i = 0; i < n; i++) {
    PA[i * 3] = A.position.getX(i); PA[i * 3 + 1] = A.position.getY(i); PA[i * 3 + 2] = A.position.getZ(i);
    NA[i * 3] = A.normal.getX(i); NA[i * 3 + 1] = A.normal.getY(i); NA[i * 3 + 2] = A.normal.getZ(i);
    MK[i * 3] = A.azMask.getX(i); MK[i * 3 + 1] = A.azMask.getY(i); MK[i * 3 + 2] = A.azMask.getZ(i);
    if (UV) { UV[i * 2] = A.uv.getX(i); UV[i * 2 + 1] = A.uv.getY(i); }
    if (SKI) for (let k = 0; k < 4; k++) { SKI[i * 4 + k] = A.skinIndex.getComponent(i, k); SKW[i * 4 + k] = A.skinWeight.getComponent(i, k); }
  }
  const IDX = g.index ? Uint32Array.from(g.index.array) : null;
  const sk = mesh.skeleton, bones = sk ? sk.bones.map(b => b.name.replace(/_\d+$/, '')) : [];
  const handRest = ['hand_L', 'hand_R'].map(nm => {
    const b = bones.indexOf(nm); if (b < 0) return null;
    const hp = new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[b].clone().invert()).applyMatrix4(mesh.bindMatrixInverse);
    return [hp.x, hp.y, hp.z];
  });
  const mat = [].concat(mesh.material).find(m => m.userData.slot === 'atlas');
  return { n, PA, NA, UV, MK, SKI, SKW, IDX, bones, handRest, pix: atlasPixels(mat && mat.map) };
}
function finish(J, r) {
  if (!r || r.failed) { console.warn('look: analysis failed for', J.id, r && r.error); r = { failed: true }; }
  else {
    r.attrs = { azFace: new THREE.BufferAttribute(r.attrs.azFace, 4, true), azFace2: new THREE.BufferAttribute(r.attrs.azFace2, 4, true),
      azHairT: new THREE.BufferAttribute(r.attrs.azHairT, 4, true), azDet: new THREE.BufferAttribute(r.attrs.azDet, 1) };
    look.stats.templates++; look.stats.prepMs += r.ms; look.stats.mainMs += J.mainMs;
  }
  J.geometry.userData.azLook = r; jobs.delete(J.geometry);
  for (const f of J.waiters) try { f(r); } catch (e) { console.warn('look:', e && e.message); }
  if (!jobs.size) { const w = look.waitIdle; look.waitIdle = []; w.forEach(f => f()); }
}
function runSync(J) { let r; try { r = analyseData(J.D); } catch (e) { r = { failed: true, error: e && e.message }; } J.D = null; finish(J, r); }
function getWorker() {
  if (worker !== null) return worker;
  worker = false;
  if (look.sync || typeof globalThis.Worker !== 'function') return worker;
  try {
    const w = new globalThis.Worker(new globalThis.URL('./skin_worker.js', import.meta.url), { type: 'module' });
    w.onmessage = e => { for (const J of jobs.values()) if (J.wid === e.data.id) { J.D = null; finish(J, e.data.r); break; } };
    // no module workers here (or the worker died): the rest runs on the main thread
    w.onerror = () => { worker = false; for (const J of [...jobs.values()]) if (J.D) runSync(J); };
    worker = w;
  } catch { worker = false; }
  return worker;
}
function request(mesh, id) {
  const g = mesh.geometry;
  let J = jobs.get(g);
  if (!J) {
    const t0 = now();
    J = { id, geometry: g, waiters: [], wid: ++jobId, D: null, mainMs: 0 };
    jobs.set(g, J);
    try { J.D = extract(mesh); } catch (e) { J.mainMs = now() - t0; finish(J, { failed: true, error: e && e.message }); return Promise.resolve(g.userData.azLook); }
    J.mainMs = now() - t0;
    const w = getWorker();
    if (w) { try { w.postMessage({ id: J.wid, D: J.D }); } catch { runSync(J); } } else runSync(J);
  }
  if (g.userData.azLook) return Promise.resolve(g.userData.azLook);
  return new Promise(ok => J.waiters.push(ok));
}
// tools and tests: resolves when every template analysis has finished
look.idle = () => (jobs.size ? new Promise(ok => look.waitIdle.push(ok)) : Promise.resolve());

function applyLook(h, seed, atlas, main, info) {
  if (h.face) return h;
  const E = info.eyes, Fc = info.face;
  const age = AGES[h.id]?.age;
  const U = {
    azEye: { value: new THREE.Vector4(0, 0, 0, 0) },
    azEyeC: { value: E ? new THREE.Vector4(E.cu, E.cv, E.R, E.cs) : new THREE.Vector4(0, 0, 0, 0) },
    azLid: { value: new THREE.Vector4(E ? E.U : 0.12, E ? E.Lo : -0.22, 0, 0) },
    azLook: { value: new THREE.Vector4(age != null ? Math.max(0, Math.min(1, (age - 22) / 50)) : 0.15, 0, 0, 0) },
    azHairTint: { value: new THREE.Vector3(...Fc.hair) },
    azLidSkin: { value: new THREE.Vector3(...(E && E.lidC ? E.lidC : [0.4, 0.25, 0.2])) },
    azLashC: { value: new THREE.Vector3(...(E && E.lashC ? E.lashC : [0.03, 0.02, 0.02])) },
    azIrisC: { value: new THREE.Vector3(...(E && E.irisC ? E.irisC : [0.05, 0.04, 0.03])) },
    azEyeX: { value: new THREE.Vector3(1, 0, 0) }, azEyeY: { value: new THREE.Vector3(0, 1, 0) }, azEyeZ: { value: new THREE.Vector3(0, 0, 1) },
    azEyeL: { value: E ? new THREE.Vector4(...E.L.c, Fc.u) : new THREE.Vector4(Fc.M[0] + 0.032, Fc.M[1], Fc.M[2], Fc.u) },
    azEyeR: { value: E ? new THREE.Vector4(...E.Rr.c, Fc.u) : new THREE.Vector4(Fc.M[0] - 0.032, Fc.M[1], Fc.M[2], Fc.u) },
    azExpr: { value: new THREE.Vector4(0, 0, 0, 0) },
    azMouth: { value: new THREE.Vector4(...(Fc.mouth || [0, 0, 0]), 0) },
    azCrown: { value: new THREE.Vector4(Fc.M[0], Fc.M[1] + 2.3 * Fc.u, Fc.M[2] - 1.5 * Fc.u, 0) },
  };
  if (h.rig2 && h.rig2.face) Object.defineProperty(U, 'azV2', { value: true, enumerable: false });
  if (h.rig2 && h.rig2.cards) Object.defineProperty(U, 'azCards', { value: true, enumerable: false });
  if (age == null) ageWait.push(() => { const a = AGES[h.id]?.age; if (a != null) U.azLook.value.x = Math.max(0, Math.min(1, (a - 22) / 50)); });
  const mats = new Map(), swaps = [];
  const pick = (m, far) => { const k = far ? 'f' : 'n'; let e = mats.get(m); if (!e) mats.set(m, e = {}); return e[k] || (e[k] = lookMaterial(m, U, info, far)); };
  const conv = (mat, far) => (Array.isArray(mat) ? mat.map(m => (m.userData.slot === 'atlas' ? pick(m, far) : m)) : (mat.userData.slot === 'atlas' ? pick(mat, far) : mat));
  for (const o of atlas) {
    if (!o.geometry.attributes.azFace) {
      for (const k in info.attrs) {
        const a = info.attrs[k];
        if (o.geometry.attributes.position.count === a.count) o.geometry.setAttribute(k, a);
      }
    }
    if (!o.geometry.attributes.azFace) continue;
    const before = o.material;
    o.material = conv(before, false);
    swaps.push([o, before, o.material, conv(before, true)]);
  }
  look.stats.persons++;
  // ---- facial life
  const R = mulberry((seed * 7919 + 13) | 0);
  const S = { t: 0, nextBlink: 0.6 + R() * 2.5, blinkT: -1, gaze: new THREE.Vector2(), want: new THREE.Vector2(), sacc: 0.3 + R(), glance: 2 + R() * 5,
    glanceOff: new THREE.Vector2(), micro: new THREE.Vector2(), brow: 0, browT: 3 + R() * 6, browTo: 0, frame: -1, far: false, fix: null, on: true, jaw: 0, jawTo: 0, sylT: 0, say: 0 };
  const headBone = main.skeleton ? main.skeleton.bones.findIndex(b => b.name.replace(/_\d+$/, '') === 'head') : -1;
  const eyeMid = E ? new THREE.Vector3((E.L.c[0] + E.Rr.c[0]) / 2, (E.L.c[1] + E.Rr.c[1]) / 2, (E.L.c[2] + E.Rr.c[2]) / 2) : new THREE.Vector3(...Fc.M);
  const blinkCurve = t => (t < 0 ? 0 : t < 0.075 ? t / 0.075 : t < 0.11 ? 1 : t < 0.27 ? 1 - (t - 0.11) / 0.16 : 0);
  const character = () => { let p = h.root.parent; for (let k = 0; k < 3 && p; k++, p = p.parent) if (p.userData && p.userData.character) return p.userData.character; return null; };
  h.face = {
    state: S, uniforms: U, info,
    blink() { if (S.blinkT < 0) S.blinkT = 0; },
    // speak for `sec` seconds without a Character (tools); a Character's talk timer does the same
    say(sec) { S.say = Math.max(S.say, sec); },
    // A/B (tools): false puts the classic materials back on this person, true the look's
    useLook(v) { S.on = !!v; for (const [o, a, b, c] of swaps) o.material = v ? (S.far ? c : b) : a; },
    // world point to look at (a Vector3), or null: free gaze
    look(p) { S.fix = p ? (p.isVector3 ? p : null) : null; },
  };
  const tick = dt => {
    if (!(dt > 0)) return;
    S.t += dt;
    const ch = character(); if (S.say > 0) S.say -= dt;
    const talking = (ch && ch.talk > 0) || S.say > 0;
    // blinks: every 2-6 s (more often while talking), 75 ms close, 35 ms shut, 160 ms open; sometimes a double blink
    if (S.blinkT >= 0) { S.blinkT += dt; if (S.blinkT > 0.3) { S.blinkT = -1; if (R() < 0.12) S.nextBlink = 0.18; } }
    else if ((S.nextBlink -= dt) <= 0) { S.blinkT = 0; S.nextBlink = (talking ? 1.4 : 2.0) + R() * (talking ? 3 : 4.5); }
    // saccades: small fixational jumps every 0.4-1.6 s, a glance away every 3-9 s that comes back after a moment
    if ((S.sacc -= dt) <= 0) { S.sacc = 0.4 + R() * 1.2; S.micro.set((R() - 0.5) * 0.06, (R() - 0.5) * 0.04); }
    if ((S.glance -= dt) <= 0) {
      if (S.glanceOff.lengthSq() > 0) { S.glanceOff.set(0, 0); S.glance = 3 + R() * 6; }
      else { S.glanceOff.set((R() - 0.5) * 0.36, (R() - 0.6) * 0.16); S.glance = 0.5 + R() * 1.2; if (R() < 0.45 && S.blinkT < 0) S.blinkT = 0; }
    }
    // micro-expressions: a brow lift now and then (more while talking), easing in and out
    if ((S.browT -= dt) <= 0) { S.browTo = S.browTo > 0 ? 0 : (talking ? 0.6 + R() * 0.4 : 0.25 + R() * 0.35); S.browT = S.browTo > 0 ? 0.5 + R() * 0.9 : (talking ? 1.5 : 4) + R() * 6; }
    S.brow += (S.browTo - S.brow) * Math.min(1, dt * 6);
    // speech: the mouth opens and closes in syllables (90-220 ms) while the character talks (ui.js onWord keeps
    // character.talk up); a consonant now and then closes it
    if (talking) { if ((S.sylT -= dt) <= 0) { S.sylT = 0.09 + R() * 0.13; S.jawTo = R() < 0.22 ? 0 : 0.35 + R() * 0.65; S.wideTo = R() * 1.5 - 0.5; } } else { S.jawTo = 0; S.wideTo = 0; }
    S.jaw += (S.jawTo - S.jaw) * Math.min(1, dt * 16);
    S.wide = (S.wide || 0) + ((S.wideTo || 0) - (S.wide || 0)) * Math.min(1, dt * 12);
    // look v2 builds: the same facial life on real bones (eyes, lids, brows, jaw, mouth corners; src/human/rig2.js)
    const F = h.rig2 && h.rig2.face;
    if (F) {
      const w = F.want, live = on('face') && S.on;
      F.driven = true;
      w.blink = live ? blinkCurve(S.blinkT) : 0;
      w.yaw = live && !S.far ? S.gaze.x * Math.PI / 2 : 0; w.pitch = live && !S.far ? S.gaze.y * Math.PI / 2 : 0;
      w.brow = live ? S.brow : 0; w.jaw = live ? S.jaw : 0; w.wide = live ? S.wide * S.jaw : 0;
      F.apply();
    }
  };
  const up = h.update;
  h.update = dt => { up(dt); tick(dt); };
  const setFar = far => { if (far === S.far) return; S.far = far; if (S.on) for (const [o, , b, c] of swaps) o.material = far ? c : b; };
  const frame = (renderer, scene, camera, mt) => {
    if (!mt || !mt.userData || !mt.userData.azLook) return;      // shadow / depth passes and the classic A/B
    const f = renderer.info.render.frame;
    if (S.frame === f) return; S.frame = f;
    const ev = U.azEye.value;
    const bonesDrive = !!(h.rig2 && h.rig2.face);     // v2: blinks, brows and speech move real bones, not the shading
    ev.z = on('face') && !bonesDrive ? blinkCurve(S.blinkT) : 0;
    U.azExpr.value.x = on('face') && !bonesDrive ? S.brow : 0;
    U.azMouth.value.w = on('face') && Fc.mouth && !bonesDrive ? S.jaw : 0;
    if (!E || headBone < 0 || !on('face')) { ev.x = ev.y = ev.w = 0; return; }
    // rest (mesh) space -> world for the head: matrixWorld * bindMatrixInverse * head * boneInverse * bindMatrix
    const sk = main.skeleton, bone = sk.bones[headBone];
    _m.multiplyMatrices(main.matrixWorld, main.bindMatrixInverse).multiply(bone.matrixWorld).multiply(sk.boneInverses[headBone]).multiply(main.bindMatrix);
    const ex = U.azEyeX.value.set(1, 0, 0).transformDirection(_m), ey = U.azEyeY.value.set(0, 1, 0).transformDirection(_m), ez = U.azEyeZ.value.set(0, 0, 1).transformDirection(_m);
    const eye = _v.copy(eyeMid).applyMatrix4(_m);
    if (camera && camera.isPerspectiveCamera && camera.fov < 89) mainCam = camera;
    const d2 = mainCam ? eye.distanceToSquared(mainCam.position) : 0;
    setFar(d2 > (S.far ? FAR * FAR * 0.9 : FAR * FAR));      // a little hysteresis
    if (S.far) { ev.x = ev.y = ev.w = 0; return; }
    // where to look: the face's own fixation (face.look), the character's lookTarget, else ahead along the body
    let tgt = S.fix;
    const ch = character(), lt = ch && ch.lookTarget;
    if (!tgt && lt) tgt = lt.isVector3 ? lt : lt.getWorldPosition ? lt.getWorldPosition(_v2) : lt.position && _v2.copy(lt.position);
    if (tgt && lt && !lt.isVector3 && lt.userData && lt.userData.character && lt.userData.character.head) { lt.userData.character.head.getWorldPosition(_v2); _v2.y += 0.07; tgt = _v2; }
    let yaw = 0, pitch = 0;
    if (tgt) {
      const d = _v2.copy(tgt).sub(eye);
      if (d.lengthSq() > 0.04) { const lx = d.dot(ex), ly = d.dot(ey), lz = d.dot(ez); yaw = Math.atan2(lx, Math.max(0.05, lz)); pitch = Math.atan2(ly, Math.hypot(lx, lz)); }
    } else {
      // free gaze: ahead along the body (the head's sway is partly cancelled, as real eyes hold a fixation)
      h.root.getWorldQuaternion(_q); const fwd = _v2.set(0, -0.12, 1).applyQuaternion(_q);
      // (part of it: the eyes lead a head turn and settle, they do not pin to the corners while the head sways)
      const lx = fwd.dot(ex), ly = fwd.dot(ey), lz = fwd.dot(ez); yaw = 0.55 * Math.atan2(lx, Math.max(0.05, lz)); pitch = 0.55 * Math.atan2(ly, Math.hypot(lx, lz));
    }
    const k = 2 / Math.PI;
    S.want.set(Math.max(-0.34, Math.min(0.34, yaw * k + S.glanceOff.x + S.micro.x)), Math.max(-0.22, Math.min(0.2, pitch * k + S.glanceOff.y + S.micro.y)));
    S.gaze.lerp(S.want, 0.55);     // a saccade takes ~2 frames
    ev.x = S.gaze.x; ev.y = S.gaze.y;
    ev.w = Math.max(-0.05, Math.min(0.1, -S.gaze.y * 0.55));    // the upper lid follows the eye down
    void scene;
  };
  for (const o of atlas) {
    const prev = o.onBeforeRender, def = THREE.Object3D.prototype.onBeforeRender;
    o.onBeforeRender = prev && prev !== def ? function (r, s, c, gm, mt, gr) { frame(r, s, c, mt); prev.call(this, r, s, c, gm, mt, gr); } : (r, s, c, gm, mt) => frame(r, s, c, mt);
  }
  return h;
}
