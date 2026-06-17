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

export const toon = (color, o = {}) =>
  injectTint(new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...o }));

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
