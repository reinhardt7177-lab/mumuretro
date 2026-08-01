// 레트로 한국 동네 색 팔레트 + 시간대(낮/노을/밤) 키프레임.
// 색은 1980~90s 한국 동네 정서: 크림 스투코, 벽돌, 바랜 청록, 머스타드 차양, 녹청 물탱크.

export const SWATCH = {
  grass:   [0x86b56a, 0x77a85c, 0x6a9a52],
  stucco:  [0xe7d9bf, 0xefe6cf, 0xd8c8a6],   // 크림 스투코 외벽
  brick:   [0xb5705a, 0xa9614a, 0xc07a5e],   // 벽돌
  teal:    0x5a8f8a,                          // 바랜 청록(간판/문/대문)
  mustard: 0xd9a441,                          // 머스타드(차양·간판)
  roof:    [0x6d7d84, 0x596066, 0x8a5b4a, 0x4f6d6a, 0x70493e], // 슬레이트·기와 톤
  metal:   0x9aa0a2,
  wood:    0x6b4f3a,
  pole:    0x55504a,
  tank:    0x6a9a7a,                          // 옥상 녹청 물탱크
  postbox: 0xd23b34,                          // 우체통 빨강
  leaf:    [0x6fa64f, 0x5e9243, 0x7cb05c],
  trunk:   0x6e4f35,
  window:  0xbfe6ef,
  concrete:0xb8b3a8,
  awning:  [0xd9a441, 0xc0584e, 0x4f8a86],    // 차양 줄무늬용
};

// 시간대 키프레임. phase 0~1(순환). Atmosphere가 인접 키프레임을 lerp.
// tint/tintAmt = 전 세계 툰 머티리얼에 곱/혼합되는 글로벌 무드 색(컬러 아틀라스 대응).
//
// skyTop/skyHorizon = 하늘 돔의 천정/지평선 색. sky는 단색 배경 폴백용으로 남겨둔다.
// starI = 별 밝기(0~1), cloudTint = 구름 색.
// sunElev = 보이는 해의 고도각(도). 키프레임 phase가 균등하지 않으므로 사인파로 유도하면
//   "노을인데 해가 지평선 한참 아래"처럼 어긋난다. 시간대 이름과 직접 짝지어 둔다.
//   (그림자용 DirectionalLight는 별개로 계속 머리 위에 있어 그림자 품질을 지킨다.)
export const TIME_KEYFRAMES = [
  { phase: 0.00, name: '새벽', sky: 0xb9c7d6, skyTop: 0x7f96bd, skyHorizon: 0xe8c9b8, starI: 0.35, cloudTint: 0xd9c9d6, sunElev: 3,
    fog: 0xc4cdd6, sun: 0xffd9b0, sunI: 1.4, hemiSky: 0xc7d2e0, hemiGround: 0x6b7355, tint: 0x8aa0c8, tintAmt: 0.22 },
  { phase: 0.28, name: '한낮', sky: 0xaee0e6, skyTop: 0x5fa8dd, skyHorizon: 0xd8f0f2, starI: 0.00, cloudTint: 0xffffff, sunElev: 64,
    fog: 0xbfe2e6, sun: 0xfff2d6, sunI: 2.4, hemiSky: 0xcfeef2, hemiGround: 0x6b7355, tint: 0xffffff, tintAmt: 0.00 },
  { phase: 0.60, name: '노을', sky: 0xf0b27a, skyTop: 0x9c7fb0, skyHorizon: 0xffc07a, starI: 0.10, cloudTint: 0xffbf95, sunElev: 5,
    fog: 0xe8a878, sun: 0xff9a52, sunI: 2.1, hemiSky: 0xf3c79a, hemiGround: 0x7a5a44, tint: 0xff8a4a, tintAmt: 0.30 },
  { phase: 0.78, name: '땅거미', sky: 0x6a5f86, skyTop: 0x3b3a63, skyHorizon: 0xb07e94, starI: 0.55, cloudTint: 0x9a86a8, sunElev: -9,
    fog: 0x6d6488, sun: 0xff7e6a, sunI: 1.2, hemiSky: 0x7a6f94, hemiGround: 0x40384f, tint: 0x8a6aa0, tintAmt: 0.34 },
  { phase: 0.90, name: '밤', sky: 0x2c3552, skyTop: 0x151c33, skyHorizon: 0x44507a, starI: 1.00, cloudTint: 0x4a5578, sunElev: -42,
    fog: 0x303a59, sun: 0x9fb0d8, sunI: 0.6, hemiSky: 0x3a4566, hemiGround: 0x20263a, tint: 0x3a5a8a, tintAmt: 0.42 },
];
