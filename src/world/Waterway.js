// 곡면 위의 야외 얼음 수로. 두 장치가 동일한 열 모형에 에너지를 전달한다.
// 실제 해법은 온열기를 가까이 옮기는 일과 반사광을 흡수판에 조준하는 일이다.
// root의 게임 루프가 읽기 화면 동안 update를 멈춘다. 업데이트에 벽시계를 쓰지 않는다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { IceThermal, proximityHeat } from '../core/Thermal.js';
import { WATERWAY as C, WATERWAY_COLORS as P, WATERWAY_TEXT as TEXT } from '../data/waterway.js';

const UP = new THREE.Vector3(0, 1, 0);
const FRONT = new THREE.Vector3(0, 0, 1);
const finite = (n) => Number.isFinite(n);
const wrapAngle = (degrees) => ((degrees % 360) + 360) % 360;
const basic = (color, opacity = 1) => {
  const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity,
    depthWrite: opacity >= 1, side: THREE.DoubleSide });
  m.userData.outlineParameters = { visible: false }; return m;
};

export function buildWaterway(scene, planet, dir, opts = {}) {
  const focusDir = dir.clone().normalize(), group = new THREE.Group();
  group.name = 'thawing-waterway'; scene.add(group);
  const initialFrame = planet.frameAt(planet.surfaceAt(focusDir));
  let east = new THREE.Vector3(1, 0, 0).applyQuaternion(initialFrame.quaternion);
  let south = FRONT.clone().applyQuaternion(initialFrame.quaternion);
  // +Z를 낮은 쪽으로 돌린다. 바닥을 수평으로 덮지 않고 모든 조각이 지형을 따른다.
  const h = (x, z) => planet.heightAt(focusDir.clone().addScaledVector(east, x / planet.R)
    .addScaledVector(south, z / planet.R).normalize());
  const gx = h(2, 0) - h(-2, 0), gz = h(0, 2) - h(0, -2);
  if (Math.hypot(gx, gz) > 0.001) {
    south = east.clone().multiplyScalar(-gx).addScaledVector(south, -gz).normalize();
    east = new THREE.Vector3().crossVectors(focusDir, south).normalize();
  }
  const liftAt = opts.liftAt || (opts.carpet?.liftAt ? d => opts.carpet.liftAt(d) : () => 0.17);
  const dirAt = (x, z) => focusDir.clone().addScaledVector(east, x / planet.R)
    .addScaledVector(south, z / planet.R).normalize();
  const localToWorld = (x, z, lift = 0) => {
    const d = dirAt(x, z); return planet.surfaceAt(d).addScaledVector(d, liftAt(d) + lift);
  };
  const localOf = (position) => {
    const d = position.clone().normalize(), facing = d.dot(focusDir);
    if (facing <= 0) return { x: Infinity, z: Infinity };
    return { x: d.dot(east) / facing * planet.R, z: d.dot(south) / facing * planet.R };
  };
  const frameAt = (x, z) => {
    const d = dirAt(x, z), zAxis = south.clone().addScaledVector(d, -south.dot(d)).normalize();
    const xAxis = new THREE.Vector3().crossVectors(d, zAxis).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, d, zAxis));
  };
  const anchor = (x, z, lift = 0) => {
    const a = new THREE.Group(); a.position.copy(localToWorld(x, z, lift));
    a.userData.waterwayAnchor = { x, z, lift };
    a.quaternion.copy(frameAt(x, z)); group.add(a); return a;
  };
  const mesh = (parent, geometry, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z);
    m.castShadow = !material.transparent; m.receiveShadow = true; parent.add(m); return m;
  };
  const surfacePatch = (width, z0, z1, lift) => {
    // 중심 높이에 놓은 평면은 비탈의 모서리가 뚫고 나온다. 표면 자체를 잘게 따라간다.
    const positions = [], indices = [], nx = 6, nz = 3;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const p = localToWorld((i / nx - 0.5) * width, z0 + j / nz * (z1 - z0), lift);
      positions.push(p.x, p.y, p.z);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices); g.computeVertexNormals(); return g;
  };
  const stone = toon(P.stone), dark = toon(P.dark), gold = toon(P.gold);
  const iceMat = toon(P.ice, { transparent: true, opacity: 0.85 });
  const waterMat = basic(P.water, 0.83), warmMat = basic(P.warm), shine = basic(P.pale);
  const thermal = new IceThermal();
  const state = { discovered: false, heater: { x: C.heater.x, z: C.heater.z, held: false },
    angle: C.mirror.initialDegrees, energyFromHeater: 0, energyFromLight: 0, flow: 0 };
  let clock = 0, heaterWatts = 0, lightWatts = 0, beamHit = false;

  // 한 장의 가상 바닥 대신 짧은 수로와 둑 조각을 하나씩 곡면에 앉힌다.
  const downstream = [], drops = [];
  for (let i = 0; i < 15; i++) {
    const z = -5.25 + i * 0.75, tile = anchor(0, z, 0.025);
    mesh(tile, new THREE.BoxGeometry(1.95, 0.055, 0.8), dark);
    const water = mesh(group, surfacePatch(1.55, z - 0.39, z + 0.39, 0.15), waterMat);
    if (z > C.ice.z) { water.visible = false; downstream.push(water); }
    for (const side of [-1, 1]) {
      const edge = anchor(side * 1.04, z, 0.04);
      mesh(edge, new THREE.BoxGeometry(0.19, 0.19, 0.72), stone, 0, 0.06);
    }
  }
  for (let i = 0; i < 9; i++) {
    const drop = mesh(group, new THREE.SphereGeometry(0.075, 5, 4), shine);
    drop.visible = false; drops.push(drop);
  }

  const iceBase = anchor(C.ice.x, C.ice.z, 0.11);
  const receiver = mesh(iceBase, new THREE.CylinderGeometry(C.receiverRadius, C.receiverRadius, 0.12, 12),
    toon(P.ink), 0, 0.05);
  const receiverRing = mesh(iceBase, new THREE.TorusGeometry(1.13, 0.07, 5, 18), basic(P.gold), 0, 0.13);
  receiverRing.rotation.x = Math.PI / 2;
  const ice = mesh(iceBase, new THREE.DodecahedronGeometry(1.16, 0), iceMat, 0, C.ice.height);
  ice.scale.set(0.98, 0.88, 0.85);
  const iceOrigin = localToWorld(C.ice.x, C.ice.z, C.ice.height + 0.11);
  // 흡수판 중심은 얼음 바로 아래다. 얼음이 줄어도 조준 기준이 사라지지 않는다.
  const receiverCenter = localToWorld(C.ice.x, C.ice.z, 0.22);
  const receiverPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(dirAt(C.ice.x, C.ice.z), receiverCenter);

  const heater = anchor(state.heater.x, state.heater.z);
  mesh(heater, new THREE.CylinderGeometry(0.45, 0.56, 0.28, 8), dark, 0, 0.18);
  mesh(heater, new THREE.OctahedronGeometry(0.36), warmMat, 0, 0.62);
  for (const side of [-1, 1]) mesh(heater, new THREE.BoxGeometry(0.08, 0.76, 0.08), gold, side * 0.42, 0.6);
  mesh(heater, new THREE.BoxGeometry(0.94, 0.1, 0.12), dark, 0, 1.04);
  const heatHalo = mesh(heater, new THREE.TorusGeometry(0.7, 0.025, 4, 20), basic(P.warm, 0.42), 0, 0.56);
  heatHalo.rotation.x = Math.PI / 2;
  const heaterHome = anchor(C.heater.x, C.heater.z, 0.02);
  const homeRing = mesh(heaterHome, new THREE.TorusGeometry(0.67, 0.045, 4, 18), basic(P.gold), 0, 0.07);
  homeRing.rotation.x = Math.PI / 2;

  const mirrorBase = anchor(C.mirror.x, C.mirror.z);
  mesh(mirrorBase, new THREE.CylinderGeometry(0.42, 0.52, 0.2, 8), dark, 0, 0.1);
  mesh(mirrorBase, new THREE.CylinderGeometry(0.095, 0.12, 1.9, 6), gold, 0, 1);
  const mirror = new THREE.Group(); group.add(mirror);
  const mirrorCenter = localToWorld(C.mirror.x, C.mirror.z, 2.15);
  mirror.position.copy(mirrorCenter);
  // 오목한 반사면: 바깥 테두리가 가운데보다 앞에 있다. +Z가 반사면 법선이다.
  const mirrorGeo = new THREE.CircleGeometry(0.88, 24);
  const mp = mirrorGeo.attributes.position;
  for (let i = 0; i < mp.count; i++) mp.setZ(i, 0.2 * (mp.getX(i) ** 2 + mp.getY(i) ** 2));
  mirrorGeo.computeVertexNormals();
  mesh(mirror, mirrorGeo, toon(P.mirror, { side: THREE.DoubleSide }));
  mesh(mirror, new THREE.TorusGeometry(0.91, 0.07, 6, 24), gold, 0, 0, 0.16);
  const mirrorUp = dirAt(C.mirror.x, C.mirror.z);
  const mirrorZ = south.clone().addScaledVector(mirrorUp, -south.dot(mirrorUp)).normalize();
  const mirrorX = new THREE.Vector3().crossVectors(mirrorUp, mirrorZ).normalize();
  const targetDelta = receiverCenter.clone().sub(mirrorCenter).normalize();
  const pitch = Math.asin(Math.max(-0.99, Math.min(0.99, targetDelta.dot(mirrorUp))));
  const sourcePos = mirrorCenter.clone().addScaledVector(mirrorUp, 3.5).addScaledVector(mirrorZ, -1.8);
  const sourceFrame = anchor(C.mirror.x, C.mirror.z - 1.7);
  mesh(sourceFrame, new THREE.CylinderGeometry(0.055, 0.07, 5.7, 5), gold, 0, 2.85);
  mesh(group, new THREE.OctahedronGeometry(0.32), basic(P.gold)).position.copy(sourcePos);
  const incoming = mirrorCenter.clone().sub(sourcePos).normalize();
  const beam = mesh(group, new THREE.CylinderGeometry(0.035, 0.18, 1, 6, 1, true), basic(P.gold, 0.34));
  const incomingBeam = mesh(group, new THREE.CylinderGeometry(0.055, 0.055, 1, 5), basic(P.pale, 0.45));
  const hitMark = mesh(group, new THREE.SphereGeometry(0.17, 8, 5), basic(P.gold));
  const ray = new THREE.Ray();
  const connect = (line, from, to) => {
    const delta = to.clone().sub(from), length = delta.length();
    line.position.copy(from).add(to).multiplyScalar(0.5);
    line.quaternion.setFromUnitVectors(UP, delta.normalize()); line.scale.y = length;
  };
  connect(incomingBeam, sourcePos, mirrorCenter);

  // 물이 돌아오면 아래쪽 바퀴가 돌고 유적의 네 눈금이 켜진다.
  const relic = anchor(1.75, 4.6), wheel = new THREE.Group(); relic.add(wheel); wheel.position.y = 1.08;
  mesh(wheel, new THREE.TorusGeometry(0.81, 0.11, 6, 16), gold);
  for (let i = 0; i < 6; i++) {
    const spoke = mesh(wheel, new THREE.BoxGeometry(0.09, 1.54, 0.1), gold);
    spoke.rotation.z = i * Math.PI / 3;
  }
  const relicLights = [];
  for (const x of [-2.3, 2.3]) for (const z of [3.7, 5.15]) {
    const pillar = anchor(x, z);
    mesh(pillar, new THREE.BoxGeometry(0.36, 0.8, 0.36), stone, 0, 0.4);
    const lamp = mesh(pillar, new THREE.OctahedronGeometry(0.19), basic(P.dark), 0, 0.95);
    relicLights.push(lamp);
  }

  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 112;
  const labelTexture = new THREE.CanvasTexture(cv); labelTexture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, depthWrite: false }));
  label.position.copy(localToWorld(0, -1, 2.8)); label.scale.set(4.8, 1.05, 1); group.add(label);
  let previousLabel = '';
  const statusText = () => thermal.solved ? '물길이 열렸다' : thermal.meltFraction > 0
    ? `녹는 중 · 0°C · ${Math.floor(thermal.meltFraction * 100)}%`
    : `얼음 · ${Math.round(thermal.temperatureC)}°C`;
  const paintLabel = () => {
    const text = statusText(); if (text === previousLabel) return; previousLabel = text;
    const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#' + P.dark.toString(16); ctx.globalAlpha = 0.91; ctx.fillRect(0, 0, 512, 112); ctx.globalAlpha = 1;
    ctx.fillStyle = '#' + P.pale.toString(16); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '600 33px "Malgun Gothic",system-ui,sans-serif'; ctx.fillText(text, 256, 37);
    ctx.font = '22px "Malgun Gothic",system-ui,sans-serif'; ctx.fillText(TEXT.name, 256, 82);
    labelTexture.needsUpdate = true;
  };

  const updateOptics = () => {
    const yaw = state.angle * Math.PI / 180;
    const wantedRay = mirrorZ.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(mirrorX, Math.sin(yaw))
      .multiplyScalar(Math.cos(pitch)).addScaledVector(mirrorUp, Math.sin(pitch)).normalize();
    const normal = wantedRay.clone().sub(incoming).normalize();
    mirror.quaternion.setFromUnitVectors(FRONT, normal);
    // 실제 반사식 r = d − 2(d·n)n을 사용한다. 저장 각도와 시각적 광로가 같은 판정을 쓴다.
    const reflected = incoming.clone().reflect(normal).normalize();
    ray.set(mirrorCenter, reflected);
    const intersection = ray.intersectPlane(receiverPlane, new THREE.Vector3());
    const along = intersection ? intersection.distanceTo(mirrorCenter) : Infinity;
    const miss = intersection ? intersection.distanceTo(receiverCenter) : Infinity;
    beamHit = along > 0 && along < C.beamLength && miss < C.receiverRadius;
    lightWatts = beamHit ? C.mirror.watts * (1 - 0.65 * (miss / C.receiverRadius) ** 2) : 0;
    const end = mirrorCenter.clone().addScaledVector(reflected, beamHit ? along : C.beamLength);
    connect(beam, mirrorCenter, end); hitMark.position.copy(end); hitMark.visible = beamHit;
    beam.material.opacity = beamHit ? 0.62 : 0.25;
  };
  const positionHeater = () => {
    heater.position.copy(localToWorld(state.heater.x, state.heater.z, state.heater.held ? 0.65 : 0));
    heater.quaternion.copy(frameAt(state.heater.x, state.heater.z));
  };
  const paint = (dt) => {
    const amount = thermal.meltFraction, scale = Math.cbrt(Math.max(0.000001, 1 - amount));
    ice.visible = !thermal.solved; ice.scale.set(0.98 * scale, 0.88 * scale, 0.85 * scale);
    ice.position.y = 0.13 + (C.ice.height - 0.13) * scale;
    iceMat.opacity = 0.85 - amount * 0.2;
    receiverRing.material.color.set((heaterWatts + lightWatts) > 0 ? P.warm : P.gold);
    heatHalo.scale.setScalar(1 + Math.sin(clock * 3) * 0.12);
    downstream.forEach((water, i) => { water.visible = state.flow > i / downstream.length; });
    drops.forEach((drop, i) => {
      drop.visible = amount > 0;
      const z = -5.2 + ((clock * (thermal.solved ? 1.5 : 0.65) + i * 1.17) % 10.4);
      if (z > C.ice.z && !thermal.solved) drop.visible = false;
      drop.position.copy(localToWorld(Math.sin(i * 3.3) * 0.43, z, 0.14));
    });
    if (thermal.solved) wheel.rotation.z -= dt * 1.6 * state.flow;
    relicLights.forEach((lamp, i) => lamp.material.color.set(state.flow > (i + 1) / 5 ? P.ice : P.dark));
    paintLabel();
  };
  positionHeater(); updateOptics(); paint(0);

  const isNear = (position, radius = C.discoverRadius) => position.clone().normalize().angleTo(focusDir) * planet.R < radius;
  const nearest = (position) => {
    if (!isNear(position, 17)) return null;
    const p = localOf(position), targets = [
      { kind: 'heater', x: state.heater.x, z: state.heater.z },
      { kind: 'mirror', x: C.mirror.x, z: C.mirror.z },
      { kind: 'ice', x: C.ice.x, z: C.ice.z },
    ];
    let found = null, best = C.reach;
    for (const t of targets) {
      const d = Math.hypot(p.x - t.x, p.z - t.z);
      if (d < best) { best = d; found = t; }
    }
    return found;
  };
  const api = {
    group, dir: focusDir.clone(), focusDir, footprint: { width: C.width, depth: C.depth },
    entryDir: dirAt(0, -5.4), outletDir: dirAt(0, 5.4), localToWorld, localOf, isNear,
    get solved() { return thermal.solved; }, get discovered() { return state.discovered; },
    get held() { return state.heater.held; },
    get temperatureC() { return thermal.temperatureC; }, get meltFraction() { return thermal.meltFraction; },
    get status() { return { phase: thermal.phase, temperatureC: thermal.temperatureC, meltFraction: thermal.meltFraction,
      heaterWatts, lightWatts, beamHit, energyJ: thermal.energyJ, flow: state.flow }; },
    get record() { return state.energyFromHeater > 1000 && state.energyFromLight > 1000 ? TEXT.recordBoth
      : state.energyFromLight > state.energyFromHeater ? TEXT.recordLight : TEXT.recordHeat; },
    update(dt, player) {
      const result = { solvedNow: false, discoveredNow: false };
      if (!finite(dt) || dt <= 0) return result;
      dt = Math.min(dt, 0.25); clock += dt;
      if (player?.position && isNear(player.position) && !state.discovered) {
        state.discovered = true; result.discoveredNow = true; result.message = TEXT.discovered;
      }
      if (state.heater.held && player?.position) {
        if (!isNear(player.position, 16)) {
          Object.assign(state.heater, { x: C.heater.x, z: C.heater.z, held: false }); result.message = TEXT.returnHome;
        } else {
          const hold = player.position.clone();
          if (player.heading) hold.addScaledVector(player.heading, 0.85);
          const p = localOf(hold);
          state.heater.x = Math.max(-9.5, Math.min(9.5, p.x)); state.heater.z = Math.max(-5.5, Math.min(5.5, p.z));
        }
        positionHeater();
      }
      const heaterCenter = heater.position.clone().addScaledVector(dirAt(state.heater.x, state.heater.z), 0.62);
      heaterWatts = proximityHeat(heaterCenter.distanceTo(iceOrigin), C.heater.radius, C.heater.watts);
      const wasSolved = thermal.solved;
      if (!wasSolved) {
        const before = thermal.energyJ; thermal.addPower(heaterWatts + lightWatts, dt);
        const gained = thermal.energyJ - before, power = heaterWatts + lightWatts;
        if (power > 0) { state.energyFromHeater += gained * heaterWatts / power; state.energyFromLight += gained * lightWatts / power; }
      }
      if (thermal.solved) state.flow = Math.min(1, state.flow + dt / 2.4);
      if (!wasSolved && thermal.solved) { result.solvedNow = true; result.message = TEXT.solved; }
      paint(dt); return result;
    },
    getPrompt(position) {
      if (state.heater.held) return 'E — 온열기 내려놓기 · 얼음과의 거리를 살펴보자';
      const n = nearest(position);
      if (n?.kind === 'heater') return 'E — 온열기 들기';
      if (n?.kind === 'mirror') return `E — 거울 돌리기 (${Math.round(state.angle)}°) · ${beamHit ? '빛이 흡수판에 닿았다' : '빛의 끝을 살펴보자'}`;
      if (n?.kind === 'ice') return `E — ${thermal.solved ? '열린 물길' : '얼음의 변화'} 살피기 · ${statusText()}`;
      return isNear(position, 11) ? (thermal.solved ? TEXT.solved : `❄ ${statusText()} · ${TEXT.goal}`) : null;
    },
    interact(position) {
      if (state.heater.held) {
        const p = localOf(position);
        if (!finite(p.x) || !finite(p.z) || !isNear(position, 16)) return false;
        // 든 것은 언제든 내려놓을 수 있다. 다른 장치 위에 놓으면 옆으로 조금 비킨다.
        let x = Math.max(-9.5, Math.min(9.5, state.heater.x)), z = Math.max(-5.5, Math.min(5.5, state.heater.z));
        for (const obstacle of [C.ice, C.mirror]) {
          const dx = x - obstacle.x, dz = z - obstacle.z, d = Math.hypot(dx, dz);
          if (d < 1.55) { x = obstacle.x + (d > 0.001 ? dx / d : -1) * 1.55; z = obstacle.z + (d > 0.001 ? dz / d : 0) * 1.55; }
        }
        Object.assign(state.heater, { x, z, held: false }); positionHeater(); return { kind: 'place', message: TEXT.place };
      }
      const n = nearest(position); if (!n) return false;
      state.discovered = true;
      if (n.kind === 'heater') { state.heater.held = true; return { kind: 'pickup', message: TEXT.pickup }; }
      if (n.kind === 'mirror') {
        state.angle = wrapAngle(state.angle + C.mirror.stepDegrees); updateOptics();
        return { kind: 'turn', message: TEXT.turn };
      }
      return { kind: 'inspect', message: thermal.solved ? TEXT.solved : thermal.meltFraction > 0 ? TEXT.melting : TEXT.science };
    },
    resolve(position, playerR = 0.32) {
      if (!isNear(position, 17)) return 0;
      const obstacles = [{ x: C.mirror.x, z: C.mirror.z, r: 0.43 }, { x: 1.75, z: 4.6, r: 0.57 }];
      for (const x of [-2.3, 2.3]) for (const z of [3.7, 5.15]) obstacles.push({ x, z, r: 0.2 });
      if (!state.heater.held) obstacles.push({ ...state.heater, r: 0.48 });
      if (!thermal.solved) obstacles.push({ x: C.ice.x, z: C.ice.z, r: 1.1 * Math.cbrt(1 - thermal.meltFraction) });
      let count = 0;
      for (const o of obstacles) {
        const up = position.clone().normalize(), at = dirAt(o.x, o.z), cos = up.dot(at), need = (o.r + playerR) / planet.R;
        if (cos < Math.cos(need)) continue;
        const side = up.addScaledVector(at, -cos);
        if (side.lengthSq() < 1e-12) side.copy(east).addScaledVector(at, -east.dot(at));
        position.copy(at.multiplyScalar(Math.cos(need)).addScaledVector(side.normalize(), Math.sin(need)).multiplyScalar(position.length())); count++;
      }
      if (count) planet.projectToSurface(position);
      return count;
    },
    exportState() {
      return { version: 1, discovered: state.discovered, heater: { ...state.heater }, mirrorAngle: state.angle,
        thermal: thermal.exportState(), energyFromHeater: state.energyFromHeater, energyFromLight: state.energyFromLight, flow: state.flow };
    },
    importState(saved) {
      if (!saved || saved.version !== 1 || typeof saved.discovered !== 'boolean'
        || !saved.heater || !finite(saved.heater.x) || !finite(saved.heater.z)
        || Math.abs(saved.heater.x) > 10 || Math.abs(saved.heater.z) > 6 || typeof saved.heater.held !== 'boolean'
        || !finite(saved.mirrorAngle) || !finite(saved.energyFromHeater) || !finite(saved.energyFromLight)
        || saved.energyFromHeater < 0 || saved.energyFromLight < 0 || !finite(saved.flow) || saved.flow < 0 || saved.flow > 1) return false;
      const probe = new IceThermal(); if (!probe.importState(saved.thermal)) return false;
      if (Math.abs(saved.energyFromHeater + saved.energyFromLight - probe.energyJ) > 0.01
        || (!probe.solved && saved.flow !== 0)) return false;
      thermal.importState(saved.thermal); state.discovered = saved.discovered;
      Object.assign(state.heater, saved.heater); state.angle = wrapAngle(saved.mirrorAngle);
      state.energyFromHeater = saved.energyFromHeater; state.energyFromLight = saved.energyFromLight; state.flow = saved.flow;
      positionHeater(); updateOptics(); paint(0); return true;
    },
    dispose() {
      const geometries = new Set(), materials = new Set();
      group.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); labelTexture.dispose(); group.removeFromParent();
    },
  };
  return api;
}
