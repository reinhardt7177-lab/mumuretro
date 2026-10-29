// 구면 행성. 아래 봉우리/분지는 기존 저장과 장소 선택의 기준 높이장이다.
// 장소를 확정한 뒤 Landscape의 자체 설계 능선과 건축 부지를 적용한다.
// 원작의 내부 지형 알고리즘이나 개발 수치를 복원했다는 의미가 아니다.
import * as THREE from 'three';
import { PlanetSurfaceIndex } from './PlanetSurfaceIndex.js';
import { fbm } from '../util/noise.js';
import { GROUND, PATH } from '../data/lighting.js';
import { addSurfaceDetail } from '../render/SurfaceDetail.js';
import { createLandscape } from '../world/Landscape.js';
import { createTerracedRelief } from '../world/TerracedRelief.js';

// 고도와 경사로 지면 색을 고른다.
// ★ 지도(ui/MapPage.js)가 이 함수를 그대로 쓴다. 지도용 색을 따로 적으면
//   지형을 손볼 때마다 두 곳이 어긋나고, 아이 눈에는 "지도가 틀렸다"로 보인다.
const _gLow = new THREE.Color(GROUND.grassLow);
const _gHigh = new THREE.Color(GROUND.grassHigh);
const _rock = new THREE.Color(GROUND.rock);
const _rockD = new THREE.Color(GROUND.rockDark);
const _peak = new THREE.Color(GROUND.peak);
const _sand = new THREE.Color(GROUND.sand);

export function terrainColor(h, slopeDeg, out) {
  // 고도 t: 분지 바닥(−3) → 최고봉(15)
  const t = Math.min(1, Math.max(0, (h + 3) / 18));
  if (t < 0.10) out.copy(_sand).lerp(_gLow, t / 0.10);          // 저지대 마른 흙 → 풀
  else if (t > 0.72) out.copy(_gHigh).lerp(_peak, (t - 0.72) / 0.28); // 정상부는 밝게
  else out.copy(_gLow).lerp(_gHigh, (t - 0.10) / 0.62);
  out.lerp(_rock, THREE.MathUtils.smoothstep(slopeDeg, 30, 40));
  out.lerp(_rockD, THREE.MathUtils.smoothstep(slopeDeg, 44, 52));
  return out;
}

export const SCALE = 2;
export const R = 34 * SCALE;                 // 68u. 둘레 427u
export const GRAIN_AMP = 0.8;                // 표면 잔결 — 이 값이 2u를 넘으면 실루엣을 오염시킨다

// 지형 메시 세밀도. IcosahedronGeometry의 detail은 각 모서리를 (detail+1)등분한다.
// 정점 간격 ≈ 1.0515·R / (detail+1) = 1.98u — 로우폴리 면이 눈에 보이는 밀도다.
// 플랫 셰이딩과 면 단위 색을 쓰므로 이 면들이 곧 디테일이 된다(§"정점 색").
const DETAIL = 36;

