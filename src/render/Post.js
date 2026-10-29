// 후처리 — 절제된 블룸 + 채도/비네트. 현재 제품 Post.js의 표시 전용 후보.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { quality } from './Quality.js';
import { LOOKS } from './LookProfiles.js';
import { OUTDOOR } from '../data/lighting.js';

class OutlineScenePass extends Pass {
  constructor(engine) {
    super();
    this.engine = engine;
    this.needsSwap = false;
    this.clear = true;
  }
  render(renderer, writeBuffer, readBuffer) {
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    if (this.clear) renderer.clear();
    this.engine.drawScene();
  }
}

// 이전 제품의 실패 기록(원본 전체는 before/src/render/Post.js에 보존):
// ★ 그레이드와 출력을 한 패스로 합쳐 봤다가 **되돌렸다.** 전체화면 패스 하나(3.15 Mpx,
//   태블릿 한 프레임 픽셀의 19%)를 아끼는 건 맞는데, three가 화면에 그리는 머티리얼에
//   tonemapping·colorspace 청크를 **스스로 끼워 넣어서** 우리가 같은 것을 include하면
//   redefinition으로 프래그먼트 셰이더가 통째로 컴파일에 실패한다. 두 번 충돌했고
//   (톤매핑 한 번, 색공간 한 번) 그건 three 판이 바뀔 때마다 되살아나는 종류다.
//   무엇보다 **결과 그림을 픽셀로 확인할 수 없는 상태**였다. 못 재는 건 안 넣는다.
//   해상도 단수(Quality.js)가 이미 픽셀의 69%를 줄이므로 이 조각은 급하지 않다.
//
// 2026-10-29 후보는 r160 OutputPass의 RawShaderMaterial을 그대로 상속한다.
// 기존 texture2D 다음에만 그레이드를 삽입해 OutputPass의 톤매핑·색공간 청크,
// exposure/define 갱신·출력 타깃 선택을 유지한다. 별도 ShaderMaterial이나
// 청크를 추가하지 않는다. 기존 grade.uniforms / saturation 검증 API도 유지한다.
class GradedOutputPass extends OutputPass {
  constructor() {
    super();
    Object.assign(this.uniforms, {
      uSaturation: { value: 1.08 },
      uVignette: { value: 0.40 },
      uContrast: { value: 1.03 },
    });
    const sample = 'gl_FragColor = texture2D( tDiffuse, vUv );';
    if (!this.material.fragmentShader.includes(sample)) throw Error('Unsupported OutputPass sample');
    this.material.fragmentShader = this.material.fragmentShader
      .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse;\n\t\tuniform float uSaturation, uVignette, uContrast;')
      .replace(sample, `${sample}
      float l = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      gl_FragColor.rgb = mix(vec3(l), gl_FragColor.rgb, uSaturation);
      gl_FragColor.rgb = max(vec3(0.0), gl_FragColor.rgb * uContrast);
      vec2 d = vUv - 0.5;
      gl_FragColor.rgb *= 1.0 - dot(d, d) * uVignette;`);
  }
}

export class Post {
  constructor(engine) {
    this.renderer = engine.renderer;
    this.engine = engine;
    this.enabled = true;
    this.composer = new EffectComposer(engine.renderer);
    this.composer.addPass(new OutlineScenePass(engine));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      0.16,
      0.55,
      0.92);
    this.composer.addPass(this.bloom);

    this.grade = new GradedOutputPass();
    this.composer.addPass(this.grade);
  }

  setSize(w, h) {
    const pr = this.renderer.getPixelRatio();
    const dw = Math.max(1, Math.floor(w * pr)), dh = Math.max(1, Math.floor(h * pr));
    this.composer.setPixelRatio(1);
    const samples = Math.min(this.renderer.capabilities.maxSamples || 0, quality.name === 'high' ? 4 : 0);
    for(const target of [this.composer.renderTarget1,this.composer.renderTarget2]) {
      if(target.samples!==samples){target.samples=samples;target.dispose();}
    }
    this.composer.setSize(dw, dh);
    const s = quality.get('bloom');
    this.bloom.enabled = s > 0;
    if (s > 0) this.bloom.setSize(Math.max(1, Math.round(dw * s)), Math.max(1, Math.round(dh * s)));
  }
  render() {
    const key=this.engine.scene.userData.lookProfile||'planet';
    if(this.lookKey!==key){const look=key==='planet'?{saturation:OUTDOOR.planetSaturation,contrast:OUTDOOR.planetContrast,vignette:OUTDOOR.planetVignette,bloom:OUTDOOR.planetBloom}:(LOOKS[key]||LOOKS.planet);this.lookKey=key;
      this.grade.uniforms.uSaturation.value=look.saturation;
      this.grade.uniforms.uContrast.value=look.contrast;
      this.grade.uniforms.uVignette.value=look.vignette;
      this.bloom.strength=look.bloom;
    }
    this.composer.render();
  }

  set bloomStrength(v) { this.bloom.strength = v; }
  get bloomStrength() { return this.bloom.strength; }
  set saturation(v) { this.grade.uniforms.uSaturation.value = v; }
  get saturation() { return this.grade.uniforms.uSaturation.value; }
}
