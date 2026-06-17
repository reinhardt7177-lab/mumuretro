// 빌보드 3D 이모지 — 머리 위로 솟아 스케일-팝 → 홀드 → 페이드. CanvasTexture(에셋 0), 스프라이트 풀링.
import * as THREE from 'three';

const TEX = {};
function emojiTexture(ch) {
  if (TEX[ch]) return TEX[ch];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 128, 128);
  x.font = "92px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  TEX[ch] = t; return t;
}

const easeOut = (t) => 1 - (1 - t) * (1 - t);
const overshoot = (t) => { const s = 1.70158; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };

export class EmojiLayer {
  constructor(scene, max = 28) {
    this.items = [];
    this.pool = [];
    for (let i = 0; i < max; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
      sp.visible = false;
      scene.add(sp);
      this.pool.push(sp);
    }
  }

  spawn(pos, up, ch, opts = {}) {
    const sp = this.pool.find(s => !s.visible);
    if (!sp) return;
    sp.material.map = emojiTexture(ch);
    sp.material.needsUpdate = true;
    sp.visible = true; sp.material.opacity = 0;
    this.items.push({
      sp,
      base: pos.clone().addScaledVector(up, opts.h ?? 1.95),
      up: up.clone(),
      t: 0, life: opts.life ?? 2.4, size: opts.size ?? 1.25,
    });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = it.t / it.life;
      if (k >= 1) { it.sp.visible = false; it.sp.material.opacity = 0; it.sp.material.map = null; this.items.splice(i, 1); continue; }
      const rise = 0.55 * easeOut(Math.min(1, it.t / 0.45));
      it.sp.position.copy(it.base).addScaledVector(it.up, rise);
      const pop = k < 0.2 ? overshoot(k / 0.2) : 1;
      const sc = it.size * (0.8 + 0.2 * pop);
      it.sp.scale.set(sc, sc, sc);
      it.sp.material.opacity = k < 0.12 ? k / 0.12 : (k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1);
    }
  }
}
