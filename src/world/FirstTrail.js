import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { FIRST_TRAIL, TRAIL_TEXT, TRAIL_COLORS as C } from '../data/expedition.js';

// 산포보다 먼저 계획한다. 길은 지면을 따르고 충돌 바닥을 따로 만들지 않는다.
export function planFirstTrail(planet) {
  const dir = ll => planet.latLonToPos(...ll).normalize();
  const routes = ['ridge', 'descent', 'meadow'].map(key => ({ key, dirs: FIRST_TRAIL[key].map(dir) }));
  const samples = routes.flatMap(route => route.dirs.slice(1).flatMap((b, i) => {
    const a = route.dirs[i], n = Math.ceil(a.angleTo(b) * planet.R / 1.4);
    return Array.from({ length: n + 1 }, (_, j) => a.clone().lerp(b, j / n).normalize());
  }));
  const overlook = dir(FIRST_TRAIL.overlook), waterway = dir(FIRST_TRAIL.waterway);
  // dot 판정으로 16만 산포 후보마다 acos를 반복하지 않는다.
  const pathCos = Math.cos(2.6 / planet.R), overlookCos = Math.cos(6 / planet.R), waterCos = Math.cos(16 / planet.R);
  return { routes, samples, overlook, waterway,
    excludes(d) { return d.dot(overlook) > overlookCos || d.dot(waterway) > waterCos || samples.some(p => d.dot(p) > pathCos); },
    pathAt(d) {
      let dot = -1;
      for (const p of samples) dot = Math.max(dot, d.dot(p));
      if (dot < Math.cos(2.4 / planet.R)) return 0;
      const distance = Math.acos(Math.min(1, dot)) * planet.R;
      const t = THREE.MathUtils.clamp((distance - 1.0) / 1.4, 0, 1);
      return 1 - t * t * (3 - 2 * t);
    },
  };
}

