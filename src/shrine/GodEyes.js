// 신의 눈 — 풀면 뜬다.
//
// ★ 신 여섯을 나란히 찍어 보니 **존재**로 읽히는 건 둘뿐이었다(균형·시간 — 눈이 있다).
//   그림자는 등불, 체는 항아리, 물은 수정, 용암은 산 — 넷은 물건이다. 지킴이는
//   각자 목소리로 말을 거는데 몸은 가구였다.
//
//   같은 문법을 넷에 준다: 눈 둘, 꺼진 채로 있다가 **풀면 금색으로 뜬다.**
//   시간의 신이 이미 그렇게 한다("다섯이 잠든 것도 봤고") — 신은 내내 보고 있었다는
//   뜻이고, 눈을 뜨는 건 "네가 해냈다"를 말 없이 말하는 가장 싼 연출이다.
//   구슬이 내려오기 직전 1.5초. 그 1.5초가 여섯 신전의 절정을 같은 결로 묶는다.
import * as THREE from 'three';
import { sfx } from '../core/Audio.js';

const DARK = 0x2a2430, LIT = 0xffd27a;

export function godEyes(parent, x, y, z, gap = 0.3, w = 0.44, h = 0.16) {
  const mats = [];
  for (const sd of [-1, 1]) {
    const m = new THREE.MeshBasicMaterial({ color: DARK });
    m.userData.outlineParameters = { visible: false };
    const e = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), m);
    e.position.set(x + sd * gap, y, z);
    parent.add(e);
    mats.push(m);
  }
  let awake = 0;
  const c = new THREE.Color();
  return {
    mats,
    get awake() { return awake; },
    // 풀렸으면 1.5초에 걸쳐 뜬다. 안 풀렸으면(다시 도전) 도로 감는다.
    tick(dt, solved) {
      const want = solved ? 1 : 0;
      if (awake === want) return;
      if (want === 1 && awake === 0) sfx('god_wake');   // 1.5초 상승 — 절정
      awake = want > awake ? Math.min(1, awake + dt / 1.5) : Math.max(0, awake - dt / 0.4);
      c.set(DARK).lerp(new THREE.Color(LIT), awake);
      for (const m of mats) m.color.copy(c);
    },
    reset() { awake = 0; for (const m of mats) m.color.set(DARK); },
  };
}
