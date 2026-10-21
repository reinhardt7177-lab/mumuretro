import * as T from 'three';
import { createWaterPacket, beginWaterChange, advanceWater, stableWaterSnapshot, waterMotionPoint, TRANSFORM_TIME } from './WaterAdventureState.js';
import { attachWaterAdventureProgress } from './WaterAdventureProgress.js';
import { loadHeritageAsset, fitHeritageHeight, heritagePart } from '../core/HeritageAssets.js';
import { addBoard } from './Signboard.js';
import { Prize } from './Prize.js';
import { sfx } from '../core/Audio.js';
import { buildWaterCuff } from '../render/WaterBraceletFx.js';

const V=(x,y,z)=>new T.Vector3(x,y,z);
const inside=(p,r,pad=0)=>p.x>=r.x0-pad&&p.x<=r.x1+pad&&p.z>=r.z0-pad&&p.z<=r.z1+pad;
const mat=(color,opts={})=>{const m=new T.MeshStandardMaterial({color,roughness:.68,...opts});m.userData.outlineParameters={visible:false};return m;};
const C={stone:mat(0x71858a),dark:mat(0x243e4d),pale:mat(0xb5c8c6),gold:mat(0xc8a85e,{metalness:.65,roughness:.3}),
  water:mat(0x329cba,{transparent:true,opacity:.76,depthWrite:false,metalness:.25,roughness:.16}),ice:mat(0x9ce2ef,{transparent:true,opacity:.85,depthWrite:false,metalness:.16,roughness:.2}),
  light:mat(0x5bdcc8,{emissive:0x289eaa,emissiveIntensity:.4}),glass:mat(0x8acdd5,{transparent:true,opacity:.18,depthWrite:false})};
function box(parent,w,h,d,m,x,y,z){const a=new T.Mesh(new T.BoxGeometry(w,h,d),m);a.position.set(x,y,z);a.castShadow=!m.transparent;a.receiveShadow=true;parent.add(a);return a;}
function pipe(parent,points,m=C.gold,r=.07){const curve=new T.CatmullRomCurve3(points.map(p=>V(...p)));const mesh=new T.Mesh(new T.TubeGeometry(curve,32,r,7,false),m);parent.add(mesh);return {mesh,curve};}
function crest(parent,x,y,z,r=.38){const a=new T.Mesh(new T.TorusGeometry(r,.045,6,32),C.gold);a.position.set(x,y,z);parent.add(a);
  const drop=new T.Mesh(new T.OctahedronGeometry(r*.38,0),C.light);drop.position.set(x,y,z+.04);drop.scale.y=1.45;parent.add(drop);return a;}
function bowl(parent,x,y,z,w=2,d=2){box(parent,w,.22,d,C.dark,x,y-.11,z);
  for(const side of [-1,1]){box(parent,.14,.3,d+.15,C.pale,x+side*w/2,y+.12,z);box(parent,w,.3,.14,C.pale,x,y+.12,z+side*d/2);}
  crest(parent,x,y+.13,z+d/2+.09,.16);}

