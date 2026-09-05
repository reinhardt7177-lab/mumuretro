// 지혜의 구슬 — 저울이 수평이 되면 나오는, 사당 하나당 단 하나의 보상.
//
// ★ 예전엔 이게 없었다. onBalance가 불리언 하나를 켜고 글자 한 줄을 띄우는 게
//   전부였다. 구슬은 어디에도 존재하지 않았고, 밖으로 나오면 빛기둥은 아까와
//   똑같이 청록으로 타고 있었다. 세계는 아이가 뭘 했는지 몰랐다.
//   "아이가 왜 돌아오는가"의 답이 「세계」였는데 그 세계가 반응을 안 하면
//   사당 2호로 걸어갈 이유가 생기지 않는다.
//
// 그래서 보상은 두 겹이다.
//   안에서 — **물건**이 내려온다. 걸어가서 줍는다(글자가 아니라 행동으로 끝난다).
//   밖에서 — 그 사당의 빛기둥이 금색이 된다(Shrine.markCleared).
import * as THREE from 'three';
import { SHRINE } from '../data/lighting.js';

const DROP_FROM = 4.6, DROP_TO = 1.25;   // 천장 근처에서 손 높이까지
const DROP_T = 1.4;                      // 내려오는 데 걸리는 시간
// 압력판(2.6)·저울(2.1)과 같은 인심. 집는 거리에 인색해서 얻는 건 아무것도 없다.
const REACH = 2.4;

export class Prize {
  constructor(scene, pos) {
    this.pos = pos.clone();
    this.taken = false;
    this.t = 0;
    this.drop = -1;                      // -1이면 아직 안 나왔다

    const g = new THREE.Group();
    g.position.copy(pos);
    g.position.y = DROP_FROM;
    g.visible = false;
    scene.add(g);
    this.group = g;

    const mat = new THREE.MeshBasicMaterial({ color: SHRINE.gold });
    mat.userData.outlineParameters = { visible: false };
    this.core = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), mat);
    g.add(this.core);

    // 반투명 껍질 한 겹. 폴리곤을 늘리지 않고 '빛나는 것'을 만드는 가장 싼 방법이다.
    const shell = new THREE.MeshBasicMaterial({
      color: SHRINE.gold, transparent: true, opacity: 0.26, side: THREE.DoubleSide,
    });
    shell.userData.outlineParameters = { visible: false };
    this.shell = new THREE.Mesh(new THREE.OctahedronGeometry(0.66, 0), shell);
    g.add(this.shell);

    // 제 빛으로 주변을 물들인다. 신전에서 가장 밝은 곳이 곧 다음 목표다(설계도 §4).
    g.add(new THREE.PointLight(SHRINE.gold, 7, 10, 1.6));
  }

  reveal() {
    if (this.drop >= 0 || this.taken) return false;
    this.drop = 0;
    this.group.visible = true;
    return true;
  }

  update(dt) {
    if (this.drop < 0 || this.taken) return;
    this.t += dt;
    if (this.drop < 1) {
      this.drop = Math.min(1, this.drop + dt / DROP_T);
      const k = 1 - (1 - this.drop) ** 3;              // 끝에서 부드럽게 멎는다
      this.group.position.y = DROP_FROM + (DROP_TO - DROP_FROM) * k;
    } else {
      this.group.position.y = DROP_TO + Math.sin(this.t * 1.6) * 0.12;
    }
    this.core.rotation.y += dt * 1.1;
    this.core.rotation.x += dt * 0.5;
    this.shell.rotation.y -= dt * 0.7;
  }

  _near(pos) {
    return this.drop >= 1 && !this.taken
      && Math.hypot(pos.x - this.pos.x, pos.z - this.pos.z) < REACH;
  }

  prompt(pos) {
    if (this.taken || this.drop < 0) return null;
    if (this.drop < 1) return '✨ 지혜의 구슬이 내려와요';
    return this._near(pos) ? 'E — 지혜의 구슬 줍기' : '✨ 구슬 가까이 가서 E로 주워요';
  }

  interact(pos) {
    if (!this._near(pos)) return false;
    this.taken = true;
    this.group.visible = false;
    return true;
  }

  // 다음 사당을 위해 처음으로. 내부 씬은 여섯 사당이 함께 쓴다.
  reset() {
    this.taken = false;
    this.drop = -1;
    this.t = 0;
    this.group.visible = false;
    this.group.position.copy(this.pos);
    this.group.position.y = DROP_FROM;
  }
}
