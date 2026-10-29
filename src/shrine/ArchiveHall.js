import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {installStaticRaycastTree} from '../render/StaticRaycastTree.js';
import {MARKS} from '../data/marks.js';
import {SHRINE_COLORS} from './StrataGates.js';

let pending;
const names=['MarkBar','MarkCircle','MarkDisc','MarkDiamond','MarkTriangle'];
function assets(){return pending??=fetch('assets/models/adventure/archive-hall-v01.json').then(async r=>{if(!r.ok)throw Error('Archive manifest missing');const spec=await r.json();return{spec,source:(await new GLTFLoader().loadAsync(spec.model)).scene};}).catch(e=>{console.warn('[archive-hall] original controls retained',e);return null;});}

export function registerArchiveHall(room){
  if(room.spec.id!=='strata')return room;
  const gate=room.gates[2].gate,art=room.archiveHall={loaded:false,models:[],cameraMeshes:[],colliders:[],hidden:[],stations:[]};
  art.ready=Promise.all([room.ready,assets()]).then(([,asset])=>{
    if(!asset)return false;const{spec,source}=asset,parts={};source.updateMatrixWorld(true);
    for(const name of['ArchiveStation','ArchiveWheel','ArchiveFloor','ArchiveBridge',...names]){parts[name]=source.getObjectByName(name);if(!parts[name])throw Error('Missing '+name);}
    if(['x0','x1','z0','z1'].some(k=>gate.seg[k]!==spec.contract.seg[k])||MARKS.some((m,i)=>m.id!==SHRINE_COLORS[i].id))throw Error('Archive layout or notebook mark order changed');
    for(const name of['ArchiveStation','ArchiveFloor','ArchiveBridge',...names])if(Math.abs(new T.Box3().setFromObject(parts[name],true).min.y)>.001)throw Error('Archive local datum '+name);
    const mats=new Map();
    function add(name,pos,dynamic=false){const root=parts[name].clone(true);root.name='Archive '+name;root.position.fromArray(pos);room.scene.add(root);art.models.push(root);root.traverse(m=>{if(m.isMesh){if(!mats.has(m.material)){const mat=m.material.clone();mat.envMapIntensity=.65;mat.userData.outlineParameters={visible:false};mats.set(m.material,mat);}m.material=mats.get(m.material);m.receiveShadow=true;m.castShadow=!['ArchiveFloor','ArchiveBridge'].includes(name);if(m.castShadow){installStaticRaycastTree(m);art.cameraMeshes.push(m);}}});return root;}
    function body(s,x,z){const[a,y,c]=s.position,[w,h,d]=s.size;const b={shape:'box',x0:x+a-w/2,x1:x+a+w/2,z0:z+c-d/2,z1:z+c+d/2,minY:y-h/2,maxY:y+h/2,padding:.28,escapeZ:1,archiveHall:true};art.colliders.push(b);return b;}
    art.floor=add('ArchiveFloor',[0,-.12,(gate.seg.z0+gate.seg.z1)/2]);art.bridges=[add('ArchiveBridge',[0,-.12,-37]),add('ArchiveBridge',[0,-.12,-57])];
    for(const [i,l] of gate.levers.entries()){
      const base=add('ArchiveStation',[l.x,0,l.z]),wheel=add('ArchiveWheel',[l.x,spec.wheelY,l.z+spec.wheelZ],true),name=names[l.si],height=new T.Box3().setFromObject(parts[name],true).max.y;
      const mark=add(name,[l.x,1.75-height/2,l.z+.135]);mark.userData.markId=MARKS[l.si].id;
      for(const s of spec.parts.ArchiveStation.solids)body(s,l.x,l.z);
      body({position:[0,spec.wheelY,spec.wheelZ+.08],size:[.74,.74,.31]},l.x,l.z);
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
      const material=new T.MeshBasicMaterial({map:texture});material.userData.outlineParameters={visible:false};const label=new T.Mesh(new T.PlaneGeometry(.80,.25),material);label.position.set(l.x,.40,l.z+.279);room.scene.add(label);art.cameraMeshes.push(label);
      art.stations.push({lever:l,base,wheel,mark,label,canvas,texture,selected:-2,angle:0,from:0,target:0,time:spec.turnDuration,index:i});
    }
    // The five fixed bases share geometry and material. Keep their transforms
    // as inspection references, while drawing/raycasting the same surfaces in
    // four batches. Wheels and selection labels remain independently mutable.
    const bases=art.stations.map(s=>s.base),sourceMeshes=new Set(),batches=new Map();
    art.baseBatchGroup=new T.Group();art.baseBatchGroup.name='Archive repeated bases';
    for(const root of bases){
      root.updateWorldMatrix(true,true);
      root.traverse(m=>{if(m.isMesh){
        sourceMeshes.add(m);const key=m.geometry.uuid+':'+m.material.uuid;
        if(!batches.has(key))batches.set(key,[]);batches.get(key).push(m);
      }});
    }
    art.baseBatches=[];
    for(const originals of batches.values()){
      const first=originals[0],mesh=new T.InstancedMesh(first.geometry,first.material,originals.length);
      mesh.name='Archive base batch '+first.material.name;
      mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;
      originals.forEach((m,i)=>mesh.setMatrixAt(i,m.matrixWorld));
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
      installStaticRaycastTree(mesh);art.baseBatchGroup.add(mesh);art.baseBatches.push({mesh,originals});
    }
    room.scene.add(art.baseBatchGroup);bases.forEach(root=>root.visible=false);
    art.models=art.models.filter(root=>!bases.includes(root));art.models.push(art.baseBatchGroup);
    art.cameraMeshes=art.cameraMeshes.filter(m=>!sourceMeshes.has(m));
    art.cameraMeshes.push(...art.baseBatches.map(b=>b.mesh));
    // Keep the legacy nodes and their saved materials; suppress their draw only.
    for(const m of gate.group.children)if(m.isMesh){m.geometry=m.geometry.clone();m.geometry.setDrawRange(0,0);art.hidden.push(m);}
    for(const m of room.scene.children){if(['r3','c2','c3'].includes(m.userData.openFieldFloor))m.position.y-=.13;if(m.userData.openFieldFloorMark==='r3'){m.geometry=m.geometry.clone();m.geometry.setDrawRange(0,0);art.hidden.push(m);}}
    room.obstacles.push(...art.colliders);const rects=room.dungeon.rects;(rects.cameraOccluders??=[]).push(...art.cameraMeshes);const floor=rects.floorAt?.bind(rects);rects.floorAt=(x,z,y=0)=>{let h=floor?.(x,z,y)??0;for(const b of art.colliders)if(x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1&&y+.26>=b.maxY)h=Math.max(h,b.maxY);return h;};
    function paint(s){const choice=SHRINE_COLORS[s.lever.ci],c=s.canvas.getContext('2d');c.fillStyle='#eee7d3';c.fillRect(0,0,512,160);c.strokeStyle='#927244';c.lineWidth=7;c.strokeRect(4,4,504,152);c.fillStyle=choice?'#'+choice.c.toString(16).padStart(6,'0'):'#8b8a82';c.fillRect(24,40,72,80);c.strokeStyle='#49514d';c.lineWidth=3;c.strokeRect(24,40,72,80);c.fillStyle='#24312e';c.font='700 56px "Malgun Gothic",system-ui,sans-serif';c.textBaseline='middle';c.fillText(choice?.name||'선택 전',120,82);s.selected=s.lever.ci;s.label.userData.selectionName=choice?.name||'선택 전';s.texture.needsUpdate=true;}
    art.sync=(dt=0,snap=false)=>{for(const m of art.hidden)m.geometry.setDrawRange(0,0);for(const s of art.stations){if(s.selected!==s.lever.ci)paint(s);if(snap){s.angle=s.from=s.target=-(s.lever.ci+1)*Math.PI*2/5;s.time=spec.turnDuration;}else{s.time=Math.min(spec.turnDuration,s.time+Math.max(0,dt));const t=s.time/spec.turnDuration;s.angle=T.MathUtils.lerp(s.from,s.target,t*t*(3-2*t));}s.wheel.rotation.z=s.angle;s.wheel.updateWorldMatrix(true,true);}};
    const interact=gate.interact.bind(gate);gate.interact=pos=>{const l=gate._near(pos),ok=interact(pos);if(ok){const s=art.stations.find(s=>s.lever===l);s.from=s.angle;s.target-=Math.PI*2/5;s.time=0;art.sync();}return ok;};
    const update=room.updateArchitecture?.bind(room);room.updateArchitecture=(dt,actor)=>{update?.(dt,actor);art.actor=actor;art.sync(dt);};
    art.reconcile=()=>{const a=art.actor;if(a?.rects===rects){a._pushOut(a.position);a.syncMesh();a._camPlaced=false;}};
    for(const name of['importState','restart','finishLegacy']){const fn=room[name]?.bind(room);if(fn)room[name]=(...args)=>{const result=fn(...args);if(name!=='importState'||result){art.sync(0,true);art.reconcile();}return result;};}
    const resume=room.resume.bind(room);room.resume=a=>{art.actor=a;const result=resume(a);art.sync(0,true);art.reconcile();return result;};
    art.spec=spec;art.loaded=true;art.sync(0,true);return true;
  }).catch(e=>{art.reason=e.message;console.warn('[archive-hall]',e);return false;});room.ready=Promise.all([room.ready,art.ready]);return room;
}
