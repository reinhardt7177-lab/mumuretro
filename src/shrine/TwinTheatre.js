import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SILHOUETTE_COURT as D } from '../data/silhouetteCourt.js';
import { SILHOUETTE_PALETTE as C } from '../data/lighting.js';
import { LAMP_SPREADS,twinProfile,twinTarget,projectOpaqueBox,subtractConvex } from './TwinShadowOptics.js';
import { installStaticRaycastTree } from '../render/StaticRaycastTree.js';

let pending;
function assets(){return pending??=fetch('assets/models/adventure/twin-shadow-v02.json').then(async r=>{if(!r.ok)return null;const spec=await r.json(),gltf=await new GLTFLoader().loadAsync(spec.model);return{spec,source:gltf.scene};}).catch(e=>{console.warn('[twin-theatre] basic mechanism retained',e);return null;});}
const material=(color,basic=false)=>{const m=basic?new T.MeshBasicMaterial({color}):new T.MeshStandardMaterial({color,roughness:.65});m.userData.outlineParameters={visible:false};return m;};

export function installTwinTheatre(scene,seg,rects,g,api){
  const legacy={resize:api.resize.bind(api),update:api.update.bind(api),interact:api.interact.bind(api),restart:api.restart.bind(api)};
  const root=new T.Group();root.name='두 등불 간격 장치';g.group.add(root);
  const stand=new T.Group(),wheel=new T.Group(),grip=new T.Object3D(),heads=[new T.Group(),new T.Group()];root.add(stand,wheel,...heads);grip.position.set(.24,0,.26);wheel.add(grip);
  stand.position.set(D.axisX,0,g.lampZ);wheel.position.set(D.axisX+1.35,1.05,g.lampZ+.35);
  const stone=material(C.stone),brass=material(C.brass),dark=material(C.hardware),fallback=[];
  function mesh(geometry,mat,parent,pos){const m=new T.Mesh(geometry,mat);m.position.fromArray(pos);m.castShadow=m.receiveShadow=false;parent.add(m);fallback.push(m);api.cameraOccluders.push(m);(rects.cameraOccluders??=[]).push(m);return m;}
  mesh(new T.CylinderGeometry(.54,.60,.24,12),stone,stand,[0,.12,.16]);mesh(new T.CylinderGeometry(.11,.15,2.26,12),dark,stand,[0,1.39,.16]);mesh(new T.BoxGeometry(2.65,.13,.28),brass,stand,[0,2.48,.16]);
  mesh(new T.BoxGeometry(.42,.16,.48),stone,stand,[1.35,.08,.35]);mesh(new T.BoxGeometry(.14,.74,.18),dark,stand,[1.35,.53,.35]);
  mesh(new T.TorusGeometry(.24,.035,8,24),brass,wheel,[0,0,0]);
  mesh(new T.CylinderGeometry(.025,.025,.195,16),brass,wheel,[.24,0,.1225]).rotation.x=Math.PI/2;
  mesh(new T.CylinderGeometry(.045,.045,.08,16),dark,wheel,[.24,0,.22]).rotation.x=Math.PI/2;
  mesh(new T.TorusGeometry(.045,.007,8,24),brass,wheel,[.24,0,.22]);
  for(const head of heads){const body=mesh(new T.CylinderGeometry(.245,.215,.28,16),dark,head,[0,0,.16]);body.rotation.x=Math.PI/2;}
  const cores=heads.map(head=>{const m=new T.Mesh(new T.SphereGeometry(.175,16,12),material(C.lamp,true));head.add(m);return m;}),lights=heads.map(head=>{const light=new T.PointLight(C.lamp,13,16,2);head.add(light);return light;});
  const wheelBody={shape:'box',x:D.axisX+1.35,z:g.lampZ+.35,x0:D.axisX+1.14,x1:D.axisX+1.56,z0:g.lampZ+.11,z1:g.lampZ+.59,minY:0,padding:.28,r:.6,escapeZ:1,twinTheatre:true};
  Object.defineProperty(wheelBody,'maxY',{enumerable:true,get:()=>api.mode==='twin'?1.04:0});api.obstacles.push(wheelBody);
  const wheelCap={shape:'box',x:wheelBody.x,z:wheelBody.z,x0:wheelBody.x-.292,x1:wheelBody.x+.292,z0:wheelBody.z-.08,z1:wheelBody.z+.27,minY:.758,padding:.28,r:.6,escapeZ:1,twinTheatre:true};
  Object.defineProperty(wheelCap,'maxY',{enumerable:true,get:()=>api.mode==='twin'?1.342:0});api.obstacles.push(wheelCap);
  // Own workbench framing: the eye target rises above the lamp heads while
  // preserving free yaw, movement and the actual solid architecture.
  (rects.cameraLookHeightZones??=[]).push({x0:D.axisX-.5,x1:D.axisX+2.4,z0:seg.z0,z1:g.lampZ+1.1,lookHeight:2.2,minDistance:5,maxDistance:6.5});
  const cameraPoints=Array.from({length:72},()=>new T.Vector3()),framePoints=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,y])=>new T.Vector3(D.axisX+x*1.6,D.beamY+y*1.6,g.wallZ+.02));
  (rects.cameraTaskZones??=[]).push({x0:D.axisX-.5,x1:D.axisX+2.4,z0:seg.z0,z1:g.lampZ+1.1,active:()=>api.mode==='twin'&&!g.solved,facing:yaw=>Math.abs(Math.atan2(Math.sin(yaw),Math.cos(yaw)))<.35,points:()=>cameraPoints.slice(0,g.round?72:36),framePoints:()=>framePoints,signature:()=>[api.mode,g.round,g.objZ,g.spanIndex,g.held,api.workshop?.revision||0,...g.answers].join('/')});
  const targetRoot=new T.Group();targetRoot.position.z=g.wallZ+.018;g.group.add(targetRoot);
  const targetMaterial=material(C.target,true),targets=[0,1].map(()=>[0,1,2,3].map(()=>{const m=new T.Mesh(new T.BoxGeometry(1,1,1),targetMaterial);targetRoot.add(m);return m;}));
  const shadowMaterial=new T.MeshBasicMaterial({color:C.shadow,transparent:true,opacity:.58,depthWrite:false,side:T.DoubleSide});shadowMaterial.userData.outlineParameters={visible:false};
  const shadows=[0,1].map(i=>{const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(384*3),3).setUsage(T.DynamicDrawUsage));const m=new T.Mesh(geometry,shadowMaterial);m.position.z=g.wallZ+.006+i*.0005;m.renderOrder=2+i;m.frustumCulled=false;g.group.add(m);return m;});
  api.mode='twin';api.native={loaded:false,models:[],fallback};api.sourceHeads=heads;api.sourceCores=cores;api.sourceLights=lights;api.wheel=wheel;api.wheelGrip=grip;api.modernShadows=shadows;api.modernTargets=targets;api.wheelObstacle=wheelBody;api.legacy=legacy;
  g.spanIndex=(twinProfile(g.answers,g.lampZ).span+1)%3;
  api.setMode=mode=>{const changed=api.mode!==mode;api.mode=mode;const modern=mode==='twin';root.visible=modern;targetRoot.visible=modern;g.hole.visible=!modern;g.shadow.visible=!modern;api.stemShadow.visible=!modern;for(const m of shadows)m.visible=modern;for(const m of api.lampHardware.parts)m.visible=!modern;api.lampHardware.light.visible=!modern;if(!modern)g.pips.forEach(p=>p.visible=true);if(changed)api.onObjective?.();};
  api.target=()=>twinTarget(g.answers,g.lampZ,g.wallZ,g.round,D.panelSize);
  api.sources=()=>api.mode==='twin'?heads.slice(0,g.round?2:1).map(h=>h.position.clone()):[g.lampBall.position.clone()];
  api.wheelNear=pos=>api.mode==='twin'&&g.round===1&&!g.held&&Math.hypot(pos.x-wheel.position.x,pos.z-wheel.position.z)<.85;
  api.objective=()=>api.mode==='legacy'?'가림판을 밀어 세 크기의 그림자를 화면에 맞춰라.':g.round===0?'가림판을 밀어 한 그림자의 크기를 맞춰라.':'가림판과 등불 손잡이로 두 그림자의 크기와 간격을 맞춰라.';
  api.guide=()=>{const state=api.status?.();return g.round===1&&state?.sizeMatch?wheel.position.clone().setY(0):api.workshop?.handlePoint()||new T.Vector3(api.handle().x,0,g.objZ);};
  api.status=()=>{const target=api.target(),size=g._size(),offset=g.round?LAMP_SPREADS[g.spanIndex]*((g.lampZ-g.wallZ)/(g.lampZ-g.objZ)-1):0;return{size,target:target.size,offset,targetOffset:target.offset,visibleShadows:shadows.filter(m=>m.visible&&m.geometry.drawRange.count>0).length,sizeMatch:Math.abs(size-target.size)<target.size*(g.tol||.09),spacingMatch:Math.abs(offset-target.offset)<.03};};
  function polygonMesh(m,polygons){const attr=m.geometry.attributes.position;let index=0;for(const p of polygons)for(let i=1;i<p.length-1;i++)for(const q of[p[0],p[i],p[i+1]]){if(index>=attr.count)throw Error('Twin shadow geometry capacity');attr.setXYZ(index++,q.x,q.z,0);}attr.needsUpdate=true;m.geometry.setDrawRange(0,index);m.geometry.computeBoundingSphere();}
  api.resize=(score=false)=>{
    if(api.mode==='legacy'){api.setMode('legacy');return legacy.resize(score);}
    legacy.resize(false);api.setMode('twin');const dual=g.round>0,span=dual?LAMP_SPREADS[g.spanIndex]:0;
    heads.forEach((head,i)=>{head.position.set(D.axisX+(dual?(i?1:-1)*span:0),D.beamY,g.lampZ);head.visible=dual||i===0;lights[i].intensity=dual?13:i===0?26:0;});wheel.rotation.z=g.spanIndex*Math.PI*2/3;
    const bounds={x0:D.axisX-D.screenSize/2,x1:D.axisX+D.screenSize/2,y0:D.beamY-D.screenSize/2,y1:D.beamY+D.screenSize/2};
    const box={x0:D.axisX-D.panelSize/2,x1:D.axisX+D.panelSize/2,y0:D.beamY-D.panelSize/2,y1:D.beamY+D.panelSize/2,z0:g.objZ-D.panelDepth,z1:g.objZ};
    const stem={...box,x0:D.axisX-D.stemWidth/2,x1:D.axisX+D.stemWidth/2,y0:D.stemBottom,y1:box.y0};
    shadows.forEach((m,i)=>{m.visible=dual||i===0;if(!m.visible)return;const source=heads[i].position,panel=projectOpaqueBox(box,source,g.wallZ,bounds),lower=projectOpaqueBox(stem,source,g.wallZ,bounds);polygonMesh(m,[panel,...subtractConvex(lower,panel)].filter(p=>p.length>=3));});
    const target=api.target();g.holeW=target.size;targetMaterial.color.set(g.solved?C.complete:C.target);
    targets.forEach((lines,i)=>{const x=D.axisX+(dual?(i?1:-1)*target.offset:0);lines.forEach((m,j)=>{m.visible=dual||i===0;const horizontal=j<2,sign=j%2?1:-1;m.position.set(horizontal?x:x+sign*target.size/2,horizontal?D.beamY+sign*target.size/2:D.beamY,0);m.scale.set(horizontal?target.size+.04:.04,horizontal?.04:target.size,.008);});});
    for(let i=0;i<2;i++){const x=D.axisX+(dual?(i?1:-1)*target.offset:0);for(let j=0;j<36;j++){const edge=Math.floor(j/9),horizontal=edge<2,sign=edge%2?1:-1,along=(-.5+(j%9)/8)*target.size;cameraPoints[i*36+j].set(horizontal?x+along:x+sign*target.size/2,horizontal?D.beamY+sign*target.size/2:D.beamY+along,g.wallZ+.02);}}
    g.pips.forEach((p,i)=>{p.visible=i<2;p.material.color.set(i<g.round||g.solved?C.complete:C.unlit);});
    if(score&&!g.solved){const state=api.status();if(state.sizeMatch&&(g.round===0||state.spacingMatch)){g.held=false;g.round++;g.solved=g.round===2;api.completed=g.solved;api.resize(false);api.onObjective?.();}}
  };
  api.update=actor=>{
    if(api.mode==='legacy')return legacy.update(actor);
    if(!g.held||g.solved)return{};
    if(actor.position.z<seg.z0||actor.position.z>seg.z1||Math.abs(actor.position.x-api.handle().x)>=g.REACH){g.held=false;return{};}
    const z=Math.max(g.wallZ+1.2,Math.min(g.lampZ-1.2,actor.position.z-g.dragOffset)),moved=Math.abs(z-g.objZ)>1e-7;g.objZ=z;api.resize(moved);return{};
  };
  api.interact=pos=>{
    api.lastWheelUse=false;
    if(api.mode==='legacy')return legacy.interact(pos);if(g.solved||api.completed)return false;
    if(api.wheelNear(pos)){g.spanIndex=(g.spanIndex+1)%3;api.resize(true);api.lastWheelUse=true;return true;}
    if(g.held){g.held=false;return true;}if(!(api.grabNear?api.grabNear(pos):g._near(pos)))return false;g.held=true;g.dragOffset=pos.z-g.objZ;return true;
  };
  api.prompt=pos=>{
    if(api.mode!=='twin')return null;if(g.solved||api.completed)return null;
    if(api.wheelNear(pos))return 'E — 등불 간격 바꾸기 · 눈금 '+(g.spanIndex+1)+'/3';
    const state=api.status(),size=state.visibleShadows===0?'그림자가 화면 밖이다 — 등불에서 멀리':state.sizeMatch?'크기는 맞았다':state.size>state.target?'그림자가 크다 — 등불에서 멀리':'그림자가 작다 — 등불 가까이',tip=g.round===1&&state.sizeMatch?'등불 손잡이로 두 그림자의 간격을 맞춰라':size;
    return g.held?'E — 놓기 · '+(g.round+1)+'/2 · '+tip:(api.grabNear?api.grabNear(pos):g._near(pos))?'E — 가림판 손잡이 잡기 ('+(g.round+1)+'/2)':'🔦 '+(g.round+1)+'/2 · '+tip;
  };
  api.restart=()=>{if(api.mode==='twin'){g.spanIndex=(twinProfile(g.answers,g.lampZ).span+1)%3;api.completed=false;g.dragOffset=0;api.resize(false);api.onObjective?.();}else legacy.restart();};
  g.handTarget=()=>{if(!api.lastWheelUse)return null;api.lastWheelUse=false;return grip.getWorldPosition(new T.Vector3());};
  api.setMode('twin');api.resize(false);
  api.ready=assets().then(asset=>{
    if(!asset)return false;const{spec,source}=asset;for(const name of spec.parts)if(!source.getObjectByName(name))return false;
    const pairs=[['LampStand',stand],['LampWheel',wheel],...heads.map(h=>['LampHousing',h])];
    for(const[name,parent]of pairs){const part=source.getObjectByName(name).clone(true);parent.add(part);api.native.models.push(part);part.traverse(m=>{if(!m.isMesh)return;m.castShadow=m.receiveShadow=false;m.material.userData.outlineParameters={visible:false};m.material.envMapIntensity=.4;m.updateWorldMatrix(true,false);installStaticRaycastTree(m);api.cameraOccluders.push(m);rects.cameraOccluders.push(m);});}
    for(const m of fallback)m.visible=false;const hidden=new Set(fallback);api.cameraOccluders.splice(0,api.cameraOccluders.length,...api.cameraOccluders.filter(m=>!hidden.has(m)));rects.cameraOccluders=rects.cameraOccluders.filter(m=>!hidden.has(m));
    grip.position.fromArray(spec.wheelGrip);api.native.loaded=true;api.native.spec=spec;api.resize(false);return true;
  });return api;
}
