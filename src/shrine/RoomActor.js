// 사당 실내 컨트롤러 — XZ 이동, 선택적인 바닥 높이와 3인칭 카메라.
//
// 구면 보행(sphere/)을 실내에 쓰지 않는다. 그건 대원 이동과 평행수송으로 짜여 있어서
// 평평한 방에서는 전부 낭비이고, 무엇보다 **검증된 코드를 건드리게 된다.**
// 기본 바닥은 y=0이며, 물 회랑은 rects.floorAt/ceilingAt으로 높이를 제공한다.
import * as THREE from 'three';
import { animateLimbs } from '../sphere/Character.js';
import { smoothK } from '../util/math.js';
import { frameSubject } from '../render/SubjectCamera.js';
import { frameTask,relaxWorkspace } from '../render/TaskCamera.js';
import { SceneRayQuery } from '../render/SceneRayQuery.js';
import { followVisibleCamera } from '../render/VisibleCameraFollow.js';

const SPEED = 3.6, RUN = 6.0, TURN = 12;
// 점프 높이 ≈ v²/2g = 0.9u. 레이저 낮은 줄(0.75u)을 넘고 높은 줄(2.2u)에는 안 닿는다.
const JUMP_V = 4.2, GRAVITY = 9.8;

export class RoomActor {
  // SurfaceActor는 mesh(위치 캐리어)와 body(캐릭터 모델)를 나눠 갖는다.
  // 실내에서도 그 구조를 그대로 쓴다 — body를 따로 만들면 커스터마이즈가 갈라진다.
  //   mesh   씬에 넣고 빼는 대상. 위치·회전을 여기에 건다
  //   body   팔다리 애니메이션 대상. 발끝이 로컬 0이라 footOffset만큼 띄운다
  // rects: [{x0,x1,z0,z1,h,open}] — 걸을 수 있는 영역. 닫힌 문은 open=false다.
  // ★ 처음엔 방 하나를 L자 사각형 둘로 하드코딩했다. 방이 넷이 되면서 못 쓴다.
  //   영역 목록으로 바꾸면 방을 몇 개 잇든 코드가 그대로다.
  constructor(mesh, body, footOffset, rects) {
    this.mesh = mesh;
    this.body = body;
    this.footOffset = footOffset || 0;
    this.rects = rects || [];
    // 점프 — 레이저를 넘으려면 필요하다. 구면의 점프는 up 방향이라 여기선 못 쓴다.
    this.vy = 0; this.grounded = true;
    this.position = new THREE.Vector3();
    this.heading = new THREE.Vector3(0, 0, -1);
    this.moving = false; this.running = false;
    this.travelSpeed=0;
    // 카메라 자체 방위. 바깥과 달리 up이 항상 +Y라 각도 하나면 된다.
    this.camYaw = Math.PI;
    this.freeCam = false;                // 열린 사당 — boot이 켠다
    this._camPlaced = false;
    this._cameraLookHeight = 1.25;
    // 방 안 장애물(석상 등). 원기둥 하나면 충분하다 — 실내엔 몇 개 없다.
    this.obstacles = [];
    // 얼음 바닥 — 0이면 보통 바닥, 1이면 완전히 미끄럽다. 관문이 켜고 끈다.
    // 관성을 액터에 두는 이유: 미끄러짐은 "방의 성질"이 아니라 **걷기의 성질**이다.
    // 관문이 매 프레임 위치를 보정하는 식으로 만들면 카메라가 한 프레임씩 튄다.
    this.slip = 0;
    this.vel = new THREE.Vector2(0, 0);
    // 화면 흔들림 — 화산 사당의 지진. 관문이 매 프레임 값을 써 넣고 여기서 감쇠시킨다.
    // ★ 흔들림은 장식이 아니라 **신호**다. 큰 진동 전에 작은 예진이 먼저 오고,
    //   그걸 알아채는 아이는 안 죽는다. 그래서 세기를 관문이 정확히 통제해야 한다.
    this.shake = 0;
  }

