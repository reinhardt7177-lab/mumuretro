// 지도 — **길을 알려주는 것이 아니라 다녀온 것을 기록하는 것.**
//
// ★ 처음에 지도를 기각했던 이유는 "화살표가 정답을 알려주기" 때문이었다.
//   여기 지도는 반대다. 처음엔 온통 검고, 걸어간 자리만 밝아진다.
//   가 보지 않은 곳은 끝까지 검은 채로 남는다 — 지도가 아이를 이끄는 게 아니라
//   아이가 지도를 그린다.
//
// 그래서 이 화면이 대답하는 것은 "어디로 가야 하나"가 아니라 이 셋이다.
//   내가 어디까지 갔나 · 사당을 몇 개 깼나 · 아직 검은 데가 어디인가
//
// 구현
//   · 정거원통도법(경도 ↔ 가로, 위도 ↔ 세로). 구를 펴는 가장 단순한 방법이고,
//     극이 늘어나지만 이 행성은 극에 아무것도 없다.
//   · 지면 색은 Planet.terrainColor를 그대로 쓴다. 지도용 색을 따로 적으면
//     지형을 손볼 때마다 어긋나고, 아이 눈에는 "지도가 틀렸다"로 보인다.
//   · 밝히기는 **칸 단위**다. 부드럽게 번지게 할 수도 있지만, 이 게임은
//     로우폴리라 각진 편이 오히려 결에 맞는다.
import * as THREE from 'three';
import { registerOverlay, soloOpen } from './overlay.js';
import { terrainColor } from '../sphere/Planet.js';
import { SHRINE } from '../data/lighting.js';

const CW = 800, CH = 400;          // 지도 그림 크기(2:1)
const GX = 200, GY = 100;          // 밝히는 칸 수
const CELL_W = CW / GX, CELL_H = CH / GY;
const REVEAL_U = 26;               // 이만큼 안이 밝아진다. 안개가 걷히는 거리와 맞춘다
const STEP_U = 1.2;                // 이만큼 걸을 때마다 한 번 칠한다

const latLonOf = (d) => ({
  lat: Math.asin(Math.max(-1, Math.min(1, d.y))),
  lon: Math.atan2(d.x, d.z),
});
const dirOf = (lat, lon, out) => out.set(
  Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));

