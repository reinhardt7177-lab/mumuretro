// 사당 여섯 곳의 배치 — **코드가 아니라 표다.**
//
// ★ 예전엔 Dungeon.js 안에 LAYOUT 상수 하나가 박혀 있었다. 그래서 사당이 여섯인데
//   내부는 하나였다. 어느 사당에 들어가도 빛 타일 → 레이저 → 압력판 → 저울,
//   늘 같은 순서 같은 색이었다.
//   사당마다 컨셉을 다르게 하려면 배치가 데이터여야 한다. 사당을 하나 더 붙이는 데
//   코드를 고쳐야 한다면 그건 아직 데이터가 아닌 것이다.
//
// 규칙
//   · z가 작아질수록 안쪽이다. from > to.
//   · 치수는 전부 플레이어 키 1.5u에서 유도한다(설계도 §1).
//   · 모든 사당의 입구 통로는 z=11.4에서 시작한다 — ENTRY_Z/EXIT_Z를 공유하기 위해서다.
//   · gate가 붙은 방은 그 관문을 풀어야 **다음 통로**가 열린다(door로 잇는다).
//   · 단원은 과학 4학년 여섯 단원을 하나씩 맡는다. 억지로 여섯을 만든 게 아니라
//     단원이 원래 여섯이고 서로 다른 물질을 다루기 때문에 분위기가 저절로 갈린다.
import { SHRINE_THEMES as T } from '../data/lighting.js';

// ★ 시작 지점이 10.2였고 나가기 판정이 z > 10.1이었다. 들어서는 순간 이미
//   출구 위라 사당 이름이 "E — 사당 밖으로"에 가려졌고, 반가워서 E를 누르면
//   곧바로 도로 나가졌다. 한 걸음 안쪽에서 시작한다.
export const ENTRY_Z = 9.2;      // 시작 지점(입구 통로 안쪽)
export const EXIT_Z = 11.0;      // 이보다 뒤로 가면 밖으로 나간다

// 방 셋 + 신전 하나를 잇는 공통 뼈대. 길이와 폭만 사당마다 다르게 준다.
// 이걸 손으로 여덟 줄씩 여섯 번 적으면 오타가 나고, 무엇보다 "어디가 다른지"가 안 보인다.
function spine({ rooms, corridor = 4, entryTo, w: cw = 3, ch = 3.2 }) {
  const out = [{ id: 'entry', kind: 'corridor', w: cw, from: 11.4, to: entryTo, h: ch, open: true }];
  let z = entryTo;
  rooms.forEach((r, i) => {
    out.push({ id: r.id, kind: 'room', name: r.name, w: r.w, from: z, to: z - r.len, h: r.h, gate: r.gate });
    z -= r.len;
    const last = i === rooms.length - 1;
    const cl = last ? corridor : (r.corridor || corridor);
    if (!last) {
      out.push({ id: `c${i + 1}`, kind: 'corridor', w: cw, from: z, to: z - cl, h: ch, door: r.id });
      z -= cl;
    }
  });
  return out;
}