  floorAt(x, z, y = this.position.y) { return this.rects.floorAt?.(x, z, y) ?? 0; }

  setAt(x, z, headingZ = -1, floorY = 0) {
    this.position.set(x, this.floorAt(x, z, floorY), z);
    this.vy = 0; this.grounded = true;
    if (this.vel) this.vel.set(0, 0);
    this.heading.set(0, 0, headingZ).normalize();
    this.camYaw = Math.atan2(-this.heading.x, -this.heading.z);
    this._camPlaced = false;
    this.syncMesh();
    this._workspaceOffset=null;this._workspaceCameraOffset=null;this._workspaceCache=null;this._workspaceAge=0;
    this._cameraForecast=null;this._cameraMotionFoot=null;this._cameraWasAnticipating=false;
  }

  // 이 점이 열린 영역 **아무 데나** 들어 있는가(여백 없음).
  _in(x, z) {
    for (const r of this.rects) {
      if (!r.open) continue;
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
    }
    return false;
  }

  // 이 점이 걸을 수 있는가.
  // ★ 처음엔 사각형 하나하나를 여백만큼 **안쪽으로 줄여** 검사했다. 그랬더니
  //   구간들이 맞닿기만 하고 겹치지 않아서(입구 z≥6, r1 z≤6) 이음매마다
  //   폭 1.0u의 **어디에도 속하지 않는 띠**가 생겼고, 아이는 z=6.54에서 벽도 없는데
  //   막혔다. 방 하나가 아니라 문 일곱 개가 전부 이랬다(실사용 확인).
  //   고치는 법: 여백을 사각형이 아니라 **합집합의 경계**에 건다.
  //   내 주변 네 방향이 전부 열린 영역이면 벽에서 떨어져 있는 것이고,
  //   이음매에서는 옆 구간이 그 자리를 메워 주므로 자연히 통과된다.
  _walkable(x, z, m = 0.5) {
    return this._in(x, z)
      && this._in(x + m, z) && this._in(x - m, z)
      && this._in(x, z + m) && this._in(x, z - m);
  }

  // 벽에 부딪히면 멈추지 않고 **미끄러진다.** 정면으로 막히면 옆으로 흐르게 —
  // 안 그러면 좁은 통로 입구에서 걸려 아이가 "못 지나간다"고 느낀다.
  _move(from, dx, dz) {
    const work=this.body?.userData.workContact;
    if(work?.modern&&work.limits&&from.z>=work.limits.z0-.1&&from.z<=work.limits.z1+.1)dz=THREE.MathUtils.clamp(from.z+dz,work.limits.z0,work.limits.z1)-from.z;
    const can = (x, z) => this._walkable(x, z) && this.floorAt(x, z, from.y) <= from.y + 0.26;
    if (can(from.x + dx, from.z + dz)) { from.x += dx; from.z += dz; return; }
    if (can(from.x + dx, from.z)) { from.x += dx; return; }
    if (can(from.x, from.z + dz)) { from.z += dz; return; }
  }

