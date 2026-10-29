import * as T from 'three';
import {templePart} from './BalanceTemple.js';
import {installStaticRaycastTree} from '../render/StaticRaycastTree.js';

export function registerBalanceCourtArt(room){
  if(room.spec.id!=='balance')return room;
  const r=room.balanceCourtArt={loaded:false,frames:[],aprons:[],labels:[],oldBars:[],colliders:[],cameraMeshes:[],actor:null,last:''};
  const resume=room.resume.bind(room);room.resume=actor=>{r.actor=actor;const result=resume(actor);r.sync?.(true);r.reconcile?.();return result;};
  const update=room.updateArchitecture?.bind(room);room.updateArchitecture=(dt,actor)=>{update?.(dt,actor);r.actor=actor;r.sync?.();};
  r.ready=room.ready.then(()=>{
    const frame=templePart('GaugeFrame'),cell=templePart('GaugeCell'),apron=templePart('TrayPlaqueMount'),g=room.gates[1].gate;
    const plates=g.root.children.filter(m=>m.isMesh&&m.userData.balancePlaque&&Math.abs(m.position.z-g.plates[0].z-1.5)<.001).sort((a,b)=>a.position.x-b.position.x),barMaterials=new Set(g.plates.flatMap(p=>p.bars)),originalBars=g.root.children.filter(m=>m.isMesh&&barMaterials.has(m.material));
    if(!frame||!cell||!apron||!room.balanceArt?.loaded||plates.length!==2||originalBars.length!==20){r.reason='optional court parts unavailable';return false;}
    const spec=r.spec={cellCount:10,cellBottom:.335,cellStep:.2,cellZ:.05,panRelativeZ:-1.65,positions:[[-4.6,0,g.plates[0].z-1.65],[4.6,0,g.plates[0].z-1.65]],body:[{position:[0,.12,0],size:[1.05,.24,.8]},{position:[0,1.32,-.03],size:[.8,2.16,.46]},{position:[0,2.56,0],size:[.96,.32,.66]}]};
    const nativeMeshes=[];cell.updateWorldMatrix(true,true);cell.traverse(m=>{if(m.isMesh)nativeMeshes.push(m);});
    if(nativeMeshes.length!==1)throw Error('Gauge cell geometry contract changed');
    const colour=new T.Color(),matrix=new T.Matrix4(),source=nativeMeshes[0],geometry=source.geometry.clone().applyMatrix4(source.matrixWorld),material=new T.MeshBasicMaterial({color:0xffffff});material.userData.outlineParameters={visible:false};
    const cells=r.cells=new T.InstancedMesh(geometry,material,20);cells.name='Balance current weight cells';cells.castShadow=cells.receiveShadow=false;
    function camera(root){root.traverse(m=>{if(m.isMesh){installStaticRaycastTree(m);r.cameraMeshes.push(m);}});}
    function label(root,w,h,position,text){const canvas=document.createElement('canvas');canvas.width=384;canvas.height=128;const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const mat=new T.MeshBasicMaterial({map:texture});mat.userData.outlineParameters={visible:false};const face=new T.Mesh(new T.PlaneGeometry(w,h),mat);face.position.fromArray(position);root.add(face);installStaticRaycastTree(face);r.cameraMeshes.push(face);const record={face,canvas,texture,text};r.labels.push(record);return record;}
    function paint(rec,text){const ctx=rec.canvas.getContext('2d');ctx.fillStyle='#102e39';ctx.fillRect(0,0,384,128);ctx.fillStyle='#fff1cc';ctx.font='700 78px "Malgun Gothic",system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,192,68,354);rec.texture.needsUpdate=true;rec.text=text;}
    for(let side=0;side<2;side++){
      const root=frame.clone(true);root.name='Balance weight gauge '+side;root.position.fromArray(spec.positions[side]);room.scene.add(root);r.frames.push(root);camera(root);
      const name=side?'오른쪽':'왼쪽';const text=label(root,.75,.23,[0,2.535,.353],name+' · 0');r.labels[side]=text;
      for(let i=0;i<10;i++){matrix.makeTranslation(root.position.x,spec.cellBottom+i*spec.cellStep,root.position.z+spec.cellZ);cells.setMatrixAt(side*10+i,matrix);cells.setColorAt(side*10+i,colour.setHex(0x174047));}
      for(const s of spec.body){const[x,y,z]=s.position,[w,h,d]=s.size;r.colliders.push({shape:'box',x0:root.position.x+x-w/2,x1:root.position.x+x+w/2,z0:root.position.z+z-d/2,z1:root.position.z+z+d/2,minY:y-h/2,maxY:y+h/2,padding:.28,escapeZ:1,balanceGauge:side});}
      const pan=g.balanceMechanism.pans[side],mount=apron.clone(true);mount.name='Balance attached tray plaque '+side;mount.position.set(0,-2.485,.76);pan.add(mount);r.aprons.push(mount);camera(mount);
      const original=plates[side];r.originalPlates??=[];r.originalPlates.push({mesh:original,parent:original.parent,position:original.position.clone(),geometry:original.geometry,map:original.material.map});
      const canvas=document.createElement('canvas');canvas.width=384;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#102e39';ctx.fillRect(0,0,384,128);ctx.fillStyle='#fff1cc';ctx.font='700 88px "Malgun Gothic",system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('두 칸',192,68);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;original.geometry=new T.PlaneGeometry(1.18,.35);original.material=original.material.clone();original.material.map=texture;pan.add(original);original.position.set(0,-2.265,.827);original.quaternion.identity();original.scale.set(1,1,1);r.cameraMeshes.push(original);
    }
    room.scene.add(cells);cells.instanceMatrix.needsUpdate=true;cells.instanceColor.needsUpdate=true;cells.computeBoundingBox();cells.computeBoundingSphere();installStaticRaycastTree(cells);r.cameraMeshes.push(cells);
    for(const m of originalBars){r.oldBars.push(m);m.visible=false;}
    const rects=room.dungeon.rects;room.obstacles.push(...r.colliders);for(const m of r.cameraMeshes)if(!rects.cameraOccluders.includes(m))rects.cameraOccluders.push(m);
    for(const zone of rects.cameraSubjectZones||[])zone.anticipateMotion=true;
    rects.cameraApproachZones=spec.positions.map(([x,y,z])=>({x,z,near:2.5,far:5.5,distance:2.7}));
    const floor=rects.floorAt?.bind(rects);rects.floorAt=(x,z,y=0)=>{let h=floor?.(x,z,y)??0;for(const s of r.colliders)if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1&&y+.26>=s.maxY)h=Math.max(h,s.maxY);return h;};
    r.sync=(force=false)=>{const sums=g.sums(),state=sums.join(':')+':'+g.solved;if(!force&&state===r.last)return;r.last=state;for(let side=0;side<2;side++){for(let i=0;i<10;i++)cells.setColorAt(side*10+i,colour.setHex(i<sums[side]?(g.solved?0xffd27a:0x77e6d6):0x174047));paint(r.labels[side],(side?'오른쪽':'왼쪽')+' · '+sums[side]);}cells.instanceColor.needsUpdate=true;};
    const gateUpdate=g.update.bind(g);g.update=(...args)=>{const result=gateUpdate(...args);r.sync();return result;};
    for(const name of ['importState','restart','finishLegacy']){const fn=room[name]?.bind(room);if(fn)room[name]=(...args)=>{const result=fn(...args);if(name!=='importState'||result)r.sync(true);return result;};}
    r.reconcile=()=>{const a=r.actor;if(a?.rects!==rects)return;const old=a.position.clone();a._pushOut(a.position);if(old.distanceTo(a.position)>1e-6){a.syncMesh();a._camPlaced=false;}};r.loaded=true;r.sync(true);r.reconcile();return true;
  }).catch(error=>{r.reason=error.message;console.warn('[balance-court-art]',error);return false;});room.ready=Promise.all([room.ready,r.ready]);return room;
}
