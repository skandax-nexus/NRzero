import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Final cinematic pass: temporal ripple, chromatic aberration, vignette, grain, freeze desaturation.
// Defines (set per quality tier):
//   FUSED_OUTPUT  the pass also does tone mapping + sRGB output, so the separate OutputPass is skipped
//   CHEAP         single texture tap unless a switch / damage effect is running
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
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uShift,uFreeze,uResidue,uDamage,uGrain,uVignette,uAspect; uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    vec3 aberrated(vec2 uv, vec2 dir, float ca){
      return vec3(texture2D(tDiffuse, uv + dir*ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir*ca).b);
    }
    void main(){
      vec2 uv=vUv; vec2 c=uv-0.5; c.x*=uAspect; float r=length(c);
      vec2 dir = normalize(c+1e-5)/vec2(uAspect,1.0);
      if (uShift > 0.0) {
        // temporal ripple: concentric wave expanding from centre
        float wave = sin(r*38.0 - uTime*22.0) * uShift * 0.018 * smoothstep(0.9,0.0,r);
        uv += dir*wave;
        // slice tearing during shift
        float band = step(0.82, hash(vec2(floor(uv.y*42.0), floor(uTime*24.0))));
        uv.x += band*uShift*0.03*(hash(vec2(uTime,uv.y))-0.5);
      }
      vec3 col;
    #ifdef CHEAP
      if (uShift + uDamage > 0.001) col = aberrated(uv, dir, uShift*0.012 + uDamage*0.006 + r*r*0.004);
      else col = texture2D(tDiffuse, uv).rgb;
    #else
      col = aberrated(uv, dir, 0.0015 + uShift*0.012 + uDamage*0.006 + r*r*0.004);
    #endif
    #ifdef FUSED_OUTPUT
      #ifdef TONE_MAPPING
      col = toneMapping(col);
      #endif
      col = linearToOutputTexel(vec4(col, 1.0)).rgb;
    #endif
      // shift: flash toward cyan-white core
      col = mix(col, col*vec3(0.8,1.15,1.3)+vec3(0.05,0.12,0.16), uShift*0.6);
      // freeze: desaturate with cold tint
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(col, vec3(l)*vec3(0.85,0.95,1.1), uFreeze*0.85);
      // residue vision: teal monochrome with edges preserved
      col = mix(col, vec3(l*0.35, l*0.9, l*1.05) + vec3(0.0,0.03,0.05), uResidue*0.7);
      col *= uTint;
      // vignette
      float v = smoothstep(1.05, 0.25, r*uVignette*1.15);
      col *= mix(0.55, 1.0, v);
      col = mix(col, col + vec3(0.5,0.0,0.03), uDamage*smoothstep(0.3,0.9,r));
      // grain
      col += (hash(vUv*vec2(1920.0,1080.0)+fract(uTime)*91.7)-0.5)*uGrain;
      gl_FragColor = vec4(col,1.0);
    }`,
};

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
function tierSettings(q, device) {
  const m = device.mobile;
  const T = {
    high: { dprCap: 1.75, shadows: true, shadowMapMax: 4096, softShadows: true, bloom: true, bloomScale: 1, cheapPost: false, adaptive: false,
      hints: { characterDetail: 'high', crowd: 1, drawDistance: 1, maxLights: 12, particles: 1 } },
    medium: { dprCap: m ? 1.5 : 1, shadows: true, shadowMapMax: 1024, softShadows: false, bloom: true, bloomScale: 0.5, cheapPost: true, adaptive: true,
      hints: { characterDetail: m ? 'low' : 'high', crowd: 0.6, drawDistance: 0.8, maxLights: 6, particles: 0.6 } },
    low: { dprCap: m ? 1 : 0.75, shadows: false, shadowMapMax: 512, softShadows: false, bloom: false, bloomScale: 0.5, cheapPost: true, adaptive: true,
      hints: { characterDetail: 'low', crowd: 0.35, drawDistance: 0.6, maxLights: 4, particles: 0.35 } },
  };
  return { quality: q, mobile: m, ...T[q] };
}

export const QUALITY_LEVELS = ['high', 'medium', 'low'];

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

    const pmrem = new THREE.PMREMGenerator(r);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.composer = new EffectComposer(r);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.5, 0.92);
    this.bloomScale = 1;
    const bloomSetSize = this.bloom.setSize.bind(this.bloom);   // half-res bloom on cheaper tiers
    this.bloom.setSize = (w, h) => bloomSetSize(Math.max(2, Math.round(w * this.bloomScale)), Math.max(2, Math.round(h * this.bloomScale)));
    this.composer.addPass(this.bloom);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
    this.cinema = new ShaderPass(CinemaShader);
    this.composer.addPass(this.cinema);
    this.fx = this.cinema.uniforms;
    this.fx.uAspect.value = window.innerWidth / window.innerHeight;

    // Per-frame statistics: scene = shadow maps + main pass, total = including post-processing.
    this.stats = { sceneCalls: 0, sceneTriangles: 0, calls: 0, triangles: 0, fps: 0, frameMs: 0, pixelRatio: 1, scale: 1 };
    const renderScene = this.renderPass.render.bind(this.renderPass);
    this.renderPass.render = (...a) => { renderScene(...a); this.stats.sceneCalls = r.info.render.calls; this.stats.sceneTriangles = r.info.render.triangles; };

    // Adaptive resolution: scales the render resolution between min and 1 to hold 30+ fps.
    const qp = new URLSearchParams(location.search);
    this.adaptiveParam = qp.get('adaptive');   // '1' forces on, '0' forces off
    this.adaptive = { enabled: false, scale: 1, min: 0.6, samples: [], windowStart: 0, good: 0, cooldown: 0 };
    this._lastFrame = 0; this._sweep = 0; this._listeners = [];
    this.quality = null; this.settings = null;
    this.setQuality('high', { silent: true });

    let queued = false;
    const onResize = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; this.resize(); }); };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
  }

  // q: 'high' | 'medium' | 'low'. opts.adaptive overrides the tier's adaptive-resolution default.
  setQuality(q, opts = {}) {
    if (!QUALITY_LEVELS.includes(q)) q = 'high';
    const first = this.quality === null, prev = this.quality;
    const s = this.settings = tierSettings(q, this.device);
    this.quality = q;
    const r = this.renderer;
    r.shadowMap.enabled = s.shadows;
    r.shadowMap.type = s.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.bloom.enabled = s.bloom;
    this.bloomScale = s.bloomScale;
    this.outputPass.enabled = !s.cheapPost;
    const defs = this.cinema.material.defines;
    if (s.cheapPost) { defs.FUSED_OUTPUT = ''; defs.CHEAP = ''; } else { delete defs.FUSED_OUTPUT; delete defs.CHEAP; }
    this.cinema.material.needsUpdate = true;
    // Automated runs (webdriver + CPU rasterizer) measure nothing real: keep their resolution fixed.
    const automated = !!window.navigator?.webdriver;
    const auto = this.adaptiveParam === '1' ? true : this.adaptiveParam === '0' ? false : (s.adaptive && !automated);
    const A = this.adaptive;
    A.enabled = opts.adaptive ?? auto;
    if (!A.enabled) A.scale = 1;
    A.samples.length = 0; A.good = 0; A.cooldown = 0;
    this._sweep = 0;
    this.resize();
    if (!first && prev !== q) this.refreshMaterials();
    if (!opts.silent && prev !== q) this.emitQuality();
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
    this._sweep = 0;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight, pr = this.pixelRatio;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(pr);   // also resizes every pass at the new pixel ratio
    this.composer.setSize(w, h);
    this.fx.uAspect.value = w / h;
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
    if (!A.windowStart) A.windowStart = now;
    if (now - A.windowStart < 1000 || A.samples.length < 8) return;
    const s = A.samples.sort((a, b) => a - b), median = s[s.length >> 1];
    A.samples.length = 0; A.windowStart = now;
    if (A.cooldown > 0) { A.cooldown--; return; }
    let next = A.scale;
    if (median > 36) { next = A.scale - (median > 55 ? 0.15 : 0.1); A.good = 0; }        // below ~28 fps
    else if (median < 20) { if (++A.good >= 2) { next = A.scale + 0.05; A.good = 0; } }  // above ~50 fps, sustained
    else A.good = 0;
    next = Math.round(Math.min(1, Math.max(A.min, next)) * 20) / 20;
    if (next !== A.scale) { A.scale = next; A.cooldown = 1; this.resize(); }
  }

  render(t) {
    const now = performance.now();
    this.adapt(now);
    if (this._sweep-- <= 0) { this._sweep = 45; this.clampShadows(); }
    this.renderer.info.reset();
    this.fx.uTime.value = t;
    this.composer.render();
    this.stats.calls = this.renderer.info.render.calls;
    this.stats.triangles = this.renderer.info.render.triangles;
  }
}

function gpuName(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
  } catch { return ''; }
}