function buildArchitecture(scene,spec){
  const rects=[],doors={},surfaces=[],occluders=[];
  scene.background=new T.Color(0x132a3b);scene.fog=new T.Fog(0x132a3b,38,100);
  scene.add(new T.HemisphereLight(0xd9f1f0,0x233a51,2.05));
  const sun=new T.DirectionalLight(0xffe4ae,2.4);sun.position.set(-12,24,6);sun.target.position.set(0,0,-25);sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-14,right:14,top:30,bottom:-30,near:1,far:90});sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.0005;scene.add(sun,sun.target);
  for(const s of spec.rooms){const len=s.from-s.to,cz=(s.from+s.to)/2,hw=s.w/2;
    const r={id:s.id,kind:s.kind,name:s.name,act:s.act,x0:-hw,x1:hw,z0:s.to,z1:s.from,h:s.h,camH:s.h,open:!s.door};rects.push(r);
    if(s.id==='r3'){
      for(const [a,b] of [[s.from,cz+3.3],[cz-3.3,s.to]])box(scene,s.w,.4,a-b,C.dark,0,-.2,(a+b)/2);
      box(scene,s.w,.4,6.6,C.dark,0,-5.2,cz);
    }else box(scene,s.w,.4,len,C.dark,0,-.2,cz);
    for(const side of [-1,1]){
      const wall=box(scene,.4,s.h,len,C.stone,side*(hw+.2),s.h/2,cz);occluders.push(wall);
      box(scene,.14,.16,len-.25,C.gold,side*(hw-.08),.3,cz);
      box(scene,.13,.12,len-.25,C.light,side*(hw-.075),1.05,cz);
      if(s.kind==='room')for(let z=s.from-2;z>s.to+1;z-=4){
        const column=new T.Mesh(new T.CylinderGeometry(.32,.42,s.h-.5,12),C.pale);column.position.set(side*(hw-.55),(s.h-.5)/2,z);scene.add(column);
        box(scene,1,.35,1,C.stone,side*(hw-.55),.175,z);box(scene,.95,.22,.95,C.gold,side*(hw-.55),s.h-.5,z);
        crest(scene,side*(hw-.55),2.7,z+.44,.3);
      }
    }
    // Open roof slots illuminate the goal; no large blue screen across the view.
    if(s.kind==='room'){
      const key=new T.PointLight(0xbbe9f6,15,22,2);key.position.set(0,7,cz);scene.add(key);
      box(scene,s.w+.5,.24,.6,C.stone,0,s.h-.25,s.from-1);
      const inset=box(scene,4,.04,Math.min(9,len-2),C.pale,0,-.001,cz);inset.receiveShadow=true;
      if(s.id==='r3')inset.visible=false;
      for(const side of [-1,1])box(scene,.10,.035,len-1,C.gold,side*2.2,.018,cz);
    }
    if(s.door){const root=new T.Group();root.position.z=s.from-.08;scene.add(root);
      const leafMat=mat(0x304f5d,{metalness:.3});const leaves=[];
      for(const side of [-1,1]){const leaf=new T.Group();leaf.position.x=side*(s.w/4);root.add(leaf);leaves.push(leaf);
        box(leaf,s.w/2-.08,3.7,.28,leafMat,0,1.85,0);box(leaf,.08,3.6,.06,C.gold,-side*s.w/4+.09,1.8,.17);
        crest(leaf,0,1.9,.2,.55);for(const y of [.3,3.4])box(leaf,s.w/2-.1,.07,.08,C.gold,0,y,.2);
      }
      doors[s.door]={mesh:root,rect:r,leaves,opened:false,amount:0};
      for(const side of [-1,1])box(scene,.4,4.1,.55,C.pale,side*(s.w/2+.15),2.05,s.from);
      box(scene,s.w+.7,.35,.55,C.gold,0,4.1,s.from);
    }
  }
  const end=rects[rects.length-1];occluders.push(box(scene,end.x1-end.x0,end.h,.4,C.stone,0,end.h/2,end.z0-.2));
  rects.cameraOccluders=occluders;rects.cameraLiftZones=rects.filter(r=>r.kind==='room');rects.surfaces=surfaces;
  rects.floorAt=(x,z)=>{let h=0;for(const s of surfaces){if(s.enabled?.()===false)continue;if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1)h=Math.max(h,typeof s.height==='function'?s.height(x,z):s.height);}return h;};
  const api={rects,doors,surfaces,occluders,rooms:spec.rooms,open:false,lights:[],
    rectOf:id=>rects.find(r=>r.id===id),segmentAt:z=>rects.find(r=>z<=r.z1&&z>=r.z0),
    openDoor(id){const d=doors[id];if(!d||d.opened)return false;d.opened=true;sfx('door_open');return true;},
    update(dt){for(const d of Object.values(doors)){if(d.opened)d.amount=Math.min(1,d.amount+dt/1.0);d.leaves.forEach((leaf,i)=>leaf.position.x=(i?1:-1)*(d.rect.x1/2+d.amount*d.rect.x1));if(d.amount>=.92)d.rect.open=true;}},
    resetDoors(){for(const d of Object.values(doors)){d.opened=false;d.amount=0;d.rect.open=false;d.leaves.forEach((leaf,i)=>leaf.position.x=(i?1:-1)*d.rect.x1/2);}},
  };return api;
}

