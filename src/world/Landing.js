// 내림판 — 별 위에서 연구실로 돌아가는 자리.
//
// ★ 포탈이 한쪽으로만 열리면 연구실은 오프닝 한 장면으로 끝난다. 그러면
//   침상도 선반도 빈 표본 병 여덟 개도 전부 배경 소품이 된다. 양쪽으로 열어야
//   그 방이 **베이스캠프**가 되고, 뒤에 올 모닥불과 표본 정리가 갈 곳이 생긴다.
//
// 사당의 빛기둥과 **다른 색**이어야 한다. 사당은 이 별의 청록이고 여긴 집의 파랑이다 —
// 멀리서 기둥 일곱 개가 보일 때 하나만 색이 다르면 그게 곧 "저긴 내 자리"다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { LAB } from '../data/lighting.js';

const PAD_R = 2.4;

export function buildLanding(scene, planet, dir) {
  const fr = planet.frameAt(planet.surfaceAt(dir), 0);
  const group = new THREE.Group();
  group.position.copy(fr.position);
  group.quaternion.copy(fr.quaternion);
  scene.add(group);

  const basic = (c, o = 1) => {
    const m = new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o });
    m.userData.outlineParameters = { visible: false };
    return m;
  };

  // 낮은 돌판 — 밟고 올라서는 게 아니라 **딛고 서는 자리**다. 높으면 걸린다.
  const base = new THREE.Mesh(new THREE.CylinderGeometry(PAD_R, PAD_R + 0.24, 0.22, 16),
    toon(0x6f6a60));
  base.position.y = 0.08; base.castShadow = true; base.receiveShadow = true;
  group.add(base);

  // 연구실 분필 원과 같은 눈금. 같은 장치라는 걸 모양으로 말한다.
  const ringMat = basic(LAB.glow, 0.55);
  const ring = new THREE.Mesh(new THREE.RingGeometry(PAD_R * 0.72, PAD_R * 0.78, 36), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.2; group.add(ring);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const tk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.34), basic(LAB.glow, 0.4));
    tk.position.set(Math.sin(a) * PAD_R * 0.88, 0.2, Math.cos(a) * PAD_R * 0.88);
    tk.rotation.y = a; group.add(tk);
  }

  // 기둥 — 사당 빛기둥보다 낮고 가늘다. 여긴 목표가 아니라 돌아가는 문이다.
  const colMat = basic(LAB.glow, 0.28);
  colMat.side = THREE.DoubleSide;
  colMat.depthWrite = false;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(PAD_R * 0.7, PAD_R * 0.55, 9, 16, 1, true),
    colMat);
  col.position.y = 4.6; group.add(col);

  const light = new THREE.PointLight(LAB.glow, 4, 12, 1.7);
  light.position.y = 1.2; group.add(light);

  let t = 0;
  const _up = new THREE.Vector3();
  return {
    dir: dir.clone(), pos: fr.position.clone(), group,
    update(dt) {
      t += dt;
      ringMat.opacity = 0.45 + Math.sin(t * 1.8) * 0.16;
      colMat.opacity = 0.22 + Math.sin(t * 1.8) * 0.07;
      col.rotation.y += dt * 0.22;
    },
    // 발밑이 이 판 위인가 — 구면 위 각도로 잰다(평면 거리로 재면 반대편에서도 걸린다)
    near(position, r = PAD_R + 0.6) {
      _up.copy(position).normalize();
      return _up.angleTo(this.dir) < r / planet.R;
    },
  };
}