// ── 봉우리 목록 ─────────────────────────────────────────────────────────────
// 손으로 배치한다. 이 배열이 이 행성의 지형 전부다.
//   r  영향 반경(도). 지평선이 23.6°이므로 r=22면 화면을 꽉 채우는 주 랜드마크가 된다
//   h  높이(월드 단위). 플레이어 키 1.5u 기준
//   s  프로파일 지수. 1.0이면 곧은 원뿔(=삼각형), 클수록 밑동이 넓고 끝이 뾰족해진다
//
// 크기를 반드시 다르게 둔다 — 같은 크기가 반복되면 노이즈와 똑같아진다.
// 큰 것 하나, 중간 다섯, 작은 여섯.
export const PEAKS = [
  // 주 랜드마크 — 행성 어디서든 이것 하나는 방향 기준이 된다
  { lat:  30, lon:   0, r: 22, h: 15.0, s: 1.15 },
  // 중간 — 구역을 가르고 시야를 자른다
  { lat: -10, lon:  70, r: 15, h:  9.0, s: 1.10 },
  { lat:  55, lon: 140, r: 14, h:  8.0, s: 1.25 },
  { lat: -40, lon: 200, r: 16, h: 10.0, s: 1.05 },
  { lat:  10, lon: 250, r: 13, h:  7.0, s: 1.20 },
  { lat: -25, lon: 310, r: 12, h:  6.5, s: 1.15 },
  // 작은 것 — 걷는 동안의 리듬. 넘어갈지 돌아갈지를 자주 묻는다
  { lat:  45, lon:  45, r:  8, h:  4.0, s: 1.30 },
  { lat: -55, lon:  20, r:  9, h:  4.5, s: 1.20 },
  { lat:  15, lon: 180, r:  8, h:  3.8, s: 1.35 },
  { lat: -15, lon: 120, r:  7, h:  3.2, s: 1.40 },
  { lat:  70, lon: 260, r: 10, h:  5.0, s: 1.10 },
  { lat: -70, lon: 150, r:  9, h:  4.2, s: 1.25 },
  // ── 커버리지 보충 ────────────────────────────────────────────────────────
  // §1 규칙 "어느 지점에 서도 목표가 최소 두 개". __dbg.landmarkCoverage로 재 보니
  // 위 12개만으로는 400표본 중 63곳에서 하나 이하만 보였다. 구멍 좌표를 그대로 읽어 메운다.
  // 높이를 6~7u대로 잡은 이유: 가시 거리 = 28 + √(2·R·h)라 6u면 57u까지 보인다.
  // 4u짜리로 메우면 51u밖에 못 미쳐 구멍이 다시 생긴다.
  { lat: -25, lon: 285, r: 13, h:  7.2, s: 1.15 },
  { lat: -18, lon:  10, r: 11, h:  6.2, s: 1.25 },
  { lat:  20, lon: 225, r: 12, h:  6.6, s: 1.10 },
  { lat:  25, lon: 118, r: 11, h:  6.0, s: 1.30 },
  { lat:  58, lon: 300, r: 12, h:  6.8, s: 1.20 },
  // 2차 보충 — 남반구 lon 130~225에 큰 공백이 남아 있었다(13곳).
  // (-30,172) 하나가 lon 136~164 무리와 193~225 무리를 동시에 덮는다.
  { lat: -30, lon: 172, r: 12, h:  6.6, s: 1.15 },
  { lat: -38, lon: 232, r: 11, h:  6.2, s: 1.20 },
  { lat:  -5, lon:  45, r: 11, h:  6.0, s: 1.25 },
];

// 얕은 분지 — 봉우리만 있으면 나머지가 전부 같은 높이의 평지가 된다.
// 파인 곳이 있어야 능선이 능선으로 읽힌다.
export const BASINS = [
  { lat:   0, lon:  35, r: 18, d: 3.0 },
  { lat:  35, lon: 200, r: 20, d: 3.6 },
  { lat: -50, lon: 265, r: 16, d: 2.6 },
];

const DEG = Math.PI / 180;

function latLonDir(latDeg, lonDeg) {
  const la = latDeg * DEG, lo = lonDeg * DEG;
  return new THREE.Vector3(
    Math.cos(la) * Math.cos(lo),
    Math.sin(la),
    Math.cos(la) * Math.sin(lo),
  );
}

// 미리 계산 — heightAt은 정점마다 불리므로 삼각함수를 매번 돌리면 안 된다.
const _peaks = PEAKS.map(p => ({
  dir: latLonDir(p.lat, p.lon), rad: p.r * DEG, h: p.h, s: p.s,
  cosR: Math.cos(p.r * DEG),
}));
const _basins = BASINS.map(b => ({
  dir: latLonDir(b.lat, b.lon), rad: b.r * DEG, d: b.d,
  cosR: Math.cos(b.r * DEG),
}));

