// 학습 모드 — "이 편지, 누구에게?"
//
// 핵심 설계: 배달이라는 행위 자체가 학습 행위가 된다.
//  1) 우체통에서 문제가 적힌 편지를 받는다.
//  2) 정답이 대문 팻말에 걸린 집을 찾아간다(오답 팻말이 걸린 집도 함께 있다).
//  3) E를 눌러 배달 = 정답 제출.
//
// 그래서 Navigation은 문제 중에 꺼야 한다. 켜두면 화살표가 정답 집을 가리켜 학습이 0이 된다.
// (오답 2회 후에만 힌트로 켠다.)
import * as THREE from 'three';
import { makeRNG } from '../util/math.js';
import { reportCurriculum } from '../data/curriculum/validate.js';
import { byRegion } from '../data/curriculum/index.js';

const KEY = 'mumu_learn_v1';
const SIGN_H = 5.2;          // 집 위 팻말 높이(월드)
const CANDIDATES = 4;        // 한 문제에 팻말을 거는 집 수(정답 1 + 오답 3)
// 후보 집 거리 밴드(월드). 이게 곧 난이도이자 "걷는 맛"이다.
//  - 너무 가까우면(0u) 방금 배달한 집이 그대로 후보가 되어 가만히 서서 정답이 될 수 있다.
//  - 너무 멀면 지평선(R=68에서 약 28u) 너머라 팻말을 읽지 못해 찍기가 된다.
const MIN_DIST = 10;
const MAX_DIST = 30;
// 절대 상한. 집이 드문 구역(안개 골짜기)에서 밴드를 무한히 넓히면 후보가 149u 밖까지 잡혀
// 시련 이탈 반경(46u)을 넘겨 시련이 시작하자마자 중단된다. 걷는 맛으로도 149u는 논외다.
// 상한 안에 집이 모자라면 밴드를 더 넓히는 대신 **후보 수를 줄인다**(2개까지).
const HARD_MAX = 42;
const MIN_CANDIDATES = 2;
// 최근 이만큼의 문제는 다시 내지 않는다(간격 반복의 "간격").
// 과목당 문제가 12~17개이므로 3이면 충분히 사이가 벌어지고, 풀이 마르지도 않는다.
const RECENT_GAP = 3;

