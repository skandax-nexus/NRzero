import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Final cinematic pass: temporal ripple, chromatic aberration, vignette, grain, freeze desaturation.
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
    void main(){
      vec2 uv=vUv; vec2 c=uv-0.5; c.x*=uAspect; float r=length(c);
      // temporal ripple: concentric wave expanding from centre
      float wave = sin(r*38.0 - uTime*22.0) * uShift * 0.018 * smoothstep(0.9,0.0,r);
      uv += normalize(c+1e-5)*wave/vec2(uAspect,1.0);
      // slice tearing during shift
      float band = step(0.82, hash(vec2(floor(uv.y*42.0), floor(uTime*24.0))));
      uv.x += band*uShift*0.03*(hash(vec2(uTime,uv.y))-0.5);
      float ca = 0.0015 + uShift*0.012 + uDamage*0.006 + r*r*0.004;
      vec2 dir = normalize(c+1e-5)/vec2(uAspect,1.0);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir*ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir*ca).b;
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

export class Engine {
  constructor(container) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    r.setSize(window.innerWidth, window.innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);

    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.08, 900);
    this.scene = new THREE.Scene();

    const pmrem = new THREE.PMREMGenerator(r);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.composer = new EffectComposer(r);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.5, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.cinema = new ShaderPass(CinemaShader);
    this.composer.addPass(this.cinema);
    this.fx = this.cinema.uniforms;
    this.fx.uAspect.value = window.innerWidth / window.innerHeight;

    this.quality = 'high';
    window.addEventListener('resize', () => this.resize());
  }

  setQuality(q) {
    this.quality = q;
    const pr = q === 'high' ? Math.min(window.devicePixelRatio, 1.75) : q === 'medium' ? 1 : 0.75;
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.bloom.enabled = q !== 'low';
    this.resize();
  }

  setScene(scene) {
    this.scene = scene;
    scene.environment = scene.environment || this.envTexture;
    this.renderPass.scene = scene;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.fx.uAspect.value = w / h;
  }

  render(t) {
    this.fx.uTime.value = t;
    this.composer.render();
  }
}