export class Planet {
  constructor(scene) {
    this.R = R;
    this.scene = scene;
    this.levelSites=[];
    this.mesh = this._build();
    if (scene) scene.add(this.mesh);
  }

  // 지형 위에 별도 판을 놓지 않고 발길이 닿은 흙색을 지형 자신에 칠한다.
  // 원본 색에서 매번 시작하므로 같은 길을 다시 적용해도 색이 짙어지지 않는다.
  paintTrail(pathAt) {
    const geo = this.mesh.geometry, p = geo.attributes.position, c = geo.attributes.color;
    if (!this._unpaintedColors) this._unpaintedColors = c.array.slice();
    const dir = new THREE.Vector3(), color = new THREE.Color(), soil = new THREE.Color(PATH.soil);
    let painted = 0;
    for (let i = 0; i < p.count; i++) {
      dir.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      const amount = THREE.MathUtils.clamp(Number(pathAt?.(dir)) || 0, 0, 1);
      if (amount > 0) painted++;
      color.setRGB(this._unpaintedColors[i * 3], this._unpaintedColors[i * 3 + 1], this._unpaintedColors[i * 3 + 2]);
      color.lerp(soil, amount);
      c.setXYZ(i, color.r, color.g, color.b);
    }
    c.needsUpdate = true;
    return painted;
  }

  // ── 높이장 ────────────────────────────────────────────────────────────────
  // dir은 단위벡터. 반환값은 기준 R로부터의 높이(월드 단위).
  //
  // 봉우리 기여는 acos 없이 내적으로 끝낸다. 정점 27,000개 × 봉우리 12개를 매번
  // acos로 돌면 빌드가 눈에 띄게 멈춘다. cos(반경)과 비교해 영향권을 먼저 거른다.
  heightAt(dir,referenceProfile=false) {
    let height=this.baseHeightAt(dir);
    if(this.landscape)height+=this.landscape.delta(dir);
    if(this.terraces)height+=(referenceProfile?this.terraces.refinementDelta:this.terraces.delta)(dir,height);
    for(const site of this.levelSites){
      const dot=THREE.MathUtils.clamp(dir.x*site.dir.x+dir.y*site.dir.y+dir.z*site.dir.z,-1,1);if(dot<=site.cosOuter)continue;
      const distance=Math.acos(dot)*this.R,amount=1-THREE.MathUtils.smoothstep(distance,site.inner,site.outer);
      // A plane perpendicular to local gravity, rather than a smaller sphere.
      const flat=(this.R+site.height)/dot-this.R;
      height=THREE.MathUtils.lerp(height,flat,amount);
    }
    if(this.arrivalSupport)height+=this.arrivalSupport.delta(dir);
    return height;
  }

  applyLandscape(spec,protectedSites,trailSamples){
    this.landscape=createLandscape(this,PEAKS,spec,protectedSites,trailSamples);
    return this.landscape;
  }

  applyTerraces(spec,protectedSites,trailSamples){
    this.terraces=createTerracedRelief(this,spec,protectedSites,trailSamples);return this.terraces;
  }

  colorAt(dir,height,slope,out,exposure){terrainColor(height,slope,out);return this.terraces?this.terraces.colorAt(dir,height,slope,out,exposure):out;}

  levelSite(id,direction,inner,outer,rebuild=true){
    if(this.levelSites.some(s=>s.id===id))return this.levelSites.find(s=>s.id===id);
    const dir=direction.clone().normalize(),height=this.heightAt(dir),beforeSlope=this.slopeDegAt(dir);
    const site={id,dir,height,inner,outer,cosOuter:Math.cos(outer/this.R),beforeSlope};this.levelSites.push(site);
    if(rebuild)this.rebuildTerrain();
    site.afterSlope=this.slopeDegAt(dir);return site;
  }

  rebuildTerrain(){
    this._groundIndex?.dispose(); this._groundIndex=null;
    const replacement=this._build();this.mesh.geometry.dispose();this.mesh.material.dispose();
    this.mesh.geometry=replacement.geometry;this.mesh.material=replacement.material;this._unpaintedColors=null;
  }