class WaterTrial{
  constructor(scene,seg,kind,world){this.seg=seg;this.kind=kind;this.world=world;this.scene=scene;this.cz=(seg.z0+seg.z1)/2;
    this.state=createWaterPacket(kind,seg);this.held=null;this.valves=[];this.message='';this.messageT=0;this.time=0;this.liftLevel=.22;
    this.group=new T.Group();this.group.name=`water-adventure-${kind}`;scene.add(this.group);
    this.waterMat=C.water.clone();this.iceMat=C.ice.clone();
    this.liquid=box(this.group,1.65,.56,1.65,this.waterMat,0,.28,0);
    this.ice=box(this.group,1.65,.78,1.65,this.iceMat,0,.39,0);
    const edges=new T.LineSegments(new T.EdgesGeometry(this.ice.geometry),new T.LineBasicMaterial({color:0xd8fbff}));this.ice.add(edges);
    for(let i=0;i<6;i++)box(this.ice,.024,.44,.012,C.pale,(i%3-.9)*.5,0,.83);
    this.cloud=new T.Group();this.group.add(this.cloud);
    for(let i=0;i<7;i++){const m=new T.Mesh(new T.IcosahedronGeometry(.38+(i%3)*.08,1),mat(0xb8edf2,{transparent:true,opacity:.32,depthWrite:false}));m.position.set(Math.sin(i*2.4)*.7,Math.cos(i*3.1)*.22,Math.cos(i*2.4)*.4);this.cloud.add(m);}
    this.castSerial=0;this.castHeating=false;
    this.glints=new T.Group();this.group.add(this.glints);
    for(let i=0;i<12;i++){const a=new T.Mesh(new T.OctahedronGeometry(.035,0),C.light);this.glints.add(a);}
    if(kind==='carry')this.buildCarry();else if(kind==='flow')this.buildFlow();else this.buildCycle();
    this.paint();
  }
  addSurface(x,z,w,d,height,enabled){this.world.dungeon.surfaces.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,height,enabled});}
  platform(x,z,w,d,h,enabled){const mesh=box(this.group,w,h,d,C.stone,x,h/2,z);this.addSurface(x,z,w,d,h,enabled);if(h>1.2&&!enabled)this.world.dungeon.occluders.push(mesh);return mesh;}
  ramp(x,z0,z1,w,h,enabled){const d=z0-z1,mesh=box(this.group,w,.18,Math.hypot(d,h),C.pale,x,h/2,(z0+z1)/2);mesh.rotation.x=Math.atan2(h,d);
    this.addSurface(x,(z0+z1)/2,w,d,(xx,zz)=>T.MathUtils.clamp((z0-zz)/d,0,1)*h,enabled);
    // Small engraved treads, aligned with the continuous collision ramp.
    for(let i=1;i<12;i++)box(this.group,w,.035,.075,C.gold,x,h*i/12+.10,z0-d*i/12);
    return mesh;
  }
  buildCarry(){const s=this.seg;
    bowl(this.group,-4,0,s.z1-4);this.ledge=V(0,1.55,s.z0+4.8);this.platform(0,this.ledge.z,4.8,3.6,1.55);
    crest(this.group,0,1.8,this.ledge.z+1.83,.7);
    this.returnRamp=this.ramp(4.8,s.z0+11.6,s.z0+4.8,3,1.55,()=>this.state.completed);
    this.returnDeck=this.platform(3.3,this.ledge.z,2.1,3.6,1.55,()=>this.state.completed);
    this.returnDeck.visible=false;this.returnRamp.visible=false;
    this.bonusPoint=V(-5.5,1.55,s.z0+8);this.platform(-5.5,this.bonusPoint.z,2.5,2.6,1.55);
    this.bonusMesh=new T.Mesh(new T.OctahedronGeometry(.18,0),C.gold);this.bonusMesh.position.copy(this.bonusPoint).y+=.6;this.group.add(this.bonusMesh);
    this.braceletPos=V(0,0,s.z1-1.8);this.braceletStand=box(this.group,.8,.52,.8,C.pale,0,.26,this.braceletPos.z);
    this.bracelet=buildWaterCuff();this.bracelet.scale.setScalar(3.4);this.bracelet.position.set(0,.85,this.braceletPos.z);this.bracelet.rotation.x=.35;this.group.add(this.bracelet);
  }
  buildFlow(){const c=this.cz;
    bowl(this.group,4,0,this.seg.z1-4);
    this.ramp(-5,this.seg.z1-1.3,c+1.8,3.1,1.55);this.platform(-4.7,c+.7,3.7,2.5,1.55);
    this.feeder=V(-4.5,1.55,c+.6);bowl(this.group,...this.feeder.toArray(),2.5,2);
    this.wallZ=c-2;
    // Real opening: a liquid conduit fits, while the ice block and traveller do not.
    const holeX=-4.5,holeHalf=.375,holeY=1.2,wallH=3.05;this.wallHeight=wallH;
    const left=-9,right=9,a=holeX-holeHalf,b=holeX+holeHalf;
    const solids=[box(this.group,a-left,wallH,.65,C.stone,(left+a)/2,wallH/2,this.wallZ),
      box(this.group,right-b,wallH,.65,C.stone,(b+right)/2,wallH/2,this.wallZ),
      box(this.group,holeHalf*2,holeY-holeHalf,.65,C.stone,holeX,(holeY-holeHalf)/2,this.wallZ),
      box(this.group,holeHalf*2,wallH-holeY-holeHalf,.65,C.stone,holeX,(wallH+holeY+holeHalf)/2,this.wallZ)];
    this.world.dungeon.occluders.push(...solids);this.addSurface(0,this.wallZ,18,.65,wallH);
    for(const side of [-1,1]){box(this.group,.07,1.0,.10,C.gold,holeX+side*.48,holeY,this.wallZ+.36);
      box(this.group,1.03,.07,.10,C.gold,holeX,holeY+side*.48,this.wallZ+.36);}
    // The narrow drain sits in the wall. Ice and travellers must use the lift.
    for(let i=0;i<26;i++){const x=-8.7+i*.69;if(Math.abs(x-holeX)>.6)box(this.group,.07,wallH-.15,.09,C.gold,x,wallH/2,this.wallZ+.37);}
    this.receiver=V(-4.5,0,c-4.2);bowl(this.group,...this.receiver.toArray(),1.1,.9);
    for(const side of [-1,1])box(this.group,.06,2.8,1,C.glass,this.receiver.x+side*.61,1.4,this.receiver.z);
    this.tank=box(this.group,1,.01,.8,C.water.clone(),this.receiver.x,.005,this.receiver.z);
    this.liftPos=V(0,0,c-.45);this.lift=box(this.group,3.3,.22,3.0,C.pale,0,.11,this.liftPos.z);
    this.addSurface(0,this.liftPos.z,3.3,3.0,()=>this.liftHeight);
    for(const x of [-1.75,1.75])box(this.group,.12,3.1,.12,C.gold,x,1.55,this.liftPos.z);
    this.returnRamp=this.ramp(5.7,c+4.2,c-2,2.5,wallH,()=>this.state.completed);this.returnRamp.visible=false;
    this.aqueduct=pipe(this.group,[[-4.5,1.65,c+.6],[-4.5,1.55,c-.8],[-4.5,1.2,c-2],[-4.5,.65,c-3.2],[-4.5,.25,c-4.2]],C.glass,.18);
    pipe(this.group,[[-4.5,.3,c-4.2],[-2.5,.3,c-4.2],[0,.3,c-.45]],C.gold,.085);
  }
  buildCycle(){const c=this.cz;
    this.bridgeIce=box(this.group,3.6,.14,6.85,this.iceMat,0,.03,c);
    this.bridgeWater=box(this.group,3.6,.11,6.85,this.waterMat,0,-.08,c);
    this.safeBridge=box(this.group,3,.3,7.6,C.pale,-6,-.15,c);this.safeBridge.visible=false;
    this.addSurface(-6,c,3,7.6,0,()=>this.state.safety);
    this.bowlPos=V(-2.9,-1.5,c-2.4);bowl(this.group,...this.bowlPos.toArray(),2.2,2.2);
    pipe(this.group,[[0,-.14,c],[-1.5,-.45,c-1],[-2.9,-1.35,c-2.4]],C.glass,.2);
    this.collector=V(4,4.7,c-7.2);this.altarPos=V(4,2.5,c-9.3);
    this.ramp(5.8,c-3.9,c-7.8,3.1,2.5);this.platform(4.6,c-9.2,4.3,2.8,2.5);
    bowl(this.group,...this.altarPos.toArray(),1.6,1.4);
    this.steamPipe=pipe(this.group,[[-2.9,-1.1,c-2.4],[-2.9,2.7,c-2.4],[0,4.8,c-4],[4,4.8,c-7.2]],C.glass,.26);
    const canopy=box(this.group,2.1,.12,1.8,C.gold,4,4.8,c-7.2);canopy.rotation.x=.12;
    this.condensation=pipe(this.group,[[4,4.55,c-7.2],[4,3.5,c-8.2],[4,2.7,c-9.3]],C.glass,.12);
    const oldFloor=this.world.dungeon.rects.floorAt;
    this.world.dungeon.rects.floorAt=(x,z)=>{
      if(z<c+3.3&&z>c-3.3&&Math.abs(x)<this.seg.x1){
        if(this.state.safety&&Math.abs(x+6)<1.5)return 0;
        if(this.state.zone==='bridge'&&this.state.phase==='ice'&&Math.abs(x)<1.8)return .10;
        return -5;
      }return oldFloor(x,z);
    };
  }
  get liftHeight(){return this.liftLevel;}
  get packetPoint(){return V(...this.state.pos).add(V(0,this.state.phase==='vapour'?0:.4,0));}
  // Art hits the visible water surface; eligibility continues using packetPoint.
  braceletPoint(actor){const s=this.state,p=V(...s.pos);
    if(s.phase==='vapour'||s.motion)return this.packetPoint;
    if(this.kind==='cycle'&&s.zone==='bridge'){p.x=T.MathUtils.clamp(actor.position.x,-1.5,1.5);p.z=T.MathUtils.clamp(actor.position.z,this.cz-2.9,this.cz+2.9);p.y+=s.phase==='ice'?.12:.015;}
    else p.y+=this.kind==='flow'&&s.zone==='receiver'?1.4:s.phase==='ice'?.80:.58;
    return p;
  }
  get origin(){return createWaterPacket(this.kind,this.seg).pos;}
  notify(text){this.message=text;this.messageT=2.8;return text;}
  target(actor){
    if(!this.world.bracelet||this.state.completed)return false;
    if(this.state.held)return true;
    const origin=actor.position.clone().add(V(0,1.25,0)),p=this.packetPoint,delta=p.clone().sub(origin),dist=delta.length();
    if(dist>5.0)return false;
    const flat=delta.clone().setY(0);if(flat.length()>.5&&flat.normalize().dot(actor.heading)<-.25)return false;
    const ray=new T.Raycaster(origin,delta.normalize(),.01,Math.max(.01,dist-.4));
    for(const m of this.world.dungeon.occluders)m.updateWorldMatrix(true,false);
    return ray.intersectObjects(this.world.dungeon.occluders,false).length===0;
  }
  change(heating,actor){
    if(!this.target(actor)){this.notify(this.world.bracelet?'가까운 물을 바라보자':'먼저 물의 팔찌를 찾아보자');return false;}
    if(this.state.held&&heating){this.state.pos=[actor.position.x,Math.max(0,this.world.baseFloor(actor.position.x,actor.position.z)),actor.position.z];}
    const ok=beginWaterChange(this.state,heating);
    if(ok){this.castSerial++;this.castHeating=heating;sfx(heating?'lever':'slot_ok');this.notify(heating?(this.state.phase==='ice'?'얼음에 열을 전한다':'물에 열을 전한다'):(this.state.phase==='vapour'?'기체에서 열을 빼앗는다':'물에서 열을 빼앗는다'));}
    else this.notify(this.state.transition||this.state.motion?'물이 변하고 있다':heating?'이미 기체 상태다':'이미 얼음 상태다');
    return ok;
  }
  interact(p,actor=this.actor){
    if(this.kind==='carry'&&!this.world.bracelet&&p.distanceTo(this.braceletPos)<1.8){this.world.bracelet=true;this.notify('물의 팔찌를 얻었다 · Q 데우기 / R 식히기');sfx('orb_take');return true;}
    if(!actor||this.kind==='cycle'||this.state.phase!=='ice'||this.state.transition||this.state.motion)return false;
    if(!this.state.held){if(p.distanceTo(this.packetPoint)>2)return false;this.state.held=true;this.state.zone='held';this.held='ice';return true;}
    const at=p.clone().addScaledVector(actor.heading,1.4),seg=this.seg;at.x=T.MathUtils.clamp(at.x,seg.x0+1.1,seg.x1-1.1);at.z=T.MathUtils.clamp(at.z,seg.z0+1.1,seg.z1-1.1);
    const h=this.world.baseFloor(at.x,at.z);
    if(h>p.y+.3||h<-.1){this.notify('발밑 높이와 같은 넓은 바닥에 놓자');return false;}
    this.state.pos=[at.x,h,at.z];this.state.held=false;this.held=null;
    this.state.zone=this.kind==='flow'&&h>=1.25&&Math.abs(at.x+4.5)<2&&Math.abs(at.z-(this.cz+.6))<2.1?'feeder':'loose';this.paint();return true;
  }
  prompt(p){
    if(this.kind==='carry'&&!this.world.bracelet)return p.distanceTo(this.braceletPos)<1.8?'E — 물의 팔찌 얻기':'반짝이는 팔찌를 찾아보자';
    if(this.state.held)return 'E — 얼음 놓기 · Q 녹이기 / R 식히기';
    if(this.kind!=='cycle'&&this.state.phase==='ice'&&p.distanceTo(this.packetPoint)<2&&!this.state.transition&&!this.state.motion)return 'E — 얼음 들기';
    return this.messageT>0?this.message:null;
  }
  update(dt,actor){this.actor=actor;this.time+=dt;this.messageT=Math.max(0,this.messageT-dt);
    if(this.state.held&&!this.state.transition){const p=actor.position.clone().addScaledVector(actor.heading,1.05);this.state.pos=[p.x,p.y+.70,p.z];}
    advanceWater(this.state,this.kind,this.seg,dt);this.held=this.state.held?'ice':null;
    if(this.kind==='flow'){
      const filled=this.state.zone==='receiver'&&this.state.phase==='liquid'&&!this.state.motion;
      const riding=Math.abs(actor.position.x)<1.65&&Math.abs(actor.position.z-this.liftPos.z)<1.5&&actor.position.y>=this.liftLevel-.3;
      const target=filled&&riding?this.wallHeight:.22;this.liftLevel+=T.MathUtils.clamp(target-this.liftLevel,-dt*1.5,dt*1.5);
    }
    if(this.kind==='cycle'&&inside(actor.position,this.seg)&&actor.position.z<this.cz-3.7&&!this.state.safety){this.state.safety=true;this.notify('돌다리가 펼쳐졌다 · 물을 다시 쓸 수 있다');sfx('door_open');}
    if(this.kind==='carry'&&inside(actor.position,this.seg)&&actor.position.y>=1.4&&Math.hypot(actor.position.x-this.bonusPoint.x,actor.position.z-this.bonusPoint.z)<1.3&&!this.state.bonus){this.state.bonus=true;this.notify('숨은 물결 조각을 찾았다!');sfx('orb_take');}
    this.paint();
    if(this.kind==='cycle'&&inside(actor.position,this.seg)&&actor.position.y<-.55)return {fail:'물은 사라지지 않는다 · 안전한 발판에서 다시 해 보자'};
    return {};
  }
  solvedBy(actor){if(this.state.completed)return true;
    if(this.kind==='carry')return inside(actor.position,this.seg)&&Math.abs(actor.position.x)<2.4&&Math.abs(actor.position.z-this.ledge.z)<1.8&&actor.position.y>=1.45;
    if(this.kind==='flow')return this.state.zone==='receiver'&&this.state.phase==='liquid'&&!this.state.motion&&inside(actor.position,this.seg)&&actor.position.z<this.seg.z0+2.6;
    return this.state.zone==='altar'&&this.state.phase==='liquid'&&!this.state.motion;
  }
  complete(){this.state.completed=true;this.state.held=false;this.held=null;this.paint();}
  resetWater(){const safety=this.state.safety,bonus=this.state.bonus;this.castSerial++;this.state=createWaterPacket(this.kind,this.seg);this.state.safety=safety;this.state.bonus=bonus;this.held=null;this.notify('이 방의 물을 회수했다');this.paint();}
  restart(){this.castSerial++;this.state=createWaterPacket(this.kind,this.seg);this.held=null;this.messageT=0;this.liftLevel=.22;this.paint();}
  snapshot(){return stableWaterSnapshot(this.state,this.origin);}
  paint(){const s=this.state,p=V(...s.pos),bridge=this.kind==='cycle'&&s.zone==='bridge';
    this.ice.visible=s.phase==='ice'&&!bridge&&!s.motion;this.liquid.visible=s.phase==='liquid'&&!bridge&&!s.motion;this.cloud.visible=s.phase==='vapour'&&!s.motion;
    this.ice.position.copy(p).y+=.39;this.liquid.position.copy(p).y+=.28;this.cloud.position.copy(p);
    const t=s.transition?s.transition.t/TRANSFORM_TIME:0;this.iceMat.emissive.setHex(s.transition?.to==='liquid'?0xbe792d:0x245969);this.iceMat.emissiveIntensity=s.transition?t*.3:.08;
    this.cloud.children.forEach((m,i)=>{m.rotation.y=this.time*.3+i;m.position.y=Math.cos(this.time*1.2+i)*.12;});
    this.glints.visible=!!s.motion;
    this.glints.children.forEach((m,i)=>{const a=this.time*2+i*.55;
      if(s.motion){m.position.fromArray(waterMotionPoint(s.motion,s.motion.t/s.motion.duration-i*.015));m.position.add(V(Math.sin(a)*.04,.08,Math.cos(a)*.04));}
      else m.position.copy(p).add(V(Math.sin(a)*.9,.25+(i%4)*.17,Math.cos(a)*.7));});
    if(this.kind==='carry'){this.bracelet.visible=!this.world.bracelet;this.bracelet.rotation.y=Math.sin(this.time*.7)*.20;this.bracelet.position.y=.85+Math.sin(this.time*1.3)*.025;this.bonusMesh.visible=!s.bonus;this.bonusMesh.rotation.y=this.time;
      this.returnRamp.visible=this.returnDeck.visible=s.completed;}
    if(this.kind==='flow'){this.lift.position.y=this.liftHeight-.11;this.returnRamp.visible=s.completed;const fill=s.zone==='receiver'&&s.phase==='liquid'?1:0;
      this.tank.scale.y=1+fill*255;this.tank.position.y=(.01+fill*2.55)/2;this.liquid.visible=this.liquid.visible&&s.zone!=='receiver';}
    if(this.kind==='cycle'){this.bridgeIce.visible=bridge&&s.phase==='ice';this.bridgeWater.visible=bridge&&s.phase==='liquid';this.safeBridge.visible=s.safety;}
  }
}

