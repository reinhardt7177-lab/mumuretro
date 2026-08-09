// 퀘스트 패널 + 전체 지도.
//
// 이 게임은 "안 되는 것"이 많다 — 급경사는 못 오르고, 안개 골짜기는 벽 오르기가 있어야 들어가고,
// 시련소는 5문제 연속을 맞혀야 깨진다. 그런데 지금까지 그걸 아무도 알려주지 않아서
// 아이 입장에서는 맵이 고장난 것처럼 느껴졌다.
//
// 그래서 이 패널의 역할은 하나다: **지금 무엇을 할 수 있고, 무엇이 왜 잠겨 있는가.**
import * as THREE from 'three';
import { ABILITIES } from './Abilities.js';

// ── 투영 ───────────────────────────────────────────────────────────────────
// 구면 → 평면(정거원통도법). 위경도를 그대로 x/y로 편다.
// 극지방이 늘어나지만 구역이 위도 -58~64에만 있어 실제로 왜곡되는 곳엔 아무것도 없다.
// 중앙 경선. 구역 경도를 정렬하면 -128°와 -62° 사이가 66°로 가장 비어 있다 —
// 그 한가운데(-95°)로 이음매를 보내면 어떤 구역도 지도 좌우로 잘리지 않는다.
// 기본값(0°)이면 윤슬 해변(172°)이 양쪽 끝에 반씩 찢어져 붙는다.
const LON0 = 85 * Math.PI / 180;

function wrapLon(lon) {
  let d = lon - LON0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function toMapXY(dir, w, h) {
  const lat = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));      // -π/2..π/2
  const lon = wrapLon(Math.atan2(dir.z, dir.x));                   // -π..π
  return {
    x: (lon / (Math.PI * 2) + 0.5) * w,
    y: (0.5 - lat / Math.PI) * h,
  };
}

// 지형 굽는 격자 크기. 높이장이 매끄러워서 이 해상도로 구운 뒤 2배로 늘려도 뭉개지지 않는다.
// 그대로 표시 해상도로 구우면 heightAt 호출이 4배가 되어 눈에 띄게 멈춘다.
const BAKE_W = 440, BAKE_H = 220;
const LIGHT = { x: -0.6, y: -0.8 };   // 지형 음영 광원(화면 좌상단에서 비춘다)

// 고도 색 램프. 실측 분포에 맞춰 잡았다 —
// 지형의 90%가 -1.14~1.97u 안에 있어서(중앙값 0.25), 진폭을 넉넉히 잡으면
// 전 표면이 램프의 같은 칸에 들어가 지도가 단색으로 눌린다.
const H_LO = -1.5, H_HI = 3.5;
// 등고선 간격(월드 단위). 지형의 90%가 3u 폭 안에 있어 0.5면 대여섯 겹이 나온다.
// 더 촘촘하게 하면 저해상도 격자에서 선끼리 붙어 얼룩이 된다.
const CONTOUR = 0.5;
const LAND_RAMP = [
  [0.00, 0x74, 0x94, 0x60],
  [0.32, 0x8f, 0xac, 0x6b],
  [0.58, 0xb2, 0xc0, 0x7a],
  [0.80, 0xcb, 0xbe, 0x87],
  [1.00, 0xe2, 0xdb, 0xba],
];
function rampAt(t, out) {
  let i = 1;
  while (i < LAND_RAMP.length - 1 && t > LAND_RAMP[i][0]) i++;
  const a = LAND_RAMP[i - 1], b = LAND_RAMP[i];
  const k = (t - a[0]) / (b[0] - a[0]);
  out[0] = a[1] + (b[1] - a[1]) * k;
  out[1] = a[2] + (b[2] - a[2]) * k;
  out[2] = a[3] + (b[3] - a[3]) * k;
}