export function buildMapPage(planet, player, shrines, specs) {
  const R = planet.R;

  // ── 바탕 그림 — 행성 전체를 한 번만 그려 둔다 ──────────────────────────
  // 지형은 변하지 않으므로 다시 그릴 일이 없다. 밝힐 때는 여기서 칸을 오려 붙인다.
  const base = document.createElement('canvas');
  base.width = CW; base.height = CH;
  const bctx = base.getContext('2d');
  const img = bctx.createImageData(CW, CH);
  const _d = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3();
  const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _c = new THREE.Color();
  const EPS = 0.005;
  for (let py = 0; py < CH; py++) {
    const lat = (0.5 - (py + 0.5) / CH) * Math.PI;
    for (let px = 0; px < CW; px++) {
      const lon = ((px + 0.5) / CW - 0.5) * Math.PI * 2;
      dirOf(lat, lon, _d);
      const h = planet.heightAt(_d);
      // 경사 — 접선 두 방향으로 조금 움직여 높이차를 본다
      _t1.set(-Math.sin(lon), 0, Math.cos(lon));
      _t2.crossVectors(_d, _t1).normalize();
      _d1.copy(_d).addScaledVector(_t1, EPS).normalize();
      _d2.copy(_d).addScaledVector(_t2, EPS).normalize();
      const arc = EPS * R;
      const dh1 = (planet.heightAt(_d1) - h) / arc, dh2 = (planet.heightAt(_d2) - h) / arc;
      const slope = Math.atan(Math.hypot(dh1, dh2)) * 180 / Math.PI;
      terrainColor(h, slope, _c);
      // 위에서 내리쬐는 빛을 흉내 낸 음영 — 없으면 산맥이 안 읽힌다
      const shade = 1 - Math.min(0.42, Math.max(0, dh2) * 0.30);
      const i = (py * CW + px) * 4;
      img.data[i] = Math.round(Math.min(1, _c.r * shade) * 255);
      img.data[i + 1] = Math.round(Math.min(1, _c.g * shade) * 255);
      img.data[i + 2] = Math.round(Math.min(1, _c.b * shade) * 255);
      img.data[i + 3] = 255;
    }
  }
  bctx.putImageData(img, 0, 0);

  // ── 밝혀진 곳 ──────────────────────────────────────────────────────────
  const seen = new Uint8Array(GX * GY);
  let seenCount = 0;
  const lit = document.createElement('canvas');
  lit.width = CW; lit.height = CH;
  const lctx = lit.getContext('2d');
  const lastAt = new THREE.Vector3(1e9, 0, 0);

  const reveal = (dir) => {
    const { lat, lon } = latLonOf(dir);
    const cx = (lon / (Math.PI * 2) + 0.5) * GX;
    const cy = (0.5 - lat / Math.PI) * GY;
    const radLat = (REVEAL_U / R) / Math.PI * GY;                 // 위도 방향 칸 수
    const cosLat = Math.max(0.15, Math.cos(lat));                 // 극에서는 경도가 촘촘하다
    const radLon = (REVEAL_U / R) / (Math.PI * 2) / cosLat * GX;
    for (let iy = Math.floor(cy - radLat); iy <= cy + radLat; iy++) {
      if (iy < 0 || iy >= GY) continue;
      for (let ix = Math.floor(cx - radLon); ix <= cx + radLon; ix++) {
        const dy = (iy + 0.5 - cy) / radLat;
        const dx = (ix + 0.5 - cx) / radLon;
        if (dx * dx + dy * dy > 1) continue;
        const wx = ((ix % GX) + GX) % GX;                          // 경도는 이어져 있다
        const k = iy * GX + wx;
        if (seen[k]) continue;
        seen[k] = 1; seenCount++;
        lctx.drawImage(base, wx * CELL_W, iy * CELL_H, CELL_W, CELL_H,
          wx * CELL_W, iy * CELL_H, CELL_W, CELL_H);
      }
    }
  };
  const isSeenDir = (dir) => {
    const { lat, lon } = latLonOf(dir);
    const ix = Math.floor((lon / (Math.PI * 2) + 0.5) * GX);
    const iy = Math.floor((0.5 - lat / Math.PI) * GY);
    if (iy < 0 || iy >= GY) return false;
    return !!seen[iy * GX + ((ix % GX) + GX) % GX];
  };

  // ── 화면 ───────────────────────────────────────────────────────────────
  const el = document.createElement('div');
  el.id = 'mapPage';
  el.innerHTML = `
    <div class="mp-inner">
      <div class="mp-head">
        <div class="mp-title">무무 행성</div>
        <div class="mp-stat"><b id="mp-shrine">0 / 6</b><span>사당</span></div>
        <div class="mp-stat"><b id="mp-explored">0%</b><span>둘러본 곳</span></div>
      </div>
      <div class="mp-frame"><canvas id="mp-canvas" width="${CW}" height="${CH}"></canvas></div>
      <div class="mp-foot">
        <span class="mp-key"><i class="mp-dot mp-me"></i>나</span>
        <span class="mp-key"><i class="mp-dot mp-todo"></i>아직 못 깬 사당</span>
        <span class="mp-key"><i class="mp-dot mp-done"></i>깬 사당</span>
        <span class="mp-close">M — 닫기</span>
      </div>
    </div>`;
  const style = document.createElement('style');
  style.textContent = `
    #mapPage{position:fixed;inset:0;z-index:40;display:none;place-items:center;
      background:rgba(6,10,12,.93);backdrop-filter:blur(3px);
      font-family:system-ui,'Malgun Gothic',sans-serif;color:#dfe9ea}
    #mapPage.show{display:grid}
    .mp-inner{display:flex;flex-direction:column;gap:12px;max-width:min(92vw,860px);width:100%}
    .mp-head{display:flex;align-items:baseline;gap:22px}
    .mp-title{font-size:20px;letter-spacing:.04em;flex:1}
    .mp-stat{display:flex;flex-direction:column;align-items:flex-end;line-height:1.2}
    .mp-stat b{font-size:19px;font-variant-numeric:tabular-nums;color:${'#' + SHRINE.glow.toString(16)}}
    .mp-stat span{font-size:11px;color:#7d8f95}
    .mp-frame{border:1px solid #22333a;border-radius:3px;overflow:hidden;background:#05080a;
      box-shadow:0 18px 50px -24px #000}
    #mp-canvas{display:block;width:100%;height:auto;image-rendering:pixelated}
    .mp-foot{display:flex;align-items:center;gap:18px;font-size:12px;color:#8b9ba1}
    .mp-key{display:flex;align-items:center;gap:6px}
    .mp-dot{width:9px;height:9px;transform:rotate(45deg);display:inline-block}
    .mp-me{background:#ffffff;border-radius:99px;transform:none}
    .mp-todo{background:${'#' + SHRINE.glow.toString(16)}}
    .mp-done{background:${'#' + SHRINE.gold.toString(16)}}
    .mp-close{margin-left:auto}
    @media (max-width:640px){.mp-title{font-size:16px}.mp-foot{gap:10px;font-size:11px}}`;
  document.head.appendChild(style);
  document.body.appendChild(el);

  const view = el.querySelector('#mp-canvas');
  const vctx = view.getContext('2d');
  const elShrine = el.querySelector('#mp-shrine');
  const elExplored = el.querySelector('#mp-explored');
  let open = false;

  const mark = (dir, draw) => {
    const { lat, lon } = latLonOf(dir);
    draw((lon / (Math.PI * 2) + 0.5) * CW, (0.5 - lat / Math.PI) * CH);
  };

  const draw = () => {
    vctx.fillStyle = '#05080a';
    vctx.fillRect(0, 0, CW, CH);
    vctx.drawImage(lit, 0, 0);

    // 위도·경도 눈금 — 아주 옅게. 검은 데가 얼마나 남았는지 가늠하는 자
    vctx.strokeStyle = 'rgba(120,150,160,.10)';
    vctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const x = CW * i / 8;
      vctx.beginPath(); vctx.moveTo(x, 0); vctx.lineTo(x, CH); vctx.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const y = CH * i / 4;
      vctx.beginPath(); vctx.moveTo(0, y); vctx.lineTo(CW, y); vctx.stroke();
    }

    // 사당 — **밝혀진 자리에 있는 것만** 보인다. 안 가 본 사당은 지도에 없다.
    shrines.shrines.forEach((s, i) => {
      if (!isSeenDir(s.dir)) return;
      const done = s.cleared;
      mark(s.dir, (x, y) => {
        vctx.save();
        vctx.translate(x, y); vctx.rotate(Math.PI / 4);
        vctx.fillStyle = done ? '#ffd27a' : '#' + (specs[i % specs.length].theme.glow).toString(16).padStart(6, '0');
        vctx.strokeStyle = 'rgba(0,0,0,.65)'; vctx.lineWidth = 2;
        vctx.strokeRect(-6, -6, 12, 12);
        vctx.fillRect(-6, -6, 12, 12);
        vctx.restore();
      });
    });

    // 나 — 흰 점과 바라보는 방향
    const up = player.position.clone().normalize();
    mark(up, (x, y) => {
      const north = new THREE.Vector3(0, 1, 0);
      const e = new THREE.Vector3().crossVectors(north, up).normalize();
      const n = new THREE.Vector3().crossVectors(up, e).normalize();
      const a = Math.atan2(player.heading.dot(e), player.heading.dot(n));
      vctx.save();
      vctx.translate(x, y); vctx.rotate(a);
      vctx.fillStyle = '#fff';
      vctx.strokeStyle = 'rgba(0,0,0,.7)'; vctx.lineWidth = 2;
      vctx.beginPath();
      vctx.moveTo(0, -9); vctx.lineTo(6, 7); vctx.lineTo(0, 3); vctx.lineTo(-6, 7);
      vctx.closePath(); vctx.stroke(); vctx.fill();
      vctx.restore();
    });

    elShrine.textContent = `${shrines.clearedCount()} / ${shrines.shrines.length}`;
    elExplored.textContent = `${Math.round(seenCount / (GX * GY) * 100)}%`;
  };

  const me = registerOverlay({ get isOpen() { return open; }, close: () => setOpen(false) });
  const setOpen = (v) => {
    if (v) soloOpen(me);            // 전면 화면은 하나만 — overlay.js
    open = v;
    el.classList.toggle('show', v);
    if (v) draw();
  };
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyM') setOpen(!open);
    else if (e.code === 'Escape' && open) setOpen(false);
  });
  el.addEventListener('click', () => setOpen(false));

  reveal(player.position.clone().normalize());
  lastAt.copy(player.position).normalize();

  return {
    // 걸을 때마다가 아니라 STEP_U만큼 움직였을 때만 칠한다.
    // 매 프레임 칠하면 같은 칸을 초당 60번 훑는다.
    update() {
      const up = player.position.clone().normalize();
      if (up.angleTo(lastAt) * R < STEP_U) return;
      lastAt.copy(up);
      reveal(up);
      if (open) draw();
    },
    get isOpen() { return open; },
    setOpen,
    // 검증용
    stats: () => ({ seen: seenCount, total: GX * GY,
      percent: +(seenCount / (GX * GY) * 100).toFixed(1) }),
    isSeenDir,
    reveal,
  };
}
