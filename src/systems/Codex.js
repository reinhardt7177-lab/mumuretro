// 우표 도감 — 수집한 항목을 우표로 기록, localStorage 지속.
// 잔잔한 모드에서는 "배달한 수령인", 학습 모드에서는 "익힌 문제"를 담는다.
// ★ 저장 키는 모드마다 달라야 한다. 같이 쓰면 학습 진도가 배달 도감을 오염시켜
//   아무것도 안 했는데 16/16으로 보인다(실제로 그랬다).
export class Codex {
  constructor(recipients, key = 'mumu_codex_v1') {
    this.recipients = recipients;
    this.key = key;
    this.collected = new Set();
    try {
      const s = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(s)) s.forEach(id => this.collected.add(id));
    } catch (e) { /* 무시 */ }
  }

  add(id) { this.collected.add(id); this._save(); }
  has(id) { return this.collected.has(id); }
  count() { return this.collected.size; }
  total() { return this.recipients.length; }
  _save() { try { localStorage.setItem(this.key, JSON.stringify([...this.collected])); } catch (e) { /* 무시 */ } }

  // 도감 그리드 DOM 채우기.
  renderInto(el) {
    if (!el) return;
    el.innerHTML = '';
    for (const r of this.recipients) {
      const got = this.collected.has(r.id);
      const d = document.createElement('div');
      d.className = 'stamp' + (got ? ' got' : '');
      d.innerHTML = got
        ? `<div class="ic">${r.parcel?.icon || '📮'}</div><div class="nm">${r.name}</div>`
        : `<div class="ic">❔</div><div class="nm">？？？</div>`;
      el.appendChild(d);
    }
  }
}