export class Quest {
  // deps: { planet, player, trials, abilities, learning, story, world, dokkaebiCaught }
  constructor(deps) {
    this.d = deps;
    this.el = document.getElementById('questPanel');
    this.canvas = document.getElementById('mapCanvas');
    this.listEl = document.getElementById('questList');
    this.open = false;
    this._bg = null;      // 구운 지형 이미지(캔버스). 한 번만 만든다.
    this._grid = null;
    this._bakeMs = 0;
    this._worstChunkMs = 0;
    // 게임이 뜬 직후부터 프레임 틈틈이 미리 구워 둔다.
    setTimeout(() => this._startBake(), 1500);
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

  // ── 지형 굽기 ───────────────────────────────────────────────────────────
  // 구역 색만 칠하면 색 얼룩 여덟 개일 뿐 "지도"로 안 읽힌다.
  // 실제 heightAt을 읽어 물·해안·고도·음영을 그리면 그때부터 지형이 보인다.
  //
  // 다만 heightAt은 한 점당 노이즈 7옥타브라 96,800칸을 한 번에 돌면
  // 그 프레임이 통째로 멈춘다(실측 1,604ms). 그래서 높이장은 **프레임에 나눠** 채우고,
  // 그 전에 패널이 열리면 남은 줄만 즉석에서 마저 채운다.
  _startBake() {
    if (this._grid || this._bg) return;
    const W = BAKE_W, H = BAKE_H;
    this._grid = {
      hs: new Float32Array(W * H), reg: new Uint8Array(W * H), edge: new Uint8Array(W * H),
      wat: new Uint8Array(W * H), row: 0, dir: new THREE.Vector3(),
    };
    const tick = () => {
      // 패널을 먼저 열면 _bake()가 남은 줄을 마저 굽고 _grid를 놓아준다.
      // 그때 예약돼 있던 이 콜백이 뒤늦게 깨어나 해제된 격자를 읽는다(실측: TypeError).
      if (this._bg || !this._grid) return;
      const t0 = performance.now();
      // 한 프레임에 6ms만 쓴다. 60fps(16.7ms) 예산 안이라 눈에 띄는 끊김이 없다.
      // 한 줄이 ~6ms라 예산을 6으로 두면 마지막 줄이 12ms까지 넘어간다(실측).
      // 4로 낮추면 최악이 프레임 예산(16.7ms) 안에 확실히 들어온다.
      while (this._grid.row < H && performance.now() - t0 < 4) this._bakeRow(this._grid.row++);
      const dt = performance.now() - t0;
      this._bakeMs += dt;
      this._worstChunkMs = Math.max(this._worstChunkMs, dt);   // 한 번에 얼마나 붙잡았나
      if (this._grid.row < H) setTimeout(tick, 0);
      else this._paint();
    };
    // setTimeout(0)은 rAF와 달리 탭이 화면에 없어도 계속 돈다.
    // 배경 작업이라 프레임 정렬이 필요 없고, 안 보이는 동안 멈추면 나중에 열 때
    // 결국 열리는 순간 한 번에 굽게 되어 정확히 피하려던 멈칫이 되돌아온다.
    setTimeout(tick, 0);
  }

  _bakeRow(py) {
    const { planet, world } = this.d;
    const W = BAKE_W, H = BAKE_H;
    const { hs, reg, edge, wat, dir } = this._grid;
    const anchors = world.anchors;
    const lat = (0.5 - (py + 0.5) / H) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let px = 0; px < W; px++) {
      const lon = ((px + 0.5) / W - 0.5) * Math.PI * 2 + LON0;
      dir.set(cl * Math.cos(lon), sl, cl * Math.sin(lon));
      // 최근접 구역은 angleTo(acos) 대신 내적 최대로 고른다. 단조 관계라 결과는 같고 훨씬 싸다.
      let b0 = -2, b1 = -2, bi = 0;
      for (let a = 0; a < anchors.length; a++) {
        const ad = anchors[a].dir;
        const d = dir.x * ad.x + dir.y * ad.y + dir.z * ad.z;
        if (d > b0) { b1 = b0; b0 = d; bi = a; } else if (d > b1) { b1 = d; }
      }
      const i = py * W + px;
      const h = planet.heightAt(dir);
      hs[i] = h;
      reg[i] = bi;
      // 물 판정은 여기서 한 번만. 색칠 단계에서 다시 하면 해안선·등고선이
      // 판정을 세 번 반복하게 된다. 표면의 36%가 h<0이라 높이만으로는 물을 가릴 수 없어
      // 반드시 물 영역과 함께 본다.
      let iw = 0;
      if (h < 0) {
        for (const wz of planet.waterZones) {
          const k = dir.x * wz.center.x + dir.y * wz.center.y + dir.z * wz.center.z;
          if (k > Math.cos(wz.ang * 1.45)) { iw = 1; break; }
        }
      }
      wat[i] = iw;
      // 임계값이 크면 저위도에서 띠가 수십 픽셀로 벌어져 경계선이 아니라
      // 커다란 원 얼룩으로 보인다(실측: 0.006에서 그랬다). 한 줄로 보일 만큼만.
      edge[i] = (b0 - b1) < 0.0016 ? 1 : 0;
    }
  }

