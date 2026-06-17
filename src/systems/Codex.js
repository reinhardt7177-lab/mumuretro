// 우표 도감 — 배달한 수령인을 우표로 수집, localStorage 지속. 유일한 진행 요소(선택적).
const KEY = 'mumu_codex_v1';

export class Codex {
  constructor(recipients) {
    this.recipients = recipients;
    this.collected = new Set();
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (Array.isArray(s)) s.forEach(id => this.collected.add(id));
    } catch (e) { /* 무시 */ }
  }

  add(id) { this.collected.add(id); this._save(); }
  has(id) { return this.collected.has(id); }
  count() { return this.collected.size; }
  total() { return this.recipients.length; }
  _save() { try { localStorage.setItem(KEY, JSON.stringify([...this.collected])); } catch (e) { /* 무시 */ } }

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
