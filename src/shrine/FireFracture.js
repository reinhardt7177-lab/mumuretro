import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FractureState,FRACTURE as F} from './FractureState.js';
import {sfx} from '../core/Audio.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),near=(p,q,r=1.65)=>Math.hypot(p.x-q[0],p.z-q[1])<r;
const material=(color,opts={})=>new T.MeshStandardMaterial({color,roughness:.55,...opts});
const gold=material(0xc7a05e,{metalness:.65,roughness:.3}),basalt=material(0x48525a),dark=material(0x28333b);
function box(w,h,d,m,x,y,z,parent){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
function bar(a,b,r,m,parent){const delta=b.clone().sub(a),o=new T.Mesh(new T.CylinderGeometry(r,r,delta.length(),12),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());parent.add(o);return o;}
function plaque(parent,x,y,z,text,w=2.5,h=.65){const c=document.createElement('canvas');c.width=768;c.height=192;const a=c.getContext('2d');a.fillStyle='#152631';a.fillRect(0,0,768,192);a.strokeStyle='#bc9a64';a.lineWidth=10;a.strokeRect(9,9,750,174);a.fillStyle='#f1d9aa';a.font='bold 52px "Malgun Gothic",sans-serif';a.textAlign='center';a.textBaseline='middle';a.fillText(text,384,96,710);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture}));m.position.set(x,y,z);parent.add(m);return m;}