  baseHeightAt(dir) {
    let h = 0;
    for (const p of _peaks) {
      const c = dir.x * p.dir.x + dir.y * p.dir.y + dir.z * p.dir.z;
      if (c <= p.cosR) continue;             // 영향권 밖 — acos 없이 걸러낸다
      const ang = Math.acos(Math.min(1, c));
      if (ang >= p.rad) continue;
      const t = 1 - ang / p.rad;
      h += p.h * Math.pow(t, p.s);          // s=1이면 곧은 원뿔 = 삼각형 단면
    }
    for (const b of _basins) {
      const c = dir.x * b.dir.x + dir.y * b.dir.y + dir.z * b.dir.z;
      if (c <= b.cosR) continue;
      const ang = Math.acos(Math.min(1, c));
      if (ang >= b.rad) continue;
      const t = 1 - ang / b.rad;
      h -= b.d * t * t;                     // 분지는 가장자리를 부드럽게(t²)
    }
    // 표면 잔결 — 실루엣이 아니라 면의 질감. 주파수를 높게, 진폭을 낮게.
    h += fbm(dir.x * 9, dir.y * 9, dir.z * 9, 3) * GRAIN_AMP;
    return h;
  }

  // 표면점(|·| = R + height)
  surfaceAt(dir, out = new THREE.Vector3()) {
    out.copy(dir).normalize();
    return out.multiplyScalar(R + this.heightAt(out));
  }

  // Authoring heightAt/surfaceAt remain analytic, so site choice, RNG,
  // static anchors and source GLB conforming do not silently change.
  enableMeshGround(options={}) {
    this._meshGroundEnabled=true;this._groundOptions=options;
    this._groundIndex?.dispose();this._groundIndex=new PlanetSurfaceIndex(this.mesh,options);
    return this._groundIndex;
  }
  get meshGroundActive() { return !!this._meshGroundEnabled; }
  meshGroundIndex() {
    if(!this._meshGroundEnabled)return null;
    if(!this._groundIndex?.isCurrent()) {
      this._groundIndex?.dispose();this._groundIndex=new PlanetSurfaceIndex(this.mesh,this._groundOptions);
    }
    return this._groundIndex;
  }
  groundHeightAt(dir) {
    const index=this.meshGroundIndex();if(!index)return this.heightAt(dir);
    const radius=index.radiusAt(dir);
    if(!Number.isFinite(radius))throw Error('Rendered terrain contact missing');
    return radius-this.R+(this.arrivalSupport?.delta(dir)||0);
  }
  groundSurfaceAt(dir,out=new THREE.Vector3()) {
    out.copy(dir).normalize();return out.multiplyScalar(this.R+this.groundHeightAt(out));
  }
  // Existing SurfaceTransform.moveOnSphere already calls this for every move,
  // including climb probes and collision recovery; jumpH remains independent.
  projectToSurface(v) {
    v.normalize();return v.multiplyScalar(this.R+this.groundHeightAt(v));
  }

  latLonToPos(latDeg, lonDeg) {
    return this.surfaceAt(latLonDir(latDeg, lonDeg));
  }

  // 경사(도) — 프롭 배치와 등반 판정에 쓴다.
  // 접선 두 방향으로 살짝 움직여 높이차를 본다.
  slopeDegAt(dir) {
    const up = _t1.copy(dir).normalize();
    const ref = Math.abs(up.y) > 0.99 ? _X : _Y;
    const e = _t2.crossVectors(ref, up).normalize();
    const n = _t3.crossVectors(up, e).normalize();
    const d = 0.6 / R;                          // 0.6u 떨어진 두 점
    const h0 = this.heightAt(up);
    const he = this.heightAt(_t4.copy(up).addScaledVector(e, d).normalize());
    const hn = this.heightAt(_t4.copy(up).addScaledVector(n, d).normalize());
    const g = Math.hypot(he - h0, hn - h0) / 0.6;
    return Math.atan(g) * 180 / Math.PI;
  }