  // 장애물 밀어내기 — 석상 안으로 걸어 들어가면 즉시 고장으로 읽힌다.
  //
  // 모양은 둘이다. 원 하나 `{x,z,r}`, 또는 두 점을 잇는 **캡슐** `{x,z,x2,z2,r}` —
  // 스핀에서 r 안쪽 전부. 캡슐은 "같은 원을 줄지어 놓은 것"과 바깥 경계가 같다.
  //
  // ★ 왜 캡슐이 필요한가. 가로로 긴 콘솔(4.2u)을 원 하나로 막으면 밀려나는 거리가
  //   손 닿는 거리보다 멀어지므로 **원 셋으로 나눠** 놨었다(간격 1.5, 반지름 0.9).
  //   그런데 반지름 0.9짜리 둘을 1.5 간격으로 두면 0.3만큼 겹치고, 겹친 자리에는
  //   바깥쪽으로 **V자 홈**이 생긴다. 그 홈이 이 밀어내기의 **고정점**이다 —
  //   앞의 원이 뒤의 원 안으로 밀어 넣고 뒤의 원이 도로 제자리로 밀어내서
  //   한 프레임에 한 번씩만 도는 이 반복문은 **알짜 이동이 정확히 0**이 된다.
  //   실제로 연구실에서 다이얼 1과 2 사이(x=-0.7693, z=-5.3328)에 끼면 좌표가
  //   소수점까지 매 프레임 똑같았다. 아이는 다이얼 하나를 맞춘 뒤 옆 다이얼로
  //   **한 픽셀도 못 갔다.** 홈을 메우는 것이 아니라 **홈이 안 생기게** 해야 한다.
  //   스핀이 직선인 캡슐은 볼록해서 홈이 없다.
  //
  //   반복을 늘리는 것으로는 안 고쳐진다. 두 원이 만나는 점은 자유 공간의 진짜
  //   오목 모서리라서, 몇 번을 돌려도 거기로 수렴할 뿐이다. 모양을 고쳐야 한다.
  _pushOut(p, obstacles=this.obstacles) {
    for (const o of obstacles) {
      if(o.disabled===true)continue;
      if(o.maxY!==undefined&&(p.y>=o.maxY||p.y+1.65<=o.minY))continue;
      if(o.shape==='box'){
        const pad=o.padding??.28,cx=THREE.MathUtils.clamp(p.x,o.x0,o.x1),cz=THREE.MathUtils.clamp(p.z,o.z0,o.z1),dx=p.x-cx,dz=p.z-cz,d=Math.hypot(dx,dz);
        if(d>=pad)continue;
        if(d>1e-6){p.x=cx+dx/d*pad;p.z=cz+dz/d*pad;}
        else if(o.escapeX){p.x=(o.escapeX<0?o.x0-pad:o.x1+pad);}
        else if(o.escapeZ){p.z=(o.escapeZ<0?o.z0-pad:o.z1+pad);}
        else{const sides=[{axis:'x',v:o.x0-pad},{axis:'x',v:o.x1+pad},{axis:'z',v:o.z0-pad},{axis:'z',v:o.z1+pad}];sides.sort((a,b)=>Math.abs(p[a.axis]-a.v)-Math.abs(p[b.axis]-b.v));p[sides[0].axis]=sides[0].v;}
        continue;
      }
      let cx = o.x, cz = o.z;
      if (o.x2 !== undefined) {                     // 캡슐 — 스핀 위 가장 가까운 점
        const vx = o.x2 - o.x, vz = o.z2 - o.z;
        const L2 = vx * vx + vz * vz;
        const t = L2 > 1e-9
          ? Math.max(0, Math.min(1, ((p.x - o.x) * vx + (p.z - o.z) * vz) / L2)) : 0;
        cx = o.x + vx * t; cz = o.z + vz * t;
      }
      const dx = p.x - cx, dz = p.z - cz;
      const d = Math.hypot(dx, dz);
      if (d < o.r && d > 1e-6) { p.x = cx + dx / d * o.r; p.z = cz + dz / d * o.r; }
      else if(d<1e-6&&o.escapeX!==undefined){p.x=cx+o.escapeX*o.r;p.z=cz+o.escapeZ*o.r;}
    }
  }