// 텍스트 팻말 텍스처. 글자 길이에 맞춰 캔버스 폭을 늘린다.
// 월드 안 텍스트 렌더러는 이거 하나로 유지한다 — 두 개가 되는 순간 폰트·여백이 갈라진다.
// style로 색/크기만 바꿔 유령 이름표(창백한 종이) 같은 변형에 재사용한다.
export function signTexture(text, style = {}) {
  const pad = style.pad ?? 26, fontPx = style.fontPx ?? 60;
  const bg = style.bg ?? '#f6ead0', border = style.border ?? '#8a6a44';
  const fg = style.fg ?? '#3b3226';
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `bold ${fontPx}px system-ui, sans-serif`;
  const w = Math.ceil(probe.measureText(text).width) + pad * 2;
  const h = fontPx + pad * 2;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  // 나무 팻말 느낌(기본). style로 창백한 종이 등으로 바꿀 수 있다.
  x.fillStyle = bg;
  x.strokeStyle = border; x.lineWidth = 8;
  const r = 16;
  x.beginPath();
  x.moveTo(r, 4); x.lineTo(w - r, 4); x.quadraticCurveTo(w - 4, 4, w - 4, r);
  x.lineTo(w - 4, h - r); x.quadraticCurveTo(w - 4, h - 4, w - r, h - 4);
  x.lineTo(r, h - 4); x.quadraticCurveTo(4, h - 4, 4, h - r);
  x.lineTo(4, r); x.quadraticCurveTo(4, 4, r, 4);
  x.closePath(); x.fill(); x.stroke();
  x.fillStyle = fg;
  x.font = `bold ${fontPx}px system-ui, sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { tex: t, aspect: w / h };
}

export class LearningSystem {
  // houses: [{id, name, pos, dir, npc}]
  // curricula: 커리큘럼 배열(레지스트리). 구역에 따라 활성 과목이 바뀐다.
  constructor(scene, planet, houses, curricula, opts = {}) {
    this.scene = scene;
    this.planet = planet;
    this.houses = houses;
    this.curricula = Array.isArray(curricula) ? curricula : [curricula];
    this.active = opts.initial || this.curricula[0];
    // 과목 전환은 즉시 하지 않고 "다음 문제" 시점까지 미룬다.
    // 후보 집으로 걸어가다 구역 경계를 넘으면 풀던 문제가 사라지기 때문.
    this.pending = null;
    this.rng = makeRNG(opts.seed ?? 7);
    for (const c of this.curricula) reportCurriculum(c);   // 로드 시점에 데이터 제약 검사
    this.range = opts.range ?? 5;              // 제출 가능 거리(월드)
    this.onQuestion = opts.onQuestion || (() => {});
    this.onResult = opts.onResult || (() => {});

    this.current = null;      // {question, labels:[{house, text, correct, sign}]}
    this.wrongStreak = 0;     // 현재 문제에서 틀린 횟수 — 2회부터 네비 힌트
    this.solved = 0;
    this._recent = [];        // 최근 출제 id — 바로 다시 내지 않기 위한 큐

    this.boxes = this._load();   // { [questionId]: 0~3 }  Leitner 상자
    this.signs = new THREE.Group();
    scene.add(this.signs);
  }

  _load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  _save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.boxes)); } catch (e) { /* 무시 */ }
  }

  boxOf(id) { return this.boxes[id] ?? 0; }
  masteredCount() { return this.active.questions.filter(q => this.boxOf(q.id) >= 3).length; }
  totalCount() { return this.active.questions.length; }
  // 전체(모든 과목) 진도 — 세션 요약·배지용.
  allQuestions() { return this.curricula.flatMap(c => c.questions); }
  masteredAll() { return this.allQuestions().filter(q => this.boxOf(q.id) >= 3).length; }
  totalAll() { return this.allQuestions().length; }

  // 구역 id로 과목 전환을 예약. 해당 구역에 커리큘럼이 없으면 지금 과목을 유지한다
  // (준비 안 된 구역에서 문제가 사라지면 할 일이 없어진다).
  requestRegion(regionId) {
    const c = byRegion(regionId);
    if (c && c !== this.active) { this.pending = c; return true; }
    return false;
  }

  // 다음 문제 — 상자가 낮은(=덜 익힌) 것부터. 같은 상자 안에서는 무작위.
  // 이게 곧 간격 반복이다: 틀리면 상자가 내려가 금방 다시 나오고, 맞히면 올라가 뜸해진다.
  //
  // ★ 최근 출제분 제외가 핵심이다. 이게 없으면 틀린 문제가 상자 0이 되어 **바로 다음 문제로**
  // 똑같이 다시 나온다(실측 간격 0). 그러면 답이 작업기억에 남아 있어 인출 연습이 전혀 안 되고,
  // 후보 4개 중 하나를 이미 배제한 상태라 남은 3개에서 찍기만 하면 된다.
  // 사이에 다른 문제를 끼워 넣어야 비로소 "다시 떠올리는" 연습이 된다.
  _pickQuestion() {
    const all = this.active.questions;
    const unlearned = all.filter(q => this.boxOf(q.id) < 3);
    let pool = unlearned.length ? unlearned : all;         // 다 익혔으면 전체 복습

    // 최근 낸 문제는 뒤로 미룬다. 남는 게 없을 때만 허용(문제 수가 적은 과목 대비).
    const fresh = pool.filter(q => !this._recent.includes(q.id));
    if (fresh.length) pool = fresh;

    let minBox = Infinity;
    for (const q of pool) minBox = Math.min(minBox, this.boxOf(q.id));
    const low = pool.filter(q => this.boxOf(q.id) === minBox);
    const picked = low[Math.floor(this.rng() * low.length)];

    this._recent.push(picked.id);
    if (this._recent.length > RECENT_GAP) this._recent.shift();
    return picked;
  }

  // 플레이어 근처 집 중 CANDIDATES개를 골라 정답/오답 팻말을 건다.
  nextQuestion(playerPos) {
    this.clearSigns();
    this.wrongStreak = 0;
    // 예약된 과목 전환을 여기서 적용 — 문제 도중에는 절대 바꾸지 않는다.
    if (this.pending) { this.active = this.pending; this.pending = null; }
    const q = this._pickQuestion();

    // 거리 밴드 안의 집만 후보로. 부족하면 밴드를 점점 넓혀 항상 CANDIDATES개를 채운다.
    const R = this.planet.R;
    const withDist = this.houses
      .map(h => ({ h, d: playerPos.angleTo(h.pos) * R }))
      .sort((a, b) => a.d - b.d);
    let band = withDist.filter(x => x.d >= MIN_DIST && x.d <= MAX_DIST);
    if (band.length < CANDIDATES) {
      band = withDist.filter(x => x.d >= MIN_DIST * 0.6 && x.d <= HARD_MAX);
    }
    const pool = band.map(x => x.h);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // 상한 안에 집이 모자라면 후보를 줄인다(정답 1 + 오답 1이면 문제는 성립한다).
    // 최후 폴백도 거리순 정렬을 유지해 가장 가까운 것부터 쓴다 —
    // 그냥 아무거나 쓰면 54u짜리가 섞여 팻말이 19px로 찍혀 읽을 수가 없다.
    let chosen = pool.slice(0, Math.min(CANDIDATES, pool.length));
    if (chosen.length < MIN_CANDIDATES) {
      chosen = withDist.slice(0, Math.min(CANDIDATES, withDist.length)).map(x => x.h);
    }
    const texts = [q.a, ...q.d].slice(0, chosen.length);
    // 정답이 항상 첫 집에 가지 않도록 섞는다.
    for (let i = texts.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [texts[i], texts[j]] = [texts[j], texts[i]];
    }

    const labels = chosen.map((house, i) => {
      const text = texts[i];
      const sign = this._makeSign(house, text);
      // tried — 이미 가본 오답 집. 표시해 두지 않으면 아이가 같은 집을 또 간다.
      return { house, text, correct: text === q.a, sign, tried: false };
    });

    this.current = { question: q, labels, curriculum: this.active };
    this.onQuestion(q, labels, this.active);
    return this.current;
  }

  _makeSign(house, text) {
    const { tex, aspect } = signTexture(text);
    const h = 1.5, w = h * aspect;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    mat.userData.outlineParameters = { visible: false };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.copy(house.pos).addScaledVector(house.dir, SIGN_H);
    this.signs.add(mesh);
    return mesh;
  }

  // 오답 표시 — 팻말을 회색 종이에 ✗ 붙인 모습으로 다시 그린다.
  _markTried(label) {
    if (!label || !label.sign) return;
    const mesh = label.sign;
    const { tex, aspect } = signTexture(`✗ ${label.text}`, {
      bg: '#cfcbc4', border: '#8f8a83', fg: '#7a736b',
    });
    if (mesh.material.map) mesh.material.map.dispose();
    mesh.material.map = tex;
    mesh.material.opacity = 0.72;
    mesh.material.transparent = true;
    mesh.material.needsUpdate = true;
    const h = 1.5;
    mesh.geometry.dispose();
    mesh.geometry = new THREE.PlaneGeometry(h * aspect, h);
  }

  clearSigns() {
    for (const m of [...this.signs.children]) {
      this.signs.remove(m);
      m.geometry.dispose();
      if (m.material.map) m.material.map.dispose();
      m.material.dispose();
    }
  }

  // 제출 가능한(사거리 안) 팻말 집. 없으면 null.
  labelInRange(playerPos) {
    if (!this.current) return null;
    const ang = this.range / this.planet.R;
    let best = null, bd = Infinity;
    for (const l of this.current.labels) {
      const d = playerPos.angleTo(l.house.pos);
      if (d < ang && d < bd) { bd = d; best = l; }
    }
    return best;
  }

  // 배달 = 정답 제출. 맞으면 다음 문제, 틀리면 같은 문제 유지(벌점 없음).
  submit(playerPos) {
    const label = this.labelInRange(playerPos);
    if (!label || !this.current) return null;
    const q = this.current.question;
    const correct = label.correct;

    if (correct) {
      this.boxes[q.id] = Math.min(3, this.boxOf(q.id) + 1);
      this.solved++;
    } else {
      this.boxes[q.id] = Math.max(0, this.boxOf(q.id) - 1);
      this.wrongStreak++;
      // 틀린 집은 팻말을 흐리게 + ✗ 표시. 4학년이 "여긴 아까 가봤다"를 기억하게 만들지 않는다.
      label.tried = true;
      this._markTried(label);
    }
    this._save();
    const res = { correct, question: q, label, wrongStreak: this.wrongStreak, box: this.boxes[q.id] };
    this.onResult(res);
    return res;
  }

  // 오답 2회부터 네비게이션을 힌트로 켠다.
  get hintUnlocked() { return this.wrongStreak >= 2; }
  get hintTarget() {
    if (!this.hintUnlocked || !this.current) return null;
    const l = this.current.labels.find(x => x.correct);
    return l ? l.house : null;
  }

  // 팻말이 항상 카메라를 보게(빌보드) + 거리 보정.
  //
  // 원근만 따르면 먼 팻말이 화면에서 19px까지 줄어 4학년이 읽을 수가 없다(실측).
  // 일정 거리부터는 거리에 비례해 키워서 화면상 크기를 유지한다 —
  // 원근감은 조금 잃지만, 읽히지 않는 팻말은 찍기를 유도할 뿐이다.
  update(camera) {
    const REF = 18;      // 이 거리까지는 원근 그대로
    const MAX_K = 3.0;   // 최대 3배까지만 키운다
    for (const m of this.signs.children) {
      m.quaternion.copy(camera.quaternion);
      const d = m.position.distanceTo(camera.position);
      const k = Math.min(MAX_K, Math.max(1, d / REF));
      m.scale.setScalar(k);
    }
  }
}