  // 표면 위 물체를 앉히는 프레임(위치 + 회전). rotDeg는 up축 기준 yaw.
  frameAt(pos, rotDeg = 0) {
    const up = _t1.copy(pos).normalize();
    const ref = Math.abs(up.y) > 0.99 ? _X : _Y;
    const e = _t2.crossVectors(ref, up).normalize();
    const n = _t3.crossVectors(up, e).normalize();
    // ★ makeBasis(x, y, z)는 **오른손 기저**를 받는다(x × y = z).
    //   여기 e·up·n은 e = ref × up, n = up × e인데, e × up = −n이다.
    //   즉 (e, up, n)은 왼손 기저이고 행렬식이 −1 — 회전이 아니라 **반사**다.
    //   setFromRotationMatrix에 반사 행렬을 넣으면 엉뚱한 회전이 나온다.
    //   실제로 이걸로 세운 사당 여섯이 46°~110°씩 기울어 서 있었고, 내림판은
    //   아예 옆으로 누워 있었다(실사용 스크린샷에서 확인).
    //   z축을 e × up으로 잡으면 행렬식이 +1이 되고 로컬 +Y가 정확히 위를 본다.
    const zAx = new THREE.Vector3().crossVectors(e, up).normalize();
    const m = new THREE.Matrix4().makeBasis(e, up, zAx);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(_Y, rotDeg * DEG));
    return { position: this.surfaceAt(up), quaternion: q };
  }

  // ── 메시 ──────────────────────────────────────────────────────────────────
  // 지형 모양은 그대로 두고 공유 꼭짓점의 색·법선만 이어 준다.
  // 풀밭의 면 경계가 먼저 읽히던 현상을 줄이고, 돌 소품의 각진 면과 구분한다.
  _build() {
    const buildStarted=performance.now();
    const base = new THREE.IcosahedronGeometry(R, DETAIL);
    const refineSites=[...this.levelSites,...(this.terraces?.refinementSites||[])];
    const geo = refineSites.length?refineLevelSites(base,refineSites,R,this.terraces?.contract.refinementRounds||2,this.terraces?d=>this.heightAt(d,true):null):base;
    const pos = geo.attributes.position;
    const n = pos.count;
    const colors = new Float32Array(n * 3);

    const d = new THREE.Vector3();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const col = new THREE.Color(), tmp = new THREE.Color();

    // 1) 정점을 높이장으로 밀어낸다
    const heights = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      d.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      // The raised walkable floor is rendered by its real Blender mesh.
      // Keep soil underneath rather than drawing soil through the platform.
      const h = this.heightAt(d)-(this.arrivalSupport?.delta(d)||0);
      heights[i] = h;
      d.multiplyScalar(R + h);
      pos.setXYZ(i, d.x, d.y, d.z);
    }

    const rockFaceFlags=new Uint8Array(n/3);
    // 2) 면마다 색 — 고도와 경사 두 축으로 고른다
    for (let f = 0; f < n; f += 3) {
      a.set(pos.getX(f), pos.getY(f), pos.getZ(f));
      b.set(pos.getX(f + 1), pos.getY(f + 1), pos.getZ(f + 1));
      c.set(pos.getX(f + 2), pos.getY(f + 2), pos.getZ(f + 2));
      const hAvg = (heights[f] + heights[f + 1] + heights[f + 2]) / 3;

      // 면 법선과 반지름 방향의 각도 = 경사
      const nx = _t2.subVectors(b, a).cross(_t3.subVectors(c, a)).normalize();
      const up = _t4.copy(a).add(b).add(c).normalize();
      const slope = Math.acos(Math.min(1, Math.max(-1, Math.abs(nx.dot(up))))) * 180 / Math.PI;

      const exposure=this.terraces?this.terraces.influence(up):0;
      this.colorAt(up,hAvg,slope,col,exposure);
      if(slope>18&&exposure>.12)rockFaceFlags[f/3]=1;

      // 면마다 아주 살짝 흔든다. 완전히 같은 색이 넓게 이어지면 로우폴리가 저해상도로 보인다.
      const j = 0.965 + ((f * 2654435761) % 1000) / 1000 * 0.07;
      tmp.copy(col).multiplyScalar(j);

      for (let k = 0; k < 3; k++) {
        colors[(f + k) * 3] = tmp.r;
        colors[(f + k) * 3 + 1] = tmp.g;
        colors[(f + k) * 3 + 2] = tmp.b;
      }
    }

    // Constant per triangle, so the carpet clone can discard exposed-rock
    // fragments without moving any soil/collision vertices or changing UVs.
    const exposedRock=new Uint8Array(n);
    for(let f=0;f<rockFaceFlags.length;f++){const i=f*3;exposedRock[i]=exposedRock[i+1]=exposedRock[i+2]=rockFaceFlags[f];}
    geo.setAttribute('aExposedRock',new THREE.Uint8BufferAttribute(exposedRock,1,false));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    softenTerrainSurface(geo,rockFaceFlags,25);
    geo.userData.rockFaceNormals.exposedAttributeBytes=exposedRock.byteLength;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    addSurfaceDetail(mat);
    mat.userData.outlineParameters = { visible: false };   // 지형에 외곽선은 그물망이 된다
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;                                // 구 전체가 자기 그림자를 던지면 얼룩진다
    geo.userData.surfaceBuildMs=performance.now()-buildStarted;
    return mesh;
  }

  // 봉우리 방향 목록 — 카메라·배치·검증에서 "랜드마크가 보이는가"를 물을 때 쓴다.
  peakDirs() { return _peaks.map(p => p.dir.clone()); }
}

