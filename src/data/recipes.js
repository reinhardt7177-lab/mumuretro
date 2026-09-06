// 부엌 — **요리는 답이 아니라 보상이다.**
//
// ★ 수첩 부엌 면이 "불을 피울 데부터 찾아야겠지"라고 약속만 해 둔 채였다.
//   여기서 갚는다. 채집 다섯 갈래 + 고기 넷 + 전설 셋이 **쓰이는 곳**이 있어야
//   모으는 이유가 생긴다(forage.js 머리말 — "채집한 것이 다른 데서 쓰이면 그때
//   비로소 모으는 이유가 생긴다").
//
// 규칙
//   · 원터치 금지 — 모닥불에 가서 E 한 번이 아니다. 접시 셋에 재료를 **골라 올리고**
//     솥을 건다. 세 자리가 곧 문제다(자리로 고른다 — 연구실 다이얼 셋과 같다).
//   · 답을 흘리지 않는다 — 앞사람은 요리 이름을 안 적었다. **재료 하나와 맛**만
//     흘렸다(파란 손글씨). 나머지 둘은 아이가 맞춘다.
//   · 틀려도 벌하지 않는다 — 안 어울리면 재료는 그대로 접시에 남는다. 없어지지
//     않는다. 맞으면 하나씩 쓴다(들에서 다시 난다).
//   · 순서는 안 본다 — 세 접시는 집합이다. 순서를 보면 6배로 어려워지는데 그건
//     요리가 아니라 자물쇠다.
//
// 재료 열쇠는 forage.js의 bag 열쇠 그대로다: fruit · mushroom · herb · salt ·
// meat_rabbit · meat_deer · meat_chicken · meat_boar · icebloom · nightmoss · starstone
export const INGREDIENTS = {
  fruit: '무른열매', mushroom: '고리버섯', herb: '향풀', salt: '암염',
  meat_rabbit: '토끼고기', meat_deer: '사슴고기', meat_chicken: '닭고기', meat_boar: '멧돼지고기',
  icebloom: '얼음꽃', nightmoss: '밤빛이끼', starstone: '별똥돌',
};

// hint — 앞사람의 파란 글씨. 재료 하나와 맛 한 마디. 이름은 없다.
// got  — 만든 뒤 내 글씨. 왜 그 셋인지 한 줄.
export const RECIPES = [
  { id: 'stew_rabbit', name: '토끼 스튜', needs: ['meat_rabbit', 'fruit', 'salt'],
    hint: '토끼고기는 열매와 끓여야 한다. 안 그러면 누린내가 난다.',
    got: '열매가 누린내를 지우고, 소금이 맛을 세운다. 셋이 다 있어야 했다.' },
  { id: 'roast_deer', name: '사슴 구이', needs: ['meat_deer', 'herb', 'salt'],
    hint: '사슴고기엔 향풀. 소금은 굽기 전에.',
    got: '향풀을 얹어 구웠다. 소금을 먼저 뿌려야 속까지 밴다.' },
  { id: 'porridge_chicken', name: '닭죽', needs: ['meat_chicken', 'mushroom', 'herb'],
    hint: '닭고기는 오래 끓여 죽으로. 버섯을 넣으면 국물이 진해진다.',
    got: '버섯이 국물을 진하게 하고 향풀이 비린내를 잡는다. 소금은 안 넣었다.' },
  { id: 'braise_boar', name: '멧돼지 조림', needs: ['meat_boar', 'fruit', 'mushroom'],
    hint: '멧돼지고기는 질기다. 열매즙에 재워 두면 부드러워진다.',
    got: '열매즙에 재워 버섯과 졸였다. 질긴 고기가 부드러워지는 건 즙 때문이다.' },
  { id: 'soup_forest', name: '숲 국', needs: ['mushroom', 'herb', 'salt'],
    hint: '고기 없이도 한 그릇은 된다. 버섯과 소금이면.',
    got: '버섯·향풀·소금. 고기가 없는 날의 한 그릇.' },
  // 전설의 요리 — 셋을 다 찾아야 한다. 마지막 장을 읽은 사람만 셋을 안다.
  { id: 'legend', name: '별의 밥', needs: ['icebloom', 'nightmoss', 'starstone'], legend: true,
    hint: '가장 높은 데, 가장 깊은 데, 가장 먼 데서 온 셋을 한 솥에.',
    got: '얼음꽃·밤빛이끼·별똥돌. 이 별을 다 걸어야 한 솥이 된다.' },
];

export const recipeOf = (id) => RECIPES.find((r) => r.id === id) || null;

// 접시 셋에 놓인 재료(열쇠 배열, 빈 접시는 null)가 어느 요리인가. 순서는 안 본다.
export function matchRecipe(plates) {
  const set = plates.filter(Boolean).slice().sort();
  if (set.length !== 3) return null;
  const key = set.join('+');
  return RECIPES.find((r) => r.needs.slice().sort().join('+') === key) || null;
}
