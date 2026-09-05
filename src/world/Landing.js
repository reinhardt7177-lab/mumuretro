// 내림판 — 별 위에서 연구실로 돌아가는 자리이자, 별에 내려서는 자리.
//
// ★ 포탈이 한쪽으로만 열리면 연구실은 오프닝 한 장면으로 끝난다. 그러면
//   침상도 선반도 빈 표본 병 여덟 개도 전부 배경 소품이 된다. 양쪽으로 열어야
//   그 방이 **베이스캠프**가 되고, 뒤에 올 모닥불과 표본 정리가 갈 곳이 생긴다.
//
// 사당의 빛기둥과 **다른 색**이어야 한다. 사당은 이 별의 청록이고 여긴 집의 파랑이다 —
// 멀리서 기둥 일곱 개가 보일 때 하나만 색이 다르면 그게 곧 "저긴 내 자리"다.
//
// ★ 한 번 통째로 누워 있었다. planet.frameAt이 왼손 기저로 회전을 만들고 있어서
//   (makeBasis(e, up, n)인데 e × up = −n) 판이 90°쯤 넘어가 있었다. Planet.js에서
//   고쳤고, 여기서는 **로컬 +Y가 곧 위**라고 믿고 그린다. 검사 J가 그걸 지킨다.
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
  const base = new THREE.Mesh(new THREE.CylinderGeometry(PAD_R, PAD_R + 0.24, 0.22, 8),
    toon(0x6f6a60));
  base.position.y = 0.08; base.rotation.y = Math.PI / 8;
  base.castShadow = true; base.receiveShadow = true;
  group.add(base);

  // 연구실 분필 원과 같은 눈금. 같은 장치라는 걸 모양으로 말한다.
  const ringMat = basic(LAB.glow, 0.55);
  const ring = new THREE.Mesh(new THREE.RingGeometry(PAD_R * 0.72, PAD_R * 0.78, 32), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.2; group.add(ring);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const tk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.34), basic(LAB.glow, 0.4));
    tk.position.set(Math.sin(a) * PAD_R * 0.88, 0.2, Math.cos(a) * PAD_R * 0.88);
    tk.rotation.y = a; group.add(tk);
  }
  // 놋쇠 다리 넷 — 연구실 짐벌과 같은 손이 만든 것으로 보여야 한다
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), toon(LAB.brassDim));
    leg.position.set(Math.sin(a) * (PAD_R - 0.35), 0.55, Math.cos(a) * (PAD_R - 0.35));
    leg.rotation.z = -Math.sin(a) * 0.16; leg.rotation.x = Math.cos(a) * 0.16;
    group.add(leg);
  }

  // 기둥 — 사당 빛기둥보다 낮고 가늘다. 여긴 목표가 아니라 돌아가는 문이다.
  const colMat = basic(LAB.glow, 0.28);
  colMat.side = THREE.DoubleSide;
  colMat.depthWrite = false;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(PAD_R * 0.7, PAD_R * 0.55, 9, 14, 1, true),
    colMat);
  col.position.y = 4.6; group.add(col);

  // ── 착지 이펙트 ────────────────────────────────────────────────────────────
  // ★ 예전엔 씬만 갈아 끼웠다. 삼 년을 붙든 장치가 처음 작동해서 다른 별에
  //   발을 딛는 순간인데, 화면에서는 **아무 일도 일어나지 않았다.**
  //   한 번뿐인 장면은 한 번뿐인 것처럼 보여야 한다.
  const burstMat = basic(LAB.glow, 0);
  burstMat.depthWrite = false;
  const burst = new THREE.Mesh(new THREE.RingGeometry(0.82, 1.0, 28), burstMat);
  burst.rotation.x = -Math.PI / 2; burst.position.y = 0.14;
  burst.visible = false; group.add(burst);
  // 튀어 오르는 불티 — 원 하나만 퍼지면 그건 파문이지 착지가 아니다
  const sparks = [];
  for (let k = 0; k < 10; k++) {
    const m = basic(LAB.glow, 0);
    m.depthWrite = false;
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.1), m);
    sp.visible = false; group.add(sp);
    const a = (k / 10) * Math.PI * 2 + Math.random() * 0.5;
    sparks.push({ mesh: sp, mat: m, a, r: 0.5 + Math.random() * 1.1,
      up: 2.4 + Math.random() * 2.2 });
  }

  const light = new THREE.PointLight(LAB.glow, 4, 12, 1.7);
  light.position.y = 1.2; group.add(light);

  let t = 0, bt = -1;                       // bt >= 0이면 착지 연출 진행 중
  const _up = new THREE.Vector3();

  return {
    dir: dir.clone(), pos: fr.position.clone(), group,

    // 별에 내려섰다 — 1.6초짜리 한 번.
    arrive() { bt = 0; },

    update(dt) {
      t += dt;
      ringMat.opacity = 0.45 + Math.sin(t * 1.8) * 0.16;
      col.rotation.y += dt * 0.22;

      if (bt < 0) {
        colMat.opacity = 0.22 + Math.sin(t * 1.8) * 0.07;
        light.intensity = 4;
        return;
      }
      bt += dt;
      const k = Math.min(1, bt / 1.6);
      const fade = 1 - k;
      // 바닥 파문 — 빠르게 퍼지고 옅어진다
      burst.visible = true;
      const s = 0.5 + k * 3.4;
      burst.scale.set(s, s, 1);
      burstMat.opacity = 0.8 * fade * fade;
      // 기둥이 확 밝아졌다 가라앉는다
      colMat.opacity = 0.22 + fade * 0.55;
      light.intensity = 4 + fade * 30;
      // 불티는 위로 솟았다 떨어진다
      for (const sp of sparks) {
        sp.mesh.visible = true;
        const y = sp.up * k - 3.4 * k * k;
        sp.mesh.position.set(Math.sin(sp.a) * sp.r * (0.4 + k * 1.6), Math.max(0.1, y + 0.4),
          Math.cos(sp.a) * sp.r * (0.4 + k * 1.6));
        sp.mat.opacity = 0.85 * fade;
      }
      if (k >= 1) {
        bt = -1;
        burst.visible = false; burstMat.opacity = 0;
        for (const sp of sparks) { sp.mesh.visible = false; sp.mat.opacity = 0; }
      }
    },

    // 발밑이 이 판 위인가 — 구면 위 각도로 잰다(평면 거리로 재면 반대편에서도 걸린다)
    near(position, r = PAD_R + 0.6) {
      _up.copy(position).normalize();
      return _up.angleTo(this.dir) < r / planet.R;
    },
  };
}