// 비인덱스 지형의 겹치는 꼭짓점만 묶어 음영을 부드럽게 한다.
// 좌표·인덱스·높이장에는 손대지 않으므로 보행/지도/산포의 표면 계약이 유지된다.
// Shared positions stay shared. Only exposed limestone contacts reject normals
// across a 25 degree crease; grassy terrain keeps the original full smoothing.
function softenTerrainSurface(geo,rockFaces,creaseDegrees=25) {
  const started=performance.now(),p=geo.attributes.position,n=geo.attributes.normal,c=geo.attributes.color,groups=new Map();
  for(let i=0;i<p.count;i++){
    const key=`${Math.round(p.getX(i)*10000)},${Math.round(p.getY(i)*10000)},${Math.round(p.getZ(i)*10000)}`;
    let group=groups.get(key);if(!group){group=[];groups.set(key,group);}group.push(i);
  }
  const cosine=Math.cos(creaseDegrees*Math.PI/180);let scratch=new Float64Array(192),sharpGroups=0,sharpCorners=0,rejected=0,maxMembers=0;
  for(const group of groups.values()){
    maxMembers=Math.max(maxMembers,group.length);const sharp=group.some(i=>rockFaces[Math.floor(i/3)]!==0);
    if(!sharp){let nx=0,ny=0,nz=0,r=0,g=0,b=0;for(const i of group){nx+=n.getX(i);ny+=n.getY(i);nz+=n.getZ(i);r+=c.getX(i);g+=c.getY(i);b+=c.getZ(i);}const len=Math.hypot(nx,ny,nz)||1;for(const i of group){n.setXYZ(i,nx/len,ny/len,nz/len);c.setXYZ(i,r/group.length,g/group.length,b/group.length);}continue;}
    sharpGroups++;sharpCorners+=group.length;if(scratch.length<group.length*6)scratch=new Float64Array(group.length*6);
    // Finish the entire group before overwriting its original face normals.
    for(let k=0;k<group.length;k++){
      const i=group[k],x=n.getX(i),y=n.getY(i),z=n.getZ(i);let nx=0,ny=0,nz=0,r=0,g=0,b=0,count=0;
      for(const j of group){if(x*n.getX(j)+y*n.getY(j)+z*n.getZ(j)<cosine){rejected++;continue;}nx+=n.getX(j);ny+=n.getY(j);nz+=n.getZ(j);r+=c.getX(j);g+=c.getY(j);b+=c.getZ(j);count++;}
      const len=Math.hypot(nx,ny,nz)||1,o=k*6;scratch[o]=nx/len;scratch[o+1]=ny/len;scratch[o+2]=nz/len;scratch[o+3]=r/count;scratch[o+4]=g/count;scratch[o+5]=b/count;
    }
    for(let k=0;k<group.length;k++){const i=group[k],o=k*6;n.setXYZ(i,scratch[o],scratch[o+1],scratch[o+2]);c.setXYZ(i,scratch[o+3],scratch[o+4],scratch[o+5]);}
  }
  geo.userData.rockFaceNormals={creaseDegrees,sharpGroups,sharpCorners,rejectedNormalPairs:rejected,rockFaces:rockFaces.reduce((a,b)=>a+b,0),maxSharedCorners:maxMembers,normalBuildMs:performance.now()-started};
}

