// 툰 머티리얼 팩토리 + 글로벌 틴트(전 세계 무드 즉시 전환). town.html:102-106 기반.
// 핵심: 모든 toon 머티리얼이 같은 uniform 객체(tintUniforms)를 공유 → 값 1회 변경으로 한 프레임에 전 세계 재채색.
import * as THREE from 'three';

export function toonGradient(steps) {
  const d = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) d[i] = Math.round(255 * (i / (steps - 1)));
  const t = new THREE.DataTexture(d, steps, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

export const GRAD = toonGradient(3);

// 모든 머티리얼이 참조하는 공유 유니폼. value만 바꾸면 전 머티리얼에 즉시 반영.
export const tintUniforms = {
  uTint: { value: new THREE.Color(0xffffff) },
  uTintAmt: { value: 0 },
};

// Atmosphere가 호출: 글로벌 무드 색/강도 설정.
export function setTint(color, amt) {
  tintUniforms.uTint.value.set(color);
  tintUniforms.uTintAmt.value = amt;
}

// onBeforeCompile로 틴트 주입. 곱셈 혼합(mix(c, c*tint, amt)) → 따뜻/차갑/어둡게 모두 자연스러움.
// customProgramCacheKey는 설정하지 않음: 기본 키가 map/emissive 변형을 올바르게 분리하고, 주입 로직은 전부 동일.
function injectTint(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = tintUniforms.uTint;
    shader.uniforms.uTintAmt = tintUniforms.uTintAmt;
    shader.fragmentShader = 'uniform vec3 uTint;\nuniform float uTintAmt;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      '#include <opaque_fragment>\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * uTint, uTintAmt);'
    );
  };
  return material;
}

// 매 호출마다 새 머티리얼. 나중에 개별 변형(색·투명도·vertexColors)이 필요한 곳에서 쓴다.
// 예: Character(커스터마이즈로 색 변경), GhostMessenger(투명도 변경), Planet(정점색 전환).
export const toon = (color, o = {}) =>
  injectTint(new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...o }));

// ── 공유(캐시) 머티리얼 ────────────────────────────────────────────────────
// 같은 색/옵션이면 동일 인스턴스를 재사용. 프롭처럼 생성 후 절대 변형하지 않는 것 전용.
//
// 왜 필요한가: 프롭 빌더는 메시마다 toon()을 새로 불러서 행성을 4배로 키우면
// 고유 머티리얼이 4만 개를 넘어간다. OutlineEffect는 머티리얼마다 아웃라인 사본을
// 만들어 매 프레임 순회하므로 이것만으로 프레임당 130ms가 날아간다(실측).
// 실제 서로 다른 조합은 60여 개뿐이라 캐시 한 번으로 거의 전부 회수된다.
//
// 주의: 반환된 머티리얼을 변형하면 같은 색을 쓰는 모든 메시가 함께 바뀐다. 변형이 필요하면 toon()을 쓸 것.
const _sharedToon = new Map();
export function toonShared(color, o = {}) {
  const key = new THREE.Color(color).getHex() + '|' +
    (o && Object.keys(o).length ? JSON.stringify(o, Object.keys(o).sort()) : '');
  let m = _sharedToon.get(key);
  if (!m) { m = toon(color, o); _sharedToon.set(key, m); }
  return m;
}
export const sharedToonCount = () => _sharedToon.size;

// 아웃라인 제외(지면·마커 등). town.html:106
export const noOut = (m) => {
  m.material.userData.outlineParameters = { visible: false };
  return m;
};

// GLB 머티리얼을 툰으로 변환. town.html:206
export function toonify(src) {
  const m = new THREE.MeshToonMaterial({ gradientMap: GRAD });
  if (src) {
    if (src.map) { src.map.colorSpace = THREE.SRGBColorSpace; m.map = src.map; }
    if (src.color) m.color.copy(src.color);
    if (src.transparent) { m.transparent = true; m.opacity = src.opacity; }
  }
  return injectTint(m);
}