export function buildFirstTrail(scene, planet, plan, carpet, waterway) {
  const liftAt = d => carpet.liftAt(d) + 0.035;
  const surface = (d, lift = 0) => planet.surfaceAt(d).addScaledVector(d, liftAt(d) + lift);
  const group = new THREE.Group(); scene.add(group);
  // 길은 Planet/GrassCarpet의 같은 마스크로 칠한다. 겹친 바닥 메시가 지면을 뚫지 않는다.

  const stone = toon(C.stone), brass = toon(C.brass), wood = toon(C.wood), cloth = toon(C.cloth);
  const at = (d, parent = group) => {
    const fr = planet.frameAt(surface(d), 0), g = new THREE.Group();
    g.position.copy(fr.position); g.quaternion.copy(fr.quaternion); parent.add(g); return g;
  };
  const add = (g, geometry, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh;
  };
  // 능선의 작은 관측대. 높은 바닥 없이 장비와 바람자루가 실루엣을 만든다.
  const camp = at(plan.overlook);
  const equipment = new THREE.Group(); camp.add(equipment);
  add(equipment, new THREE.BoxGeometry(1.4, 0.13, 0.7), wood, 0, 0.45, 0);
  for (const x of [-0.52, 0.52]) add(equipment, new THREE.CylinderGeometry(0.04, 0.07, 0.5, 5), brass, x, 0.25, 0);
  const folded = add(equipment, new THREE.ConeGeometry(0.48, 1.22, 4), cloth, 0, 0.76, 0);
  folded.rotation.z = Math.PI / 2; folded.scale.z = 0.3;
  const flagDir = plan.overlook.clone().addScaledVector(new THREE.Vector3().crossVectors(plan.overlook, plan.waterway).normalize(), 2.4 / planet.R).normalize();
  const mast = at(flagDir);
  add(mast, new THREE.CylinderGeometry(0.035, 0.09, 4.1, 7), wood, 0, 2.05, 0);
  const flag = add(mast, new THREE.ConeGeometry(0.26, 1.5, 8, 1, true), cloth, 0.65, 3.8, 0);
  flag.rotation.z = -Math.PI / 2;
  // 낮은 돌 조각 몇 개만 길 가장자리에 둔다. 표지판과 화살표는 필요 없다.
  plan.samples.filter((_, i) => i % 7 === 0).forEach((d, i) => {
    const side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
    const edge = d.clone().addScaledVector(side, (i % 2 ? 1 : -1) * 1.35 / planet.R).normalize();
    const g = at(edge); const m = add(g, new THREE.DodecahedronGeometry(0.22, 0), stone, 0, 0.09, 0);
    m.scale.set(1.4, 0.55, 0.9); m.rotation.y = i * 1.7;
  });

  // 기존 물 사당의 두 번째 입구. 기존 월드 사당과 저장 ID는 그대로다.
  const gateDir = waterway.localToWorld(0, 9).normalize();
  const gate = at(gateDir);
  for (const x of [-1.75, 1.75]) add(gate, new THREE.BoxGeometry(0.46, 3.8, 0.66), stone, x, 1.9, 0);
  add(gate, new THREE.BoxGeometry(4.1, 0.5, 0.9), stone, 0, 3.8, 0);
  const gateMat = new THREE.MeshBasicMaterial({ color: C.gate, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
  gateMat.userData.outlineParameters = { visible: false };
  const ring = add(gate, new THREE.TorusGeometry(1.3, 0.055, 6, 36), brass, 0, 1.95, 0);
  const light = add(gate, new THREE.CircleGeometry(1.25, 36), gateMat, 0, 1.95, 0);
  light.castShadow = false;
  const state = { version: 1, overlook: false, glider: false, water: false, restored: false };
  let t = 0;
  const near = (position, d, radius) => position.clone().normalize().dot(d) > Math.cos(radius / planet.R);
  function sync() { equipment.visible = !state.glider; gateMat.opacity = state.restored ? 0.24 : 0.035; }
  return {
    group, plan, gateDir, equipment,
    update(dt, player) {
      t += dt; flag.rotation.y = Math.sin(t * 1.8) * 0.12; ring.rotation.z = state.restored ? t * 0.13 : 0;
      let message = null;
      if (!state.overlook && near(player.position, plan.overlook, 4.5)) { state.overlook = true; message = TRAIL_TEXT.found; }
      if (!state.water && waterway.discovered) { state.water = true; message = TRAIL_TEXT.water; }
      if (!state.restored && waterway.solved) { state.restored = true; message = TRAIL_TEXT.restored; }
      sync(); return message;
    },
    getPrompt(position) {
      if (!state.glider && near(position, plan.overlook, 2.1)) return 'E — 접이식 활공막 챙기기';
      if (near(position, gateDir, 2.6)) return state.restored ? 'E — 물의 사당에 들어가기' : '멈춘 물레와 이어진 문이다';
      return null;
    },
    interact(position) {
      if (!state.glider && near(position, plan.overlook, 2.1)) { state.glider = true; state.overlook = true; sync(); return { kind: 'glider', message: TRAIL_TEXT.equipped }; }
      if (state.restored && near(position, gateDir, 2.6)) return { kind: 'water-shrine' };
      return null;
    },
    exportState() { return { ...state }; },
    importState(s) {
      if (!s || s.version !== 1 || ['overlook', 'glider', 'water', 'restored'].some(k => typeof s[k] !== 'boolean')) return false;
      Object.assign(state, s); state.restored = waterway.solved; state.water ||= waterway.discovered;
      state.overlook ||= state.glider; sync(); return true;
    },
    get glider() { return state.glider; },
    get records() { return Object.entries(TRAIL_TEXT).flatMap(([key, text]) => {
      const has = ({ found: state.overlook, equipped: state.glider, water: state.water, restored: state.restored })[key];
      return has ? [{ key: 'trail-' + key, text: key === 'restored' ? `${text} ${waterway.record}` : text }] : [];
    }); },
    get landmarks() { return [
      ...(state.overlook ? [{ dir: plan.overlook, label: '바람고개', done: state.glider }] : []),
      ...(state.water ? [{ dir: plan.waterway, label: '물길 유적', done: state.restored }] : []),
    ]; },
  };
}
