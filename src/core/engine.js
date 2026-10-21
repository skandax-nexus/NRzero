import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { GTAOShader } from 'three/addons/shaders/GTAOShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as RZ from '../world/realism.js';
import * as KIT from '../world/kit.js';

// ---------------------------------------------------------------------------------------------------------------
// Post-processing chain (docs/RENDERING.md, "Post-processing"):
//
//   high    RenderPass -> scene target with depth -> AOPass (GTAO, half res, bilateral blur + upsample)
//           -> ExposurePass (eye adaptation, 16x16 + 1x1) -> DofPass (cinematic shots only) -> bloom mips
//           -> Cinema (bloom tap + tone mapping + sRGB + grade + effects) -> SMAA (3 passes) -> screen
//   medium  RenderPass -> ExposurePass -> half-res bloom mips -> Cinema (fused FXAA + bloom tap, cheap effects) -> screen
//   low     RenderPass -> Cinema (cheap effects; the grade is ALU in the same pass) -> screen
//
// Every pass is tier-gated in setQuality(); render() allocates nothing.
// ---------------------------------------------------------------------------------------------------------------

const _infraV = new THREE.Vector3(), _infraB = new THREE.Box3();
const LUMA_GLSL = 'const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);';
const RAW_VS = `precision highp float;
  uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
  attribute vec3 position; attribute vec2 uv; varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

// Final cinematic pass: tone mapping + sRGB output, colour grade, temporal ripple, chromatic aberration, vignette,
// grain, freeze / residue / damage looks. A RawShaderMaterial so tone mapping happens here whether the pass draws to
// the screen or into the SMAA input. Defines (set per quality tier):
//   CHEAP          single texture tap unless a switch / damage effect is running (medium, low)
//   FXAA           fast approximate anti-aliasing fused into that tap (medium)
//   AUTO_EXPOSURE  eye adaptation from ExposurePass (high, medium)
//   <tone mapping> + SRGB_TRANSFER, mirrored from the renderer like OutputPass does
const CinemaShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uShift: { value: 0 },      // 0..1 temporal switch distortion
    uFreeze: { value: 0 },     // 0..1 zero-second desaturation
    uResidue: { value: 0 },    // 0..1 residue vision tint
    uDamage: { value: 0 },     // 0..1 red edge
    uTint: { value: new THREE.Color(1, 1, 1) },
    uGrain: { value: 0.06 },
    uVignette: { value: 1.0 },
    uAspect: { value: 1 },
    toneMappingExposure: { value: 1 },
    uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    // grade (display space): lift / 1/gamma / gain, (saturation, contrast, pivot, shoulder), shadow + highlight balance
    uLift: { value: new THREE.Vector3(0, 0, 0) },
    uGammaInv: { value: new THREE.Vector3(1, 1, 1) },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
    uGrade: { value: new THREE.Vector4(1, 1, 0.4, 0) },
    uShadowBal: { value: new THREE.Vector3(1, 1, 1) },
    uHighBal: { value: new THREE.Vector3(1, 1, 1) },
    tBloom: { value: null },
    tAdapt: { value: null },
    uAE: { value: new THREE.Vector3(0.5, -0.5, 0.7) },   // strength, min EV, max EV
  },
  vertexShader: RAW_VS,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tDiffuse; uniform float uTime,uShift,uFreeze,uResidue,uDamage,uGrain,uVignette,uAspect; uniform vec3 uTint;
    uniform vec2 uTexel;
    uniform vec3 uLift, uGammaInv, uGain, uShadowBal, uHighBal; uniform vec4 uGrade;
    #ifdef AUTO_EXPOSURE
    uniform sampler2D tAdapt; uniform vec3 uAE;
    #endif
    #ifdef BLOOM
    uniform sampler2D tBloom;
    #endif
    #include <tonemapping_pars_fragment>
    #include <colorspace_pars_fragment>
    varying vec2 vUv;
    ${LUMA_GLSL}
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    vec3 aberrated(vec2 uv, vec2 dir, float ca){
      return vec3(texture2D(tDiffuse, uv + dir*ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir*ca).b);
    }
    vec3 toDisplay(vec3 c){
      #if defined( LINEAR_TONE_MAPPING )
        c = LinearToneMapping(c);
      #elif defined( REINHARD_TONE_MAPPING )
        c = ReinhardToneMapping(c);
      #elif defined( CINEON_TONE_MAPPING )
        c = CineonToneMapping(c);
      #elif defined( ACES_FILMIC_TONE_MAPPING )
        c = ACESFilmicToneMapping(c);
      #elif defined( AGX_TONE_MAPPING )
        c = AgXToneMapping(c);
      #elif defined( NEUTRAL_TONE_MAPPING )
        c = NeutralToneMapping(c);
      #endif
      #ifdef SRGB_TRANSFER
        c = sRGBTransferOETF(vec4(c, 1.0)).rgb;
      #endif
      return c;
    }
    #ifdef FXAA
    // FXAA (console variant) on the HDR input: luma is range-compressed for edge detection and taps are weighted by
    // 1/(1+luma) so a bright neon pixel does not win the blend (the result is tone mapped afterwards).
    float lumaOf(vec3 c){ float l = dot(c, LUMA); return sqrt(l / (1.0 + l)); }
    vec4 tapW(vec2 uv){ vec3 c = texture2D(tDiffuse, uv).rgb; float w = 1.0 / (1.0 + dot(c, LUMA)); return vec4(c * w, w); }
    vec3 fxaa(vec2 uv){
      vec3 rgbM = texture2D(tDiffuse, uv).rgb;
      float lM = lumaOf(rgbM);
      float lNW = lumaOf(texture2D(tDiffuse, uv + vec2(-1.0, -1.0) * uTexel).rgb);
      float lNE = lumaOf(texture2D(tDiffuse, uv + vec2( 1.0, -1.0) * uTexel).rgb);
      float lSW = lumaOf(texture2D(tDiffuse, uv + vec2(-1.0,  1.0) * uTexel).rgb);
      float lSE = lumaOf(texture2D(tDiffuse, uv + vec2( 1.0,  1.0) * uTexel).rgb);
      float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
      float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
      if (lMax - lMin < max(0.04, lMax * 0.16)) return rgbM;
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
      float red = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
      dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + red), -6.0, 6.0) * uTexel;
      vec4 a = tapW(uv - dir * (1.0 / 6.0)) + tapW(uv + dir * (1.0 / 6.0));
      vec4 b = a + tapW(uv - dir * 0.5) + tapW(uv + dir * 0.5);
      vec3 rgbA = a.rgb / a.w, rgbB = b.rgb / b.w;
      float lB = lumaOf(rgbB);
      return (lB < lMin || lB > lMax) ? rgbA : rgbB;
    }
    #endif
    // Colour grade in display space: lift / gamma / gain, saturation, soft shoulder (no hard clip of saturated
    // highlights), contrast S-curve around a pivot (0 and 1 stay put), split-tone balance for shadows / highlights.
    vec3 grade(vec3 c){
      c = max(c * uGain + uLift * (1.0 - c), 0.0);
      if (uGammaInv != vec3(1.0)) c = pow(c, uGammaInv);   // uniform branch: free when a grade has no gamma
      float l = dot(c, LUMA);
      c = max(mix(vec3(l), c, uGrade.x), 0.0);
      float knee = 1.0 - 0.3 * uGrade.w, w = max(1.0 - knee, 1e-3);
      float m = max(c.r, max(c.g, c.b)), x = max(m - knee, 0.0);
      c *= (knee + w * x / (x + w)) / max(m, knee);
      vec3 p = vec3(uGrade.z), hi = step(p, c);
      // t^k approximated by t * (1 + (k-1)(t-1)): same slope k at the pivot, no pow (cheap on phone GPUs)
      vec3 t = clamp(mix(c / p, (1.0 - c) / (1.0 - p), hi), 0.0, 1.0);
      t *= 1.0 + (uGrade.y - 1.0) * (t - 1.0);
      c = mix(p * t, 1.0 - (1.0 - p) * t, hi);
      l = dot(c, LUMA);
      c *= mix(uShadowBal, vec3(1.0), smoothstep(0.0, 0.5, l));
      c *= mix(vec3(1.0), uHighBal, smoothstep(0.4, 1.0, l));
      return clamp(c, 0.0, 1.0);
    }
    void main(){
      vec2 uv=vUv; vec2 c=uv-0.5; c.x*=uAspect; float r2=dot(c,c);
      // uniform branches: the switch / damage / freeze / residue effects cost nothing while they are off
      float fxOn = uShift + uDamage;
      vec2 dir = vec2(0.0);
    #ifndef CHEAP
      fxOn = 1.0;
    #endif
      if (fxOn > 0.001) dir = normalize(c+1e-5)/vec2(uAspect,1.0);
      if (uShift > 0.0) {
        float r = sqrt(r2);
        // temporal ripple: concentric wave expanding from centre
        float wave = sin(r*38.0 - uTime*22.0) * uShift * 0.018 * smoothstep(0.9,0.0,r);
        uv += dir*wave;
        // slice tearing during shift
        float band = step(0.82, hash(vec2(floor(uv.y*42.0), floor(uTime*24.0))));
        uv.x += band*uShift*0.03*(hash(vec2(uTime,uv.y))-0.5);
      }
      vec3 col;
    #ifdef CHEAP
      if (fxOn > 0.001) col = aberrated(uv, dir, uShift*0.012 + uDamage*0.006 + r2*0.004);
      else {
      #ifdef FXAA
        col = fxaa(uv);
      #else
        col = texture2D(tDiffuse, uv).rgb;
      #endif
      }
    #else
      // lens aberration only toward the corners: at most ~1 px of R/B split inside the inner frame, so thin bright lines
      // (rain, LED strips, window frames) stay one colour; the full 0.0015 is reached in the corners only
      col = aberrated(uv, dir, uShift*0.012 + uDamage*0.006 + r2*0.0015*smoothstep(0.35, 1.0, r2));
    #endif
    #ifdef BLOOM
      col += texture2D(tBloom, uv).rgb;
    #endif
    #ifdef AUTO_EXPOSURE
      vec2 ae = texture2D(tAdapt, vec2(0.5)).rg;
      col *= exp2(clamp((ae.g - ae.r) * uAE.x, uAE.y, uAE.z));
    #endif
      col = toDisplay(col);
    #ifndef NO_GRADE
      col = grade(col);
    #endif
      float l = dot(col, vec3(0.299,0.587,0.114));
      if (uShift + uFreeze + uResidue > 0.0) {
        // shift: flash toward cyan-white core
        col = mix(col, col*vec3(0.8,1.15,1.3)+vec3(0.05,0.12,0.16), uShift*0.6);
        // freeze: desaturate with cold tint
        col = mix(col, vec3(l)*vec3(0.85,0.95,1.1), uFreeze*0.85);
        // residue vision: teal monochrome with edges preserved
        col = mix(col, vec3(l*0.35, l*0.9, l*1.05) + vec3(0.0,0.03,0.05), uResidue*0.7);
      }
      // tint and vignette in one multiply
      col *= uTint * mix(0.55, 1.0, smoothstep(1.05, 0.25, sqrt(r2)*uVignette*1.15));
      if (uDamage > 0.0) col = mix(col, col + vec3(0.5,0.0,0.03), uDamage*smoothstep(0.3,0.9,sqrt(r2)));
      // film grain (interleaved gradient noise): strongest in the shadows and mid-tones, fading out in highlights
      vec2 gp = gl_FragCoord.xy + fract(uTime * 7.31) * vec2(47.0, 113.0);
      float n = fract(52.9829189 * fract(dot(gp, vec2(0.06711056, 0.00583715))));
      col += (n - 0.5)*uGrain*(1.0 - 0.65*clamp(l, 0.0, 1.0));
      gl_FragColor = vec4(col,1.0);
    }`,
};

