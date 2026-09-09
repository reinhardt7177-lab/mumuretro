import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BALANCE_TEMPLE as D } from '../data/balanceTemple.js';
let source=null;
export async function loadBalanceTemple(){source=(await new GLTFLoader().loadAsync(D.model)).scene;}
export function templePart(name){const found=source?.getObjectByName(name);if(!found)return null;const g=found.clone(true);g.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;o.userData.partitionedSolid=true;for(const m of Array.isArray(o.material)?o.material:[o.material])m.userData.outlineParameters={visible:false};}});return g;}
export function buildBalanceDungeon(scene,rooms,theme){
  const rects=[],doors={};rects.cameraOccluders=[];scene.background=new THREE.Color(0x182b3d);scene.fog=new THREE.Fog(0x182b3d,45,110);
  scene.add(new THREE.HemisphereLight(0xe7efde,0x293647,1.6));const sun=new THREE.DirectionalLight(0xffdfab,3.1);sun.position.set(14,35,-10);sun.target.position.set(0,0,-22);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-23,right:23,top:48,bottom:-48,near:1,far:100});sun.shadow.bias=-.0004;scene.add(sun,sun.target);
  const m=new THREE.MeshStandardMaterial({color:0xc6c3a4});
  for(const s of rooms){const r={id:s.id,kind:s.kind,name:s.name,act:s.act,x0:-s.w/2,x1:s.w/2,z0:s.to,z1:s.from,h:s.h,camH:s.h,open:!s.door};rects.push(r);
    const name=s.id==='r1'?'hall_order':s.id==='r2'?'hall_twin':s.id==='shrine'?'hall_lever':s.id==='entry'?'hall_entry':'hall_corridor';const art=templePart(name);
    if(art){art.position.z=(s.from+s.to)/2;scene.add(art);}else{const floor=new THREE.Mesh(new THREE.BoxGeometry(s.w,.3,s.from-s.to),m);floor.position.set(0,-.15,(s.from+s.to)/2);scene.add(floor);}
    if(s.door){const root=new THREE.Group();root.position.z=s.from-.15;scene.add(root);for(const side of [-1,1]){const leaf=templePart('door_leaf')||new THREE.Mesh(new THREE.BoxGeometry(2.45,5,.35),m);leaf.position.x=side*1.25;root.add(leaf);}doors[s.door]={mesh:root,rect:r,opened:false,amount:0};}
  }
  const sr=rects.find(r=>r.id==='shrine');sr.z0=D.gateZ+.3;
  const passage={id:'sanctumDoor',kind:'corridor',x0:-2.5,x1:2.5,z0:D.gateZ-.4,z1:D.gateZ+.3,h:8,open:false};
  rects.push(passage,{id:'audience',name:'균형의 신',kind:'corridor',x0:-9,x1:9,z0:-64,z1:D.gateZ-.4,h:11,open:true});
  rects.cameraLiftZones=[...rects];
  const root=new THREE.Group();root.position.z=D.gateZ;scene.add(root);for(const side of [-1,1]){const leaf=templePart('door_leaf')||new THREE.Mesh(new THREE.BoxGeometry(2.45,5,.35),m);leaf.position.x=side*1.25;root.add(leaf);}
  doors.shrine={mesh:root,rect:passage,opened:false,amount:0};
  // The final doorway fills the room width outside its five metre passage.
  for(const side of [-1,1]){const wall=new THREE.Mesh(new THREE.BoxGeometry(6.5,8,.5),new THREE.MeshStandardMaterial({color:0x173b43}));wall.position.set(side*5.75,4,D.gateZ);scene.add(wall);
    rects.cameraOccluders.push(wall);
    for(const x of [3,8.5]){const pilaster=new THREE.Mesh(new THREE.CylinderGeometry(.26,.36,8,12),m);pilaster.position.set(side*x,4,D.gateZ+.4);scene.add(pilaster);rects.cameraOccluders.push(pilaster);}
    const crest=new THREE.Mesh(new THREE.TorusGeometry(1.3,.055,6,48),new THREE.MeshStandardMaterial({color:0xbd9550,metalness:.6,roughness:.5}));crest.position.set(side*5.75,4.8,D.gateZ+.3);scene.add(crest);
  }
  const god=templePart('guardian');if(god){god.position.set(0,0,D.godZ);scene.add(god);}
  const backdrop=new THREE.Mesh(new THREE.BoxGeometry(18,11,.5),new THREE.MeshStandardMaterial({color:0x12303b}));backdrop.position.set(0,5.5,-64);scene.add(backdrop);
  const aureole=new THREE.Mesh(new THREE.TorusGeometry(3.1,.08,8,64),new THREE.MeshStandardMaterial({color:0xcead6a,metalness:.65,roughness:.4}));aureole.position.set(0,4.3,-63.5);scene.add(aureole);
  for(let i=0;i<16;i++){const a=i*Math.PI/8,star=new THREE.Mesh(new THREE.OctahedronGeometry(i%2?.06:.13),new THREE.MeshBasicMaterial({color:0xe8d297}));star.position.set(Math.sin(a)*3.1,4.3+Math.cos(a)*3.1,-63.4);scene.add(star);}
  const blessing=new THREE.Mesh(new THREE.IcosahedronGeometry(.3,1),new THREE.MeshBasicMaterial({color:0x8dffe0}));blessing.position.set(0,2.75,D.godZ+.85);scene.add(blessing);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.5,.045,6,48),new THREE.MeshBasicMaterial({color:0xffd884}));ring.rotation.x=-Math.PI/2;ring.position.set(0,.04,D.godZ+2);scene.add(ring);
  return {rects,doors,rooms,theme,lights:[],open:false,god,modelLoaded:!!source,
    rectOf:id=>id==='shrine'?{...sr,z0:-64}:rects.find(r=>r.id===id),segmentAt:z=>rects.find(r=>z<=r.z1&&z>=r.z0),
    openDoor(id){const d=doors[id];if(!d||d.opened)return false;d.opened=true;return true;},
    update(dt){for(const d of Object.values(doors)){d.amount=Math.min(1,d.amount+(d.opened?dt/1.1:0));d.mesh.children.forEach((o,i)=>o.position.x=(i?1:-1)*(1.25+d.amount*2.7));if(d.amount===1)d.rect.open=true;}},
    resetDoors(){for(const d of Object.values(doors)){d.opened=false;d.amount=0;d.rect.open=false;d.mesh.children.forEach((o,i)=>o.position.x=(i?1:-1)*1.25);}},
  };
}
