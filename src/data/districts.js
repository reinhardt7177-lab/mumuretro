// 행성 위 동네 디스트릭트 레이아웃. 각 디스트릭트는 중심(lat,lon)과 로컬 탄젠트 평면 배치(u=동, v=북, 단위=월드).
// b=빌더 키(Props.PROP_BUILDERS), rot=up축 회전(도, +Z 정면이 향할 방향), opts=빌더 옵션.
// M1은 2~3개 디스트릭트로 시작. 사이 빈 곳은 buildDistricts가 나무·전봇대로 절차 채움.

export const DISTRICTS = [
  {
    id: 'alley', name: '골목 주택가', lat: 14, lon: 0,
    props: [
      { b: 'mailbox', u: 0,    v: 0,   rot: 180 },          // 우체통 허브(시작점 근처)
      { b: 'house', u: -7,  v: 5,   rot: 200, opts: { stories: 2 } },
      { b: 'house', u: 6,   v: 6,   rot: 150, opts: { stories: 1 } },
      { b: 'house', u: -6,  v: -6,  rot: 20,  opts: { stories: 2 } },
      { b: 'house', u: 7,   v: -5,  rot: 340, opts: { stories: 1 } },
      { b: 'alleyWall', u: 0, v: 8,  rot: 90,  opts: { length: 8 } },
      { b: 'alleyWall', u: 0, v: -9, rot: 90,  opts: { length: 7 } },
      { b: 'pyeongsang', u: 2,  v: 1,  rot: 0 },
      { b: 'utilityPole', u: -3, v: 2, rot: 0 },
      { b: 'utilityPole', u: 4,  v: -3, rot: 0 },
      { b: 'tree', u: -4, v: -2, rot: 0 },
      { b: 'streetlamp', u: 3, v: 4, rot: 0 },
    ],
  },
  {
    id: 'plaza', name: '구멍가게·문방구 광장', lat: 0, lon: 72,
    props: [
      { b: 'cornerShop', u: -5, v: 4,  rot: 180 },
      { b: 'stationery', u: 5,  v: 4,  rot: 180 },
      { b: 'vending', u: -1, v: 5, rot: 180 },
      { b: 'bench', u: 0,   v: -1, rot: 0 },
      { b: 'bench', u: -3,  v: -1, rot: 0 },
      { b: 'tree', u: 4,    v: -3, rot: 0 },
      { b: 'tree', u: -5,   v: -4, rot: 0 },
      { b: 'streetlamp', u: 2, v: 2, rot: 0 },
      { b: 'house', u: 8,   v: -6, rot: 250, opts: { stories: 2 } },
      { b: 'utilityPole', u: -7, v: -2, rot: 0 },
    ],
  },
  {
    id: 'bath', name: '목욕탕 골목', lat: -12, lon: 142,
    props: [
      { b: 'bathhouse', u: 0,  v: 4,  rot: 180 },          // 굴뚝 랜드마크
      { b: 'house', u: -7, v: -3, rot: 40,  opts: { stories: 1 } },
      { b: 'house', u: 7,  v: -4, rot: 320, opts: { stories: 2 } },
      { b: 'alleyWall', u: -2, v: -7, rot: 90, opts: { length: 6 } },
      { b: 'pyeongsang', u: 3, v: -2, rot: 0 },
      { b: 'utilityPole', u: 5, v: 2, rot: 0 },
      { b: 'tree', u: -5, v: 0, rot: 0 },
      { b: 'streetlamp', u: 1, v: -4, rot: 0 },
    ],
  },
];

// 디스트릭트 사이 빈 행성 표면을 채울 산발 프롭(개수, 빌더 풀).
export const SCATTER = { count: 40, builders: ['tree', 'tree', 'utilityPole', 'streetlamp'] };
