// 캐릭터 커스터마이즈 — 로드아웃 localStorage 지속 + UI 생성 + 플레이어 라이브 적용.
import {
  HAIR_STYLES, SKIN_COLORS, HAIR_COLORS, JACKET_COLORS, PANTS_COLORS, SHOE_COLORS, CAP_COLORS, DEFAULT_LOADOUT,
} from '../entities/Character.js';

const KEY = 'mumu_loadout_v1';
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export class Customizer {
  constructor(player) {
    this.player = player;
    this.loadout = this._load();
    player.setLoadout(this.loadout);
  }

  _load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) return { ...DEFAULT_LOADOUT, ...s }; } catch (e) { /* 무시 */ }
    return { ...DEFAULT_LOADOUT };
  }
  _save() { try { localStorage.setItem(KEY, JSON.stringify(this.loadout)); } catch (e) { /* 무시 */ } }

  set(part, val) { this.loadout[part] = val; this.player.setLoadout(this.loadout); this._save(); }
  cycleHair(dir) {
    const ids = HAIR_STYLES.map(h => h.id);
    let i = ids.indexOf(this.loadout.hairId);
    i = (i + dir + ids.length) % ids.length;
    this.set('hairId', ids[i]);
  }
  toggleCap() { this.set('hasCap', !this.loadout.hasCap); }

  buildUI(container) {
    container.innerHTML = '';
    const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

    // 머리 스타일 사이클러
    const hairRow = mk('div', 'cz-row');
    hairRow.appendChild(mk('span', 'cz-label', '머리'));
    const prev = mk('button', 'cz-arrow', '◀'), name = mk('span', 'cz-name'), next = mk('button', 'cz-arrow', '▶');
    const updName = () => { name.textContent = (HAIR_STYLES.find(h => h.id === this.loadout.hairId) || {}).name || this.loadout.hairId; };
    prev.onclick = () => { this.cycleHair(-1); updName(); };
    next.onclick = () => { this.cycleHair(1); updName(); };
    hairRow.append(prev, name, next); updName();
    container.appendChild(hairRow);

    const colorRow = (label, part, colors) => {
      const row = mk('div', 'cz-row'); row.appendChild(mk('span', 'cz-label', label));
      const sw = mk('div', 'cz-sw');
      colors.forEach(c => {
        const b = mk('button', 'cz-chip'); b.style.background = hex(c);
        if (this.loadout[part] === c) b.classList.add('sel');
        b.onclick = () => { this.set(part, c); sw.querySelectorAll('.cz-chip').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); };
        sw.appendChild(b);
      });
      row.appendChild(sw); container.appendChild(row);
    };
    colorRow('피부', 'skin', SKIN_COLORS);
    colorRow('머리색', 'hairColor', HAIR_COLORS);
    colorRow('자켓', 'jacket', JACKET_COLORS);
    colorRow('바지', 'pants', PANTS_COLORS);
    colorRow('신발', 'shoe', SHOE_COLORS);
    colorRow('모자색', 'cap', CAP_COLORS);

    const capRow = mk('div', 'cz-row'); capRow.appendChild(mk('span', 'cz-label', '모자'));
    const capBtn = mk('button', 'cz-toggle', this.loadout.hasCap ? 'ON' : 'OFF');
    capBtn.classList.toggle('on', this.loadout.hasCap);
    capBtn.onclick = () => { this.toggleCap(); capBtn.textContent = this.loadout.hasCap ? 'ON' : 'OFF'; capBtn.classList.toggle('on', this.loadout.hasCap); };
    capRow.appendChild(capBtn); container.appendChild(capRow);
  }
}