// ---------- colour grades ----------
// Display-space presets, each a richer, more filmic version of the era's existing palette (never a new palette).
// lift / gamma / gain per channel; saturation; contrast (slope of the S-curve at the pivot); shoulder 0..1 (soft roll
// off of saturated highlights); shadows / highlights = colour balance multipliers (normalised to unit luminance).
export const GRADES = {
  neutral: { lift: [-0.004, -0.004, -0.004], gamma: [1, 1, 1], gain: [1, 1, 1], saturation: 1.06, contrast: 1.08, pivot: 0.4, shoulder: 0.35, shadows: [1, 1, 1], highlights: [1, 1, 1] },
  // 2049 Rain City / present day: deeper blacks under the fog, punchier neon, cool teal shadows, warm skin and lamp highlights
  rain2049: { lift: [-0.011, -0.009, -0.002], gamma: [1, 1, 1], gain: [1.05, 1.04, 1.05], saturation: 1.22, contrast: 1.15, pivot: 0.31, shoulder: 0.5, shadows: [0.95, 1.0, 1.07], highlights: [1.045, 1.0, 0.955] },
  // 2026 Helix / the past: warm amber, tungsten highlights, soft brown shadows
  helix2026: { lift: [-0.004, -0.006, -0.012], gamma: [1, 1, 1], gain: [1.05, 1.01, 0.94], saturation: 1.05, contrast: 1.12, pivot: 0.36, shoulder: 0.6, shadows: [1.05, 1.0, 0.92], highlights: [1.05, 1.0, 0.91] },
  // 2196 devastated future: slightly bleached, green-grey shadows, dusty warm highlights, harder contrast
  ruin2196: { lift: [-0.012, -0.006, -0.008], gamma: [1, 1, 1], gain: [1.02, 1.04, 1.0], saturation: 0.98, contrast: 1.18, pivot: 0.3, shoulder: 0.5, shadows: [0.94, 1.05, 1.02], highlights: [1.05, 1.01, 0.92] },
  // ancient valley at sunset: golden highlights, cooler blue shadows for depth, richer foliage
  ancient: { lift: [-0.012, -0.011, -0.004], gamma: [1, 1, 1], gain: [1.02, 1.01, 1.01], saturation: 1.02, contrast: 1.16, pivot: 0.42, shoulder: 0.5, shadows: [0.94, 1.0, 1.1], highlights: [1.02, 1.0, 0.975] },
};
const GRADE_KEYS = ['lift', 'gamma', 'gain', 'shadows', 'highlights'];

// Pick a preset from the scene when nothing set one: scene.userData.grade, else the hue of the fog (or the plain
// background colour). Missions 1-4 need no change: Rain City fog is blue (rain2049), the 2026 era fog is amber
// (helix2026), 2196 is green (ruin2196), the ancient valley is a bright warm haze (ancient), daylight skies neutral.
export function gradeForScene(scene) {
  if (!scene) return 'neutral';
  const ud = scene.userData?.grade;
  if (ud) return ud;
  const c = scene.fog?.color || (scene.background?.isColor ? scene.background : null);
  if (!c) return 'neutral';
  const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b), v = max, s = max > 1e-5 ? (max - min) / max : 0;
  let h = 0;
  if (max - min > 1e-6) {
    if (max === c.r) h = ((c.g - c.b) / (max - min) + 6) % 6; else if (max === c.g) h = (c.b - c.r) / (max - min) + 2; else h = (c.r - c.g) / (max - min) + 4;
    h *= 60;
  }
  const sv = Math.pow(v, 1 / 2.2);   // display brightness of the (linear) fog colour
  if (h >= 10 && h <= 60 && s > 0.25) return sv > 0.4 ? 'ancient' : 'helix2026';
  if (h >= 90 && h <= 175 && s > 0.2) return 'ruin2196';
  if (sv > 0.45) return 'neutral';
  return 'rain2049';
}

function normBalance(src, out) {
  const l = src[0] * 0.2126 + src[1] * 0.7152 + src[2] * 0.0722 || 1;
  return out.set(src[0] / l, src[1] / l, src[2] / l);
}

// ---------- ambient occlusion (high tier) ----------
// GTAO at half resolution from the scene pass's own depth buffer (normals are reconstructed from depth, so the
// scene is not drawn a second time), a 4x4 depth-aware blur that cancels the 4x4 rotation noise, then a full-res
// composite with a depth-aware upsample. The composite fades AO with fog and distance and keeps emissive / lit-up
// pixels untouched, so neon, lamps and the sky never get dirty halos.
const AOBlurShader = {
  uniforms: { tAO: { value: null }, tDepth: { value: null }, cameraNear: { value: 0.1 }, cameraFar: { value: 900 } },
  vertexShader: QUAD_VS,
  fragmentShader: `
    #include <packing>
    uniform highp sampler2D tAO; uniform highp sampler2D tDepth; uniform float cameraNear, cameraFar;
    varying vec2 vUv;
    void main(){
      ivec2 p = ivec2(gl_FragCoord.xy), sz = textureSize(tAO, 0) - 1;
      vec2 c0 = texelFetch(tAO, p, 0).rg;
      float zc = c0.g, sum = 0.0, ws = 0.0, tol = 0.03 + 0.04 * zc;
      for (int y = -2; y < 2; y++) for (int x = -2; x < 2; x++) {
        vec2 s = texelFetch(tAO, clamp(p + ivec2(x, y), ivec2(0), sz), 0).rg;
        float w = exp(-abs(s.g - zc) / tol);
        sum += s.r * w; ws += w;
      }
      gl_FragColor = vec4(sum / max(ws, 1e-4), zc, 0.0, 1.0);
    }`,
};
const AOCompositeShader = {
  uniforms: { tDiffuse: { value: null }, tAO: { value: null }, tDepth: { value: null }, cameraNear: { value: 0.1 }, cameraFar: { value: 900 },
    uIntensity: { value: 1 }, uFog: { value: 0 }, uFade: { value: new THREE.Vector2(45, 110) }, uDebug: { value: 0 } },
  vertexShader: QUAD_VS,
  fragmentShader: `
    #include <packing>
    uniform sampler2D tDiffuse; uniform highp sampler2D tAO; uniform highp sampler2D tDepth;
    uniform float cameraNear, cameraFar, uIntensity, uFog, uDebug; uniform vec2 uFade;
    varying vec2 vUv;
    ${LUMA_GLSL}
    void main(){
      vec4 col = texture2D(tDiffuse, vUv);
      float d = texture2D(tDepth, vUv).x;
      if (d >= 1.0) { gl_FragColor = col; return; }
      float z = -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
      vec2 sz = vec2(textureSize(tAO, 0));
      vec2 tc = vUv * sz - 0.5, f = fract(tc);
      ivec2 b = ivec2(floor(tc)), mx = ivec2(sz) - 1;
      float tol = 0.02 + 0.03 * z, sum = 0.0, ws = 0.0;
      for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
        vec2 s = texelFetch(tAO, clamp(b + ivec2(i, j), ivec2(0), mx), 0).rg;
        float wb = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y);
        float w = wb * exp(-abs(s.g - z) / tol) + 1e-5;
        sum += s.r * w; ws += w;
      }
      float ao = sum / ws;
      float k = uIntensity * (1.0 - smoothstep(uFade.x, uFade.y, z)) * exp(-(uFog * z) * (uFog * z));
      k *= 1.0 - smoothstep(1.2, 3.5, dot(col.rgb, LUMA));
      col.rgb *= mix(1.0, ao, k);
      if (uDebug > 0.5) col.rgb = vec3(uDebug > 1.5 ? ao : mix(1.0, ao, k));
      gl_FragColor = col;
    }`,
};

function bayerNoise() {
  // 4x4 rotation noise (Bayer order) so the 4x4 blur cancels it exactly; w = step jitter in a different order
  const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], J = [5, 13, 7, 15, 9, 1, 11, 3, 6, 14, 4, 12, 10, 2, 8, 0];
  const data = new Uint8Array(64);
  for (let i = 0; i < 16; i++) {
    const a = (B[i] + 0.5) / 16 * Math.PI;
    data[i * 4] = Math.round((Math.cos(a) * 0.5 + 0.5) * 255); data[i * 4 + 1] = Math.round((Math.sin(a) * 0.5 + 0.5) * 255);
    data[i * 4 + 2] = 127; data[i * 4 + 3] = Math.round((J[i] + 0.5) / 16 * 255);
  }
  const t = new THREE.DataTexture(data, 4, 4);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}

const quadMat = (shader, defines) => new THREE.ShaderMaterial({ defines: { ...(shader.defines || {}), ...(defines || {}) }, uniforms: THREE.UniformsUtils.clone(shader.uniforms),
  vertexShader: shader.vertexShader, fragmentShader: shader.fragmentShader, depthTest: false, depthWrite: false });