  update(dt, intent, camera) {
    const startX=this.position.x,startZ=this.position.z;
    const work=this.body?.userData.workContact;
    // 카메라 기준 이동 — 화면에서 위로 밀면 화면 안쪽으로 간다
    const cf = _fwd.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const cr = _right.set(cf.z, 0, -cf.x);
    _move.set(0, 0, 0).addScaledVector(cf, intent.y).addScaledVector(cr, intent.x);
    const strength=Math.min(1,_move.length());
    this.moving = _move.lengthSq() > 1e-6;
    this.running = !!intent.run && this.moving&&!work?.modern;

    const sp = work?.modern?2.4:this.running?RUN:SPEED;
    (this._cameraIntentStep??=new THREE.Vector3()).copy(_move).normalize().multiplyScalar(sp*strength*dt);
    if (this.slip > 0) {
      // 얼음 — 미는 힘은 약하고 멈추는 힘은 더 약하다. 그래서 미리 감속해야 한다.
      const accel = 9.0 * (1 - this.slip * 0.72);
      const drag = 1 - Math.min(1, dt * (7.5 - this.slip * 7.0));
      if (this.moving) { this.vel.x += _move.x * accel * dt; this.vel.y += _move.z * accel * dt; }
      this.vel.multiplyScalar(drag);
      const v = this.vel.length();
      if (v > sp) this.vel.multiplyScalar(sp / v);
      if (v > 0.02) {
        this._move(this.position, this.vel.x * dt, this.vel.y * dt);
        this._pushOut(this.position);
        _move.set(this.vel.x, 0, this.vel.y).normalize();
        this.moving = true;                 // 미끄러지는 중엔 손을 떼도 걷는 자세다
      }
    } else if (this.moving) {
      this.vel.set(0, 0);
      _move.normalize();
      this._move(this.position, _move.x * sp * strength * dt, _move.z * sp * strength * dt);
      this._pushOut(this.position);
      // 진행 방향으로 부드럽게 돈다
      if(!work){const target = Math.atan2(_move.x, _move.z);
      const cur = Math.atan2(this.heading.x, this.heading.z);
      let d = target - cur;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const step = Math.max(-TURN * dt, Math.min(TURN * dt, d));
      const na = cur + step;
      this.heading.set(Math.sin(na), 0, Math.cos(na));}
    }

    // 점프 — 레이저 관문에서만 쓰지만 어디서든 뛸 수 있어야 한다.
    // 아이가 "뛰어 보는" 행동을 막으면 세계가 죽은 것처럼 느껴진다.
    const floor = this.floorAt(this.position.x, this.position.z);
    if (this.grounded) {
      if (this.position.y - floor > 0.3) { this.grounded = false; this.vy = 0; }
      else this.position.y = floor;
    }
    if (intent.jump && this.grounded) { this.vy = JUMP_V; this.grounded = false; }
    if (!this.grounded) {
      this.vy -= GRAVITY * dt;
      this.position.y += this.vy * dt;
      const ceiling = this.rects.ceilingAt?.(this.position.x, this.position.z, this.position.y) ?? Infinity;
      if (this.vy > 0 && this.position.y + 1.65 >= ceiling) {
        this.position.y = Math.max(floor, ceiling - 1.65); this.vy = 0;
      }
      if (this.position.y <= floor) { this.position.y = floor; this.vy = 0; this.grounded = true; }
    }

    const handAction=this.body?.userData.navigator?.poseLayer?.use,handTarget=this.body?.userData.actionTargetWorld;
    if(work&&this.grounded)this.heading.lerp(work.facing,1-Math.exp(-dt*18)).normalize();
    if(!this.moving&&handAction&&handTarget){const wanted=_move.copy(handTarget).sub(this.position).setY(0);if(wanted.lengthSq()>.001){wanted.normalize();this.heading.lerp(wanted,1-Math.exp(-dt*14)).normalize();}}
    this.travelSpeed=dt>0?Math.hypot(this.position.x-startX,this.position.z-startZ)/dt:0;
    const reverse=!!work&&((this.position.x-startX)*work.facing.x+(this.position.z-startZ)*work.facing.z)<-.00001;
    animateLimbs(this.body, dt, this.travelSpeed>.01, this.running, { airborne: !this.grounded, vy: this.vy, speed:this.travelSpeed,reverse,runBlend:work?0:undefined });
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.copy(this.position);   // y는 점프 높이를 포함한다
    this.mesh.quaternion.setFromAxisAngle(_Y, Math.atan2(this.heading.x, this.heading.z));
    // 바깥에서는 SurfaceActor가 해 주던 일. 실내에서는 여기서 한다.
    if (this.body) this.body.position.y = this.footOffset + (this.body.userData.bob || 0);
  }