export async function buildFireFracture(){
  const loader=new GLTFLoader(),base='assets/models/fire-temple/';
  const results=await Promise.all(['static','bridge','brace','socket','anchor'].map(id=>loader.loadAsync(`${base}fracture-${id}-v01.glb`)));
  const response=await fetch(base+'fracture-manifest.json');if(!response.ok)throw Error('균열 회랑의 배치 파일을 불러오지 못했다');const manifest=await response.json();
  const scene=new T.Scene();scene.background=new T.Color(0x233545);scene.fog=new T.Fog(0x233545,36,94);
  scene.add(new T.HemisphereLight(0xd8e9f5,0x4b3b2e,2.3));const sun=new T.DirectionalLight(0xffdfab,3.0);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-19,right:19,top:19,bottom:-19,near:1,far:65});sun.shadow.bias=-.0004;sun.shadow.normalBias=.06;scene.add(sun,sun.target);
  const shapes=Object.fromEntries(results.map((r,i)=>[['static','bridge','brace','socket','anchor'][i],r.scene]));
  for(const root of Object.values(shapes))root.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])m.userData.outlineParameters={visible:false};}});
  scene.add(shapes.static);const mechanics=new FractureState();
  const bridge=new T.Group();bridge.name='fracture-dynamic-bridge';bridge.position.set(-28,F.lowBridge,0);bridge.add(shapes.bridge);scene.add(bridge);
  const braces=F.spawns.map((p,i)=>{const o=shapes.brace.clone(true);o.name='portable-brace-'+i;o.position.set(p[0],0,p[1]);scene.add(o);return o;});
  const sockets=F.sockets.map((p,i)=>{const g=new T.Group();g.position.set(p[0],0,p[1]);g.add(shapes.socket.clone(true));scene.add(g);const m=material(0x7f9ea0,{emissive:0x365459,emissiveIntensity:.25});const ring=new T.Mesh(new T.TorusGeometry(.26,.03,8,32),m);ring.rotation.x=-Math.PI/2;ring.position.set(0,.455,0);g.add(ring);return {group:g,ring};});
  const anchor=shapes.anchor;anchor.position.set(-28,0,-8);scene.add(anchor);const sealMat=material(0xa5773b,{emissive:0xa85e23,emissiveIntensity:.2});const seal=new T.Mesh(new T.TorusGeometry(.39,.055,8,40),sealMat);seal.position.set(-28,1.5,-7.39);scene.add(seal);
  // Actual test lever and visible linkage, rather than an invisible E trigger.
  const bench=new T.Group();bench.position.set(F.bench[0],0,F.bench[1]);scene.add(bench);box(1,.65,.85,basalt,0,.325,0,bench);box(1.06,.12,.91,gold,0,.69,0,bench);
  const lever=new T.Group();lever.position.set(0,.76,0);bench.add(lever);bar(V(),V(0,.65,0),.055,gold,lever);box(.36,.10,.15,dark,0,.69,0,lever);
  plaque(bench,0,.57,.436,'다리 시험',.85,.22);plaque(scene,-28,2.30,-7.37,'건너편 잠금',2.3,.55);
  const struts=[];for(const x of [-29.55,-26.45])for(const z of [-2.6,2.6]){const m=box(.23,2,.23,gold,x,-1.9,z,scene);struts.push(m);box(.65,.25,.65,basalt,x,-2.875,z,scene);}
  const hallSeal=new T.Mesh(new T.TorusGeometry(.6,.06,8,40),sealMat);hallSeal.rotation.x=-Math.PI/2;hallSeal.position.set(-4,.03,7);scene.add(hallSeal);
  const nextSign=plaque(scene,6.4,1.6,8,'다음 구역 · 제작 중',3.3,.64);
  const apron=manifest.entryApron;
  const rects=[{id:'entry',x0:-4,x1:4,z0:apron.z0,z1:34,h:9,open:true},{id:'hub',x0:-12,x1:12,z0:-12,z1:12,h:8,open:true},{id:'west',x0:-18.35,x1:-8,z0:6,z1:10,h:7,open:true},{id:'fracture',x0:-38,x1:-18,z0:-12,z1:14,h:7,open:true}];
  const portalSolids=manifest.cameraOccluders.filter(b=>b.min[2]>16&&b.max[2]<19.5&&b.min[1]<.1);
  const contains=(x,z)=>(Math.hypot(x,z)<11.85||rects.filter(r=>r.id!=='hub').some(r=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1))&&!portalSolids.some(b=>x>b.min[0]&&x<b.max[0]&&z>b.min[2]&&z<b.max[2]);
  const cameraOccluders=manifest.cameraOccluders.map(b=>{const s=b.max.map((n,i)=>n-b.min[i]),m=new T.Mesh(new T.BoxGeometry(...s),new T.MeshBasicMaterial());m.position.set(...b.min.map((n,i)=>(n+b.max[i])/2));m.updateMatrixWorld(true);return m;});
  rects.cameraOccluders=cameraOccluders;rects.cameraLiftZones=[rects[3]];
  rects.floorAt=(x,z)=>x>-38&&x<-18&&z>F.pit[0]&&z<F.pit[1]?(Math.abs(x+28)<F.bridgeWidth/2?bridge.position.y+Math.sin(bridge.rotation.z)*(x+28):-3):(x>apron.x0&&x<apron.x1&&z>apron.z0&&z<apron.z1?apron.height:0);
  const obstacles=[...manifest.pillars,{x:-28,z:10.8,r:.78},...F.sockets.map(p=>({x:p[0],z:p[1],r:.83})),{x:-28,z:-8,r:.89}];
  let time=0,message='',messageT=0,target=null,hintLevel=0,falls=0;
  const notify=(text,duration=3)=>{message=text;messageT=duration;};
  const nearBank=p=>p.z>=3.5;
  function candidate(actor){const p=actor.position,s=mechanics.state;if(!actor.grounded||Math.abs(p.y)>.30)return null;
    if(mechanics.testing)return {kind:'busy',label:'다리를 시험하고 있다'};
    if(mechanics.held!==null){const slot=F.sockets.findIndex((q,i)=>near(p,q,1.6)&&!s.braces.some(b=>b.slot===i));return slot>=0?{kind:'seat',id:slot,label:'받침 끼우기'}:{kind:'drop',label:'받침 내려놓기'};}
    if(near(p,F.anchor,1.8))return {kind:'anchor',label:s.latched?'잠금 완료':s.stable?'다리 잠그기':'먼저 다리를 시험하자'};
    if(near(p,F.bench,1.7))return {kind:'test',label:s.latched?'시험 완료':mechanics.seated===2?'고정한 다리 시험':'다리 시험'};
    if(!s.latched&&nearBank(p)){
      let best=null,dist=1.65;s.braces.forEach((b,i)=>{const q=b.slot===null?b.pos:F.sockets[b.slot],d=Math.hypot(p.x-q[0],p.z-q[1]);if(d<dist){best={kind:'pick',id:i,label:b.slot===null?'받침 들기':'끼운 받침 꺼내기'};dist=d;}});return best;
    }return null;
  }
  function interact(actor){target=candidate(actor);if(!target)return false;const s=mechanics.state;
    if(target.kind==='busy'){notify('시험이 끝나면 받침을 옮길 수 있다');return false;}
    if(target.kind==='anchor'){
      if(s.latched){notify('다리는 잠겼다 · 중앙 홀로 돌아가자');return false;}
      if(!mechanics.latch()){notify('양쪽을 고정하고 시험한 뒤 잠글 수 있다');return false;}
      notify('다리가 영구 고정되었다 · 중앙 홀로 돌아가자',5);sfx('door_open');return true;
    }
    if(target.kind==='test'){
      if(s.latched)return false;if(!mechanics.test())return false;sfx('lever');notify('움직이는 부위를 살펴보자',1.7);return true;
    }
    if(target.kind==='pick'){if(mechanics.pick(target.id)){sfx('pick_up');return true;}return false;}
    if(target.kind==='seat'){if(mechanics.seat(target.id)){sfx('slot_ok');notify(mechanics.seated===2?'두 받침을 끼웠다 · 손잡이로 시험하자':'한쪽을 고정했다 · 다른 쪽도 살펴보자');return true;}return false;}
    if(target.kind==='drop'){
      const p=actor.position.clone().addScaledVector(actor.heading,1.15),pos=[p.x,p.z];
      const blocked=obstacles.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.r+.55)||s.braces.some((b,i)=>i!==mechanics.held&&b.slot===null&&Math.hypot(p.x-b.pos[0],p.z-b.pos[1])<1);
      if(blocked||!mechanics.drop(pos)){notify('입구 쪽의 넓은 바닥에 놓자');return false;}sfx('put_down');return true;
    }return false;
  }
  function recover(actor){mechanics.recover();mechanics.state.visited=true;mechanics.state.checkpoint='near';actor.setAt(-28,10,-1);falls++;sfx('gate_fail');notify('가까운 발판으로 돌아왔다 · 끼운 받침은 그대로다',4);}
  function animate(dt,actor){time+=dt;messageT=Math.max(0,messageT-dt);const prev=mechanics.testing;mechanics.tick(dt);const s=mechanics.state;
    if(prev&&!mechanics.testing){if(s.stable){notify('다리가 안정되었다 · 건너편에서 잠그자',4);sfx('door_open');}else{notify(mechanics.seated?'받침 없는 쪽이 계속 움직인다':'양쪽 고정구가 비어 있다',4);sfx('lever');}}
    const progress=mechanics.testing&&mechanics.testPassed?T.MathUtils.smoothstep(mechanics.testT/F.testTime,.25,1):s.stable?1:0;
    bridge.rotation.z=s.stable||progress>.99?0:Math.sin(time*(mechanics.testing?18:2.1))*(mechanics.testing?.035:.009)*(mechanics.seated===2?.08:1);
    const pivot=mechanics.seated===1?(s.braces.some(b=>b.slot===0)?-1.4:1.4):0;
    bridge.position.y=T.MathUtils.lerp(F.lowBridge,0,progress)-Math.sin(bridge.rotation.z)*pivot;
    lever.rotation.x=T.MathUtils.damp(lever.rotation.x,mechanics.testing?-.75:0,10,dt);
    struts.forEach(m=>{const top=bridge.position.y-.60;m.scale.y=Math.max(.05,(top+2.75)/2);m.position.y=(-2.75+top)/2;});
    braces.forEach((m,i)=>{const b=s.braces[i];m.scale.setScalar(i===mechanics.held?.85:1);
      if(i===mechanics.held){m.position.copy(actor.position).addScaledVector(actor.heading,.65);m.position.y=actor.position.y+.55;m.rotation.y=Math.atan2(actor.heading.x,actor.heading.z);}
      else{m.position.set(b.slot===null?b.pos[0]:F.sockets[b.slot][0],b.slot===null?0:.44,b.slot===null?b.pos[1]:F.sockets[b.slot][1]);m.rotation.y=0;}
    });
    sockets.forEach((q,i)=>{const occupied=s.braces.some(b=>b.slot===i);q.ring.material.emissiveIntensity=occupied?.6:.16;q.ring.material.color.setHex(occupied?0xddb86c:0x7f9ea0);});
    sealMat.emissiveIntensity=s.latched?.75:.15;hallSeal.visible=s.latched;
    sun.position.copy(actor.position).add(V(-9,24,15));sun.target.position.copy(actor.position);
    if(actor.position.x<-18&&!s.visited){s.visited=true;s.checkpoint='near';mechanics.changed=true;}
    if(actor.grounded&&s.stable&&actor.position.z<-4&&actor.position.x<-18&&s.checkpoint!=='far'){s.checkpoint='far';mechanics.changed=true;}
    if(s.latched&&!s.returned&&near(actor.position,F.hub,3.5)){s.returned=true;s.checkpoint='hub';mechanics.changed=true;notify('첫 실험을 마쳤다 · 다음은 용암 주조실이다',6);sfx('orb_take');}
    if(actor.position.y<-.6&&actor.position.x<-18){recover(actor);}
    target=candidate(actor);
  }
  function afterMove(actor){if(actor.position.y<-.6&&actor.position.x<-18)recover(actor);const i=mechanics.held;if(i!==null){const m=braces[i];m.position.copy(actor.position).addScaledVector(actor.heading,.65);m.position.y=actor.position.y+.55;m.rotation.y=Math.atan2(actor.heading.x,actor.heading.z);}}
  return {scene,rects,contains,obstacles,mechanics,bridge,braces,sockets,manifest,nextSign,animate,afterMove,interact,recover,
    get held(){return mechanics.held;},get falls(){return falls;},get message(){return messageT>0?message:'';},
    prompt(actor){const t=candidate(actor);return t&&t.kind!=='busy'?'E — '+t.label:t?.label||null;},
    target(actor){const s=mechanics.state;if(s.returned)return {point:V(0,0,8),label:'첫 실험 완료 · 용암 주조실은 다음 제작 단계다'};if(s.latched)return {point:V(...[F.hub[0],0,F.hub[1]]),label:'중앙 홀로 돌아가자'};if(s.stable)return {point:V(-28,0,-8),label:'다리를 건너 반대편에서 잠그자'};if(mechanics.held!==null){const i=F.sockets.findIndex((p,i)=>!s.braces.some(b=>b.slot===i));return {point:V(F.sockets[i][0],0,F.sockets[i][1]),label:'받침을 고정구에 끼우자'};}return {point:V(-28,0,10.8),label:s.visited?'다리를 안정시켜 건너편에 도달하자':'왼쪽 회랑의 다리를 살펴보자'};},
    hint(){const hints=['다리 시험 손잡이를 당기고, 움직이는 부위를 관찰해 보자.','다리 양쪽의 빈 고정구가 움직인다. 받침을 옮겨 고정해 보자.','받침 두 개를 끼우고 다시 시험한 다음, 다리를 건너 먼 쪽 손잡이로 잠그자.'];return hints[Math.min(hintLevel++,2)];},
    resume(actor){const p=F[mechanics.state.checkpoint];actor.setAt(p[0],p[1],mechanics.state.checkpoint==='far'?1:-1);animate(0,actor);}
  };
}
