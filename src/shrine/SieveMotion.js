import * as THREE from 'three';
import { SIEVE_COURT as D, SIEVE_MOTION as M } from '../data/sieveCourt.js';

const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;

// 판정에 쓰는 체·알갱이는 건드리지 않는다. 같은 지오메트리·재질로 짧게 재생한다.
export function buildSieveMotion(g, parent) {
  const root = new THREE.Group(); root.name = '체질 과정'; root.visible = false; parent.add(root);
  const sieves = g.sieves.map(s => { const copy = s.grp.clone(true); root.add(copy); return copy; });
  const grains = g.grainMesh.map(gm => {
    const mesh = new THREE.Mesh(gm.mesh.geometry, gm.mesh.material); mesh.receiveShadow = true; root.add(mesh);
    return { ...gm, mesh };
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let run = null;
  const finish = () => {
    root.visible = false; run = null;
    g.above.visible = g.below.visible = true;
    g.sieves.forEach(s => { s.grp.visible = true; });
  };
  const paint = () => {
    if (!run) return;
    const { sieve, mix, t } = run, f = g.frame, tray = g.tray;
    const shake = t < M.shakeDuration ? Math.sin(t * Math.PI * 2 * M.shakeHz)
      * M.shakeAmplitude * Math.sin(Math.PI * t / M.shakeDuration) : 0;
    const selected = sieves[g.sieves.indexOf(sieve)];
    selected.position.set(f.x + shake, D.tableY, f.z); selected.rotation.set(0, 0, 0);
    const pitch = sieve.aperture + D.bar;
    for (const grain of grains) {
      const { gi, k, size, mesh } = grain;
      mesh.visible = mix.has(gi);
      if (!mesh.visible) continue;
      const x = (k % 3 - 1) * .57 + gi * .08, z = (Math.floor(k / 3) - 1) * .57;
      const startY = D.tableY + .04 + size / 2 + gi * .055;
      if (g.grainTypes[gi].mm > sieve.spec.mm) {
        mesh.position.set(f.x + x + shake, startY, f.z + z); continue;
      }
      // 실제 살 사이 중앙으로 굴린다. 경사받이가 있는 앞쪽 구멍만 사용한다.
      let hx = 0, hz = 0, nearest = Infinity;
      for (let ix = -12; ix <= 12; ix++) for (let iz = 0; iz <= 12; iz++) {
        const px = ix * pitch, pz = iz * pitch;
        if (Math.hypot(px, pz) + size * .6 > D.meshRadius) continue;
        const d = (x - px) ** 2 + (z - pz) ** 2;
        if (d < nearest) { nearest = d; hx = px; hz = pz; }
      }
      const delay = k / 8 * M.stagger;
      const u = clamp((t / M.duration - delay) / (1 - delay));
      const rise = D.tableY - .18 - (D.trayY + .04);
      const chuteY = D.tableY - .18 - (hz + .175) / 2.45 * rise + .04 + size / 2;
      const endX = tray.x + x, endY = D.trayY + size / 2;
      const endZ = tray.z + (Math.floor(k / 3) - 1) * D.traySpread + D.trayForward;
      if (u < M.alignEnd) {
        const v = ease(u / M.alignEnd);
        mesh.position.set(f.x + lerp(x, hx, v) + shake, startY, f.z + lerp(z, hz, v));
      } else if (u < M.fallEnd) {
        const v = clamp((u - M.alignEnd) / (M.fallEnd - M.alignEnd));
        mesh.position.set(f.x + hx + shake, lerp(startY, chuteY, v * v), f.z + hz);
      } else {
        const v = ease((u - M.fallEnd) / (M.slideEnd - M.fallEnd));
        mesh.position.set(lerp(f.x + hx, endX, v), lerp(chuteY, endY, v), lerp(f.z + hz, endZ, v));
      }
    }
  };
  return {
    root, grains,
    get active() { return !!run; },
    get elapsed() { return run?.t ?? 0; },
    cancel: finish,
    play(sieve, mix) {
      finish();
      if (reduced.matches) return;
      run = { sieve, mix: new Set(mix), t: 0 };
      root.visible = true; g.above.visible = g.below.visible = false; sieve.grp.visible = false;
      sieves.forEach((s, i) => { s.visible = g.sieves[i] === sieve; });
      paint();
    },
    update(dt) {
      if (!run) return;
      if (reduced.matches) { finish(); return; }
      run.t += Math.max(0, dt);
      if (run.t >= M.duration) finish(); else paint();
    },
  };
}