  // 이 점이 방(또는 통로) 안인가. 카메라를 가두는 데 쓴다.
  // 여백을 두는 이유: 벽에 정확히 붙으면 근평면(0.3u)이 벽을 뚫어 벽 너머가 보인다.
  // 닫힌 문도 카메라에겐 통과 가능하다 — 문 너머가 보이는 건 오히려 좋다(다음 목표).
  // 걷기와 같은 이유로 여백은 합집합 경계에 건다. 안 그러면 이음매마다 카메라가 튄다.
  // ★ 열린 사당(freeCam)에서는 옆벽이 없다. 카메라가 섬 가장자리 밖 허공에 서도
  //   보이는 건 하늘뿐이라 괜찮다 — 다만 4u까지만. 더 나가면 섬이 화면에서 빠진다.
  //   바닥 최저는 1.0 — 난간(0.9)보다 높아야 난간 속으로 안 들어간다.
  _inAny(x, z, y) {
    const pad = this.freeCam ? 4 : 0, ymin = this.freeCam ? 1.0 : 0.4;
    for (const r of this.rects) {
      const top = (r.camH ?? r.h) - 0.35;
      if (x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad
        && y >= ymin && y <= top) return true;
    }
    return false;
  }

  _inside(p, m = 0.45) {
    return this._inAny(p.x, p.z, p.y)
      && this._inAny(p.x + m, p.z, p.y) && this._inAny(p.x - m, p.z, p.y)
      && this._inAny(p.x, p.z + m, p.y) && this._inAny(p.x, p.z - m, p.y);
  }