class AOPass extends Pass {
  constructor(camera) {
    super();
    this.camera = camera; this.needsSwap = false; this.enabled = false;
    this.scale = 0.5;   // AO resolution relative to the frame
    this.sceneRT = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(2, 2) });
    this.sceneRT.texture.name = 'Engine.scene';
    const half = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    this.aoRT = new THREE.WebGLRenderTarget(2, 2, half); this.blurRT = new THREE.WebGLRenderTarget(2, 2, half);
    this.gtao = quadMat(GTAOShader, { NORMAL_VECTOR_TYPE: 0, SAMPLES: 12, FRAGMENT_OUTPUT: 'vec4(ao, -viewPos.z, 0., 1.)' });
    const u = this.gtao.uniforms;
    u.tNoise.value = bayerNoise(); u.tDepth.value = this.sceneRT.depthTexture;
    u.radius.value = 0.8; u.thickness.value = 0.8; u.distanceExponent.value = 2; u.distanceFallOff.value = 1; u.scale.value = 1.6;
    this.blur = quadMat(AOBlurShader); this.blur.uniforms.tAO.value = this.aoRT.texture;
    this.comp = quadMat(AOCompositeShader);
    this.comp.uniforms.tAO.value = this.blurRT.texture; this.comp.uniforms.tDepth.value = this.sceneRT.depthTexture; this.comp.uniforms.tDiffuse.value = this.sceneRT.texture;
    this.quad = new FullScreenQuad(null);
    this._cc = new THREE.Color(); this._clearAO = new THREE.Color(1, 1000, 0);
    this.intensity = 0.9; this.fog = 0;
  }
  setSize(w, h) {
    this.sceneRT.setSize(w, h);
    const hw = Math.max(1, Math.round(w * this.scale)), hh = Math.max(1, Math.round(h * this.scale));
    this.aoRT.setSize(hw, hh); this.blurRT.setSize(hw, hh);
    this.gtao.uniforms.resolution.value.set(hw, hh);
  }
  release() { this.sceneRT.dispose(); this.aoRT.dispose(); this.blurRT.dispose(); }
  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera, u = this.gtao.uniforms;
    u.cameraNear.value = cam.near; u.cameraFar.value = cam.far;
    u.cameraProjectionMatrix.value.copy(cam.projectionMatrix); u.cameraProjectionMatrixInverse.value.copy(cam.projectionMatrixInverse);
    this.blur.uniforms.cameraNear.value = cam.near; this.blur.uniforms.cameraFar.value = cam.far;
    const cu = this.comp.uniforms;
    cu.cameraNear.value = cam.near; cu.cameraFar.value = cam.far; cu.uIntensity.value = this.intensity; cu.uFog.value = this.fog;
    renderer.getClearColor(this._cc); const ca = renderer.getClearAlpha();
    renderer.setClearColor(this._clearAO, 1);
    renderer.setRenderTarget(this.aoRT); renderer.clear(true, false, false);
    this.quad.material = this.gtao; this.quad.render(renderer);
    renderer.setClearColor(this._cc, ca);
    renderer.setRenderTarget(this.blurRT); this.quad.material = this.blur; this.quad.render(renderer);
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer); this.quad.material = this.comp; this.quad.render(renderer);
  }
}

// ---------- eye adaptation (high, medium) ----------
// Log-average luminance of the HDR frame (centre-weighted) on the GPU: 16x16 reduction, then a 1x1 ping-pong target
// holding (adapted log2 luminance, reference log2 luminance). The Cinema pass exposes by (reference - adapted) *
// strength, clamped to a small EV range: walking from a bright street into a dark room the image is dark first and
// opens up over a second, and a bright exterior is reined in. The reference is the scene's own authored exposure:
// it is re-taken after a scene change and an era / grade change and drifts very slowly, so missions keep their look.
const LumShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: QUAD_VS,
  fragmentShader: `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    ${LUMA_GLSL}
    void main(){
      float s = 0.0, ws = 0.0;
      for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
        vec2 uv = vUv + (vec2(float(i), float(j)) - 1.5) * (1.0 / 64.0);
        float l = dot(texture2D(tDiffuse, uv).rgb, LUMA);
        vec2 c = uv - 0.5; float w = 1.0 - dot(c, c);   // centre-weighted metering (corners count half)
        s += log2(clamp(l, 1e-4, 64.0)) * w; ws += w;
      }
      gl_FragColor = vec4(s, ws, 0.0, 1.0);
    }`,
};
const AdaptShader = {
  uniforms: { tLum: { value: null }, tPrev: { value: null }, uK: { value: 1 }, uKRef: { value: 0 } },
  vertexShader: QUAD_VS,
  fragmentShader: `
    uniform sampler2D tLum; uniform sampler2D tPrev; uniform float uK, uKRef;
    void main(){
      vec2 acc = vec2(0.0);
      for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) acc += texture2D(tLum, (vec2(float(i), float(j)) * 2.0 + 1.0) / 16.0).rg;
      float cur = acc.x / max(acc.y, 1e-4);
      vec2 prev = texture2D(tPrev, vec2(0.5)).rg;
      float a = mix(prev.r, cur, uK);
      gl_FragColor = vec4(a, mix(prev.g, a, uKRef), 0.0, 1.0);
    }`,
};
class ExposurePass extends Pass {
  constructor() {
    super();
    this.needsSwap = false; this.enabled = false;
    const o = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.lumRT = new THREE.WebGLRenderTarget(16, 16, o);
    this.rt = [new THREE.WebGLRenderTarget(1, 1, o), new THREE.WebGLRenderTarget(1, 1, o)]; this.i = 0;
    this.lum = quadMat(LumShader); this.adapt = quadMat(AdaptShader); this.adapt.uniforms.tLum.value = this.lumRT.texture;
    this.quad = new FullScreenQuad(null);
    this.k = 1; this.kRef = 1;   // set by the engine every frame
  }
  get texture() { return this.rt[this.i].texture; }
  release() { this.lumRT.dispose(); this.rt[0].dispose(); this.rt[1].dispose(); }
  render(renderer, writeBuffer, readBuffer) {
    this.lum.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.lumRT); this.quad.material = this.lum; this.quad.render(renderer);
    const prev = this.rt[this.i]; this.i ^= 1;
    const a = this.adapt.uniforms; a.tPrev.value = prev.texture; a.uK.value = this.k; a.uKRef.value = this.kRef;
    renderer.setRenderTarget(this.rt[this.i]); this.quad.material = this.adapt; this.quad.render(renderer);
  }
}

// ---------- cinematic depth of field (high tier, only while engine.focus() holds a target) ----------
// Thin-lens circle of confusion from the scene depth (coc ~ f^2 |1/zf - 1/z|, so long lenses and close focus blur
// most and wide establishing shots barely at all) and a 24-tap spiral gather in HDR before bloom. A sample behind the
// pixel may not blur over it by more than the pixel's own CoC, so in-focus silhouettes stay crisp over a soft
// background while an out-of-focus foreground shoulder still spreads over them.
const DOF_TAPS = 24;
const DofShader = {
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, cameraNear: { value: 0.1 }, cameraFar: { value: 900 }, uTexel: { value: new THREE.Vector2() },
    uFocus: { value: 3 }, uScale: { value: 1 }, uMaxR: { value: 8 }, uKernel: { value: [] } },
  vertexShader: QUAD_VS,
  fragmentShader: `
    #include <packing>
    #define TAPS ${DOF_TAPS}
    uniform sampler2D tDiffuse; uniform highp sampler2D tDepth; uniform float cameraNear, cameraFar, uFocus, uScale, uMaxR;
    uniform vec2 uTexel; uniform vec2 uKernel[TAPS];
    varying vec2 vUv;
    float viewZ(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
    float coc(float z){ return min(abs(1.0 / uFocus - 1.0 / z) * uScale, uMaxR); }
    void main(){
      vec3 c0 = texture2D(tDiffuse, vUv).rgb;
      float z0 = viewZ(vUv), k0 = coc(z0);
      vec3 acc = c0; float ws = 1.0;
      for (int i = 0; i < TAPS; i++) {
        vec2 o = uKernel[i] * uMaxR;
        float r = length(o);
        vec2 uv = vUv + o * uTexel;
        float z = viewZ(uv), k = coc(z);
        if (z > z0) k = min(k, k0);
        float w = smoothstep(r - 1.0, r + 0.5, k);
        acc += texture2D(tDiffuse, uv).rgb * w; ws += w;
      }
      gl_FragColor = vec4(acc / ws, 1.0);
    }`,
};
class DofPass extends Pass {
  constructor() {
    super();
    this.enabled = false;
    this.mat = quadMat(DofShader);
    const k = this.mat.uniforms.uKernel.value;
    for (let i = 0; i < DOF_TAPS; i++) { const r = Math.sqrt((i + 0.5) / DOF_TAPS), a = i * 2.39996323; k.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
    this.quad = new FullScreenQuad(this.mat);
    this.height = 720;
  }
  setSize(w, h) { this.mat.uniforms.uTexel.value.set(1 / w, 1 / h); this.height = h; }
  render(renderer, writeBuffer, readBuffer) {
    this.mat.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }
}

// ---------- bloom with its final full-screen blend fused into the Cinema pass ----------
// UnrealBloomPass ends with a full-resolution additive blend of its result over the frame (a read-modify-write of the
// whole frame buffer, the costliest part of bloom on tile-based phone GPUs). Here that step is skipped and the Cinema
// pass adds the bloom texture with one bilinear tap instead. Same image, one full-screen pass fewer on every tier.
class FusedBloomPass extends UnrealBloomPass {
  get texture() { return this.renderTargetsHorizontal[0].texture; }
  render(renderer, writeBuffer, readBuffer) {
    renderer.getClearColor(this._oldClearColor);
    this.oldClearAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setClearColor(this.clearColor, 0);
    this.highPassUniforms.tDiffuse.value = readBuffer.texture;
    this.highPassUniforms.luminosityThreshold.value = this.threshold;
    this.fsQuad.material = this.materialHighPassFilter;
    renderer.setRenderTarget(this.renderTargetBright); renderer.clear(); this.fsQuad.render(renderer);
    let input = this.renderTargetBright;
    for (let i = 0; i < this.nMips; i++) {
      const m = this.separableBlurMaterials[i];
      this.fsQuad.material = m;
      m.uniforms.colorTexture.value = input.texture; m.uniforms.direction.value = UnrealBloomPass.BlurDirectionX;
      renderer.setRenderTarget(this.renderTargetsHorizontal[i]); renderer.clear(); this.fsQuad.render(renderer);
      m.uniforms.colorTexture.value = this.renderTargetsHorizontal[i].texture; m.uniforms.direction.value = UnrealBloomPass.BlurDirectionY;
      renderer.setRenderTarget(this.renderTargetsVertical[i]); renderer.clear(); this.fsQuad.render(renderer);
      input = this.renderTargetsVertical[i];
    }
    this.fsQuad.material = this.compositeMaterial;
    this.compositeMaterial.uniforms.bloomStrength.value = this.strength;
    this.compositeMaterial.uniforms.bloomRadius.value = this.radius;
    this.compositeMaterial.uniforms.bloomTintColors.value = this.bloomTintColors;
    renderer.setRenderTarget(this.renderTargetsHorizontal[0]); renderer.clear(); this.fsQuad.render(renderer);
    renderer.setClearColor(this._oldClearColor, this.oldClearAlpha);
    renderer.autoClear = oldAutoClear;
  }
}

// ---------- device profile ----------
// GPUs that struggle with PBR + post at phone resolutions (old Adreno, Mali Bifrost entry parts,
// PowerVR, software rasterizers).
const LOW_END_GPU = /Adreno \(TM\) ([3-5]\d\d|60\d|61[02])\b|Mali-(4\d\d|T\d+|G31|G51|G52|G57)\b|PowerVR|SGX|Vivante|VideoCore|SwiftShader|llvmpipe/i;

export function detectDevice() {
  const nav = window.navigator || {};
  const mm = q => { try { return window.matchMedia(q).matches; } catch { return false; } };
  const coarse = mm('(pointer: coarse)');
  const touch = coarse || ((nav.maxTouchPoints || 0) > 0 && !mm('(pointer: fine)'));
  const scr = window.screen || { width: window.innerWidth, height: window.innerHeight };
  const shortSide = Math.min(scr.width || 0, scr.height || 0) || Math.min(window.innerWidth, window.innerHeight);
  const ua = nav.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1);
  const phone = touch && shortSide <= 540;
  const mobile = phone || (touch && shortSide <= 1100) || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const memory = nav.deviceMemory || 0;          // GB, Chromium only
  const cores = nav.hardwareConcurrency || 0;    // Safari reports a clamped value: ignore it there
  const lowEnd = (memory > 0 && memory <= 3) || (!ios && cores > 0 && cores <= 4);
  return { touch, phone, mobile, ios, lowEnd, memory, cores, dpr: window.devicePixelRatio || 1, gpu: '', tier: mobile ? (lowEnd ? 'low' : 'medium') : 'high' };
}

