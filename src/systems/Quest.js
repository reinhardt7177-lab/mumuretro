// 퀘스트 패널 + 전체 지도.
//
// 이 게임은 "안 되는 것"이 많다 — 급경사는 못 오르고, 안개 골짜기는 벽 오르기가 있어야 들어가고,
// 시련소는 5문제 연속을 맞혀야 깨진다. 그런데 지금까지 그걸 아무도 알려주지 않아서
// 아이 입장에서는 맵이 고장난 것처럼 느껴졌다.
//
// 그래서 이 패널의 역할은 하나다: **지금 무엇을 할 수 있고, 무엇이 왜 잠겨 있는가.**
import * as THREE from 'three';
import { ABILITIES } from './Abilities.js';

// 구면 → 평면(정거원통도법). 위경도를 그대로 x/y로 편다.
// 극지방이 늘어나지만 구역 위치를 눈으로 잡는 데는 충분하고, 계산이 단순하다.
function toMapXY(dir, w, h) {
  const lat = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));      // -π/2..π/2
  const lon = Math.atan2(dir.z, dir.x);                            // -π..π
  return {
    x: (lon / (Math.PI * 2) + 0.5) * w,
    y: (0.5 - lat / Math.PI) * h,
  };
}

export class Quest {
  // deps: { planet, player, trials, abilities, learning, story, world, dokkaebiCaught }
  constructor(deps) {
    this.d = deps;
    this.el = document.getElementById('questPanel');
    this.canvas = document.getElementById('mapCanvas');
    this.listEl = document.getElementById('questList');
    this.open = false;
    this._bg = null;   // 구역 배경은 한 번만 그려 캐시(매번 그리면 느리다)
  }

  toggle() { this.open ? this.hide() : this.show(); }
  hide() { this.open = false; if (this.el) this.el.classList.remove('show'); }
  show() {
    this.open = true;
    if (this.el) this.el.classList.add('show');
    this.renderList();
    this.renderMap();
  }

  // ── 퀘스트 목록 ─────────────────────────────────────────────────────────
  // "할 수 있는 것"을 위에, "왜 잠겼는지"를 아래에 둔다.
  renderList() {
    if (!this.listEl) return;
    const { trials, abilities, learning, dokkaebiCaught } = this.d;
    const cleared = abilities.clearedCount();
    const rows = [];

    const item = (state, title, desc) =>
      `<div class="qi ${state}"><div class="qi-t">${title}</div><div class="qi-d">${desc}</div></div>`;

    // 지금 할 일
    if (learning.current) {
      rows.push(item('now', '📮 편지 배달하기',
        `"${learning.current.question.q}" — 답이 걸린 집으로 가서 E`));
    }

    // 시련소 — 클리어 여부는 tower의 스냅샷이 아니라 abilities를 진실로 삼는다
    // (탑 플래그는 submit()에서만 갱신되므로 다른 경로로 클리어되면 어긋난다).
    const isDone = t => abilities.cleared.has(t.regionId);
    const openTowers = trials.towers.filter(t => !isDone(t) && t.regionId !== 'mist');
    if (openTowers.length) {
      rows.push(item('todo', `🗼 시련소 (${cleared}/${trials.towers.length})`,
        `빛기둥이 보이는 탑에서 E → 5문제 연속 정답. 남은 곳: ${openTowers.map(t => t.emoji).join(' ')}`));
    }

    // 다음 능력
    const next = abilities.next();
    if (next) {
      const need = next.at - cleared;
      rows.push(item(need <= 0 ? 'todo' : 'lock', `${next.emoji} ${next.name}`,
        need <= 0 ? '곧 열려요!' : `시련소를 ${need}곳 더 깨면 열려요 (${cleared}/${next.at})`));
    }

    // 잠긴 것들 — 왜 잠겼는지 반드시 밝힌다
    if (!abilities.has('wallClimb')) {
      rows.push(item('lock', '⛰️ 가파른 절벽',
        '지금은 못 올라가요. 🧗 벽 오르기를 배우면 오를 수 있어요'));
    }
    if (!abilities.has('wallClimb')) {
      rows.push(item('lock', '🌫️ 안개 골짜기',
        '절벽으로 둘러싸여 있어요. 🧗 벽 오르기가 있어야 넘어갈 수 있어요'));
    } else if (!dokkaebiCaught()) {
      rows.push(item('todo', '😈 도깨비 잡기',
        '안개 골짜기에서 편지를 훔쳐 달아나요. Shift로 달려서 잡으세요'));
    } else {
      const done = abilities.cleared.has('mist');
      rows.push(item(done ? 'done' : 'todo', '💌 마지막 편지',
        done ? '잊혀진 우체국에 전했어요' : '안개 골짜기의 잊혀진 우체국으로 가져가세요'));
    }

    // 이미 얻은 능력
    const got = ABILITIES.filter(a => abilities.has(a.id));
    if (got.length) {
      rows.push(item('done', '✨ 가진 능력',
        got.map(a => `${a.emoji} ${a.name}`).join(' · ')));
    }

    this.listEl.innerHTML = rows.join('');
  }

