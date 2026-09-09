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
import { quality } from './Quality.js';

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
    // 외곽선을 켤지 말지는 화질 단수가 정한다 — engine이 그 분기를 갖는다.
    this.engine.drawScene();
  }
}

// ★ 그레이드와 출력을 한 패스로 합쳐 봤다가 **되돌렸다.** 전체화면 패스 하나(3.15 Mpx,
//   태블릿 한 프레임 픽셀의 19%)를 아끼는 건 맞는데, three가 화면에 그리는 머티리얼에
//   tonemapping·colorspace 청크를 **스스로 끼워 넣어서** 우리가 같은 것을 include하면
//   redefinition으로 프래그먼트 셰이더가 통째로 컴파일에 실패한다. 두 번 충돌했고
//   (톤매핑 한 번, 색공간 한 번) 그건 three 판이 바뀔 때마다 되살아나는 종류다.
//   무엇보다 **결과 그림을 픽셀로 확인할 수 없는 상태**였다. 못 재는 건 안 넣는다.
//   해상도 단수(Quality.js)가 이미 픽셀의 69%를 줄이므로 이 조각은 급하지 않다.
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

  // w·h는 CSS 픽셀. 컴포저가 자기 픽셀비를 곱해 실제 버퍼 크기를 만든다.
  // ★ 예전엔 이 함수가 **아무 데서도 안 불렸다.** 창이 바뀌면 후처리 버퍼만
  //   낡은 크기로 남아 화면이 늘어나거나 흐려졌다(태블릿 회전·주소창 접힘).
  setSize(w, h) {
    // ★ 컴포저에 픽셀비를 맡기면 안 된다. 렌더러는 floor(w·pr)로 캔버스를 잡는데
    //   컴포저는 안 깎아서, 배율이 1.4나 0.8처럼 정수가 아니면 버퍼가 819.2 대 819로
    //   어긋난다. 어긋난 만큼 마지막 blit이 반 픽셀 밀려 화면이 미세하게 흐려진다.
    //   그래서 **기기 픽셀을 우리가 직접 계산해서** 넘기고, 컴포저 배율은 1로 둔다.
    const pr = this.renderer.getPixelRatio();
    const dw = Math.max(1, Math.floor(w * pr)), dh = Math.max(1, Math.floor(h * pr));
    this.composer.setPixelRatio(1);
    this.composer.setSize(dw, dh);
    // 블룸은 흐림이다. 낮은 해상도로 흐려도 눈에 안 띈다 — 단수에 맞춰 더 줄인다.
    const s = quality.get('bloom');
    this.bloom.enabled = s > 0;
    if (s > 0) this.bloom.setSize(Math.max(1, Math.round(dw * s)), Math.max(1, Math.round(dh * s)));
  }
  render() { this.composer.render(); }

  // 검증용 훅
  set bloomStrength(v) { this.bloom.strength = v; }
  get bloomStrength() { return this.bloom.strength; }
  set saturation(v) { this.grade.uniforms.uSaturation.value = v; }
  get saturation() { return this.grade.uniforms.uSaturation.value; }
}
