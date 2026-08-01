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

// 텍스트 팻말 텍스처. 글자 길이에 맞춰 캔버스 폭을 늘린다.
function signTexture(text) {
  const pad = 26, fontPx = 60;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `bold ${fontPx}px system-ui, sans-serif`;
  const w = Math.ceil(probe.measureText(text).width) + pad * 2;
  const h = fontPx + pad * 2;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  // 나무 팻말 느낌
  x.fillStyle = '#f6ead0';
  x.strokeStyle = '#8a6a44'; x.lineWidth = 8;
  const r = 16;
  x.beginPath();
  x.moveTo(r, 4); x.lineTo(w - r, 4); x.quadraticCurveTo(w - 4, 4, w - 4, r);
  x.lineTo(w - 4, h - r); x.quadraticCurveTo(w - 4, h - 4, w - r, h - 4);
  x.lineTo(r, h - 4); x.quadraticCurveTo(4, h - 4, 4, h - r);
  x.lineTo(4, r); x.quadraticCurveTo(4, 4, r, 4);
  x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#3b3226';
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
  _pickQuestion() {
    const qs = this.active.questions.filter(q => this.boxOf(q.id) < 3);
    const pool = qs.length ? qs : this.active.questions;   // 다 익혔으면 전체 복습
    let minBox = Infinity;
    for (const q of pool) minBox = Math.min(minBox, this.boxOf(q.id));
    const low = pool.filter(q => this.boxOf(q.id) === minBox);
    return low[Math.floor(this.rng() * low.length)];
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
    for (let grow = 1; band.length < CANDIDATES && grow <= 4; grow++) {
      band = withDist.filter(x => x.d >= MIN_DIST * 0.6 && x.d <= MAX_DIST + 20 * grow);
    }
    if (band.length < CANDIDATES) band = withDist.filter(x => x.d >= MIN_DIST * 0.6);
    const pool = band.map(x => x.h);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const chosen = pool.slice(0, Math.min(CANDIDATES, pool.length));
    const texts = [q.a, ...q.d].slice(0, chosen.length);
    // 정답이 항상 첫 집에 가지 않도록 섞는다.
    for (let i = texts.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [texts[i], texts[j]] = [texts[j], texts[i]];
    }

    const labels = chosen.map((house, i) => {
      const text = texts[i];
      const sign = this._makeSign(house, text);
      return { house, text, correct: text === q.a, sign };
    });

    this.current = { question: q, labels, curriculum: this.active };
    this.onQuestion(q, labels, this.active);
    return this.current;
  }

  _makeSign(house, text) {
    const { tex, aspect } = signTexture(text);
    const h = 1.5, w = h * aspect;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    mat.userData.outlineParameters = { visible: false };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.copy(house.pos).addScaledVector(house.dir, SIGN_H);
    this.signs.add(mesh);
    return mesh;
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

  // 팻말이 항상 카메라를 보게(빌보드).
  update(camera) {
    for (const m of this.signs.children) m.quaternion.copy(camera.quaternion);
  }
}