  // 패널을 여는 순간 호출된다. 배경 굽기가 아직이면 남은 줄을 여기서 마저 채운다.
  _bake() {
    if (this._bg) return this._bg;
    this._startBake();
    const t0 = performance.now();
    while (this._grid.row < BAKE_H) this._bakeRow(this._grid.row++);
    this._bakeMs += performance.now() - t0;
    return this._paint();
  }

  // 높이장 → 색. 노이즈 호출이 없어 한 프레임에 끝내도 안전하다.
  _paint() {
    if (this._bg) return this._bg;
    const t0 = performance.now();
    const { planet, world } = this.d;
    const W = BAKE_W, H = BAKE_H;
    const { hs, reg, edge, wat, dir } = this._grid;
    const anchors = world.anchors;

    // 2단계 — 높이장을 먼저 다듬는다.
    // 지형이 잔노이즈라 원본 그대로 등고선을 뽑으면 거의 모든 칸이 층 경계가 되어
    // 선이 아니라 얼룩이 된다(실측: 0.5u 간격에서 그랬다). 실제 지형도도 원측량값이 아니라
    // 일반화(generalize)한 표고를 쓴다. 3x3 상자흐림 2번이면 큰 기복만 남는다.
    const hsm = new Float32Array(hs);
    {
      let src = hsm, dst = new Float32Array(W * H);
      for (let pass = 0; pass < 2; pass++) {
        for (let py = 0; py < H; py++) {
          const y0 = Math.max(0, py - 1) * W, y1 = py * W, y2 = Math.min(H - 1, py + 1) * W;
          for (let px = 0; px < W; px++) {
            const xl = (px + W - 1) % W, xr = (px + 1) % W;
            dst[y1 + px] = (src[y0 + xl] + src[y0 + px] + src[y0 + xr] +
                            src[y1 + xl] + src[y1 + px] + src[y1 + xr] +
                            src[y2 + xl] + src[y2 + px] + src[y2 + xr]) / 9;
          }
        }
        const t = src; src = dst; dst = t;
      }
      if (src !== hsm) hsm.set(src);
    }

    // 3단계 — 기울기를 구하고 그 세기를 실측해서 음영 배율을 자동으로 맞춘다.
    // 상수를 눈대중으로 박으면 지형 진폭이 바뀔 때마다 지도가 다시 평평해진다.
    const gxs = new Float32Array(W * H), gys = new Float32Array(W * H);
    let g2 = 0;
    for (let py = 0; py < H; py++) {
      const cl = Math.max(0.25, Math.cos((0.5 - (py + 0.5) / H) * Math.PI));
      for (let px = 0; px < W; px++) {
        const i = py * W + px;
        const xr = hsm[py * W + (px + 1) % W], xl = hsm[py * W + (px + W - 1) % W];
        const yd = hsm[Math.min(H - 1, py + 1) * W + px], yu = hsm[Math.max(0, py - 1) * W + px];
        // 고위도는 경도 한 칸의 실제 거리가 짧아 기울기가 과장된다 → cos(lat)으로 되돌린다
        const gx = (xr - xl) * 0.5 * cl, gy = (yd - yu) * 0.5;
        gxs[i] = gx; gys[i] = gy;
        g2 += gx * gx + gy * gy;
      }
    }
    const rms = Math.sqrt(g2 / (W * H)) || 1;
    // 등고선이 기복을 설명하므로 음영은 살짝 낮춘다. 둘 다 세게 주면 지저분해진다.
    const shadeK = 0.32 / (rms * 2.5);        // ±2.5σ 기울기가 ±0.32 명암이 되도록

    // 4단계 — 색칠. 음영은 이미 구한 격자에서 뽑으므로 heightAt 추가 호출 0.
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const ox = off.getContext('2d');
    const img = ox.createImageData(W, H);
    const mistDir = planet.mistDir;
    const cosMist = Math.cos(0.215);          // MIST_ZONE.outer — 바깥 사면까지
    const ramp = [0, 0, 0];
    for (let py = 0; py < H; py++) {
      const lat = (0.5 - (py + 0.5) / H) * Math.PI;
      const cl = Math.cos(lat), sl = Math.sin(lat);
      for (let px = 0; px < W; px++) {
        const i = py * W + px, h = hs[i];
        const shade = THREE.MathUtils.clamp(
          1 + (gxs[i] * LIGHT.x + gys[i] * LIGHT.y) * shadeK, 0.60, 1.34);

        let r, g, b;
        const lon = ((px + 0.5) / W - 0.5) * Math.PI * 2 + LON0;
        dir.set(cl * Math.cos(lon), sl, cl * Math.sin(lon));

        const inWater = wat[i] === 1;
        if (inWater) {
          const dep = THREE.MathUtils.clamp(-h / 1.1, 0, 1);       // 0 얕음 → 1 깊음
          r = 127 - dep * 56; g = 195 - dep * 61; b = 212 - dep * 44;
        } else {
          // 바탕은 **고도 램프**다. 구역 색을 그대로 깔면 채도 높은 색 조각 여덟 개가 되고
          // 지형이 전부 묻힌다. 구역은 색으로 30%만 거들고 이름표가 책임진다.
          rampAt(THREE.MathUtils.clamp((hsm[i] - H_LO) / (H_HI - H_LO), 0, 1), ramp);
          const c = anchors[reg[i]].color, M = 0.30;
          r = ramp[0] * (1 - M) + c.r * 255 * M;
          g = ramp[1] * (1 - M) + c.g * 255 * M;
          b = ramp[2] * (1 - M) + c.b * 255 * M;
          // 물가 모래 — 수면 바로 위 띠. 해안선이 초록에서 뚝 끊기지 않게 한다.
          if (h < 0.8) {
            let nearW = false;
            for (const wz of planet.waterZones) {
              const kk = dir.x * wz.center.x + dir.y * wz.center.y + dir.z * wz.center.z;
              if (kk > Math.cos(wz.ang * 1.6)) { nearW = true; break; }
            }
            if (nearW) {
              const s = (1 - THREE.MathUtils.clamp(h / 0.8, 0, 1)) * 0.8;
              r += (232 - r) * s; g += (216 - g) * s; b += (168 - b) * s;
            }
          }
        }
        // 안개 골짜기 — 채도를 빼고 푸르스름하게. "저긴 다른 곳"이 색으로 읽힌다.
        const km = dir.x * mistDir.x + dir.y * mistDir.y + dir.z * mistDir.z;
        if (km > cosMist) {
          const m = THREE.MathUtils.clamp((km - cosMist) / (1 - cosMist), 0, 1) * 0.8;
          const lum = (r + g + b) / 3;
          r += (lum * 0.88 - r) * m; g += (lum * 0.90 - g) * m; b += (lum * 1.06 - b) * m;
        }
        let k2 = shade;
        if (edge[i]) k2 *= 0.90;                                   // 구역 경계 한 줄
        r *= k2; g *= k2; b *= k2;

        // ── 등고선 ────────────────────────────────────────────────────────
        // 지도를 '지도'로 만드는 건 결국 이 선이다. 높이를 CONTOUR 간격으로 층을 나누고
        // 오른쪽/아래 칸과 층이 다르면 그 픽셀에 선을 얹는다(마칭스퀘어까지 갈 필요 없다).
        // 완만한 곳은 성기고 비탈은 촘촘해져서 경사가 선 밀도로 읽힌다.
        if (!inWater) {
          const bd = Math.floor((hsm[i] - H_LO) / CONTOUR);
          const rx = px + 1 < W ? px + 1 : 0;
          const dy = py + 1 < H ? py + 1 : py;
          const b1 = Math.floor((hsm[py * W + rx] - H_LO) / CONTOUR);
          const b2 = Math.floor((hsm[dy * W + px] - H_LO) / CONTOUR);
          if (bd !== b1 || bd !== b2) {
            // 5칸마다 굵은 계곡선 — 실제 지형도의 관례다. 층 번호로 판별한다.
            const major = bd % 5 === 0;
            const a = major ? 0.30 : 0.15;
            r *= 1 - a; g *= 1 - a * 0.94; b *= 1 - a * 0.78;      // 갈색 쪽으로 어둡게
          }
        }

        // ── 해안선 ────────────────────────────────────────────────────────
        // 물과 뭍이 만나는 칸에 진한 선. 모래 그라데이션만 있으면 경계가 흐려서
        // 물이 '얼룩'처럼 보인다. 선 하나로 호수가 호수로 읽힌다.
        {
          const rx = px + 1 < W ? px + 1 : 0;
          const dy = py + 1 < H ? py + 1 : py;
          if (wat[i] !== wat[py * W + rx] || wat[i] !== wat[dy * W + px]) {
            r = r * 0.34 + 28 * 0.66; g = g * 0.34 + 76 * 0.66; b = b * 0.34 + 104 * 0.66;
          }
        }

        const o = i * 4;
        img.data[o] = Math.min(255, r);
        img.data[o + 1] = Math.min(255, g);
        img.data[o + 2] = Math.min(255, b);
        img.data[o + 3] = 255;
      }
    }
    ox.putImageData(img, 0, 0);
    this._bg = off;
    this._grid = null;                        // 높이장은 색으로 옮겼으니 놓아준다(~1.2MB)
    this._paintMs = +(performance.now() - t0).toFixed(1);   // 흐림+색칠은 한 프레임에 끝난다
    this._bakeMs = +(this._bakeMs + performance.now() - t0).toFixed(0);
    return off;
  }