// Quality tiers. `high` is the desktop look and is never altered by the mobile work.
// `hints` are advisory budgets world / character code can read through game.onQuality().
// Post: ao = GTAO, aa = 'smaa' | 'fxaa' | null, dof = cinematic depth of field, autoExposure = eye adaptation.
function tierSettings(q, device) {
  const m = device.mobile;
  const T = {
    high: { dprCap: 1.75, shadows: true, shadowMapMax: 4096, softShadows: true, bloom: true, bloomScale: 1, cheapPost: false, adaptive: false,
      ao: true, aa: 'smaa', dof: true, autoExposure: true,
      light: { probe: 256, probeMove: 25, puddles: 1, wetDetail: 1, contact: 0.3, rig: 2, pcfRadius: 1, shafts: 1 },
      infra: { smallCull: 180, atlas: 2048 },
      hints: { characterDetail: 'high', crowd: 1, drawDistance: 1, maxLights: 12, particles: 1 } },
    medium: { dprCap: m ? 1.5 : 1, shadows: true, shadowMapMax: 1024, softShadows: false, bloom: true, bloomScale: 0.5, cheapPost: true, adaptive: true,
      ao: false, aa: 'fxaa', dof: false, autoExposure: true,
      light: { probe: 128, probeMove: 40, puddles: 1, wetDetail: 0, contact: 0.42, rig: 2, pcfRadius: 2, shafts: 0.8 },
      // phones on medium: low's facade path (RZ_INTERIOR 0: m1a +13-24 % raster over the pre-stage-4 city instead of
      // +20-35 % with RZ_INTERIOR 1), about low's small-prop cull distance, 1024 sign atlases (-106 MB texture memory on
      // m1), 200 m batch cells and no shadows from small props / ground slabs (m1a 295 -> 245 draw calls)
      infra: m ? { smallCull: 85, atlas: 1024, facadeInterior: 0, smallShadows: false, cell: 200 } : { smallCull: 120, atlas: 2048 },
      bloomMips: m ? 3 : 5,
      hints: { characterDetail: m ? 'low' : 'high', crowd: 0.6, drawDistance: 0.8, maxLights: 6, particles: 0.6 } },
    low: { dprCap: m ? 1 : 0.75, shadows: false, shadowMapMax: 512, softShadows: false, bloom: false, bloomScale: 0.5, cheapPost: true, adaptive: true,
      ao: false, aa: null, dof: false, autoExposure: false,
      light: { probe: 64, probeMove: 0, puddles: 0, wetDetail: 0, contact: 0.5, rig: 1, pcfRadius: 1, shafts: 0 },
      infra: { smallCull: 80, atlas: 1024, cell: m ? 200 : 50 },
      hints: { characterDetail: 'low', crowd: 0.35, drawDistance: 0.6, maxLights: 4, particles: 0.35 } },
  };
  return { quality: q, mobile: m, ...T[q] };
}

export const QUALITY_LEVELS = ['high', 'medium', 'low'];

const TONE_DEFINES = {
  [THREE.LinearToneMapping]: 'LINEAR_TONE_MAPPING', [THREE.ReinhardToneMapping]: 'REINHARD_TONE_MAPPING', [THREE.CineonToneMapping]: 'CINEON_TONE_MAPPING',
  [THREE.ACESFilmicToneMapping]: 'ACES_FILMIC_TONE_MAPPING', [THREE.AgXToneMapping]: 'AGX_TONE_MAPPING', [THREE.NeutralToneMapping]: 'NEUTRAL_TONE_MAPPING',
};