  // ── 전체 지도 ───────────────────────────────────────────────────────────
  renderMap() {
    const cv = this.canvas; if (!cv) return;
    const { planet, player, trials, world } = this.d;
    const w = cv.width, h = cv.height;
    const x = cv.getContext('2d');

    // 구역 배경 — 위경도 격자를 훑어 그 방향의 구역 색을 칠한다. 한 번만 계산.
    if (!this._bg) {
      const img = x.createImageData(w, h);
      const dir = new THREE.Vector3();
      for (let py = 0; py < h; py++) {
        const lat = (0.5 - py / h) * Math.PI;
        for (let px = 0; px < w; px++) {
          const lon = (px / w - 0.5) * Math.PI * 2;
          dir.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
          let best = world.anchors[0], bd = Infinity;
          for (const a of world.anchors) { const dd = dir.angleTo(a.dir); if (dd < bd) { bd = dd; best = a; } }
          let r = best.color.r, g = best.color.g, b = best.color.b;
          // 물은 파랗게
          for (const z of planet.waterZones) {
            if (dir.angleTo(z.center) < z.ang) { r = 0.29; g = 0.55; b = 0.65; break; }
          }
          const i = (py * w + px) * 4;
          img.data[i] = r * 255; img.data[i + 1] = g * 255; img.data[i + 2] = b * 255; img.data[i + 3] = 255;
        }
      }
      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      off.getContext('2d').putImageData(img, 0, 0);
      this._bg = off;
    }
    x.clearRect(0, 0, w, h);
    x.drawImage(this._bg, 0, 0);

    // 시련소
    for (const t of trials.towers) {
      const p = toMapXY(t.dir, w, h);
      const done = this.d.abilities.cleared.has(t.regionId);
      x.font = '18px system-ui, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(done ? '✅' : '🗼', p.x, p.y);
      x.fillStyle = 'rgba(0,0,0,.62)';
      x.font = 'bold 10px system-ui, sans-serif';
      // 이름은 경도 ±180° 근처에서 캔버스 밖으로 잘린다 — 글자만 안쪽으로 당긴다
      // (마커까지 당기면 위치가 틀려진다).
      const lw = x.measureText(t.name).width / 2 + 3;
      x.fillText(t.name, THREE.MathUtils.clamp(p.x, lw, w - lw), p.y + 15);
    }

    // 플레이어
    const pp = toMapXY(player.position.clone().normalize(), w, h);
    x.beginPath(); x.arc(pp.x, pp.y, 6, 0, Math.PI * 2);
    x.fillStyle = '#ff5a4a'; x.fill();
    x.lineWidth = 2.5; x.strokeStyle = '#fff'; x.stroke();
    x.fillStyle = '#fff'; x.font = 'bold 11px system-ui, sans-serif';
    x.textAlign = 'center';
    x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 3;
    // 극 근처(위도 85° 등)에서는 라벨이 위로 삐져나간다 — 그때만 점 아래에 쓴다.
    const ly = pp.y < 14 ? pp.y + 18 : pp.y - 12;
    x.strokeText('나', pp.x, ly); x.fillText('나', pp.x, ly);
  }
}