  // ── 전체 지도 ───────────────────────────────────────────────────────────
  renderMap() {
    const cv = this.canvas; if (!cv) return;
    const { planet, player, trials, world, abilities } = this.d;
    const w = cv.width, h = cv.height;
    const x = cv.getContext('2d');
    const S = w / 440;                                   // 표시 배율(레티나 대응)

    x.clearRect(0, 0, w, h);
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    x.drawImage(this._bake(), 0, 0, w, h);

    // ── 경위선 ─────────────────────────────────────────────────────────────
    // 30° 간격. 지도가 '어디쯤'을 말해 주려면 눈금이 있어야 한다.
    // 적도와 중앙 경선만 한 단계 진하게 — 나머지는 배경으로 물러나야 지형을 안 가린다.
    x.lineWidth = 1;
    for (let lat = -60; lat <= 60; lat += 30) {
      const gy = (0.5 - lat / 180) * h;
      x.strokeStyle = lat === 0 ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.10)';
      x.beginPath(); x.moveTo(0, gy); x.lineTo(w, gy); x.stroke();
    }
    for (let k = -5; k <= 5; k++) {
      const gx = (k / 12 + 0.5) * w;
      x.strokeStyle = k === 0 ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.10)';
      x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, h); x.stroke();
    }

    // ── 길 ─────────────────────────────────────────────────────────────────
    // 지형만 있으면 "어디로 갈 수 있는지"가 안 보인다.
    // 밝은 테두리를 깔고 그 위에 갈색 심 — 한 겹만 그리면 지형에 묻힌다.
    const road = world.roads && world.roads.centerline;
    if (road && road.length) {
      x.lineCap = 'round';
      for (const pass of [{ c: 'rgba(255,250,238,.30)', wd: 3.4 }, { c: 'rgba(126,96,60,.55)', wd: 1.7 }]) {
        x.strokeStyle = pass.c; x.lineWidth = pass.wd * S;
        let prev = null;
        for (const p of road) {
          const q = toMapXY(p.clone ? p.clone().normalize() : p, w, h);
          // 경도 이음매를 건너뛴다 — 안 그러면 지도를 가로지르는 줄이 생긴다
          if (prev && Math.abs(q.x - prev.x) < w * 0.4) {
            x.beginPath(); x.moveTo(prev.x, prev.y); x.lineTo(q.x, q.y); x.stroke();
          }
          prev = q;
        }
      }
    }

    // ── 물 이름 ────────────────────────────────────────────────────────────
    // 지도 관례대로 물 위에 기울임체 파랑. 넣는 순간 물이 '얼룩'에서 '호수'가 된다.
    const WATER_NAME = { beach: '윤슬 바다', lake: '연꽃 호수' };
    const waterRects = [];
    for (const wz of planet.waterZones) {
      const q = toMapXY(wz.center, w, h);
      const rpx = wz.ang / Math.PI * h;                 // 지도상 물 반경
      waterRects.push({ x: q.x - rpx, y: q.y - rpx, w: rpx * 2, h: rpx * 2 });
      const name = WATER_NAME[wz.id]; if (!name) continue;
      x.font = `italic ${Math.round(10 * S)}px system-ui, sans-serif`;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = 3 * S; x.strokeStyle = 'rgba(226,244,250,.75)';
      x.strokeText(name, q.x, q.y);
      x.fillStyle = 'rgba(20,74,104,.95)';
      x.fillText(name, q.x, q.y);
    }

    // ── 이름표 배치 ────────────────────────────────────────────────────────
    // 마커 아래 고정으로 두면 서로 겹치고, 물 위 구역에서는 호수를 통째로 덮는다
    // (실측: 연꽃 호수가 마커+이름표에 완전히 가려져 파란 점 하나 안 보였다).
    // 후보 자리를 네 방향으로 두고 이미 놓인 것들과 겹침이 가장 적은 곳을 고른다.
    const taken = waterRects.slice();      // 물 이름 영역도 피할 대상
    const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
                              Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const label = (cx, cy, text, opts = {}) => {
      x.font = `${opts.bold ? 'bold ' : ''}${Math.round(11 * S)}px system-ui, sans-serif`;
      const pw = x.measureText(text).width + 10 * S, ph = 16 * S;
      const g = 13 * S;                                  // 마커에서 띄우는 간격
      const cands = [
        { x: cx - pw / 2, y: cy + g },                   // 아래(기본)
        { x: cx - pw / 2, y: cy - g - ph },              // 위
        { x: cx + g, y: cy - ph / 2 },                   // 오른쪽
        { x: cx - g - pw, y: cy - ph / 2 },              // 왼쪽
      ];
      let best = null, bestCost = Infinity;
      cands.forEach((c, idx) => {
        const r = {
          x: THREE.MathUtils.clamp(c.x, 2, w - pw - 2),
          y: THREE.MathUtils.clamp(c.y, 2, h - ph - 2), w: pw, h: ph,
        };
        let cost = idx * 40;                             // 앞쪽 후보를 선호(순서가 곧 우선순위)
        for (const q of taken) cost += overlap(r, q);
        cost += Math.abs(r.x - c.x) * 6;                 // 가장자리에서 밀려난 만큼 벌점
        if (cost < bestCost) { bestCost = cost; best = r; }
      });
      taken.push(best);
      x.fillStyle = opts.bg || 'rgba(18,32,42,.74)';
      x.beginPath(); x.roundRect(best.x, best.y, pw, ph, 8 * S); x.fill();
      x.fillStyle = opts.fg || '#fff';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(text, best.x + pw / 2, best.y + ph / 2 + 0.5);
    };

    // ── 구역 마커 ──────────────────────────────────────────────────────────
    // 구역 하나에 시련소 하나라 마커도 하나면 충분하다.
    // 마커를 전부 먼저 찍고 이름표를 나중에 얹어야, 이름표가 남의 마커를 덮지 않는다.
    const marks = trials.towers.map(t => {
      const p = toMapXY(t.dir, w, h);
      taken.push({ x: p.x - 10 * S, y: p.y - 10 * S, w: 20 * S, h: 20 * S });   // 마커도 피할 대상
      return { t, p };
    });
    for (const { t, p } of marks) {
      const done = abilities.cleared.has(t.regionId);
      const locked = t.regionId === 'mist' && !abilities.has('wallClimb');
      // 흰 테두리 원을 깔지 않으면 이모지가 지형 위에서 묻힌다.
      x.beginPath(); x.arc(p.x, p.y, 9.5 * S, 0, Math.PI * 2);
      x.fillStyle = done ? 'rgba(143,208,143,.96)'
        : locked ? 'rgba(122,122,136,.94)' : 'rgba(255,255,255,.95)';
      x.fill();
      x.lineWidth = 1.6 * S; x.strokeStyle = 'rgba(20,36,46,.6)'; x.stroke();
      x.font = `${Math.round(12 * S)}px system-ui, sans-serif`;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(done ? '✅' : locked ? '🔒' : t.emoji, p.x, p.y + 0.5);
    }
    for (const { t, p } of marks) label(p.x, p.y, t.name, { bold: abilities.cleared.has(t.regionId) });

    // ── 플레이어 ───────────────────────────────────────────────────────────
    const up = player.position.clone().normalize();
    const pp = toMapXY(up, w, h);
    // 진행 방향 삼각형 — 점만 찍으면 어느 쪽을 보고 있는지 알 수 없다.
    // heading을 지도 좌표계의 동/북 성분으로 분해해 화면 각도를 만든다.
    const north = new THREE.Vector3(0, 1, 0).addScaledVector(up, -up.y).normalize();
    const east = new THREE.Vector3().crossVectors(north, up).normalize();
    const ang = Math.atan2(player.heading.dot(east), player.heading.dot(north));
    x.save();
    x.translate(pp.x, pp.y);
    x.rotate(ang);                                        // 화면 위쪽이 북쪽
    x.beginPath();
    x.moveTo(0, -11 * S); x.lineTo(6.5 * S, 5 * S); x.lineTo(0, 2 * S); x.lineTo(-6.5 * S, 5 * S);
    x.closePath();
    x.fillStyle = '#ff5a4a'; x.fill();
    x.lineWidth = 2 * S; x.strokeStyle = '#fff'; x.stroke();
    x.restore();
    label(pp.x, pp.y, '나', { bg: 'rgba(255,90,74,.94)', bold: true });

    // ── 방위 + 축척 ────────────────────────────────────────────────────────
    // 지도가 지도로 보이려면 이 둘이 있어야 한다. 축척은 눈대중이 아니라
    // 세로 1픽셀 = R·π/h 월드단위로 실제 환산한 값이다.
    const uPerPx = planet.R * Math.PI / h;
    let barU = 50, barPx = barU / uPerPx;                 // 50u가 화면에서 몇 픽셀인가
    while (barPx > w * 0.22) { barU /= 2; barPx = barU / uPerPx; }
    const bx = w - barPx - 12 * S, by = h - 14 * S;
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 2 * S;
    x.beginPath();
    x.moveTo(bx, by - 4 * S); x.lineTo(bx, by); x.lineTo(bx + barPx, by); x.lineTo(bx + barPx, by - 4 * S);
    x.stroke();
    x.font = `${Math.round(9 * S)}px system-ui, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'bottom';
    x.lineWidth = 3 * S; x.strokeStyle = 'rgba(16,30,40,.8)';
    x.strokeText(`${Math.round(barU)} 걸음`, bx + barPx / 2, by - 5 * S);
    x.fillStyle = '#fff'; x.fillText(`${Math.round(barU)} 걸음`, bx + barPx / 2, by - 5 * S);
    // 방위 — 정거원통도법에서는 언제나 위쪽이 북쪽이다
    x.beginPath();
    x.moveTo(14 * S, 27 * S); x.lineTo(14 * S, 9 * S);
    x.moveTo(10 * S, 14 * S); x.lineTo(14 * S, 9 * S); x.lineTo(18 * S, 14 * S);
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 1.6 * S; x.stroke();
    x.font = `bold ${Math.round(11 * S)}px system-ui, sans-serif`;
    x.textBaseline = 'middle';
    x.lineWidth = 3 * S; x.strokeStyle = 'rgba(16,30,40,.8)';
    x.strokeText('N', 14 * S, 35 * S); x.fillStyle = '#fff'; x.fillText('N', 14 * S, 35 * S);
  }
}