class WaterAudience{
  constructor(scene,seg,world){this.seg=seg;this.world=world;this.active=false;this.progress=0;this.eventStarted=false;this.eventClock=0;
    this.altar=V(0,0,seg.z1-4);this.prizePos=this.altar.clone();this.obstacles=[{x:0,z:seg.z0+4,r:1.8}];
    bowl(scene,0,0,seg.z1-4,2.5,2.5);crest(scene,0,2.6,seg.z0+.5,1.8);
    this.fallback=new T.Mesh(new T.IcosahedronGeometry(1.4,1),C.glass);this.fallback.position.set(0,2.8,seg.z0+4);scene.add(this.fallback);
    this.heritagePromise=Promise.all(['water-deity','water-deity-halo-v03','water-deity-droplet-v03'].map(loadHeritageAsset)).then(()=>{
      const deity=fitHeritageHeight('water-deity',4.7);if(!deity)return;deity.position.set(0,0,seg.z0+4);scene.add(deity);this.deity=deity;this.fallback.visible=false;
      for(const id of ['water-deity-halo-v03','water-deity-droplet-v03']){const g=heritagePart(id);if(g){g.scale.setScalar(4.7/3.3);g.rotation.y=Math.PI;g.position.copy(deity.position);scene.add(g);}}
    });
  }
  get solved(){return this.active;}
  solvedBy(){return this.active;}
  prompt(p){return !this.active&&p.distanceTo(this.altar)<2?'E — 물의 신에게 다가가기':null;}
  interact(p){if(this.active||!this.world.gates.every(g=>g.solved)||p.distanceTo(this.altar)>=2)return false;this.active=true;this.progress=1;return true;}
  update(){}
  restart(){this.active=false;this.progress=0;this.eventStarted=false;this.eventClock=0;}
}

