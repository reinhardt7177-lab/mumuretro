import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STARSAIL as D } from '../data/starsail.js';
import { STARSAIL_PALETTE as C } from '../data/lighting.js';
import { buildSpaceVista } from './SpaceVista.js';
import { buildStarRoute } from './StarRoute.js';

// 기존 lab 저장 키와 숫자 퍼즐. 공간·소포 회수만 새 범선 계약으로 감싼다.
export async function installStarsail(lab) {
  const asset = await new GLTFLoader().loadAsync(D.model);
  const { scene, visualBindings: v } = lab;
  const original = {
    update: lab.update.bind(lab), interact: lab.interact.bind(lab), prompt: lab.prompt.bind(lab),
    capture: lab.exportState.bind(lab), restore: lab.importState.bind(lab), pick: lab.pickAt.bind(lab),
  };
  // 원본 진행 객체는 남기고, 집의 벽·천장·침상·계단은 장면에서 분리한다.
  const specimenShelf=scene.children.filter(o=>o.position.x>4.85&&o.position.x<5.6
    &&o.position.z> -1.7&&o.position.z<1.5&&o.position.y>1.2&&o.position.y<2.9);
  scene.clear(); scene.background = new THREE.Color(C.sky); scene.fog = null;
  scene.add(asset.scene, v.table, v.con, v.gimbal, ...specimenShelf);
  asset.scene.name = 'Starsail — Blender model';
  const cameraOccluders = [];
  asset.scene.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) m.userData.outlineParameters = { visible: false };
    // 천·얇은 밧줄은 카메라를 밀지 않는다. 선체·선실·난간은 실제 면으로 검사한다.
    if (!/sail|rigging|hem|lantern|Hemp/i.test(o.name)) cameraOccluders.push(o);
    else o.userData.cameraNonSolid=true;
    o.userData.partitionedSolid=true;
  });
  scene.add(new THREE.HemisphereLight(C.ambient, C.ground, 2.6));
  const sun = new THREE.DirectionalLight(C.sun, 3.3); sun.position.set(12,18,9); sun.castShadow = true;
  sun.shadow.mapSize.set(1024,1024); Object.assign(sun.shadow.camera,{left:-19,right:19,top:22,bottom:-22,near:1,far:70});
  sun.shadow.bias = -.0006; scene.add(sun);
  const fill = new THREE.DirectionalLight(C.ambient, .8); fill.position.set(-10,8,-15); scene.add(fill);
  const vista=buildSpaceVista(scene),{sky,planet}=vista;
  const route=buildStarRoute(scene,v.gimbal,planet);
  const halfWidth=z=>{
    for(let i=1;i<D.profile.length;i++){const[a,wa]=D.profile[i-1],[b,wb]=D.profile[i];if(z<=b)return wa+(wb-wa)*(z-a)/(b-a);}
    return D.profile.at(-1)[1];
  };
  // 난간 안쪽으로 연속된 보행 구간을 둔다. 뾰족한 선수 끝은 장식이다.
  lab.rects.splice(0,lab.rects.length);
  for(let z=-13.5;z<11;z+=.5){const hw=Math.min(halfWidth(z),halfWidth(z+.5))-.42;
    lab.rects.push({id:z< -3.5?'send':z<2.5?'work':'live',kind:'room',x0:-hw,x1:hw,z0:z,z1:z+.5,h:80,open:true});}
  lab.rects.cameraOccluders=cameraOccluders;
  lab.rects.cameraLiftZones=[...lab.rects];
  lab.obstacles.splice(0,lab.obstacles.length,
    {x:.4,z:0,r:1.5},{x:-1.5,z:-5.8,x2:1.5,z2:-5.8,r:.9},{x:0,z:-9.4,r:2.8},
    {x:-3,z:2.8,r:.52},{x:-4.05,z:-11.2,x2:-4.05,z2:-9.2,r:1.85},
    {x:4.3,z:4,r:.72}, {x:-4.5,z:6,r:.68},{x:-4.7,z:-4,r:.68},{x:5.25,z:-2.4,r:.68},
    {x:4.7,z:-10,r:.6},{x:-4.7,z:-.8,r:.6},{x:5.25,z:-1.3,x2:5.25,z2:1,r:.45});
  const floating=v.parcelG.clone(true);scene.add(floating);
  // 소포 아래를 감싸는 회수망. 선분을 한 메시로 묶어 얇은 그물의 비용을 제한한다.
  const netPoints=[];
  for(let k=-3;k<=3;k++)for(const axis of [0,1])for(let i=0;i<16;i++) {
    const point=n=>{const t=-.7+n/16*1.4,u=k*.2;return axis
      ?[u,-.20+.28*(t*t+u*u),t]:[t,-.20+.28*(t*t+u*u),u];};
    netPoints.push(...point(i),...point(i+1));
  }
  const netGeo=new THREE.BufferGeometry();netGeo.setAttribute('position',new THREE.Float32BufferAttribute(netPoints,3));
  const net=new THREE.LineSegments(netGeo,new THREE.LineBasicMaterial({color:C.rope}));floating.add(net);
  const cable=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:C.rope}));scene.add(cable);
  let recovered=false, time=0, recovering=0;
  const target=new THREE.Vector3(.4,.92,0),from=new THREE.Vector3(D.parcel.x,D.parcel.y,D.parcel.z);
  const nearWinch=p=>Math.hypot(p.x-D.winch.x,p.z-D.winch.z)<D.winch.reach;
  const sync=()=>{
    v.parcelG.visible=recovered&&!recovering;
    floating.visible=!recovered||recovering>0; cable.visible=recovering>0;
    net.visible=recovering>0;
    if(!recovered)floating.position.copy(from).add(new THREE.Vector3(0,Math.sin(time*.8)*.12,0));
    if(recovering>0){const u=1-recovering/D.recoverySeconds,s=u*u*(3-2*u);floating.position.lerpVectors(from,target,s);floating.position.y+=Math.sin(Math.PI*u)*1.7;}
    const pos=cable.geometry.attributes.position;pos.setXYZ(0,5.5,3,4);pos.setXYZ(1,...floating.position.toArray());pos.needsUpdate=true;
  };
  lab.nearStairs=()=>false;
  lab.exportState=()=>({...original.capture(),parcelRecovered:recovered});
  lab.importState=s=>{
    if(!s || (s.parcelRecovered!==undefined&&typeof s.parcelRecovered!=='boolean') || (s.hasNote&&s.parcelRecovered===false))return false;
    if(!original.restore(s))return false;
    recovered=s.parcelRecovered??true;recovering=0;sync();return true;
  };
  lab.update=dt=>{original.update(dt);vista.update(dt);route.update(dt,lab.state.open);time+=dt;recovering=Math.max(0,recovering-dt);sync();};
  lab.prompt=p=>{
    if(!recovered)return nearWinch(p)?'E — 소포 건져 올리기':'배 밖에 소포가 떠 있다 — 우현 회수 손잡이로';
    if(recovering)return '소포가 갑판으로 올라온다';
    const text=original.prompt(p);
    if(text?.includes('위층'))return null;
    if(text?.includes('삼 년째'))return '항해대 — 소포에 다음 목적지의 단서가 있을까';
    return text?.replace('저 별로 내려가기','무무 행성으로 출발').replace('단 앞으로 가면 된다','출항 장치 앞으로').replace('다이얼','항해 고리');
  };
  lab.pickAt=p=>nearWinch(p)?'회수 손잡이':original.pick(p);
  lab.interact=p=>{
    if(!recovered){if(!nearWinch(p))return null;recovered=true;recovering=D.recoverySeconds;sync();return 'recover';}
    if(recovering)return null;
    return original.interact(p);
  };
  lab.reachables.push({name:'회수 손잡이',x:D.winch.x,z:D.winch.z,r:D.winch.reach});
  lab.starsail={model:asset.scene,planet,sky,route,get recovered(){return recovered;},get recovering(){return recovering;}};
  sync();return lab;
}
