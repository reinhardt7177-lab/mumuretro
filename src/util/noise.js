// 결정론적 3D 그래디언트 노이즈 + FBM. 외부 의존성 없음.
//
// 왜 3D인가: 지형을 위경도 2D 노이즈로 만들면 극점에서 뭉치고 경도 0/360 이음새가 생긴다.
// 단위 방향벡터를 그대로 3D 노이즈에 넣으면 구 전체가 자연스럽게 연속이다.

const _perm = new Uint8Array(512);

// 시드로 순열표 생성(Fisher–Yates, mulberry32와 동일 계열의 결정론적 RNG).
function buildPerm(seed) {
  let t = seed >>> 0;
  const rnd = () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) _perm[i] = p[i & 255];
}
buildPerm(1337);

export function seedNoise(seed) { buildPerm(seed); }

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

// 해시값 → 12개 정12면체 모서리 방향 중 하나와의 내적(Perlin 표준 그래디언트).
function grad(h, x, y, z) {
  switch (h & 15) {
    case 0:  return  x + y;
    case 1:  return -x + y;
    case 2:  return  x - y;
    case 3:  return -x - y;
    case 4:  return  x + z;
    case 5:  return -x + z;
    case 6:  return  x - z;
    case 7:  return -x - z;
    case 8:  return  y + z;
    case 9:  return -y + z;
    case 10: return  y - z;
    case 11: return -y - z;
    case 12: return  x + y;
    case 13: return -y + z;
    case 14: return -x + y;
    default: return -y - z;
  }
}

// 고전 Perlin 3D. 대략 [-1, 1].
export function noise3(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = _perm[X] + Y, AA = _perm[A] + Z, AB = _perm[A + 1] + Z;
  const B = _perm[X + 1] + Y, BA = _perm[B] + Z, BB = _perm[B + 1] + Z;

  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(grad(_perm[AA], x, y, z),         grad(_perm[BA], x - 1, y, z),         u),
      l(grad(_perm[AB], x, y - 1, z),     grad(_perm[BB], x - 1, y - 1, z),     u), v),
    l(l(grad(_perm[AA + 1], x, y, z - 1), grad(_perm[BA + 1], x - 1, y, z - 1), u),
      l(grad(_perm[AB + 1], x, y - 1, z - 1), grad(_perm[BB + 1], x - 1, y - 1, z - 1), u), v),
    w);
}

// 옥타브 누적. 반환 범위는 대략 [-1, 1](진폭 합으로 정규화).
export function fbm(x, y, z, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

// 능선(ridged) 변형 — 산등성이가 날카롭게 서서 언덕 실루엣이 살아난다. 반환 [0, 1].
export function ridged(x, y, z, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise3(x * freq, y * freq, z * freq));
    sum += amp * n * n;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

// 0→1 부드러운 전이(에지 사이). GLSL smoothstep과 동일.
export function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