export function buildWaterAdventure(spec,seed){
  const scene=new T.Scene();scene.userData.lookProfile='water';
  const dungeon=buildArchitecture(scene,spec),world={dungeon,bracelet:false,gates:[]};
  world.baseFloor=(x,z)=>{let h=0;for(const s of dungeon.surfaces){if(s.enabled?.()===false)continue;if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1)h=Math.max(h,typeof s.height==='function'?s.height(x,z):s.height);}return h;};
  const kinds=['carry','flow','cycle'];const gates=kinds.map((kind,i)=>({room:`r${i+1}`,solved:false,gate:new WaterTrial(scene,dungeon.rectOf(`r${i+1}`),kind,world)}));world.gates=gates;
  const baseFloor=dungeon.rects.floorAt;
  dungeon.rects.floorAt=(x,z)=>{let h=baseFloor(x,z);for(const {gate} of gates){const s=gate.state;if(gate.kind==='cycle'||s.phase!=='ice'||s.held)continue;
    if(Math.abs(x-s.pos[0])<.825&&Math.abs(z-s.pos[2])<.825)h=Math.max(h,s.pos[1]+.78);}return h;};
  const shrineSeg=dungeon.rectOf('shrine'),final=new WaterAudience(scene,shrineSeg,world),prize=new Prize(scene,final.prizePos),goals={},hints={};
  for(const r of spec.rooms){if(!r.goal)continue;const seg=dungeon.rectOf(r.id);goals[r.id]=r.goal;
    const board=addBoard(scene,seg,-1,r.name,r.goal,0xb3e4e9);board.group.scale.setScalar(.63);board.group.position.set(seg.x0+1,1.6,seg.z1-2);board.group.rotation.y=.55;
    if(r.hints){const board=addBoard(scene,seg,1,'물의 기록','팔찌의 힌트 버튼으로 펼치기',0xe0c786,true);board.group.scale.setScalar(.55);board.group.position.set(seg.x1-1,1.6,seg.z1-2);board.group.rotation.y=-.55;hints[r.id]={board,texts:r.hints,level:0,t:0};}
  }
  const api={spec,seed,scene,dungeon,gates,final,prize,goals,hints,shrineSeg,waterAdventure:true,world,runTier:0,
    obstacles:final.obstacles,veils:[],fadeVeils(){},applyTier(t){this.runTier=t;},nudge(){return null;},
    get bracelet(){return world.bracelet;},
    activeTrial(actor){const seg=dungeon.segmentAt(actor.position.z);return gates.find(g=>g.room===seg?.id)?.gate||null;},
    changeWater(heat,actor){return this.activeTrial(actor)?.change(heat,actor)||false;},
    recoverWater(actor){const g=this.activeTrial(actor);if(!g||g.state.completed)return false;g.resetWater();return true;},
    hint(actor){const seg=dungeon.segmentAt(actor.position.z),h=hints[seg?.id];if(!h)return '';h.level=Math.min(h.texts.length,h.level+1);h.board.set(`힌트 ${h.level}`,h.texts[h.level-1],false);return h.texts[h.level-1];},
    restart(){world.bracelet=false;this.hasProgress=false;this.checkpoint=null;this.legacyWater=null;this.migratedWater=false;for(const g of gates){g.solved=false;g.gate.restart();}dungeon.resetDoors();final.restart();prize.reset();for(const h of Object.values(hints)){h.level=0;h.t=0;h.board.set('물의 기록','팔찌의 힌트 버튼으로 펼치기',true);}},
  };
  // Keep the web save/return-hub contract; none of the former WaterCourt geometry is built.
  api.court={update(){},restart(){},prompt(p){return prize.taken&&p.distanceTo(final.altar)<2?'E — 입구로 돌아가기':null;}};
  attachWaterAdventureProgress(api);return api;
}