export class Engine {
  constructor(container) {
    this.container = container;
    this.device = detectDevice();
    // The scene always renders through the composer's render targets, so canvas MSAA buys nothing:
    // phones skip it to save memory and bandwidth. Desktop keeps its original context settings.
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: !this.device.mobile, powerPreference: 'high-performance' });
    this.device.gpu = gpuName(r);
    if (this.device.mobile && LOW_END_GPU.test(this.device.gpu)) { this.device.lowEnd = true; this.device.tier = 'low'; }
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    r.setSize(window.innerWidth, window.innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    // Count the whole frame (shadow maps + scene + post) in renderer.info, not just the last pass.
    r.info.autoReset = false;
    container.appendChild(r.domElement);

    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.08, 900);
    this.scene = new THREE.Scene();

    // Height fog, horizon specular occlusion and wet-weather code go into three's shared chunks before anything compiles.
    RZ.installFogChunks(); RZ.installLightingChunks();
    // the realism kit bakes its textures with this renderer (kit.js facade buildings, missions 5+); its tier follows ours
    RZ.init(r);
    // static batching of every scene (docs/RENDERING.md, stage 4); ?infra=nobatch turns it off
    this._batch = new RZ.StaticBatcher(); this._bFrames = 0; this.batchOn = KIT.infraOn('batch');

    // Debug / A-B switches: ?post=noao,noaa,nodof,noae,nograde turn single post features off on every tier (aodebug shows
    // the AO term). engine.postOff can be changed at runtime followed by applyPost().
    const qp = new URLSearchParams(location.search);
    this.postOff = new Set(String(qp.get('post') || '').split(',').filter(Boolean));
    // Scene-lighting A/B switches: ?light=noenv,nofog,nowet,nocontact,norig,noshadow,noshafts (engine.lightOff + applyLighting()).
    this.lightOff = new Set(String(qp.get('light') || '').split(',').filter(Boolean));
    this._initLighting();

    this.composer = new EffectComposer(r);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.aoPass = new AOPass(this.camera);
    this.composer.addPass(this.aoPass);
    this.exposurePass = new ExposurePass();
    this.composer.addPass(this.exposurePass);
    this.dofPass = new DofPass();
    this.composer.addPass(this.dofPass);
    this.bloom = new FusedBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.5, 0.92);
    this.bloomScale = 1;
    const bloomSetSize = this.bloom.setSize.bind(this.bloom);   // half-res bloom on cheaper tiers
    this.bloom.needsSwap = false;   // it no longer writes the frame (Cinema adds this.bloom.texture)
    this.bloom.setSize = (w, h) => bloomSetSize(Math.max(2, Math.round(w * this.bloomScale)), Math.max(2, Math.round(h * this.bloomScale)));
    this.composer.addPass(this.bloom);
    // tone mapping + sRGB now always happen in the Cinema pass; kept (disabled) for code that looks it up
    this.outputPass = new OutputPass();
    this.outputPass.enabled = false;
    this.composer.addPass(this.outputPass);
    this.cinema = new ShaderPass(new THREE.RawShaderMaterial({ name: 'CinemaShader', uniforms: THREE.UniformsUtils.clone(CinemaShader.uniforms),
      vertexShader: CinemaShader.vertexShader, fragmentShader: CinemaShader.fragmentShader, depthTest: false, depthWrite: false }));
    this.composer.addPass(this.cinema);
    this.smaa = new SMAAPass(2, 2);
    this.smaa.clear = true;   // the edge pass discards non-edges: stale edges must not survive from the last frame
    this.composer.addPass(this.smaa);
    this.fx = this.cinema.uniforms;
    this.fx.uAspect.value = window.innerWidth / window.innerHeight;
    this.fx.tAdapt.value = this.exposurePass.texture;
    this.fx.tBloom.value = this.bloom.texture;
    // RenderPass draws into the AO pass's depth-textured target when AO is on (the AO composite writes the result to
    // the composer's buffer), so AO and depth of field read the scene depth without drawing the scene twice.
    this._toneKey = -1; this._toneSpace = '';

    // Per-frame statistics: scene = shadow maps + main pass, total = including post-processing.
    this.stats = { sceneCalls: 0, sceneTriangles: 0, calls: 0, triangles: 0, fps: 0, frameMs: 0, pixelRatio: 1, scale: 1, post: '', probeMs: 0, probes: 0 };
    const renderScene = this.renderPass.render.bind(this.renderPass);
    this.renderPass.render = (rr, wb, rb, dt, mask) => {
      renderScene(rr, wb, this.aoPass.enabled ? this.aoPass.sceneRT : rb, dt, mask);
      this.stats.sceneCalls = r.info.render.calls; this.stats.sceneTriangles = r.info.render.triangles;
    };

    // colour grade state: current values interpolate toward the target (no allocations per frame)
    const g0 = GRADES.neutral;
    const mk = () => ({ lift: [...g0.lift], gamma: [...g0.gamma], gain: [...g0.gain], shadows: [...g0.shadows], highlights: [...g0.highlights], saturation: g0.saturation, contrast: g0.contrast, pivot: g0.pivot, shoulder: g0.shoulder });
    this._grade = { cur: mk(), target: mk(), name: 'neutral', explicit: null, check: 0, tmp: new THREE.Vector3() };
    // focus / depth of field state
    this._focus = { target: null, active: null, z: 3, amount: 0, enabled: true, v: new THREE.Vector3(), d: new THREE.Vector3() };
    // eye adaptation state: snap = seconds of instant adaptation left, ref = seconds of reference re-take left
    this._ae = { snap: 1, ref: 1.2 };
    this._postT = 0;

    // Adaptive resolution: scales the render resolution between min and 1 to hold 30+ fps.
    this.adaptiveParam = qp.get('adaptive');   // '1' forces on, '0' forces off
    // ceiling: a scale that proved too slow right after a raise is not tried again for a while (no see-saw)
    this.adaptive = { enabled: false, scale: 1, min: 0.6, samples: [], windowStart: 0, good: 0, cooldown: 0, ceiling: 1, ceilingUntil: 0, raisedAt: 0, fails: 0 };
    this._lastFrame = 0; this._sweep = 0; this._listeners = [];
    this.quality = null; this.settings = null;
    this.setQuality('high', { silent: true });

    let queued = false;
    const onResize = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; this.resize(); }); };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    // WebGL context restored (phones drop it on app switch or under memory pressure): three re-creates its render
    // targets but not their contents. The scene probe is captured again, the batches rebuilt, eye adaptation restarts.
    r.domElement.addEventListener('webglcontextrestored', () => this._contextRestored());
  }
  _contextRestored() {
    const L = this._light, old = L.probe;
    L.probe = null; this._lightingTier();
    if (this.scene && old && this.scene.environment === old.texture) this.scene.environment = L.probe.texture;
    if (L.legacyEnv && this.scene?.environment === L.legacyEnv) this.scene.environment = L.probe.texture;
    L.legacyEnv = null;
    try { old?.dispose(); } catch { /* resources of the lost context */ }
    L.captured = false; L.sig = ''; L.frames = 0; L.lastCap = -1e9;
    this._batch.reset(); this._bFrames = 0;
    this.exposurePass.release?.(); this._ae.snap = 1; this._ae.ref = 1.2;
    this._envSwitch();
    this.stats.contextRestores = (this.stats.contextRestores || 0) + 1;
  }

  // q: 'high' | 'medium' | 'low'. opts.adaptive overrides the tier's adaptive-resolution default.
  // opts.auto: the tier was picked for this device (Graphics: Auto), so a phone that cannot hold its frame
  // rate even at the lowest render scale may step down one tier by itself (never back up: no flip-flop).
  setQuality(q, opts = {}) {
    if (!QUALITY_LEVELS.includes(q)) q = 'high';
    const first = this.quality === null, prev = this.quality;
    this.autoTier = !!opts.auto;
    const s = this.settings = tierSettings(q, this.device);
    this.quality = q;
    RZ.setQuality(q, s.infra.facadeInterior !== undefined ? { interior: s.infra.facadeInterior } : undefined);
    this._batch.smallCull = s.infra.smallCull; this._batch.atlasSize = s.infra.atlas; this._batch.smallShadows = s.infra.smallShadows !== false;
    this._batch.cell = s.infra.cell ?? 50;   // phones: 200 m batch cells (fewer, larger merged draws; m1a medium -23 calls, +1 % triangles)
    const r = this.renderer;
    r.shadowMap.enabled = s.shadows;
    r.shadowMap.type = s.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.bloom.enabled = s.bloom;
    this.bloomScale = s.bloomScale;
    this.applyPost();
    this._lightingTier();
    // Automated runs (webdriver + CPU rasterizer) measure nothing real: keep their resolution fixed.
    const automated = !!window.navigator?.webdriver;
    const auto = this.adaptiveParam === '1' ? true : this.adaptiveParam === '0' ? false : (s.adaptive && !automated);
    const A = this.adaptive;
    A.enabled = opts.adaptive ?? auto;
    if (!A.enabled) A.scale = 1;
    A.samples.length = 0; A.good = 0; A.cooldown = 0; A.windowStart = 0; A.slow = 0; A.ceiling = 1; A.ceilingUntil = 0; A.raisedAt = 0; A.fails = 0;
    this._sweep = 0;
    this.resize();
    if (!first && prev !== q) { this._retier(); this.refreshMaterials(); }
    if (!opts.silent && prev !== q) this.emitQuality();
  }

  // Runtime tier change (Graphics menu, adaptive auto-downgrade): content that is already built follows the new tier.
  // Facade materials that took their detail from the tier get the new RZ_INTERIOR (going to the lite path frees the
  // wall normal / ORM arrays), batches and sign atlases are rebuilt at the new atlas size, street-kit shadows follow.
  _retier() {
    const scene = this.scene; if (!scene) return;
    const interior = RZ.tier().interior, seen = new Set();
    scene.traverse(o => {
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        if (seen.has(m) || !m.userData?.facade?.followsTier) continue;
        seen.add(m); RZ.setFacadeInterior(m, interior);
      }
    });
    this._batch.reset(); this._bFrames = 0; this._culls = null;
  }

  // Tier-gate the post passes (and free the GPU memory of the ones a tier does not use).
  applyPost() {
    const s = this.settings, off = this.postOff;
    const ao = s.ao && !off.has('noao'), smaa = s.aa === 'smaa' && !off.has('noaa'), fxaa = s.aa === 'fxaa' && !off.has('noaa');
    const ae = s.autoExposure && !off.has('noae');
    if (this.aoPass.enabled && !ao) this.aoPass.release();
    if (this.smaa.enabled && !smaa) { this.smaa.edgesRT.dispose(); this.smaa.weightsRT.dispose(); }
    if (this.exposurePass.enabled && !ae) this.exposurePass.release();
    this.aoPass.enabled = ao; this.smaa.enabled = smaa; this.exposurePass.enabled = ae;
    this.dofAllowed = s.dof && ao && !off.has('nodof');
    if (!this.dofAllowed) this.dofPass.enabled = false;
    const defs = this.cinema.material.defines;
    const set = (k, on) => { if (on) defs[k] = ''; else delete defs[k]; };
    set('CHEAP', s.cheapPost); set('FXAA', fxaa); set('AUTO_EXPOSURE', ae); set('NO_GRADE', off.has('nograde')); set('BLOOM', s.bloom);
    // bloom mip count per tier (medium phones: 3, 4 draw calls fewer); the remaining mips carry the dropped ones' weight
    const B = this.bloom, mips = Math.min(B.renderTargetsHorizontal.length, s.bloomMips ?? 5), bf = B.compositeMaterial.uniforms.bloomFactors.value;
    B._bf0 = B._bf0 || bf.slice();
    const kept = B._bf0.slice(0, mips).reduce((a, v) => a + v, 0), all = B._bf0.reduce((a, v) => a + v, 0);
    for (let i = 0; i < bf.length; i++) bf[i] = i < mips ? B._bf0[i] * all / kept : 0;
    B.nMips = mips;
    delete defs.FUSED_OUTPUT;
    this._toneKey = -1;   // tone-mapping defines are rebuilt on the next frame
    this.cinema.material.needsUpdate = true;
    this._ae.snap = 0.5; this._ae.ref = 0.6;
    this.stats.post = [ao && 'gtao', ae && 'eye', this.dofAllowed && 'dof', s.bloom && 'bloom', fxaa && 'fxaa', smaa && 'smaa', !off.has('nograde') && 'grade'].filter(Boolean).join('+');
  }

  // Subscribe to quality changes: fn(quality, settings). Returns an unsubscribe function.
  onQuality(fn) { this._listeners.push(fn); return () => { this._listeners = this._listeners.filter(f => f !== fn); }; }
  emitQuality() {
    for (const fn of [...this._listeners]) { try { fn(this.quality, this.settings); } catch (e) { console.error(e); } }
    try { window.dispatchEvent(new window.CustomEvent('afterzero:quality', { detail: { quality: this.quality, settings: this.settings } })); } catch { /* old browsers */ }
  }

  get resolutionScale() { return this.adaptive.scale; }
  get pixelRatio() { return Math.min(window.devicePixelRatio || 1, this.settings.dprCap) * this.adaptive.scale; }

  setScene(scene) {
    this.scene = scene;
    scene.environment = scene.environment || this.envTexture;
    this.renderPass.scene = scene;
    this._lightScene(scene);
    this._batch.reset(); this._bFrames = 0; this.stats.facadeMs = 0;
    this._sweep = 0;
    // a new place: its own grade at once, no focus, the eye adapts from scratch
    this.focus(null); this._focus.amount = 0; this.dofPass.enabled = false;
    this._grade.explicit = null; this._grade.check = 0;
    this._ae.snap = 1; this._ae.ref = 1.2;
    this.updateGrade(0, true);
  }

  // ---------- colour grade ----------
  // setGrade('rain2049' | 'helix2026' | 'ruin2196' | 'ancient' | 'neutral' | { base?, ...fields } | null, { instant })
  // An object overrides fields of its `base` preset (default neutral). null returns to the automatic choice
  // (scene.userData.grade, else the scene's fog colour, see gradeForScene). Changes blend over ~1 s.
  setGrade(g, opts = {}) {
    this._grade.explicit = g ?? null;
    this._grade.check = 0;
    this.updateGrade(0, !!opts.instant);
    return this._grade.name;
  }
  get grade() { return this._grade.name; }

  _resolveGrade(g) {
    if (typeof g === 'string') return GRADES[g] ? g : 'neutral';
    return g && typeof g === 'object' ? g : 'neutral';
  }
  _setGradeTarget(g) {
    const G = this._grade, t = G.target;
    const base = typeof g === 'string' ? GRADES[g] : GRADES[g.base] || GRADES.neutral;
    const src = typeof g === 'string' ? base : g;
    for (const k of GRADE_KEYS) { const v = src[k] || base[k]; t[k][0] = v[0]; t[k][1] = v[1]; t[k][2] = v[2]; }
    t.saturation = src.saturation ?? base.saturation; t.contrast = src.contrast ?? base.contrast;
    t.pivot = src.pivot ?? base.pivot; t.shoulder = src.shoulder ?? base.shoulder;
  }
  updateGrade(dt, snap = false) {
    const G = this._grade;
    if ((G.check -= dt) <= 0 || snap) {
      G.check = 0.5;
      const g = this.postOff.has('nograde') ? 'off' : this._resolveGrade(G.explicit ?? gradeForScene(this.scene));
      const key = typeof g === 'string' ? g : g === G.ref ? G.key : JSON.stringify(g);
      G.ref = g;
      if (key !== G.key) {
        const had = G.key !== undefined; G.key = key;
        G.name = typeof g === 'string' ? g : (g.name || 'custom');
        this._setGradeTarget(g === 'off' ? IDENTITY_GRADE : g);
        if (had) { this._ae.ref = Math.max(this._ae.ref, 1.4); }   // an era change re-takes the exposure reference
      }
    }
    const c = G.cur, t = G.target, k = snap ? 1 : 1 - Math.exp(-dt / 0.45);
    for (const key of GRADE_KEYS) { const a = c[key], b = t[key]; a[0] += (b[0] - a[0]) * k; a[1] += (b[1] - a[1]) * k; a[2] += (b[2] - a[2]) * k; }
    c.saturation += (t.saturation - c.saturation) * k; c.contrast += (t.contrast - c.contrast) * k;
    c.pivot += (t.pivot - c.pivot) * k; c.shoulder += (t.shoulder - c.shoulder) * k;
    const u = this.fx;
    u.uLift.value.set(c.lift[0], c.lift[1], c.lift[2]);
    u.uGammaInv.value.set(1 / c.gamma[0], 1 / c.gamma[1], 1 / c.gamma[2]);
    u.uGain.value.set(c.gain[0], c.gain[1], c.gain[2]);
    u.uGrade.value.set(c.saturation, c.contrast, Math.min(0.9, Math.max(0.1, c.pivot)), c.shoulder);
    normBalance(c.shadows, u.uShadowBal.value); normBalance(c.highlights, u.uHighBal.value);
  }

  // ---------- cinematic focus ----------
  // focus(point | Object3D | null, { active?: () => bool, dof?: false }): while a target is held (and active() is true)
  // the high tier renders depth of field focused on it; null / inactive releases it (the blur fades out).
  // game.shot() holds the shot's look target and releases it with the shot.
  focus(target, opts = {}) {
    const F = this._focus;
    F.target = target && opts.dof !== false ? target : null;
    F.active = F.target ? opts.active || null : null;
    // the dialogue light rig follows the same target (every tier; opts.rig: false opts a shot out)
    const G = this._light.rig;
    G.target = target && opts.rig !== false ? target : null;
    G.active = G.target ? opts.active || null : null;
    return this;
  }
  _updateFocus(dt) {
    const F = this._focus, cam = this.camera;
    let on = !!(F.target && this.dofAllowed && (!F.active || F.active()));
    if (F.target && !on && F.active && !F.active()) { F.target = null; F.active = null; }
    if (on) {
      const p = F.target.isObject3D ? F.target.getWorldPosition(F.v) : F.v.copy(F.target);
      cam.getWorldDirection(F.d);
      const z = Math.max(0.35, p.sub(cam.position).dot(F.d));
      if (!(z < 1e5)) on = false;
      else F.z = F.amount < 0.01 || dt === 0 ? z : F.z + (z - F.z) * (1 - Math.exp(-dt / 0.18));
    }
    const k = dt === 0 ? 1 : 1 - Math.exp(-dt / 0.3);
    F.amount += ((on ? 1 : 0) - F.amount) * k;
    if (F.amount < 0.01 && !on) F.amount = 0;
    const dp = this.dofPass;
    dp.enabled = this.dofAllowed && F.amount > 0.01;
    if (dp.enabled) {
      const u = dp.mat.uniforms, t = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
      u.cameraNear.value = cam.near; u.cameraFar.value = cam.far; u.uFocus.value = F.z;
      u.tDepth.value = this.aoPass.sceneRT.depthTexture;
      const px = dp.height / 720;
      u.uScale.value = 1.9 * px / (t * t) * F.amount; u.uMaxR.value = 9 * px * F.amount;
    }
  }

  // Jump every smoothed post value (grade, exposure, focus) to its target: deterministic captures and cuts.
  settlePost() {
    this.settleLighting();
    this.updateGrade(0, true);
    this._ae.snap = Math.max(this._ae.snap, 1e-3); this._ae.ref = Math.max(this._ae.ref, 1e-3); this._ae.force = true;
    this._updateFocus(0);
  }

  _updatePost(dt) {
    const r = this.renderer, fx = this.fx;
    // tone mapping defines follow the renderer (missions set exposure; tone mapping itself rarely changes)
    if (r.toneMapping !== this._toneKey || r.outputColorSpace !== this._toneSpace) {
      this._toneKey = r.toneMapping; this._toneSpace = r.outputColorSpace;
      const defs = this.cinema.material.defines;
      for (const k in TONE_DEFINES) delete defs[TONE_DEFINES[k]];
      if (TONE_DEFINES[r.toneMapping]) defs[TONE_DEFINES[r.toneMapping]] = '';
      if (THREE.ColorManagement.getTransfer(r.outputColorSpace) === THREE.SRGBTransfer) defs.SRGB_TRANSFER = ''; else delete defs.SRGB_TRANSFER;
      this.cinema.material.needsUpdate = true;
    }
    fx.toneMappingExposure.value = r.toneMappingExposure;
    this.updateGrade(dt);
    this._updateFocus(dt);
    if (this.aoPass.enabled) {
      const f = this.scene?.fog;
      this.aoPass.fog = f?.isFogExp2 ? f.density : f?.isFog ? 1.2 / Math.max(1, f.far) : 0;
      this.aoPass.comp.uniforms.uDebug.value = this.postOff.has('aodebug') ? 1 : this.postOff.has('aoraw') ? 2 : 0;
    }
    const E = this.exposurePass;
    if (E.enabled) {
      const A = this._ae;
      const snap = A.snap > 0 || A.force, ref = A.ref > 0 || A.force;
      A.snap -= dt; A.ref -= dt; A.force = false;
      E.k = snap ? 1 : 1 - Math.exp(-dt / 0.9);
      E.kRef = ref ? 1 : 1 - Math.exp(-dt / 120);
      fx.uAE.value.set(this.quality === 'high' ? 0.5 : 0.4, -0.5, 0.7);
      fx.tAdapt.value = E.rt[E.i ^ 1].texture;   // the target this frame's adaptation writes
    }
  }

  // ---------- scene lighting (docs/RENDERING.md, stage 2) ----------
  // Applied to every scene the engine shows; each part is tier-gated and can be switched off for A/B captures with
  // ?light=noenv,nofog,nowet,nocontact,norig,noshadow,noshafts (or engine.lightOff + applyLighting()):
  //   env      the scene's own image-based light: an EnvProbe captured at the camera ~8 frames after setScene
  //            (characters, rain and particles hidden), scaled to the mean brightness of the studio light the scene
  //            was authored with (so authored exposure and envIntensity still hold) with 15 % of it spread evenly as
  //            bounce light, re-captured when the place changes (era switch, blackout: fog / background / visible
  //            lights) and, on high / medium, when the camera has moved 25 / 40 m. A re-capture renders one cube face
  //            per frame. Missions that set scene.environment themselves are left alone.
  //   fog      FogExp2 becomes height fog with the same colour, density and near-field curve (falloff per era).
  //   wet      visible rain -> wet materials (realism.setWetness): low = darker + glossier tops, medium + puddles,
  //            high + raindrop ripples and water streaks on walls / glass.
  //   contact  soft contact shadows under every character (one instanced draw, all tiers).
  //   shadow   texel-snapped directional shadows (no shimmer), normalBias / PCF radius defaults for untuned lights.
  //   rig      dialogue key + rim lights (no shadows) around the focus target while a close cinematic shot holds
  //            it; added to the scene only during the shot (2 lights on high / medium, a rim on low).
  //   shafts   additive light cones under shadow-casting spot lights, scaled by haze and era (high / medium).
  _initLighting() {
    // spot lights aimed at the subject whose range ends just past it: the wall behind a speaker is never lit (a key from
    // the camera side stops ~0.8 m behind the head; the rim sits behind the subject and shines toward the camera)
    const key = new THREE.SpotLight(0xfff0e2, 0, 3, 0.5, 1, 2); key.name = 'rigKey';
    const rim = new THREE.SpotLight(0xdbe8ff, 0, 3, 0.55, 1, 2); rim.name = 'rigRim';
    key.userData.noCapture = rim.userData.noCapture = true;
    this._light = {
      probe: null, roomLum: 0.5, legacyEnv: null, contact: RZ.contactShadows({ max: 48 }),
      rig: { key, rim, target: null, active: null, amount: 0, added: 0, v: new THREE.Vector3(), d: new THREE.Vector3(), r: new THREE.Vector3(), warm: new WeakSet() },
      wet: 0, wetTarget: 0, casters: [], chars: [], shafts: [], sig: '', sigT: 0, frames: 0, lastCap: -1e9, captured: false, scene: null,
    };
  }
  get envTexture() { return this._light?.probe?.texture || null; }
  lightOn(k) { return !this.lightOff.has('no' + k); }

  // Tier change: probe resolution (the studio placeholder is re-filled; a scene using the old probe moves over).
  _lightingTier() {
    const L = this._light, size = this.settings.light.probe;
    if (L.probe && L.probe.size === size) return;
    const old = L.probe, oldTex = old?.texture;
    L.probe = new RZ.EnvProbe(this.renderer, { size });
    const room = new RoomEnvironment();
    L.probe.fill(room, [0, 0, 0], { measure: true }).keepAsFloor();
    room.dispose?.();
    L.roomLum = L.probe.luminance || 0.5;
    if (this.scene && oldTex && this.scene.environment === oldTex) { this.scene.environment = L.probe.texture; L.frames = 0; L.sig = ''; L.captured = false; }
    old?.dispose();
  }
  _lightScene(scene) {
    const L = this._light;
    L.scene = scene; L.frames = 0; L.sig = ''; L.lastCap = -1e9; L.casters = []; L.chars = []; L.shafts = [];
    L.probe.job = null;
    // a new place starts from the studio placeholder until its own capture is ready (same texture object)
    if (scene.environment === L.probe.texture && L.captured) { const room = new RoomEnvironment(); L.probe.fill(room, [0, 0, 0]); room.dispose?.(); }
    L.captured = false;
    this._envSwitch();
    L.contact.track([]);
    if (L.contact.mesh.parent !== scene) scene.add(L.contact.mesh);
    const G = L.rig; G.target = null; G.active = null; G.amount = 0; this._rigAttach(false);
    L.wet = L.wetTarget = 0;
    this._upgradeFog(scene);
  }
  // FogExp2 -> realism HeightFog (same Color object, density linked both ways, same curve at the ground).
  _upgradeFog(scene) {
    const f = scene.fog;
    if (!f || !f.isFogExp2 || f.isHeightFog) return;
    const h = RZ.heightFogFrom(f, { falloff: this._fogFalloff(scene) });
    Object.defineProperty(h, 'density', { get: () => f.density, set: v => { f.density = v; }, configurable: true });
    h.userData = { falloff: h.falloff };
    if (!this.lightOn('fog')) h.falloff = 1e-4;
    scene.fog = h;
  }
  // Height falloff per era (1/m): open valley haze thins slowly, the rainy street lets towers rise out of it.
  _fogFalloff(scene) {
    if (scene.userData.fogFalloff !== undefined) return scene.userData.fogFalloff;
    return { rain2049: 0.05, helix2026: 0.06, ruin2196: 0.04, ancient: 0.022, neutral: 0.04 }[gradeForScene(scene)] ?? 0.04;
  }
  // What the probe depends on: a change re-captures it (era switch, blackout, lights switched on / off).
  _lightSig(scene) {
    const q = c => (c && c.isColor ? Math.round(c.r * 64) + ',' + Math.round(c.g * 64) + ',' + Math.round(c.b * 64) : '-');
    let n = 0;
    const vis = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    for (const l of this._sigLights || []) if (l.parent && vis(l) && l !== this._light.rig.key && l !== this._light.rig.rim) n++;
    const f = scene.fog;
    return [q(f?.color), f ? Math.round(Math.log(Math.max(1e-5, f.density ?? f.far ?? 1)) * 8) : 0, q(scene.background), Math.round((scene.environmentIntensity ?? 1) * 20), n].join('|');
  }
  // Every 45 frames: lights (shadow tuning + snapping list, probe signature), characters (contact shadows), rain (wet).
  _lightSweep() {
    const L = this._light, scene = this.scene; if (!scene || L.scene !== scene) return;
    const lights = [], chars = []; let rain = false;
    scene.traverse(o => {
      if (o.isLight) lights.push(o);
      else if (o.userData.character) chars.push(o);
      else if (o.userData.contactShadow) {   // opt-in props: userData.contactShadow = true | radius | { radius, strength, scale }
        const c = o.userData.contactShadow;
        chars.push(typeof c === 'object' ? { object: o, radius: c.radius, strength: c.strength, scale: c.scale } : { object: o, radius: typeof c === 'number' ? c : undefined });
      }
      if (o.userData.rzRain && o.visible) rain = true;
    });
    this._sigLights = lights;
    const shadowFix = this.lightOn('shadow');
    L.casters = [];
    for (const l of lights) {
      if (!l.castShadow || !l.shadow) continue;
      if (shadowFix) { RZ.tuneShadow(l, { radius: this.settings.light.pcfRadius }); if (l.isDirectionalLight) L.casters.push(l); }
      else if (l.userData.rzAuthoredNB !== undefined) { l.shadow.normalBias = l.userData.rzAuthoredNB; l.shadow.radius = l.userData.rzAuthoredRadius; }
    }
    L.chars = chars; L.contact.track(chars);
    // light shafts: a soft additive cone under each shadow-casting spot light (the key lights of interiors and the
    // moonlight through the 2196 roof), brightness from the haze density and the era; high / medium only
    if (this.settings.light.shafts > 0 && this.lightOn('shafts')) for (const l of lights) {
      if (!l.isSpotLight || !l.castShadow || l.userData.rzShaft || !l.parent || l.userData.noShaft) continue;
      const from = l.position, to = l.target.parent === l.parent ? l.target.position : l.target.position.clone();
      const len = from.distanceTo(to); if (!(len > 1.5)) continue;
      const r1 = Math.min(len * 0.9, Math.tan(Math.min(l.angle, 1.2)) * len * 0.75);
      const sh = RZ.lightShaft({ from: from.toArray(), to: to.toArray(), radius: [0.12, r1], color: l.color.getHex(), intensity: 0, floorY: to.y, dust: 0.8 });
      sh.userData.light = l; l.userData.rzShaft = sh; l.parent.add(sh); L.shafts.push(sh);
    }
    L.wetTarget = scene.userData.wet ?? (rain ? 1 : 0);
  }
  _updateLighting(dt, t) {
    const L = this._light, scene = this.scene, s = this.settings.light;
    if (!scene || L.scene !== scene) return;
    if (scene.fog && scene.fog.isFogExp2 && !scene.fog.isHeightFog) this._upgradeFog(scene);
    // env probe: first capture once the scene is built, re-captures on change, one face per frame
    const P = L.probe, auto = scene.environment === P.texture && this.lightOn('env') && scene.userData.autoEnv !== false;
    L.frames++;
    if (auto) {
      if (P.busy) { P.step(1); if (!P.busy) this._probeDone(); }
      else if (L.frames >= 8 && (L.sigT -= dt) <= 0) {
        L.sigT = 0.5;
        const sig = this._lightSig(scene), moved = s.probeMove > 0 && L.captured && this.camera.position.distanceTo(P.position) > s.probeMove;
        if (!L.sig || ((sig !== L.sig || moved) && t - L.lastCap > 2)) { L.sig = sig; this._startProbe(t); }
      }
    }
    // probe brightened toward the studio level: diffuse keeps it, reflections at most 4x physical
    RZ.setEnvSpecular(scene.environment === P.texture && L.captured ? Math.min(1, 4 / Math.max(1e-3, P.scale)) : 1);
    RZ.setEnvDiffuseSaturation(scene.environment === P.texture && L.captured ? L.diffSat ?? 1 : 1);
    // wet weather (global shader state): eases over ~2 s
    const wt = this.lightOn('wet') ? L.wetTarget : 0;
    L.wet += (wt - L.wet) * (dt > 0 ? 1 - Math.exp(-dt / 0.7) : 1);
    if (Math.abs(L.wet - wt) < 1e-3) L.wet = wt;
    RZ.setWetness({ amount: L.wet, time: t, puddles: s.puddles, detail: s.wetDetail, ground: scene.userData.wetGround ?? 0 });
    // contact shadows
    const C = L.contact; C.strength = this.lightOn('contact') ? s.contact : 0;
    if (C.mesh.parent !== scene) scene.add(C.mesh);
    C.update(this.camera);
    // shadow snapping (after the mission moved its sun / moon this frame)
    if (this.lightOn('shadow')) for (const l of L.casters) RZ.stabilizeShadow(l);
    if (L.shafts.length) {
      const f = scene.fog, haze = f ? Math.min(1, Math.max(0.2, (f.density ?? 0.02) * 30)) : 0.35;
      const era = { ruin2196: 1.25, helix2026: 1, rain2049: 0.8, ancient: 0.6, neutral: 0.8 }[this.grade] ?? 0.8;
      const on = this.lightOn('shafts') ? s.shafts : 0;
      for (const sh of L.shafts) {
        // (the shaft itself fades out while the camera is inside / next to its cone: realism.lightShaftFade)
        const l = sh.userData.light, k = on * haze * era * Math.min(1, l.intensity / 120);
        sh.visible = k > 0.01 && l.visible; sh.material.uniforms.uCol.value.copy(l.color).multiplyScalar(0.55 * k);
      }
    }
    this._updateRig(dt);
  }
  _startProbe(t) {
    const L = this._light;
    L.probe.start(this.scene, this.camera.position, {
      hide: o => !!(o.userData.character || o.userData.rzRain || o.isPoints || o.isLineSegments || o.isSprite),
      // floor: no direction darker than half the studio light the scene was authored with in that direction (bright
      // from above), so a blacked-out room keeps readable floors and characters' legs (up-facing surfaces under a black
      // ceiling had almost no image-based light); measured on m1b street +14 %, m2b office floor about 2x
      normalize: { luminance: L.roomLum, strength: this.scene.userData.envNormalize ?? 1, min: 0.5, max: 48, fill: this.scene.userData.envFill ?? this.settings.light.envFill ?? 0.15,
        floor: this.scene.userData.envFloor ?? this.settings.light.envFloor ?? 0.5 },
      // emissive panels stay bright in reflections without blowing wet floors out; tinted eras keep their hue in the
      // key / hemisphere lights and fog, so the probe adds less of it (an orange sunset would turn green grass brown,
      // a red alarm strip would paint a whole lab red); a rainy street keeps its full neon colour
      // the diffuse share is desaturated separately (L.diffSat -> realism.setEnvDiffuseSaturation): the valley's
      // reflections keep the sunset colour while grass and stone are lit by a near-neutral sky (no ochre grass)
      clamp: this.scene.userData.envClamp ?? 8, saturation: this.scene.userData.envSaturation ?? ({ ancient: 0.75, ruin2196: 0.55, helix2026: 0.7 }[gradeForScene(this.scene)] ?? (L.wetTarget > 0 ? 1 : 0.7)),
    });
    L.diffSat = this.scene.userData.envDiffuseSaturation ?? ({ ancient: 0.3 }[gradeForScene(this.scene)] ?? 1);
    L.lastCap = t;
  }
  _probeDone() {
    const L = this._light;
    L.captured = true; this.stats.probeMs = +L.probe.ms.toFixed(1); this.stats.probes++;
    this.stats.probeLum = +(L.probe.luminance ?? 0).toFixed(4); this.stats.probeScale = +L.probe.scale.toFixed(2); this.stats.roomLum = +L.roomLum.toFixed(3);
    // the rig's program variants (light count + 1 / + 2) compile in the background now, not at the first close-up
    // (without KHR_parallel_shader_compile this is a plain compile at scene start, under the mission intro)
    // On 'low' without KHR_parallel_shader_compile it is skipped: a synchronous compile of every visible material would
    // be a hitch at gameplay start on a weak phone; the variants then compile at the first close-up, which starts with a cut.
    const r = this.renderer, par = r.extensions?.has?.('KHR_parallel_shader_compile');
    if (!L.rig.warm.has(this.scene) && this.settings.light.rig > 0 && (par || this.quality !== 'low')) {
      L.rig.warm.add(this.scene);
      try { this._rigAttach(true); if (par) r.compileAsync(this.scene, this.camera).catch(() => {}); else r.compile(this.scene, this.camera); } catch { /* optional */ } finally { this._rigAttach(false); }
    }
  }
  _rigAttach(on) {
    const L = this._light, G = L.rig, scene = this.scene, n = on ? this.settings.light.rig : 0;
    for (const [i, l] of [[1, G.rim], [2, G.key]]) {
      const want = n >= i && scene;
      if (want && l.parent !== scene) scene.add(l, l.target); else if (!want && l.parent) { l.parent.remove(l); l.target.parent?.remove(l.target); }
    }
    G.added = n;
  }
  _updateRig(dt) {
    const G = this._light.rig, cam = this.camera;
    // scene.userData.rigIntensity = 0 detaches the rig entirely (no light in the shader loop, not just a dark one)
    let on = !!(G.target && this.lightOn('rig') && this.settings.light.rig > 0 && (this.scene?.userData.rigIntensity ?? 1) > 0 && (!G.active || G.active()));
    if (G.target && G.active && !G.active()) { G.target = null; G.active = null; }
    let p = null;
    if (on) {
      p = G.target.isObject3D ? G.target.getWorldPosition(G.v) : G.v.copy(G.target);
      if (!(p.distanceTo(cam.position) < 7) || cam.fov > 50) on = false;   // close shots only
    }
    const k = dt === 0 ? 1 : 1 - Math.exp(-dt / 0.35);
    G.amount += ((on ? 1 : 0) - G.amount) * k;
    if (!on && G.amount < 0.01) G.amount = 0;
    if (G.amount <= 0) { if (G.added) this._rigAttach(false); return; }
    if (G.added !== this.settings.light.rig) this._rigAttach(true);
    if (p) {
      // camera-relative placement: key from the camera side, 45 degrees off axis and above; rim behind the subject
      const d = G.d.subVectors(p, cam.position); d.y = 0; if (d.lengthSq() < 1e-6) d.set(0, 0, -1); d.normalize();
      const r = G.r.set(-d.z, 0, d.x);
      G.key.position.copy(p).addScaledVector(d, -1.0).addScaledVector(r, 1.0).y += 0.5;
      G.rim.position.copy(p).addScaledVector(d, 1.1).addScaledVector(r, -0.6).y += 0.7;
      for (const l of [G.key, G.rim]) { l.target.position.copy(p); l.target.position.y -= 0.25; l.distance = l.position.distanceTo(p) + 0.75; }
    }
    const scale = this.scene.userData.rigIntensity ?? 1;
    G.key.intensity = 3 * G.amount * scale; G.rim.intensity = 5 * G.amount * scale;
  }
  // Snap the lighting state for a deterministic frame (captures, hard cuts): finish the probe, wet + rig at target.
  settleLighting() {
    const L = this._light, scene = this.scene;
    if (!scene || L.scene !== scene) return;
    this._lightSweep();
    L.frames = Math.max(L.frames, 8); L.sigT = 0; L.lastCap = -1e9;   // no re-capture throttle for a settled frame
    this._updateLighting(0, this.fx.uTime.value);
    if (L.probe.busy) { L.probe.finish(); this._probeDone(); }
    L.wet = this.lightOn('wet') ? L.wetTarget : 0;
    this._updateLighting(0, this.fx.uTime.value);
  }
  // noenv: the pre-upgrade studio environment (three's RoomEnvironment PMREM) instead of the scene probe.
  _envSwitch() {
    const L = this._light, scene = this.scene; if (!scene) return;
    if (!this.lightOn('env') && scene.environment === L.probe.texture) {
      if (!L.legacyEnv) { const pm = new THREE.PMREMGenerator(this.renderer); const room = new RoomEnvironment(); L.legacyEnv = pm.fromScene(room, 0.04).texture; pm.dispose(); room.dispose?.(); }
      scene.environment = L.legacyEnv;
    } else if (this.lightOn('env') && L.legacyEnv && scene.environment === L.legacyEnv) scene.environment = L.probe.texture;
  }
  // Re-apply the ?light= switches at runtime (A/B captures).
  applyLighting() {
    const scene = this.scene; if (!scene) return;
    this._envSwitch();
    if (scene.fog?.isHeightFog && scene.fog.userData?.falloff !== undefined) scene.fog.falloff = this.lightOn('fog') ? scene.fog.userData.falloff : 1e-4;
    this._lightSweep(); this.settleLighting();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight, pr = this.pixelRatio;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    RZ.shared.viewH.value = Math.max(1, Math.round(h * pr));   // thin facade emitters are widened to ~1.5 px of this
    this.composer.setPixelRatio(pr);   // also resizes every pass at the new pixel ratio
    this.composer.setSize(w, h);
    this.fx.uAspect.value = w / h;
    this.fx.uTexel.value.set(1 / Math.max(1, Math.round(w * pr)), 1 / Math.max(1, Math.round(h * pr)));
    this.stats.pixelRatio = pr; this.stats.scale = this.adaptive.scale;
  }

  // Force shader recompiles after shadow settings change at runtime.
  refreshMaterials() {
    this.scene?.traverse(o => {
      if (!o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true;
    });
  }

  // Keep shadow maps within the tier budget (missions author 2048² maps for desktop).
  clampShadows() {
    const max = this.settings.shadowMapMax;
    this.scene.traverse(o => {
      if (!o.isLight || !o.castShadow || !o.shadow) return;
      const ms = o.shadow.mapSize, ud = o.userData;
      if (!ud.authoredShadowMap) ud.authoredShadowMap = ms.clone();
      const w = Math.min(ud.authoredShadowMap.x, max), h = Math.min(ud.authoredShadowMap.y, max);
      if (ms.x !== w || ms.y !== h) { ms.set(w, h); o.shadow.map?.dispose(); o.shadow.map = null; }
    });
  }

  adapt(now) {
    const A = this.adaptive, dt = now - this._lastFrame;
    this._lastFrame = now;
    if (dt > 0 && dt < 1000) {
      A.samples.push(dt);
      this.stats.frameMs = this.stats.frameMs ? this.stats.frameMs * 0.9 + dt * 0.1 : dt;
      this.stats.fps = 1000 / this.stats.frameMs;
    }
    if (!A.enabled) { A.samples.length = 0; return; }
    // a long gap (tab hidden, app backgrounded, a breakpoint) starts a fresh window
    if (!A.windowStart || dt >= 1000) { A.windowStart = now; A.samples.length = 0; return; }
    if (now - A.windowStart < 1000 || A.samples.length < 8) return;
    const s = A.samples.sort((a, b) => a - b), median = s[s.length >> 1];
    A.samples.length = 0; A.windowStart = now;
    // Auto tier on a phone, already at the lowest scale and still under ~22 fps for 15 s: one tier down.
    A.slow = A.scale <= A.min + 1e-6 && median > 45 ? (A.slow || 0) + 1 : 0;
    if (A.slow >= 15 && this.autoTier && this.device.mobile && this.quality !== 'low') {
      this.setQuality(QUALITY_LEVELS[QUALITY_LEVELS.indexOf(this.quality) + 1], { auto: true });
      this.stats.autoDowngrades = (this.stats.autoDowngrades || 0) + 1;
      return;
    }
    if (A.cooldown > 0) { A.cooldown--; return; }
    if (A.ceilingUntil && now > A.ceilingUntil) { A.ceiling = 1; A.ceilingUntil = 0; }
    let next = A.scale;
    if (median > 36) {                                                                  // below ~28 fps
      next = A.scale - (median > 55 ? 0.15 : 0.1); A.good = 0;
      // the last raise is what made it slow: step back to where it was and stay at or below that scale
      // for 30 s, doubling (up to 4 min) every time the same raise fails again
      if (A.raisedAt && now - A.raisedAt < 4000) {
        next = A.scale - 0.05; A.ceiling = next;
        A.fails = Math.min((A.fails || 0) + 1, 4); A.ceilingUntil = now + 15000 * (2 ** A.fails);
      }
    } else if (median < 20) { if (++A.good >= 2) { next = A.scale + 0.05; A.good = 0; } } // above ~50 fps, sustained
    else A.good = 0;
    next = Math.round(Math.min(1, A.ceiling, Math.max(A.min, next)) * 20) / 20;
    next = Math.max(A.min, next);
    if (next !== A.scale) { A.raisedAt = next > A.scale ? now : 0; A.scale = next; A.cooldown = 1; this.resize(); }
  }

  // ---------- buildings and static batching (docs/RENDERING.md, stage 4) ----------
  //   facades  kit.box() buildings get their geometry on the first frame their scene renders (kit.resolveFacades)
  //   batch    static meshes sharing a material (or an equivalent plain one) merge into a few draws per 50 m cell:
  //            snapshot 2 frames after setScene, merged at frame 6 if unchanged, new static meshes picked up every
  //            120 frames; members that move / change draw themselves again (realism.StaticBatcher). Small props
  //            are distance-culled (tier infra.smallCull). ?infra=nobatch / scene.userData.batch = false opt out.
  _updateInfra() {
    const s = this.scene; if (!s) return;
    try { const ms = KIT.resolveFacades(s); if (ms) this.stats.facadeMs = Math.round((this.stats.facadeMs || 0) + ms); } catch (e) { console.warn('facades', e); }
    const B = this._batch;
    if (!this.batchOn || s.userData.batch === false) { if (B.scene) B.reset(); return; }
    const f = ++this._bFrames;
    try {
      if (f === 2 || f === 6 || (f > 6 && f % 120 === 0)) B.scan(s, { stableOnly: true });
      B.update(s, this.camera, f);
    } catch (e) { console.warn('static batching disabled for this scene', e); B.reset(); s.userData.batch = false; }
    this.stats.batches = B.stats.batches; this.stats.batched = B.stats.members; this.stats.batchMs = B.stats.ms;
    // street kit: distance culling of small instanced props (userData.rzCullDist, scaled by the tier) and animated
    // props (userData.rzAnimate + update(t): traffic lights), collected every 60 frames
    if (f === 1 || f % 60 === 0 || !this._culls) {
      const c = [], a = [], shadows = this.settings.infra.smallShadows !== false, B = this._batch;
      // medium phones: small props (street kit, static meshes under 1 m radius) and flat ground slabs cast no shadow (their shadow-pass draws;
      // characters keep theirs), restored on other tiers. A batched member keeps its flag (changing it would un-batch it;
      // its small batch already casts nothing).
      const visit = o => {
        if (o.userData.character) return;
        if (o.userData.rzCullDist) c.push(o);
        if (o.userData.rzAnimate) a.push(o);
        if ((o.isMesh || o.isInstancedMesh) && !o.isSkinnedMesh && !o.userData.rzBatch && (o.userData.rzCast0 !== undefined || (o.castShadow && !shadows))) {
          let small = !!o.userData.rzCullDist;
          if (!small && o.geometry) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); small = o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() < 1; }
          // flat slabs on the ground (pavements, plazas, rail beds: kit boxes cast by default) shadow nothing visible
          if (!small && !o.isInstancedMesh && o.geometry) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); _infraB.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); small = _infraB.max.y - _infraB.min.y < 0.35 && _infraB.max.y < 0.6; }
          if (small && !B.members.has(o)) {
            if (o.userData.rzCast0 === undefined) o.userData.rzCast0 = o.castShadow;
            o.castShadow = shadows && o.userData.rzCast0;
          }
        }
        for (const ch of o.children) visit(ch);
      };
      visit(s);
      this._culls = c; this._anims = a;
    }
    if (this._culls?.length) {
      const k = this.settings.infra.smallCull / 120, cam = this.camera.position;
      for (const o of this._culls) { const r = o.boundingSphere || o.geometry?.boundingSphere; if (!r) continue; _infraV.copy(r.center).applyMatrix4(o.matrixWorld); o.visible = cam.distanceTo(_infraV) - r.radius < o.userData.rzCullDist * k; }
    }
    if (this._anims?.length && f % 15 === 0) for (const o of this._anims) o.userData.update?.(this.fx.uTime.value);
  }

  // A/B for captures and cost measurements: legacy = true shows the scene as before stage 4 (plain kit boxes, legacy
  // lamp posts, no static batching), false restores the upgrade (batched at once).
  setInfraLegacy(legacy) {
    const s = this.scene; if (!s) return 0;
    const n = KIT.setInfraLegacy(s, legacy);
    if (legacy) { this._batch.reset(); this.batchOn = false; }
    else { this.batchOn = KIT.infraOn('batch'); this._batch.reset(); if (this.batchOn) { this._batch.scan(s); this._batch.update(s, this.camera, this._bFrames); } }
    return n;
  }

  // A/B for the stage-3 surface materials: legacy = true gives the kit's asphalt / tile / stone / concrete materials
  // their canvas textures from before stage 3 (same page, same frame), false the baked PBR sets; batches are rebuilt.
  setMaterialsLegacy(legacy) {
    const s = this.scene; if (!s) return 0;
    const n = KIT.setKitMaterialsLegacy(s, legacy);
    this._batch.reset(); if (this.batchOn && s.userData.batch !== false) { this._batch.scan(s); this._batch.update(s, this.camera, this._bFrames); }
    return n;
  }

  render(t) {
    const now = performance.now();
    const dt = this._postT ? Math.min(0.1, Math.max(0, (now - this._postT) / 1000)) : 0;
    this._postT = now;
    this.adapt(now);
    if (this._sweep-- <= 0) { this._sweep = 45; this.clampShadows(); this._lightSweep(); }
    this._updatePost(dt);
    this._updateInfra();
    this._updateLighting(dt, t);
    this.renderer.info.reset();
    this.fx.uTime.value = t;
    this.composer.render();
    this.stats.calls = this.renderer.info.render.calls;
    this.stats.triangles = this.renderer.info.render.triangles;
  }
}

// The grade with ?post=nograde: exactly the pre-grade image.
const IDENTITY_GRADE = { lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], saturation: 1, contrast: 1, pivot: 0.4, shoulder: 0, shadows: [1, 1, 1], highlights: [1, 1, 1] };

function gpuName(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
  } catch { return ''; }
}
