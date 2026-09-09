// 판마다 달라지게 하는 도구.
//
// ★ 점검에서 나온 것: 관문 18개 중 15개가 **다시 해도 똑같았다.**
//   한 번 푼 아이는 두 번째부터 손이 기억하는 대로 누르면 끝난다.
//   「여러 번 도전할 만한가」라는 기준에서 그게 가장 큰 구멍이었다.
//
// 무작위화의 원칙 둘.
//   1) **답이 바뀌어야 한다.** 장식만 흔들면 외운 답이 그대로 통한다.
//   2) **항상 풀려야 한다.** 무작위로 뽑고 끝내지 않고, 뽑은 뒤 풀리는지 확인한다.
//      못 풀 판을 한 번이라도 내주면 아이는 게임이 고장났다고 생각한다.
let source = Math.random;
export const random = () => source();
// 사당의 배치만 재현한다. 전역 Math.random과 바깥 세계의 난수는 건드리지 않는다.
export function withSeed(seed, make) {
  const previous = source;
  let state = seed >>> 0;
  source = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  try { return make(); } finally { source = previous; }
}
export const randInt = (n) => Math.floor(random() * n);
export const pick = (arr) => arr[randInt(arr.length)];
export const range = (lo, hi) => lo + random() * (hi - lo);

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 조건을 만족하는 값이 나올 때까지 다시 뽑는다. 못 뽑으면 마지막 값을 준다 —
// 무한 루프로 게임을 멈추느니 한 판쯤 시시한 게 낫다.
export function until(make, ok, tries = 200) {
  let v = make();
  for (let i = 0; i < tries && !ok(v); i++) v = make();
  return v;
}
