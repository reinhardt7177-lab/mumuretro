// 능력 해금 — 시련소를 클리어할수록 갈 수 있는 곳이 넓어진다.
//
// 젤다식 루프의 핵심은 "저기 뭔가 보인다 → 아직 못 간다 → 능력을 얻는다 → 간다"이다.
// 그 "못 간다"를 만들려면 먼저 제약이 있어야 한다. 그래서 이 시스템의 실제 출발점은
// 능력이 아니라 **경사 제한**이다(Player가 32°보다 가파른 곳을 못 오른다).
// 벽 오르기는 그 제한을 푸는 것이지, 없던 능력을 더하는 게 아니다.

const KEY = 'mumu_abilities_v1';

// 시련소 클리어 수 → 해금. 순서가 곧 난이도이자 지도 확장 순서.
export const ABILITIES = [
  { id: 'doubleJump', at: 1, emoji: '🕊️', name: '이단 점프', desc: '공중에서 한 번 더 뛸 수 있어요' },
  { id: 'wallClimb',  at: 3, emoji: '🧗', name: '벽 오르기', desc: '가파른 절벽도 오를 수 있어요' },
  { id: 'glide',      at: 5, emoji: '🪂', name: '활공',      desc: '높은 곳에서 멀리 날 수 있어요' },
  { id: 'mistPass',   at: 7, emoji: '🌫️', name: '안개 통행', desc: '안개 골짜기에 들어갈 수 있어요' },
];

export class Abilities {
  constructor(opts = {}) {
    this.onUnlock = opts.onUnlock || (() => {});
    const s = this._load();
    this.cleared = new Set(s.cleared || []);      // 클리어한 시련소 구역 id
    this.unlocked = new Set(s.unlocked || []);
  }

  _load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  _save() {
    try { localStorage.setItem(KEY, JSON.stringify({ cleared: [...this.cleared], unlocked: [...this.unlocked] })); }
    catch (e) { /* 무시 */ }
  }

  has(id) { return this.unlocked.has(id); }
  clearedCount() { return this.cleared.size; }

  // 다음에 열릴 능력(진행 표시용). 다 열었으면 null.
  next() { return ABILITIES.find(a => !this.unlocked.has(a.id)) || null; }

  // 시련소 클리어 → 새로 열린 능력들 반환.
  clearTrial(regionId) {
    if (this.cleared.has(regionId)) return [];
    this.cleared.add(regionId);
    const n = this.cleared.size;
    const fresh = ABILITIES.filter(a => a.at <= n && !this.unlocked.has(a.id));
    for (const a of fresh) this.unlocked.add(a.id);
    this._save();
    for (const a of fresh) this.onUnlock(a);
    return fresh;
  }

  // 검증/디버그용
  grantAll() {
    for (const a of ABILITIES) this.unlocked.add(a.id);
    this._save();
    return [...this.unlocked];
  }
  reset() { this.cleared.clear(); this.unlocked.clear(); this._save(); }
}
