// 후처리 — 은은한 블룸 + 컬러 그레이딩(채도·비네트).
//
// 까다로운 지점: 이 게임의 외곽선은 OutlineEffect인데, 이건 컴포저 "패스"가 아니라
// renderer를 감싸는 래퍼다(씬을 두 번 그린다). 그래서 RenderPass를 그대로 쓰면 외곽선이 사라진다.
// → OutlineEffect를 호출하는 커스텀 패스를 만들어 컴포저 첫 단계에 끼운다.
//
// AO(SSAO/GTAO)는 넣지 않았다. 툰 셰이딩은 평평한 색면이 특징인데 AO가 그 위에 때를 묻히면
// 스타일이 무너진다. 비용도 이 스타일에서 얻는 것에 비해 크다.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// OutlineEffect를 컴포저 안에서 돌리는 패스.
class OutlineScenePass extends Pass {
  constructor(outline, scene, camera) {
    super();
    this.outline = outline;
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;      // readBuffer에 직접 그린다
    this.clear = true;
  }
  render(renderer, writeBuffer, readBuffer) {
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    if (this.clear) renderer.clear();
    this.outline.render(this.scene, this.camera);   // 내부에서 씬 2회(본체 + 외곽선)
  }
}

// 채도 + 비네트. 로우폴리 툰에 살짝만 걸어 색이 뭉치지 않게 한다.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 1.12 },
    uVignette: { value: 0.55 },
    uContrast: { value: 1.04 },
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
      c.rgb = mix(vec3(l), c.rgb, uSaturation);          // 채도
      c.rgb = (c.rgb - 0.5) * uContrast + 0.5;           // 대비
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - dot(d, d) * uVignette;              // 비네트
      gl_FragColor = c;
    }
  `,
};

export class Post {
  constructor(renderer, scene, camera, outline) {
    this.renderer = renderer;
    this.enabled = true;

    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(renderer.getPixelRatio());
    this.composer.setSize(innerWidth, innerHeight);


    this.scenePass = new OutlineScenePass(outline, scene, camera);
    this.composer.addPass(this.scenePass);

    // 블룸 — 시련소 빛기둥·해·물빛만 살짝 번지게. 강하면 툰이 뿌예진다.
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      0.28,   // strength
      0.62,   // radius
      0.80);  // threshold — 이 밝기 이상만 번진다
    this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    // ★ OutputPass가 마지막이어야 한다. 컴포저는 선형 작업공간에서 돌고,
    // 이게 톤매핑 + sRGB 인코딩을 해서 화면에 내보낸다.
    // 빠뜨리면 선형 값이 그대로 표시돼 어둡고 과채도로 보인다(실측: 밝기 180→94, 채도 0.24→0.61).
    this.composer.addPass(new OutputPass());

    addEventListener('resize', () => {
      this.composer.setSize(innerWidth, innerHeight);
      this.bloom.setSize(innerWidth, innerHeight);
    });
  }

  render() { this.composer.render(); }

  // 성능/취향 비교용
  setEnabled(on) { this.enabled = !!on; }
  set bloomStrength(v) { this.bloom.strength = v; }
  set saturation(v) { this.grade.uniforms.uSaturation.value = v; }
  set vignette(v) { this.grade.uniforms.uVignette.value = v; }
}
