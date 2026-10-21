import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SteamState,STEAM as S} from './SteamState.js';
import {sfx} from '../core/Audio.js';

const V=(...p)=>new T.Vector3(...p),near=(p,q,r=1.7)=>Math.hypot(p.x-q[0],p.z-q[1])<r;
function label(root,text,x,y,z,w=1.2){const c=document.createElement('canvas');c.width=640;c.height=144;const a=c.getContext('2d');a.fillStyle='#162d36';a.fillRect(0,0,640,144);a.strokeStyle='#c5a66c';a.lineWidth=8;a.strokeRect(4,4,632,136);a.fillStyle='#f0dfb6';a.font='bold 46px "Malgun Gothic",sans-serif';a.textAlign='center';a.textBaseline='middle';a.fillText(text,320,72,610);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(w,w*.225),new T.MeshBasicMaterial({map:t}));m.position.set(x,y,z);root.add(m);return m;}
export async function buildFireSteam(){
 const loader=new GLTFLoader(),base='assets/models/fire-temple/',ids=['static','bridge','turbine','lift','rail'];
 const [models,utilities,res]=await Promise.all([Promise.all(ids.map(id=>loader.loadAsync(base+`steam-${id}-v01.glb`))),Promise.all(['stand','wheel','gate'].map(id=>loader.loadAsync(base+`foundry-${id}-v01.glb`))),fetch(base+'steam-manifest.json')]);if(!res.ok)throw Error('증기 승강실 배치를 불러오지 못했다');const manifest=await res.json(),parts=Object.fromEntries(ids.map((id,i)=>[id,models[i].scene])),[stand,wheel,gateTemplate]=utilities.map(m=>m.scene),root=new T.Group();root.name='steam-lift-hall';
 for(const p of [...Object.values(parts),stand,wheel,gateTemplate])p.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});root.add(parts.static);
 const mechanics=new SteamState(),bridge=new T.Group(),rightBridge=new T.Group(),rightLeaf=parts.bridge.clone(true);bridge.add(parts.bridge);rightLeaf.rotation.y=Math.PI;rightBridge.add(rightLeaf);bridge.position.set(-4,0,-27);rightBridge.position.set(4,0,-27);root.add(bridge,rightBridge);const turbine=parts.turbine;turbine.position.set(-7,2.4,-26.7);root.add(turbine);const lift=parts.lift;lift.position.set(7,0,-31.2);root.add(lift);
 const westRail=parts.rail.clone(true),northRail=parts.rail.clone(true);westRail.rotation.y=Math.PI/2;westRail.position.x=-1.65;northRail.position.z=-1.65;lift.add(westRail,northRail);
 const gate=gateTemplate.clone(true);gate.rotation.y=Math.PI/2;gate.position.set(0,0,-14.5);root.add(gate);const futureGate=gateTemplate.clone(true);futureGate.rotation.y=Math.PI/2;futureGate.position.set(0,3.2,-40.8);root.add(futureGate);label(root,'불꽃 수호자 전당',0,6.7,-40.65,3.2);
 const handles=[];for(const [p,y,text] of [[S.selector,0,'A 다리 · B 승강기'],[S.lowerCall,0,'아래로 호출'],[S.upperCall,3.2,'위로 호출']]){const a=stand.clone(true);a.position.set(p[0],y,p[1]);root.add(a);label(a,text,0,.56,.37,1.4);const w=wheel.clone(true);w.position.set(p[0],y+1.25,p[1]+.3);root.add(w);handles.push(w);}
 label(lift,'E · 왕복',0,-.30,1.81,1.0);
 const bronze=new T.MeshStandardMaterial({color:0xc69b55,metalness:.65,roughness:.4}),cyan=new T.MeshBasicMaterial({color:0x73c8c9}),amber=new T.MeshBasicMaterial({color:0xffc468});
 function line(points,mat,r=.035){const path=new T.CurvePath();for(let i=1;i<points.length;i++)path.add(new T.LineCurve3(V(...points[i-1]),V(...points[i])));const m=new T.Mesh(new T.TubeGeometry(path,points.length*8,r,8,false),mat);root.add(m);return m;}
 const flowA=line([[-6,1.19,-21],[-8.5,1.19,-21],[-8.5,1.19,-27],[-7,2.5,-27]],amber),flowB=line([[-6,.025,-20],[10,.025,-20],[10,.025,-31.2]],cyan);
 const lamps=[[-6.6,1.2,-20.5],[-5.4,1.2,-20.5]].map((p,i)=>{const m=new T.Mesh(new T.SphereGeometry(.11,12,8),new T.MeshStandardMaterial({color:i?0x68b8bc:0xd4a458,emissive:i?0x68b8bc:0xd4a458,emissiveIntensity:.1}));m.position.set(...p);root.add(m);return m;});
 const cables=[5.45,8.55].map(x=>{const o=new T.Mesh(new T.CylinderGeometry(.025,.025,1,8),bronze);o.position.set(x,3,-31.2);root.add(o);return o;});
 const cameraOccluders=manifest.cameraOccluders.map(b=>{const o=new T.Mesh(new T.BoxGeometry(...b.max.map((n,i)=>n-b.min[i])),new T.MeshBasicMaterial());o.position.set(...b.min.map((n,i)=>(n+b.max[i])/2));o.updateMatrixWorld(true);return o;});
 const bridgeCamera=new T.Mesh(new T.BoxGeometry(4,.5,6.4).translate(2,-.24,0),new T.MeshBasicMaterial()),rightCamera=new T.Mesh(new T.BoxGeometry(4,.5,6.4).translate(-2,-.24,0),new T.MeshBasicMaterial());cameraOccluders.push(bridgeCamera,rightCamera);
 const rects=[{id:'north',x0:-2.4,x1:2.4,z0:-17.4,z1:-10.4,h:9,open:true},{id:'steam',x0:-12,x1:12,z0:-37,z1:-17,h:9,open:true},{id:'upperPassage',x0:-3,x1:3,z0:-40.25,z1:-37,h:9,open:true}];
 const obstacles=[...manifest.pillars,{x:-9.5,z:-19.8,r:.8},{x:10,z:-31.2,r:.8},{x:-6,z:-21,r:.67},{x:4.1,z:-32.1,r:.65},{x:9.4,z:-34.5,r:.65},...[5,9].flatMap(x=>[-33,-29.4].map(z=>({x,z,r:.22})))];
 const mistCanvas=document.createElement('canvas');mistCanvas.width=mistCanvas.height=32;const mc=mistCanvas.getContext('2d'),gradient=mc.createRadialGradient(16,16,0,16,16,16);gradient.addColorStop(0,'#eef8ff70');gradient.addColorStop(1,'#eef8ff00');mc.fillStyle=gradient;mc.fillRect(0,0,32,32);const mistGeo=new T.BufferGeometry();mistGeo.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(48*3),3));const mist=new T.Points(mistGeo,new T.PointsMaterial({map:new T.CanvasTexture(mistCanvas),color:0xdce8ed,size:.33,transparent:true,opacity:.24,depthWrite:false}));root.add(mist);const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let gateOpen=0,message='',messageT=0,falls=0,hintLevel=0,turnSpeed=0,time=0,low=false;const notify=(m,t=4)=>{message=m;messageT=t;};
 const onDeck=(p,pad=0)=>Math.abs(p.x-7)<1.8-pad&&Math.abs(p.z+31.2)<1.8-pad;
 const upper=(x,z)=>(Math.abs(x)<12&&z>=-37&&z<=-33)||(Math.abs(x)<3&&z>=-40.25&&z<=-37);
 function contains(x,z,y=0){const m=mechanics,dx=x-7,dz=z+31.2;if(m.moving&&m.passenger)return Math.abs(dx)<=1.65&&Math.abs(dz)<=1.65;
  if(m.moving&&!m.passenger&&Math.abs(dx)<2&&Math.abs(dz)<2)return false;
  if(y>=m.height-.2&&y<m.height+1.1){if(Math.abs(dx-1.65)<.14&&Math.abs(dz)<1.8||Math.abs(dz-1.65)<.14&&Math.abs(dx)<1.8)return false;if((m.moving||m.state.liftLevel==='low')&&Math.abs(dz+1.65)<.14&&Math.abs(dx)<1.8)return false;if((m.moving||m.state.liftLevel==='upper')&&Math.abs(dx+1.65)<.14&&Math.abs(dz)<1.8)return false;}
  if(y>1.05)return onDeck({x,z})&&m.height>.9||y>2.8&&upper(x,z);
  return rects.filter(r=>r.id!=='upperPassage').some(r=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1);
 }
 function floorAt(x,z,y=0){if(onDeck({x,z})&&y>=mechanics.height-.28)return mechanics.height;if(y>2.8&&upper(x,z))return 3.2;if(Math.abs(x)<12&&z>-30&&z<-24)return mechanics.state.bridgeLatched&&Math.abs(x)<4?0:-3;return Math.abs(x)<2.4&&z>-13&&z<-10.4?.04:0;}
 function ceilingAt(x,z,y=0){return y<2.7&&Math.abs(x)<12&&z<=-33&&z>=-37?2.76:Infinity;}
 function boarded(a){return onDeck(a.position,.45)&&a.grounded&&Math.abs(a.position.y-mechanics.height)<.16;}
 function candidate(actor){const p=actor.position,m=mechanics,s=m.state;if(m.moving)return {kind:'busy',label:m.passenger?'승강대가 이동하고 있다':'승강대를 호출하고 있다'};
  if(boarded(actor))return {kind:'ride',label:s.diverter==='lift'?(s.liftLevel==='low'?'승강대 출발 · 위로':'승강대 출발 · 아래로'):'승강기에 동력이 필요하다'};
  if(!actor.grounded)return null;if(Math.abs(p.y)<.25&&near(p,S.selector))return {kind:'power',label:s.diverter==='bridge'?'증기 동력 B · 승강기로':'증기 동력 A · 다리로'};
  if(Math.abs(p.y)<.25&&near(p,S.lowerCall)){const send=s.rodeUp&&s.liftLevel==='low';return {kind:'call',level:send?'upper':'low',label:send?'빈 승강대 위로 보내기':s.liftLevel==='low'?'승강대는 아래에 있다':'승강대 아래로 호출'};}
  if(Math.abs(p.y-3.2)<.25&&near(p,S.upperCall))return {kind:'call',level:s.liftLevel==='upper'?'low':'upper',label:s.liftLevel==='upper'?'빈 승강대 아래로 보내기':'승강대 위로 호출'};
  return null;
 }
 function interact(actor){const t=candidate(actor);if(!t)return false;const m=mechanics,s=m.state;
  if(t.kind==='busy'){notify('문이 열리면 내릴 수 있다');return false;}
  if(t.kind==='power'){m.switchPower();notify(s.diverter==='bridge'?s.bridgeLatched?'다리는 잠겨 있다 · 승강기 쪽 동력도 살펴보자':'터빈이 다리를 내리고 있다':'승강기 쪽으로 동력을 보냈다');sfx('lever');return true;}
  if(t.kind==='ride'){if(!m.ride(boarded(actor))){notify(s.bridgeLatched?'승강기에 동력을 보내자':'먼저 다리를 내려 잠가야 한다');return false;}actor.camYaw=0;notify('출입문을 닫았다 · 발밑과 함께 이동한다');sfx('lever');return true;}
  const level=t.level;if(!m.call(level)){notify(s.liftLevel===level?'승강대가 도착해 있다':'승강기에 동력을 보내야 호출할 수 있다');return false;}notify('빈 승강대를 호출했다');sfx('lever');return true;
 }
 function recover(actor){const m=mechanics,s=m.state;if(m.moving){m.height=s.liftLevel==='upper'?3.2:0;m.moving=false;m.passenger=false;}const up=actor.position.y>2.5&&s.rodeUp;if(up)actor.setAt(...S.upper,-1,3.2);else actor.setAt(...S.near,-1);falls++;m.changed=true;notify('안전한 발판으로 돌아왔다 · 잠근 다리는 그대로다',5);sfx('gate_fail');}
 function afterMove(actor){if(actor.position.z>-17||Math.abs(actor.position.x)>12)return;if(actor.position.y<-.6)recover(actor);}
 function animate(dt,actor,unlocked){time+=dt;messageT=Math.max(0,messageT-dt);const m=mechanics,s=m.state,oldHeight=m.height,wasMoving=m.moving,wasLatched=s.bridgeLatched,carry=wasMoving&&m.passenger&&boarded(actor);m.tick(dt);
  if(carry){actor.position.y+=m.height-oldHeight;actor.syncMesh();}
  if(!wasLatched&&s.bridgeLatched){notify('다리 끝에 잠금이 걸렸다 · 동력을 바꾸어도 유지된다',5);sfx('door_open');}
  if(wasMoving&&!m.moving){notify(s.liftLevel==='upper'?'상층에 멈췄다 · 북쪽 문으로 나가 통로를 걸어가자':'아래에 멈췄다 · 서쪽 문이 열렸다',5);sfx('door_open');}
  gateOpen=dt===0?(unlocked?1:0):T.MathUtils.damp(gateOpen,unlocked?1:0,8,dt);gate.position.y=gateOpen*4.3;
  bridge.rotation.z=(1-m.bridgeProgress)*1.40;rightBridge.rotation.z=-bridge.rotation.z;bridgeCamera.position.copy(bridge.position);bridgeCamera.rotation.copy(bridge.rotation);rightCamera.position.copy(rightBridge.position);rightCamera.rotation.copy(rightBridge.rotation);lift.position.y=m.height;
  westRail.position.y=!m.moving&&s.liftLevel==='low'?-1.3:0;northRail.position.y=!m.moving&&s.liftLevel==='upper'?-1.3:0;
  turnSpeed=T.MathUtils.damp(turnSpeed,s.diverter==='bridge'?2.4:0,5,dt);turbine.rotation.z-=turnSpeed*dt;handles[0].rotation.z=T.MathUtils.damp(handles[0].rotation.z,s.diverter==='lift'?-Math.PI*.65:s.diverter==='bridge'?Math.PI*.65:0,9,dt);
  flowA.visible=s.diverter==='bridge';flowB.visible=s.diverter==='lift';lamps.forEach((l,i)=>l.material.emissiveIntensity=(i===0?s.diverter==='bridge':s.diverter==='lift')?(low?.8:2):.05);
  mist.visible=!low&&!reduced.matches&&s.diverter!=='off';if(mist.visible){const a=mistGeo.attributes.position;for(let i=0;i<48;i++){const age=(i/24+time*.25)%1,side=i<24,x=side?-9.5:10,z=side?-19.8:-31.2;a.setXYZ(i,x+Math.sin(i*3.1+age*2)*(.04+age*.14),2.4+age*1.2,z+Math.cos(i*2.7)*age*.12);}a.needsUpdate=true;}
  cables.forEach(o=>{const top=6.45,bottom=m.height+1.05;o.scale.y=top-bottom;o.position.y=(top+bottom)/2;});
  if(unlocked&&actor.position.z<-17&&!s.visited){s.visited=true;m.changed=true;}
  if(s.rodeUp&&actor.grounded&&actor.position.y>3.0&&near(actor.position,S.goal,1.1)&&!s.upperReached){s.upperReached=true;m.changed=true;notify('세 실험을 지나 상층에 도착했다 · 북쪽 전당으로 들어가자',6);sfx('orb_take');}
 }
 function target(){const m=mechanics,s=m.state;if(s.upperReached)return {point:V(0,3.2,-39.1),label:'세 실험 완료 · 다음은 수호자 전당이다'};if(!s.bridgeLatched)return {point:V(-6,0,-21),label:s.diverter==='bridge'?'터빈과 다리의 잠금 장치를 살펴보자':'북쪽 승강실에서 증기를 다리 쪽으로 보내자'};if(s.diverter!=='lift')return {point:V(-6,0,-21),label:'다리가 잠겼다 · 동력을 승강기로 바꾸자'};if(m.moving)return {point:V(7,m.height,-31.2),label:m.passenger?'승강대와 함께 상층으로 이동하자':'호출한 승강대가 도착할 때까지 살펴보자'};if(s.rodeUp&&s.liftLevel==='upper')return {point:V(0,3.2,-39.1),label:'북쪽 출입문으로 내려 상층 통로를 걸어가자'};return {point:V(7,0,-31.2),label:'다리를 건너 승강대에 타고 출발하자'};}
 return {root,mechanics,bridge,rightBridge,lift,turbine,gate,futureGate,northRail,westRail,rects,obstacles,cameraOccluders,manifest,contains,floorAt,ceilingAt,boarded,animate,afterMove,interact,recover,target,
  get gateOpen(){return gateOpen;},get falls(){return falls;},get message(){return messageT>0?message:'';},prompt(a){const t=candidate(a);return t?t.kind==='busy'?t.label:'E — '+t.label:null;},setLow(on){low=on;},
  checkpoint(a){return mCheckpoint(a);},
  hint(){return ['분기 밸브에서 두 관이 어느 기계로 이어지는지 살펴보자.','다리를 내린 뒤 잠금이 걸리면 동력을 바꾸어도 다리가 남는다.','A로 다리를 내려 잠근 뒤 B로 바꾸고, 건너편 승강대 안에서 E로 출발해 상층 통로까지 걸어가자.'][Math.min(hintLevel++,2)];},
  record(){const s=mechanics.state;return s.upperReached?'증기로 다리를 내려 잠갔다. 동력을 승강기로 바꿔 직접 타고 올라와 상층 통로에 도착했다.':s.rodeUp?'승강대에 타고 출발하니 발밑과 함께 올라갔다. 북쪽 출입문 뒤로 상층 통로가 보인다.':s.bridgeLatched?'다리의 끝이 잠겨 동력을 바꾸어도 내려간 채로 남았다. 다른 관은 승강기로 이어져 있다.':'분기 밸브에서 관 두 갈래가 터빈과 승강기로 이어진다.';}
 };
 function mCheckpoint(a){const m=mechanics;if(m.moving&&m.passenger)return m.state.liftLevel==='upper'?'steamUpper':'steamFar';if(a.position.y>2.7&&m.state.rodeUp)return 'steamUpper';return a.position.z<-30&&m.state.bridgeLatched?'steamFar':'steamNear';}
}