export const SHRINES = [
  // ── 01 · 과학 4-1 「물체의 무게」 ─────────────────────────────────────────
  // 따뜻한 돌, 청록, 고요. 여섯 중 유일하게 아무 일도 일어나지 않는 사당이라
  // 나머지 다섯이 얼마나 시끄러운지를 이 사당이 기준으로 잡아 준다.
  {
    id: 'balance', name: '균형의 사당', unit: '물체의 무게', theme: T.balance,
    rooms: spine({
      entryTo: 6.0,
      rooms: [
        { id: 'r1', name: '빛 타일', w: 10, len: 14, h: 5.5, gate: 'tile' },
        { id: 'r2', name: '레이저 회랑', w: 8, len: 16, h: 5.5, gate: 'laser' },
        { id: 'r3', name: '무게 압력판', w: 12, len: 10, h: 5.5, gate: 'plate' },
        { id: 'shrine', name: '신전', w: 18, len: 16, h: 9 },
      ],
    }),
    final: 'scale',
  },

  // ── 02 · 과학 4-2 「그림자와 거울」 ──────────────────────────────────────
  // 벽이 안 보인다. 광원이 방마다 하나뿐이고 빛이 닿는 바닥만 보인다.
  // 1번과 정반대라 문 하나 지나는 순간 "다른 사당"이 전달된다.
  // 규칙도 뒤집힌다 — 여기서는 **어둠이 안전하다.**
  // 복도가 긴 것도 의도다. 어둠 속을 걷는 시간이 이 사당의 재료다.
  {
    id: 'shadow', name: '그림자의 사당', unit: '그림자와 거울', theme: T.shadow,
    rooms: spine({
      entryTo: 5.0, corridor: 6, ch: 3.4,
      rooms: [
        { id: 'r1', name: '그림자 밟기', w: 9, len: 16, h: 6.0, gate: 'shade' },
        { id: 'r2', name: '거울 세 장', w: 9, len: 14, h: 6.0, gate: 'mirror' },
        { id: 'r3', name: '그림자 크기', w: 9, len: 12, h: 6.0, gate: 'silhouette' },
        { id: 'shrine', name: '신전', w: 16, len: 16, h: 8 },
      ],
    }),
    final: 'mirrorGod',
  },

  // ── 03 · 과학 4-1 「혼합물의 분리」 ──────────────────────────────────────
  // 넓고 낮다. 여섯 중 유일하게 작업장처럼 생겼다.
  // 신전에 가까워질수록 바닥이 깨끗해진다 — 섞인 데서 갈라진 데로 가는 것이 진행이다.
  {
    id: 'sift', name: '체의 사당', unit: '혼합물의 분리', theme: T.sift,
    rooms: spine({
      entryTo: 6.0,
      rooms: [
        { id: 'r1', name: '체 고르기', w: 12, len: 12, h: 5.0, gate: 'sieve' },
        { id: 'r2', name: '자석 발판', w: 12, len: 12, h: 5.0, gate: 'magnet' },
        { id: 'r3', name: '거름과 증발', w: 12, len: 12, h: 5.0, gate: 'evaporate' },
        { id: 'shrine', name: '신전', w: 16, len: 16, h: 6.5 },
      ],
    }),
    final: 'siftGod',
  },

  // ── 04 · 과학 4-2 「물의 상태 변화」 ─────────────────────────────────────
  // 높다. 수위가 오르고 발밑이 미끄럽다. 방의 모양이 시간에 따라 바뀌는 유일한 사당.
  {
    id: 'water', name: '세 모습의 사당', unit: '물의 상태 변화', theme: T.water,
    rooms: spine({
      entryTo: 6.0,
      rooms: [
        { id: 'r1', name: '얼려서 건너기', w: 10, len: 16, h: 7.0, gate: 'freeze' },
        { id: 'r2', name: '미끄러운 바닥', w: 10, len: 14, h: 7.0, gate: 'slide' },
        { id: 'r3', name: '수증기 승강기', w: 10, len: 12, h: 7.0, gate: 'steam' },
        { id: 'shrine', name: '신전', w: 18, len: 18, h: 10 },
      ],
    }),
    final: 'waterGod',
  },

  // ── 05 · 과학 4-2 「화산과 지진」 ────────────────────────────────────────
  // 방 폭이 들쭉날쭉하다. 반듯한 방이 하나도 없어야 "무너지는 중"으로 읽힌다.
  {
    id: 'fire', name: '흔들리는 사당', unit: '화산과 지진', theme: T.fire,
    rooms: spine({
      entryTo: 6.0,
      rooms: [
        { id: 'r1', name: '예진', w: 11, len: 15, h: 6.5, gate: 'quake' },
        { id: 'r2', name: '용암 육각형', w: 9, len: 12, h: 6.5, gate: 'hexlava' },
        { id: 'r3', name: '간헐천', w: 13, len: 14, h: 6.5, gate: 'geyser' },
        { id: 'shrine', name: '신전', w: 18, len: 18, h: 9 },
      ],
    }),
    final: 'fireGod',
  },

  // ── 06 · 과학 4-1 「지층과 화석」 — 마지막 사당 ──────────────────────────
  // 가장 길고, 신전이 20u다(다른 신전의 두 배 이상).
  // 문을 지나는 순간 천장이 안 보이는 것이 이 방의 첫인상이어야 한다.
  {
    id: 'strata', name: '시간의 사당', unit: '지층과 화석', theme: T.strata,
    locked: 5,          // 앞선 다섯 사당의 구슬이 있어야 열린다
    rooms: spine({
      entryTo: 6.0, corridor: 6,
      rooms: [
        { id: 'r1', name: '층의 순서', w: 10, len: 16, h: 6.0, gate: 'strataOrder' },
        { id: 'r2', name: '내려가는 갱도', w: 8, len: 18, h: 9.0, gate: 'shaft' },
        { id: 'r3', name: '다섯 색의 문', w: 12, len: 14, h: 6.0, gate: 'fiveDoors' },
        { id: 'shrine', name: '신전', w: 20, len: 22, h: 20 },
      ],
    }),
    final: 'grand',
  },
];

export const shrineSpec = (i) => SHRINES[i % SHRINES.length];
