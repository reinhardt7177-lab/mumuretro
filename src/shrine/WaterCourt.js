import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { WATER_COURT as C } from '../data/waterCourt.js';

// 주 동선의 바닥 y=0은 유지하고 양쪽에 3u 회랑을 얹는다. 중앙은 아래로도 지나는 수로다.
export function buildWaterCourt(scene, seg, shrineSeg, theme, rects) {
  const group = new THREE.Group(); group.name = 'water-court'; scene.add(group);
  const stone = toon(theme.stone), dark = toon(theme.stoneDark), pale = toon(theme.stoneLite);
  const bright = new THREE.MeshBasicMaterial({ color: theme.glow });
  bright.userData.outlineParameters = { visible: false };
  const water = new THREE.MeshBasicMaterial({ color: theme.court.water, transparent: true, opacity: 0.9 });
  water.userData.outlineParameters = { visible: false };
  const time = { value: 0 }, foam = { value: new THREE.Color(theme.court.foam) };
  water.onBeforeCompile = shader => {
    shader.uniforms.courtTime = time; shader.uniforms.courtFoam = foam;
    shader.vertexShader = 'varying vec3 courtWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ncourtWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = 'uniform float courtTime; uniform vec3 courtFoam; varying vec3 courtWorld;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float flow = courtWorld.z * 3.8 + courtWorld.y * 7.0 - courtTime * 1.8;
      float a = sin(flow + sin(courtWorld.x * 3.0 + courtTime * 0.5));
      float b = sin(courtWorld.x * 6.0 + sin(courtWorld.z * 2.3 - courtTime * 0.3));
      float crest = smoothstep(0.84, 0.99, a * 0.5 + b * 0.5);
      diffuseColor.rgb = mix(diffuseColor.rgb * (0.88 + a * 0.10), courtFoam, crest * 0.7);`);
  };
  const bronze = toon(theme.court.bronze), moss = toon(theme.court.moss, { rim: 0.02 });
  const cameraOccluders = [];
  const obstacles = [];
  const zAt = back => seg.z1 - back;
  const box = (w, h, d, x, y, z, mat = stone, parent = group) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
    m.castShadow = !mat.transparent; m.receiveShadow = true; parent.add(m); return m;
  };
  const decks = [];
  const jointMatrices = [], dummy = new THREE.Object3D();
  const joint = (x, y, z, sx, sz, rx = 0) => {
    dummy.position.set(x, y, z); dummy.scale.set(sx, 0.016, sz); dummy.rotation.set(rx, 0, 0);
    dummy.updateMatrix(); jointMatrices.push(dummy.matrix.clone());
  };
  for (const side of [-1, 1]) {
    const x = side * 8;
    const terrace = box(4, C.height, C.terraceBack - C.rampBack, x, C.height / 2,
      zAt((C.terraceBack + C.rampBack) / 2));
    cameraOccluders.push(terrace); decks.push(terrace);
    // 비탈은 윗면과 옆면을 같은 꼭짓점으로 만든다. 눈으로 보는 경사와 발 높이가 같다.
    const geo = new THREE.BoxGeometry(4, C.height, C.rampBack - C.rampFront);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getZ(i) + (C.rampBack - C.rampFront) / 2) / (C.rampBack - C.rampFront);
      p.setY(i, p.getY(i) > 0 ? C.height * (1 - t) : -0.07);
    }
    geo.computeVertexNormals();
    const ramp = new THREE.Mesh(geo, pale); ramp.position.set(x, 0, zAt((C.rampFront + C.rampBack) / 2));
    ramp.castShadow = true; ramp.receiveShadow = true; group.add(ramp); cameraOccluders.push(ramp); decks.push(ramp);
    for (let b = 3.5; b < 11; b += 0.65) joint(x, 3 * (b - 3) / 8 + 0.012, zAt(b), 3.96, 0.035, Math.atan(3 / 8));
    for (let b = 11.8; b < 19; b += 1.2) joint(x, 3.012, zAt(b), 3.96, 0.035);
    joint(x, 3.012, zAt(15), 0.035, 7.9);
    // 바깥 난간은 진행 공간 바깥에 둔다. 안쪽은 아래의 수조가 보이는 열린 회랑이다.
    for (const back of [4, 7, 10, 13, 16, 18.5]) {
      const h = back < C.rampBack ? C.height * (back - C.rampFront) / (C.rampBack - C.rampFront) : C.height;
      box(0.13, 0.8, 0.13, side * 10.12, h + 0.4, zAt(back), dark);
    }
    box(0.15, 0.16, 8, side * 10.12, C.height + 0.8, zAt(15), bronze);
    const rampRail = box(0.15, 0.15, Math.hypot(8, 3), side * 10.12, 2.3, zAt(7), bronze);
    rampRail.rotation.x = Math.atan(3 / 8);
    for (const back of [11, 19]) {
      box(0.55, 4.7, 0.55, side * 10.85, 2.35, zAt(back), pale);
      box(0.83, 0.20, 0.83, side * 10.85, 4.7, zAt(back), bronze);
    }
    // 높은 회랑의 아래로 흘러내리는 얇은 물. 중앙의 마른 통행로와 구별한다.
    box(0.12, 2.8, 1.8, side * 5.94, 1.4, zAt(16), water);
    box(0.55, 0.12, 2.15, side * 5.94, 2.87, zAt(16), pale);
    box(4.1, 0.035, 10.6, side * 3.6, 0.045, zAt(14), water);
    box(0.12, 0.13, 11, side * 1.5, 0.08, zAt(14), pale);
    // 바닥의 물결과 떨어지는 물의 포말. 같은 시간으로 흐르므로 읽기 화면에서 함께 멈춘다.
    const splash = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.53, 24), new THREE.MeshBasicMaterial({
      color: theme.court.foam, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    splash.rotation.x = -Math.PI / 2; splash.scale.set(1.1, 1.6, 1); splash.position.set(side * 5.2, 0.075, zAt(16)); group.add(splash);
    // 식생과 기둥은 외곽의 작은 돌 화분에 모아 동선을 비운다.
    for (const back of [5, 12, 20]) {
      box(1.3, 0.4, 1.5, side * 11.5, 0.2, zAt(back), pale);
      for (let j = 0; j < 3; j++) {
        const sprig = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), moss);
        sprig.scale.set(1, 0.45, 0.8); sprig.position.set(side * 11.5 + (j - 1) * 0.3, 0.47, zAt(back) + Math.sin(j * 2) * 0.4); group.add(sprig);
      }
    }
  }
  // 가운데 y=0 돌길이 상시 열려 있어, 다리 전에도 아래에서 양쪽을 살펴볼 수 있다.
  box(2.8, 0.08, 12, 0, 0.01, zAt(14), pale);
  for (let b = 2; b < 26; b += 1.35) joint(0, 0.06, zAt(b), 2.75, 0.04);
  joint(0, 0.06, zAt(14), 0.035, 23.8);
  const joints = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stone, jointMatrices.length);
  jointMatrices.forEach((m, i) => joints.setMatrixAt(i, m)); group.add(joints);
  const bridge = new THREE.Group(); group.add(bridge); bridge.visible = false;
  const bridgeDeck = box(12, 0.28, C.bridgeBack - C.bridgeFront, 0, C.height - 0.14, zAt(16), pale, bridge);
  cameraOccluders.push(bridgeDeck);
  for (const back of [C.bridgeFront, C.bridgeBack]) {
    box(12, 0.10, 0.12, 0, C.height + 0.73, zAt(back), bronze, bridge);
    for (const x of [-5, -2.5, 0, 2.5, 5]) box(0.09, 0.75, 0.09, x, C.height + 0.36, zAt(back), dark, bridge);
  }
  for (const x of [-4.8, -2.4, 0, 2.4, 4.8]) box(0.04, 0.012, 3.95, x, 3.006, zAt(16), stone, bridge);
  const pipeLamps = [];
  for (const v of C.valves) {
    // 가지마다 밸브의 응답이 수조까지 이어진다. 정답 위치를 색으로 알려주지 않는다.
    const pipe = box(0.18, Math.max(0.6, v.y + 0.6), 0.18, v.x, (v.y + 0.6) / 2, zAt(v.back) - 0.5, dark);
    const lampMat = bright.clone(); const lamp = box(0.30, 0.30, 0.3, v.x, v.y + 0.5, pipe.position.z, lampMat);
    pipeLamps.push(lamp);
  }
  const wheel = new THREE.Group(); wheel.position.set(4.2, 1.4, zAt(22)); group.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.13, 6, 20), pale); wheel.add(rim);
  for (let i = 0; i < 8; i++) { const s = box(0.1, 2.35, 0.1, 0, 0, 0, dark, wheel); s.rotation.z = i * Math.PI / 4; }
  // 목적지를 한눈에 알아볼 수 있는 둥근 지붕. 가운데 제단과 카메라 공간은 열린 채로 둔다.
  const sanctuaryZ = shrineSeg.z0 + (shrineSeg.z1 - shrineSeg.z0) * 0.3;
  const crown = new THREE.Mesh(new THREE.TorusGeometry(6.3, 0.32, 6, 32), pale);
  crown.rotation.x = Math.PI / 2; crown.position.set(0, 7.3, sanctuaryZ); crown.castShadow = true;
  group.add(crown); cameraOccluders.push(crown);
  for (const a of [-2.3, -0.85, 0.85, 2.3]) {
    const x = Math.sin(a) * 6.3, z = sanctuaryZ + Math.cos(a) * 6.3;
    const pillar = box(0.65, 7.1, 0.65, x, 3.55, z, pale); cameraOccluders.push(pillar); obstacles.push({ x, z, r: 0.85 });
    box(1.05, 0.26, 1.05, x, 0.13, z, bronze); box(0.95, 0.25, 0.95, x, 7.08, z, bronze);
  }
  // 먼 녹색 바위섬은 규모를 비교할 배경이다. 실제 통행 영역 밖에만 놓는다.
  const distant = toon(theme.open.rim), leaf = toon(theme.court.moss);
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1, x = side * (36 + (i % 3) * 12), z = seg.z1 - 10 - i * 14;
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(5 + i % 3, 2.5, 17 + i % 2 * 7, 6), distant);
    rock.position.set(x, -7, z); rock.rotation.y = i * 0.6; group.add(rock);
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(5, 1), leaf);
    canopy.position.set(x, 4 + i % 2 * 3.5, z); canopy.scale.set(1.5, 0.6, 1); group.add(canopy);
  }
  const returnPos = new THREE.Vector3(6, 0, shrineSeg.z1 - 3.0);
  const returnGroup = new THREE.Group(); returnGroup.position.copy(returnPos); scene.add(returnGroup);
  const returnMat = new THREE.MeshBasicMaterial({ color: theme.glow, transparent: true, opacity: 0.12 });
  returnMat.userData.outlineParameters = { visible: false };
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.08, 6, 28), returnMat); ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1; returnGroup.add(ring);
  const returnCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), returnMat); returnCrystal.position.y = 0.9; returnGroup.add(returnCrystal);
  let bridgeProgress = 0, filled = [false, false, false], returnOpen = false, clock = 0;
  const inside = (x, z) => x >= seg.x0 && x <= seg.x1 && z >= seg.z0 && z <= seg.z1;
  function heightAt(x, z, referenceY = 0) {
    if (!inside(x, z)) return 0;
    const back = seg.z1 - z, ax = Math.abs(x);
    if (ax >= C.wingInner && ax <= C.wingOuter) {
      if (back >= C.rampFront && back <= C.rampBack) return C.height * (back - C.rampFront) / (C.rampBack - C.rampFront);
      if (back > C.rampBack && back <= C.terraceBack) return C.height;
    }
    // 다리의 아래 돌길은 계속 걷는다. 위에서 진입할 때만 높은 바닥을 고른다.
    if (bridgeProgress >= 1 && ax < C.wingInner && back >= C.bridgeFront && back <= C.bridgeBack && referenceY >= C.height - 0.35) return C.height;
    return 0;
  }
  const oldHeight = rects.floorAt;
  rects.floorAt = (x, z, y) => inside(x, z) ? heightAt(x, z, y) : oldHeight ? oldHeight(x, z, y) : 0;
  rects.ceilingAt = (x, z, y) => bridgeProgress >= 1 && Math.abs(x) < C.wingInner
    && seg.z1 - z >= C.bridgeFront && seg.z1 - z <= C.bridgeBack && y < C.height - 0.5 ? C.height - 0.28 : Infinity;
  rects.cameraOccluders = cameraOccluders;
  // 작은 난간·기둥 장식은 같은 재질끼리 한 번에 그린다. 충돌에 쓰는 메시와 움직이는 장치는 유지한다.
  const batchTrim = parent => {
    const byMaterial = new Map();
    for (const m of parent.children) {
      if (!m.isMesh || m.geometry.type !== 'BoxGeometry' || m.material.transparent || cameraOccluders.includes(m)
        || pipeLamps.includes(m)) continue;
      if (!byMaterial.has(m.material)) byMaterial.set(m.material, []);
      byMaterial.get(m.material).push(m);
    }
    for (const [material, parts] of byMaterial) {
      if (parts.length < 2) continue;
      const batch = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, parts.length);
      batch.name = 'water-court-trim'; batch.castShadow = parts.some(m => m.castShadow); batch.receiveShadow = true;
      const matrix = new THREE.Matrix4(), size = new THREE.Vector3();
      parts.forEach((m, i) => {
        m.updateMatrix(); const p = m.geometry.parameters; size.set(p.width, p.height, p.depth);
        matrix.copy(m.matrix).scale(size); batch.setMatrixAt(i, matrix);
        parent.remove(m); m.geometry.dispose();
      });
      parent.add(batch);
    }
  };
  batchTrim(group); batchTrim(bridge);
  function paint() {
    bridge.visible = bridgeProgress > 0;
    bridge.scale.x = Math.max(0.001, bridgeProgress);
    pipeLamps.forEach((lamp, i) => lamp.material.color.set(filled[i] ? theme.glow : theme.stoneDark));
    returnMat.opacity = returnOpen ? 0.85 : 0.12;
  }
  return {
    group, decks, bridge, returnGroup, returnPos, heightAt, obstacles,
    get bridgeProgress() { return bridgeProgress; },
    setBridgeProgress(v) { bridgeProgress = v; paint(); },
    update(dt, valves, complete) {
      clock += dt; filled = valves.map(v => v.filled); returnOpen = complete;
      time.value = clock;
      if (filled.some(Boolean)) bridgeProgress = Math.min(1, bridgeProgress + dt / 1.25);
      if (filled.every(Boolean)) wheel.rotation.z -= dt * 0.9;
      returnCrystal.position.y = 0.9 + Math.sin(clock * 1.4) * 0.12; paint();
    },
    restart() { bridgeProgress = 0; filled = [false, false, false]; returnOpen = false; paint(); },
    prompt(p) { return returnOpen && p.distanceTo(returnPos) < 2 ? 'E — 물길을 따라 사당 입구로 돌아가기' : null; },
    interact(p) { return !!this.prompt(p); },
  };
}