// Refine only authored building sites. Shared edge midpoints are registered
// before triangulation, so neighbouring faces stitch without T-junction cracks.
// A local flat height function alone was not enough on the old ~2m mesh edges.
function refineLevelSites(source,sites,radius,rounds=2,heightAt=null){
  let positions=Array.from(source.attributes.position.array);source.dispose();
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),mid=new THREE.Vector3(),centre=new THREE.Vector3();
  const key=v=>`${Math.round(v.x*1e4)},${Math.round(v.y*1e4)},${Math.round(v.z*1e4)}`;
  const edgeKey=(a,b)=>{const x=key(a),y=key(b);return x<y?x+'|'+y:y+'|'+x;};
  const cosines=sites.map(s=>Math.cos((s.outer+2)/radius));
  for(let round=0;round<rounds;round++){
    const edges=new Map();
    for(let i=0;i<positions.length;i+=9){a.fromArray(positions,i);b.fromArray(positions,i+3);c.fromArray(positions,i+6);
      for(const[x,y]of[[a,b],[b,c],[c,a]]){mid.addVectors(x,y).normalize();if(!sites.some((s,j)=>round<(s.rounds||2)&&mid.dot(s.dir)>cosines[j]))continue;if(round>=3&&heightAt){const hx=heightAt(x.clone().normalize()),hy=heightAt(y.clone().normalize());if(Math.abs(heightAt(mid)-(hx+hy)*.5)<.012)continue;}const k=edgeKey(x,y);if(!edges.has(k))edges.set(k,mid.clone().multiplyScalar(radius));}
    }
    const next=[];const push=v=>next.push(v.x,v.y,v.z);
    for(let i=0;i<positions.length;i+=9){a.fromArray(positions,i);b.fromArray(positions,i+3);c.fromArray(positions,i+6);const ab=edges.get(edgeKey(a,b)),bc=edges.get(edgeKey(b,c)),ca=edges.get(edgeKey(c,a));
      if(!ab&&!bc&&!ca){push(a);push(b);push(c);continue;}
      const boundary=[a,...(ab?[ab]:[]),b,...(bc?[bc]:[]),c,...(ca?[ca]:[])];centre.copy(a).add(b).add(c).normalize().multiplyScalar(radius);
      for(let j=0;j<boundary.length;j++){push(centre);push(boundary[j]);push(boundary[(j+1)%boundary.length]);}
    }
    positions=next;
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));return geometry;
}

const _Y = new THREE.Vector3(0, 1, 0), _X = new THREE.Vector3(1, 0, 0);
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();
const _t3 = new THREE.Vector3(), _t4 = new THREE.Vector3();
