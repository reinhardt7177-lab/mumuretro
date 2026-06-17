// 배달 네비게이션 — 목적지 발광 비콘(곡면 너머로 보임) + 플레이어 위 방향 화살표(대원 방위).
import * as THREE from 'three';
import { projectTangent } from '../world/SurfaceTransform.js';

const Y = new THREE.Vector3(0, 1, 0);
const noOutline = (mat) => { mat.userData.outlineParameters = { visible: false }; return mat; };

export class Navigation {
  constructor(scene, planet) {
    this.planet = planet;
    this._t = 0;

    // 비콘 — 반투명 발광 기둥 + 부유 오브. 수평선 컬링 제외(scene 직접 추가). 굴뚝 연기처럼 멀리서 식별.
    this.beacon = new THREE.Group();
    const col = 0xffe08a;
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 9, 12, 1, true),
      noOutline(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide })));
    column.position.y = 4.5; this.beacon.add(column);
    this.orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 14, 12),
      noOutline(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.92, depthWrite: false })));
    this.orb.position.y = 9; this.beacon.add(this.orb);
    this.beacon.visible = false;
    scene.add(this.beacon);

    // 화살표 — 플레이어 위 콘, 목적지로의 접선 방위를 가리킴.
    this.arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.8, 10),
      noOutline(new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.95, depthWrite: false })));
    this.arrow.visible = false;
    scene.add(this.arrow);
  }

  // target: {pos:Vector3, dir:Vector3} | null
  update(player, target, dt) {
    if (!target) { this.beacon.visible = false; this.arrow.visible = false; return; }
    this._t += dt;

    // 비콘: 표면 법선(target.dir)으로 세우고 오브 부유
    this.beacon.position.copy(target.pos);
    this.beacon.quaternion.setFromUnitVectors(Y, target.dir);
    this.beacon.visible = true;
    this.orb.position.y = 9 + Math.sin(this._t * 2) * 0.4;

    // 화살표: 목적지로의 접선 방위. 가까우면 숨김.
    const dir = target.pos.clone().sub(player.position);
    projectTangent(dir, player.up);
    const distU = player.position.angleTo(target.pos) * this.planet.R;
    if (distU < 5 || dir.lengthSq() < 1e-6) { this.arrow.visible = false; return; }
    dir.normalize();
    this.arrow.visible = true;
    this.arrow.position.copy(player.position).addScaledVector(player.up, 2.5);
    this.arrow.quaternion.setFromUnitVectors(Y, dir);   // 콘의 +Y축을 방위로
  }
}
