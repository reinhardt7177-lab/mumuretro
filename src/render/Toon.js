// 툰 머티리얼 팩토리 + 림 라이트(§4 실루엣).
//
// ★ 이전 버전에는 하루 주기용 글로벌 틴트가 있었다. 시간대를 오후 3시로 고정하면서
//   틴트는 할 일이 없어졌다. 주입 지점은 그대로 두되 **림 라이트**로 바꿔 쓴다.
//
// 림 라이트는 로우폴리에서 가장 싼 디테일이다. 형태의 가장자리에만 빛을 얹어
// 물체를 배경에서 떼어낸다 — 폴리곤을 한 개도 늘리지 않고 실루엣이 살아난다.
import * as THREE from 'three';
import { LIGHT, INTENSITY } from '../data/lighting.js';

export function toonGradient(steps) {
  const d = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) d[i] = Math.round(255 * (i / (steps - 1)));
  const t = new THREE.DataTexture(d, steps, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

// 3단 — 2단은 만화처럼 딱딱하고, 4단부터는 그라데이션으로 뭉개져 툰이 아니게 된다.
export const GRAD = toonGradient(3);

// 모든 머티리얼이 공유하는 유니폼. 값 하나만 바꾸면 전 세계에 한 프레임에 반영된다.
export const rimUniforms = {
  uRimColor: { value: new THREE.Color(LIGHT.air) },   // 하늘빛이 가장자리를 훑는다
  uRimAmt:   { value: INTENSITY.rim },
  uRimPow:   { value: 2.6 },
};

export function setRim(amt, color) {
  rimUniforms.uRimAmt.value = amt;
  if (color !== undefined) rimUniforms.uRimColor.value.set(color);
}

// vViewPosition은 조명 받는 머티리얼이면 항상 있는 varying이고, normal은 뷰 공간 셰이딩 법선이다.
// 둘의 내적이 0에 가까울수록(=시선과 면이 나란할수록) 가장자리다.
function injectRim(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = rimUniforms.uRimColor;
    shader.uniforms.uRimAmt = rimUniforms.uRimAmt;
    shader.uniforms.uRimPow = rimUniforms.uRimPow;
    shader.fragmentShader =
      'uniform vec3 uRimColor;\nuniform float uRimAmt;\nuniform float uRimPow;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
       {
         vec3 rimV = normalize(vViewPosition);
         float rimF = pow(1.0 - clamp(dot(normal, rimV), 0.0, 1.0), uRimPow);
         gl_FragColor.rgb += uRimColor * (rimF * uRimAmt);
       }`
    );
  };
  return material;
}

// 매 호출마다 새 머티리얼. 나중에 개별 변형이 필요한 곳에서 쓴다(캐릭터 커스터마이즈 등).
export const toon = (color, o = {}) =>
  injectRim(new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...o }));

// ── 공유(캐시) 머티리얼 ────────────────────────────────────────────────────
// 같은 색/옵션이면 동일 인스턴스를 재사용. 생성 후 절대 변형하지 않는 것 전용.
//
// 왜 필요한가: 메시마다 toon()을 새로 부르면 고유 머티리얼이 수만 개가 된다.
// OutlineEffect는 머티리얼마다 아웃라인 사본을 만들어 매 프레임 순회하므로
// 이것만으로 프레임당 130ms가 날아간 적이 있다(구버전 실측).
//
// 주의: 반환된 머티리얼을 변형하면 같은 색을 쓰는 모든 메시가 함께 바뀐다.
const _sharedToon = new Map();
export function toonShared(color, o = {}) {
  const key = new THREE.Color(color).getHex() + '|' +
    (o && Object.keys(o).length ? JSON.stringify(o, Object.keys(o).sort()) : '');
  let m = _sharedToon.get(key);
  if (!m) { m = toon(color, o); _sharedToon.set(key, m); }
  return m;
}
export const sharedToonCount = () => _sharedToon.size;

// 아웃라인 제외(지면·풀·리본 등 얇거나 넓은 것)
export const noOut = (m) => {
  m.material.userData.outlineParameters = { visible: false };
  return m;
};
