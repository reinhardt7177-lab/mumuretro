// 후처리 — 절제된 블룸 + 채도/비네트. 아트 바이블 §2 표.
//
// ★ 구버전은 블룸 threshold 0.80 / strength 0.28이었다. 그 값이면 밝은 면이 전부 번져서
//   화면이 뿌옇게 뜨고(실측 평균 휘도 0.519), 심지어 팻말에 두른 **어두운 후광까지 먹었다.**
//   블룸으로 형태를 만들지 않는다 — 블룸은 이미 밝은 것만 살짝 번지게 한다.
//     threshold 0.80 → 0.92,  strength 0.28 → 0.16
//
// 채도는 반대로 올린다(1.12 → 1.28). 깊이는 채도를 낮춰서 만드는 게 아니라
// **대기 원근(§3)**이 만든다. 근경은 선명하고 진해야 한다 — 뿌연 것과 깊은 것은 다르다.
//
// 까다로운 지점: 이 게임의 외곽선은 OutlineEffect인데 컴포저 "패스"가 아니라 renderer를
// 감싸는 래퍼다(씬을 두 번 그린다). RenderPass를 그대로 쓰면 외곽선이 사라지므로
// OutlineEffect를 호출하는 커스텀 패스를 컴포저 첫 단계에 끼운다.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ★ 씬을 생성 시점에 붙잡지 않고 매 프레임 engine에서 읽는다.
// 사당 안팎이 서로 다른 Scene이라, 붙잡아 두면 전환해도 바깥 행성만 계속 그린다.
class OutlineScenePass extends Pass {
  constructor(engine) {
    super();
    this.engine = engine;
    this.needsSwap = false;      // readBuffer에 직접 그린다
    this.clear = true;
  }
  render(renderer, writeBuffer, readBuffer) {
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    if (this.clear) renderer.clear();
    this.engine.outline.render(this.engine.scene, this.engine.camera);
  }
}

const GradeShader = {
  uniforms: {
    tDiffuse:    { value: null },
    // ★ 1.28로 잡았다가 되돌렸다. 그 값은 **구버전의 뿌연 화면** 기준이었다.
    // 지금은 지형이 정점 색을 갖고 조명이 색온도를 만들어서 이미 채도가 충분하다.
    // 거기에 1.28을 곱하니 mix(vec3(l), rgb, 1.28)이 외삽이라 낮은 채널을 0 아래로 밀었고,
    // 지형의 파랑이 통째로 0으로 잘렸다(실측 128,160,0 · 96,128,0).
    // 채도는 색 설계가 만드는 것이지 그레이드가 만드는 게 아니다.
    uSaturation: { value: 1.08 },
    uVignette:   { value: 0.40 },
    uContrast:   { value: 1.03 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uSaturation, uVignette, uContrast;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSaturation);
      c.rgb = (c.rgb - 0.5) * uContrast + 0.5;
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - dot(d, d) * uVignette;
      gl_FragColor = c;
    }
  `,
};

export class Post {
  constructor(engine) {
    this.renderer = engine.renderer;
    this.enabled = true;
    this.composer = new EffectComposer(engine.renderer);
    this.composer.addPass(new OutlineScenePass(engine));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      0.16,   // strength — 이미 밝은 것만
      0.55,   // radius
      0.92);  // threshold — 이 밝기 이상만 번진다
    this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }
  render() { this.composer.render(); }

  // 검증용 훅
  set bloomStrength(v) { this.bloom.strength = v; }
  get bloomStrength() { return this.bloom.strength; }
  set saturation(v) { this.grade.uniforms.uSaturation.value = v; }
  get saturation() { return this.grade.uniforms.uSaturation.value; }
}
