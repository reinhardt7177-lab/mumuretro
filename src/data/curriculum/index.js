// 커리큘럼 레지스트리 — 과목 파일을 여기에 등록하면 구역에 자동으로 배치된다.
//
// 과목을 추가하는 법:
//   1) 이 폴더에 <과목>.js 를 만들고 { id, subject, region, emoji, questions } 를 export
//   2) 아래 CURRICULA에 추가
//   3) 새로고침 → 콘솔에서 검증 결과 확인(validate.js가 자동 실행)
//
// region은 data/regions.js의 구역 id와 같아야 한다:
//   village · temple · beach · lake · meadow · forest · hill · mist
//
// mist(안개 골짜기)에는 일부러 과목을 두지 않는다 — 최종 시련이
// "지금까지 쌓은 과목으로 치르는 마지막 시험"이 되게 하기 위해서다.
import { MATH4 } from './math4.js';
import { SCIENCE4 } from './science4.js';
import { KOREAN4 } from './korean4.js';
import { SOCIAL4 } from './social4.js';
import { PLANT4 } from './plant4.js';
import { EARTH4 } from './earth4.js';
import { SPACE4 } from './space4.js';

export const CURRICULA = [MATH4, SCIENCE4, KOREAN4, SOCIAL4, PLANT4, EARTH4, SPACE4];

// 구역 id → 커리큘럼. 없는 구역은 null.
export const byRegion = (regionId) => CURRICULA.find(c => c.region === regionId) || null;

// 아직 과목이 없는 구역에서 기본으로 쓸 커리큘럼.
export const DEFAULT_CURRICULUM = MATH4;