  // 3인칭 카메라.
  // ★ 처음엔 y만 클램프하고 x·z를 놔뒀다. 시점을 돌리면 카메라가 **벽을 통과해** 밖으로
  //   나가서 검은 공간에서 방을 들여다보게 됐다(실사용 확인).
  //   x·z를 잘라 가두면 카메라가 플레이어 안으로 파고든다. 그래서 자르는 게 아니라
  //   **시선표적에서 카메라 쪽으로 나아가다 벽에 닿는 지점에서 멈춘다** — 바깥 카메라가
  //   건물에 raycast를 쏘는 것과 같은 해법이고, 상자 방이라 훨씬 싸게 된다.
  // 여기 서 있을 때 천장이 얼마나 낮은가 — 카메라가 물러날 방향 쪽을 본다.
  // 뒤로 갈수록 천장이 달라지므로(복도로 물러나는 경우) **가장 낮은 것**을 쓴다.
  _ceilBehind(target, dirX, dirZ, dist) {
    let lo = Infinity;
    for (let i = 0; i <= 6; i++) {
      const k = (i / 6) * dist;
      const x = target.x + dirX * k, z = target.z + dirZ * k;
      let best = 0;
      for (const r of this.rects) {
        const ch = r.camH ?? r.h;
        if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && ch > best) best = ch;
      }
      if (best > 0 && best < lo) lo = best;
      const deck = this.rects.ceilingAt?.(x, z, this.position.y) ?? Infinity;
      lo = Math.min(lo, deck);
      if (best === 0) break;                      // 밖이면 더 볼 것 없다
    }
    return lo === Infinity ? 0 : lo;
  }

  cameraProfile() {
    const p=this.position,zone=this.rects.cameraLookHeightZones?.find(r=>p.x>=r.x0&&p.x<=r.x1&&p.z>=r.z0&&p.z<=r.z1);
    if(!zone?.overview)return zone;
    const wide=zone.overview,zoom=this._cameraInput?.camDist??9,pitch=this._cameraInput?.camPitch??.5;
    // Looking up provides the same optional overview on touch, without stealing
    // the existing two-thumb movement/look gesture or adding another HUD mode.
    const request=Math.max(THREE.MathUtils.smoothstep(zoom,wide.zoomStart,wide.zoomEnd),
      1-THREE.MathUtils.smoothstep(pitch,wide.lookUpEnd,wide.lookUpStart));
    const heading=Number.isFinite(wide.focusZ)?Math.atan2(p.x-wide.focusX,p.z-wide.focusZ):this.camYaw;
    const facing=wide.facingStart===undefined?1:THREE.MathUtils.smoothstep(Math.cos(this.camYaw-heading),wide.facingStart,wide.facingFull);
    const mix=request*facing,narrow=wide.narrow?1-THREE.MathUtils.smoothstep(this._cameraAspect??1,wide.narrow.aspectEnd,wide.narrow.aspectStart):0;
    const profile={overviewMix:mix,minPitch:THREE.MathUtils.lerp(.12,wide.minPitch??.12,request)};
    for(const key of ['lookHeight','minDistance','maxDistance','distanceScale']){
      const overview=THREE.MathUtils.lerp(wide[key],wide.narrow?.[key]??wide[key],narrow);
      profile[key]=THREE.MathUtils.lerp(zone[key],overview,mix);
    }
    return profile;
  }

  lookHeight() { return this.cameraProfile()?.lookHeight??1.25; }

  updateCamera(camera, input, dt) {
    const previousRotation=this.rects.workspaceAspectFit&&this._camPlaced&&dt>0?camera.quaternion.clone():null;
    this._cameraInput=input;
    this._cameraAspect=camera.aspect;
    if(this.rects.workspaceAspectFit||this._workspaceLensActive){
      const fit=this.rects.workspaceAspectFit?Math.max(1,1/camera.aspect):1;
      const wanted=Math.min(100,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(62)/2)*fit)));
      const fov=this._camPlaced&&dt>0?THREE.MathUtils.lerp(camera.fov,wanted,1-Math.exp(-8*dt)):wanted;
      if(Math.abs(camera.fov-fov)>.00001){camera.fov=fov;camera.updateProjectionMatrix();}
      this._workspaceLensActive=!!this.rects.workspaceAspectFit||Math.abs(fov-62)>.001;
    }
    this.camYaw += input.consumeYaw();
    const zone=this.cameraProfile();
    let pitch = Math.max(zone?.minPitch??0.12, Math.min(0.7, input.camPitch));
    let dist = Math.max(zone?.minDistance??3.2, Math.min(zone?.maxDistance??6.5, input.camDist*(zone?.distanceScale??1)));
    const requestedDistance=dist;
    for(const focus of this.rects.cameraApproachZones||[]){
      const near=1-THREE.MathUtils.smoothstep(Math.hypot(this.position.x-focus.x,this.position.z-focus.z),focus.near,focus.far);
      dist=Math.min(dist,THREE.MathUtils.lerp(requestedDistance,Math.min(requestedDistance,focus.distance),near));
    }
    const wantedHeight = this.lookHeight();
    this._cameraLookHeight = this._camPlaced
      ? this._cameraLookHeight + (wantedHeight - this._cameraLookHeight) * smoothK(0.0009, dt) : wantedHeight;
    const target = _tgt.copy(this.position).setY(this.position.y + this._cameraLookHeight);

    // ★ 천장이 낮으면 **거리를 줄이지 말고 각도를 낮춘다.**
    //
    //   예전엔 뒤로 물러나다 천장에 걸리면 그냥 거리를 잘랐다. 그래서 낮은 데서는
    //   카메라가 뒤통수에 달라붙었다. 재 보니 55칸 중 19칸이 그랬고, 하필 **사당
    //   입구 복도 여섯 곳 전부**가 희망 거리의 38%밖에 못 냈다 — 사당에 들어서는
    //   첫 장면이 가장 눌려 있었던 것이다. 실사용에서 들은 "높이가 낮아서 답답하다"가
    //   이거였다. 복도 폭 3u는 캐릭터 폭의 4.8배라 좁은 적이 없었고, 천장 3.2u도
    //   실척으로 3.8m다. 좁은 게 아니라 **카메라가 천장 위에 서고 싶어 했다**
    //   (희망 높이 1.25 + 6.5·sin28.6° = 4.37u).
    //
    //   각도를 낮추면 카메라가 낮게, 그러나 **멀리** 선다. 복도가 길어 보이고
    //   앞이 뚫린다. 각도를 최저까지 낮춰도 안 될 때만 그때 거리를 줄인다.
    const hx = Math.sin(this.camYaw), hz = Math.cos(this.camYaw);
    const ceil = this._ceilBehind(target, hx, hz, dist);
    if (ceil > 0) {
      const room = ceil - CEIL_PAD - target.y;
      const maxSin = Math.max(0, room) / dist;
      if (maxSin < Math.sin(pitch)) pitch = Math.max(0.12, Math.asin(Math.min(1, maxSin)));
    }

    const dir = _dir.set(hx * Math.cos(pitch), Math.sin(pitch), hz * Math.cos(pitch));

    // 벽에 닿기 직전까지만 물러난다. 16단이면 방 크기(16u) 기준 1u 간격이라 충분하다.
    const STEPS = 16;
    let t = 1;
    for (let i = 1; i <= STEPS; i++) {
      const k = i / STEPS;
      _probe.copy(target).addScaledVector(dir, dist * k);
      if (!this._inside(_probe)) { t = (i - 1) / STEPS; break; }
    }
    const camDist = Math.max(1.4, dist * t);      // 너무 붙으면 캐릭터 안이 보인다
    const desired = _des.copy(target).addScaledVector(dir, camDist);
    const subjectZone=this.rects.cameraSubjectZones?.find(zone=>this.position.x>=zone.x0&&this.position.x<=zone.x1&&this.position.z>=zone.z0&&this.position.z<=zone.z1);
    let cameraMotion=null;
    if(subjectZone?.anticipateMotion){
      const previous=this._cameraMotionFoot??=this.position.clone(),motion=this._cameraSubjectMotion??=new THREE.Vector3();
      motion.subVectors(this.position,previous).setY(0);if(!this._camPlaced||!this._cameraWasAnticipating||motion.lengthSq()>.25)motion.set(0,0,0);previous.copy(this.position);cameraMotion=motion;
      // Forecast the controller's actual boundary slides, rather than extending
      // the clipped velocity through a bridge post when the passage widens.
      const step=this._cameraIntentStep,path=this._cameraForecast??=Array.from({length:16},()=>new THREE.Vector3());
      const predicted=this.position.clone();
      if(step&&this.grounded&&!this.slip)for(const point of path){this._move(predicted,step.x,step.z);this._pushOut(predicted);point.copy(predicted);}
      else for(let i=0;i<path.length;i++)path[i].copy(this.position).addScaledVector(motion,i+1);
    }
    this._cameraWasAnticipating=!!subjectZone?.anticipateMotion;
    const preferredSubjectCamera=subjectZone?(subjectZone.minRetreat>0?target.clone().addScaledVector(dir,dist):desired.clone()):null;

    // 입체 회랑의 옆면은 기존 사각형 경계만으로 알 수 없다. 실제 메시로 시선 충돌을 푼다.
    const occluders = this.rects.cameraOccluders;
    const visible = (occluders||[]).filter(m => { if(m.userData.cameraIgnored)return false;for (let o = m; o; o = o.parent) if (!o.visible) return false; return true; });
    for (const m of visible) m.updateWorldMatrix(true, false);
    const queries=this._cameraRayQuery??=new SceneRayQuery();queries.update(visible);visible.rayQuery=queries;
    const avoid = p => {
      if (!occluders) return;
      _rayDir.subVectors(p, target); const length = _rayDir.length();
      if (length < 0.01) return;
      _ray.set(target, _rayDir.divideScalar(length)); _ray.far = length + 0.25;
      const hit = queries.closest(_ray);
      // 벽 바로 앞에서는 0.6u 최소 거리도 벽 너머가 된다. 충돌면 앞의 여유를 우선한다.
      if (hit) p.copy(target).addScaledVector(_rayDir, Math.max(0.12, hit.distance - 0.35));
    };
    avoid(desired);
    // 열린 회랑과 그 연결 다리에서는 장치 뒤로 카메라가 끼면 위로 돌아본다.
    // 이동 등불이 다리의 시선을 가릴 때도 같은 후퇴 거리를 확보한다.
    const lift = [...(this.rects.cameraLiftZones || []), this.rects.cameraLiftZone].find(zone => zone
      && this.position.x >= zone.x0 - dist && this.position.x <= zone.x1 + dist
      && this.position.z >= zone.z0 - dist && this.position.z <= zone.z1 + dist);
    if (lift && desired.distanceTo(target) < dist * 0.85) {
      for (const angle of [0.72, 0.95, 1.2]) {
        _lift.copy(target).add(new THREE.Vector3(hx * Math.cos(angle), Math.sin(angle), hz * Math.cos(angle)).multiplyScalar(dist));
        if (!this._inside(_lift)) continue;
        avoid(_lift);
        if (_lift.distanceTo(target) > desired.distanceTo(target)) desired.copy(_lift);
        if (desired.distanceTo(target) >= dist * 0.85) break;
      }
    }

    if(subjectZone)frameSubject(this,target,desired,visible,p=>this._inside(p),avoid,preferredSubjectCamera,dt,subjectZone.halfWidth||0,subjectZone.pitchAssist||0,subjectZone.minRetreat||0,subjectZone.yawAssist??.5);
    else{this._subjectOffset=0;this._subjectCameraCache=null;this._subjectCacheAge=0;this.cameraReadability=null;}
    const taskZone=this.rects.cameraTaskZones?.find(zone=>zone.active()&&this.position.x>=zone.x0&&this.position.x<=zone.x1&&this.position.z>=zone.z0&&this.position.z<=zone.z1&&zone.facing(this.camYaw));
    if(taskZone)frameTask(this,camera,target,desired,visible,taskZone,p=>this._inside(p),avoid,dt);
    else{relaxWorkspace(this,target,desired,visible,avoid,dt);this._taskOffset=undefined;this._taskAge=0;this.taskReadability=null;}
    if (!this._camPlaced) { camera.position.copy(desired); this._camPlaced = true; }
    else if(subjectZone?.smoothOcclusion&&dt>0)this.cameraTransition=followVisibleCamera(camera.position,desired,target,this.position,visible,p=>this._inside(p),smoothK(0.0009,dt),dt,subjectZone.halfWidth||.22,cameraMotion,this._cameraForecast);
    else {camera.position.lerp(desired, smoothK(0.0009, dt));this.cameraTransition=null;}
    avoid(camera.position);

    if (this.shake > 0.001) {
      const a = this.shake;
      camera.position.x += (Math.random() - 0.5) * a;
      camera.position.y += (Math.random() - 0.5) * a * 0.7;
      camera.position.z += (Math.random() - 0.5) * a;
      this.shake = Math.max(0, this.shake - dt * 2.4);
    }
    camera.up.set(0, 1, 0);
    camera.lookAt(this._workspaceOffset?target.clone().add(this._workspaceOffset):target);
    if(previousRotation){const wanted=camera.quaternion.clone();camera.quaternion.copy(previousRotation).rotateTowards(wanted,10*dt);}
  }
}

// _inAny가 천장에서 잘라내는 여백과 **같아야 한다.** 다르면 각도를 낮춰 놓고도
// 탐침이 또 걸려서 결국 거리가 줄어든다 — 고친 줄 알았는데 안 고쳐지는 종류다.
const CEIL_PAD = 0.35;

const _Y = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _move = new THREE.Vector3();
const _dir = new THREE.Vector3(), _tgt = new THREE.Vector3(), _des = new THREE.Vector3();
const _probe = new THREE.Vector3();
const _lift = new THREE.Vector3();
const _ray = new THREE.Raycaster(), _rayDir = new THREE.Vector3();
