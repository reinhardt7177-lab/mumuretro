// 레트로 한국 동네 소품 레지스트리.
//
// 빌더 32종이 한 파일에 1,586줄로 쌓여 있었다. 소품 하나를 손보려면 그 파일을 열어
// 관계없는 서른한 개를 스크롤해야 했고, 새 소품을 어디에 둬야 하는지도 알 수 없었다.
// 그래서 "이 물건이 동네 어디에 서는가"로 갈랐다 — 소품을 추가할 때 고민이 한 번에 끝난다.
//
//   props/buildings.js  건물과 시설 — 사람이 드나드는 것. 학습 팻말이 걸리는 후보 집
//   props/street.js     골목 살림 — 건물 사이를 채우는 것
//   props/nature.js     자연 — 숲·언덕·꽃밭
//   props/water.js      물가와 해변 — 수면에 뜨거나 모래에 박히는 것
//   props/shared.js     공용 헬퍼(mesh·meshFlat·pick·WIN_OPTS)
//
// 이 파일은 레지스트리다. 빌더를 여기 직접 쓰지 않는다.
export * from './props/buildings.js';
export * from './props/street.js';
export * from './props/nature.js';
export * from './props/water.js';

import {
  buildHouse, buildAlleyWall, buildCornerShop, buildStationery, buildBathhouse,
  buildSignboard, buildSchoolFacade, buildPlayground,
} from './props/buildings.js';
import {
  buildPyeongsang, buildUtilityPole, buildStreetlamp, buildMailbox, buildBench,
  buildVendingMachine, buildHedge, buildFlowerpot, buildBicycle, buildFence,
  buildGravestone, buildJangdokdae,
} from './props/street.js';
import {
  buildTree, buildBush, buildPalmTree, buildRock, buildLogBench, buildCampfire,
  buildFlowerPatch, buildLantern, buildMushroom,
} from './props/nature.js';
import { buildParasol, buildDeckChair, buildRowboat } from './props/water.js';

// 키는 배치 데이터(districts.js·regions.js)가 참조하는 이름이다 — 바꾸면 마을이 빈다.
export const PROP_BUILDERS = {
  // 건물·시설
  house:        buildHouse,
  alleyWall:    buildAlleyWall,
  cornerShop:   buildCornerShop,
  stationery:   buildStationery,
  bathhouse:    buildBathhouse,
  signboard:    buildSignboard,
  schoolFacade: buildSchoolFacade,
  playground:   buildPlayground,
  // 골목 살림
  pyeongsang:   buildPyeongsang,
  utilityPole:  buildUtilityPole,
  streetlamp:   buildStreetlamp,
  mailbox:      buildMailbox,
  bench:        buildBench,
  vending:      buildVendingMachine,
  hedge:        buildHedge,
  flowerpot:    buildFlowerpot,
  bicycle:      buildBicycle,
  fence:        buildFence,
  gravestone:   buildGravestone,
  jangdokdae:   buildJangdokdae,
  // 자연
  tree:         buildTree,
  bush:         buildBush,
  palmTree:     buildPalmTree,
  rock:         buildRock,
  logBench:     buildLogBench,
  campfire:     buildCampfire,
  flowerPatch:  buildFlowerPatch,
  lantern:      buildLantern,
  mushroom:     buildMushroom,
  // 물가·해변
  parasol:      buildParasol,
  deckChair:    buildDeckChair,
  rowboat:      buildRowboat,
};
