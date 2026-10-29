import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { installStaticRaycastTree } from '../render/StaticRaycastTree.js';

let pending;
const meshes=root=>{const result=[];root.traverse(o=>{if(o.isMesh)result.push(o);});return result;};
function assets(){return pending??=fetch('assets/models/adventure/balance-mechanisms-v01.json').then(async r=>{if(!r.ok)return null;const spec=await r.json(),gltf=await new GLTFLoader().loadAsync(spec.model);gltf.scene.updateMatrixWorld(true);return{spec,source:gltf.scene};}).catch(e=>{console.warn('[balance-art] retained original mechanisms',e);return null;});}

export function registerBalanceArt(room){
  if(room.spec.id!=='balance')return room;
  const record=room.balanceArt={loaded:false,models:[],colliders:[],crateBodies:[],ready:null};
  const resume=room.resume?.bind(room);room.resume=actor=>{const result=resume?.(actor);record.actor=actor;record.reconcileActor?.();return result;};
  record.ready=Promise.all([assets(),room.ready]).then(([asset])=>{
    if(!asset){record.reason='optional asset unavailable';return false;}const{spec,source}=asset;
    const names=['OrderScale','OrderBeam','OrderLeftPanRest','OrderRightPanRest','TwinScale','TwinBeam','TwinLeftPanCell0','TwinLeftPanCell1','TwinRightPanCell0','TwinRightPanCell1','LeverAssembly','LeverBeam','LeverFulcrum','LeverRail',...Array.from({length:6},(_,i)=>'LeverCell'+i),...Array.from({length:6},(_,i)=>'LeverLabel'+i)];
    record.missing=names.filter(name=>!source.getObjectByName(name));if(record.missing.length){record.reason='required anchor missing';return false;}
    record.floorBounds=spec.parts.map(name=>({name,minY:new T.Box3().setFromObject(source.getObjectByName(name),true).min.y}));if(record.floorBounds.some(b=>Math.abs(b.minY)>.001)){record.reason='floor datum mismatch';return false;}
    const [order,twin]=room.gates.map(g=>g.gate),lever=room.final,rects=room.dungeon.rects;
    function add(name,g,z){const root=source.getObjectByName(name).clone(true);root.position.set(0,0,z);g.root.add(root);root.name='Balance native '+name;for(const m of meshes(root)){m.castShadow=m.receiveShadow=true;m.material.userData.outlineParameters={visible:false};}record.models.push(root);return root;}
    const roots=[add('OrderScale',order,order.scale.position.z),add('TwinScale',twin,twin.plates[0].z),add('LeverAssembly',lever,lever.originZ)];
    const old=[order.scale,...twin.plates.map(p=>p.group),...twin.plateTiles,twin.link,lever.beam,lever.fulcrum].filter(Boolean);old.forEach(o=>o.visible=false);record.oldParts=old;record.spec=spec;
    function body(x,z,w,d,minY,maxY,escapeX=0,escapeZ=0){const o={shape:'box',x,z,r:Math.hypot(w,d)/2+spec.bodyPadding,x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,minY,maxY,padding:spec.bodyPadding,escapeX,escapeZ,balanceMechanism:true};record.colliders.push(o);room.obstacles.push(o);return o;}
    // Replace the former single circular scale base while preserving array identity.
    for(let i=room.obstacles.length-1;i>=0;i--)if(order.obstacles.includes(room.obstacles[i]))room.obstacles.splice(i,1);
    body(0,order.scale.position.z,1.25,1,0,2.2);body(0,twin.plates[0].z,1.4,1.15,0,3.2);body(0,lever.originZ,8.9,1.1,0,1.5,0,1);
    // Existing v04 columns were rendered but not represented in body obstacles.
    for(const s of room.spec.rooms){const length=s.from-s.to;for(const side of[-1,1])for(let i=0;i<Math.floor((length-2)/4)+1;i++){const x=side*(s.w/2-.25),z=(s.from+s.to)/2-length/2+1+i*4;body(x,z,1,1,0,.74,-side);body(x,z,.6,.6,.6,s.h-.7,-side);}}
    const ray=new T.Raycaster(),up=new T.Vector3(0,1,0),position=new T.Vector3(),quaternion=new T.Quaternion();
    function rest(frame,anchor){return{frame,anchor,meshes:meshes(frame)};}
    function padRest(p){p.group.updateWorldMatrix(true,true);const v=p.group.getWorldPosition(new T.Vector3());ray.set(new T.Vector3(v.x,2,v.z),new T.Vector3(0,-1,0));ray.far=3;const hit=ray.intersectObjects(meshes(p.group),false)[0];const anchor=new T.Object3D();anchor.name='Measured answer-pad surface';p.group.add(anchor);anchor.position.copy(p.group.worldToLocal(hit?hit.point.clone():v.setY(.215)));return rest(p.group,anchor);}
    function mount(g,root,kind){
      const prefix=kind==='order'?'Order':'Twin',beam=root.getObjectByName(kind==='lever'?'LeverBeam':prefix+'Beam');
      const pans=kind==='lever'?[]:['Left','Right'].map(s=>root.getObjectByName(prefix+s+'Pan'));
      const rec=g.balanceMechanism={kind,root,beam,pans,rests:[],angle:0,visualPivot:(g.pivot??3)-3,pivot:root.getObjectByName('LeverFulcrum')};
      const bases=new Map(beam.children.map(o=>[o,o.position.clone()]));rec.visualPivot*=1.4;
      const bottoms=new Map(g.stock.map(b=>{const copy=b.mesh.clone(true);copy.position.set(0,0,0);copy.quaternion.identity();copy.updateMatrixWorld(true);return[b,new T.Box3().setFromObject(copy,true).min.y];}));
      if(kind==='order'){rec.rests=g.pads.map(padRest);for(const p of pans)rec.rests.push(rest(p,p.getObjectByName(p.name+'Rest')));}
      else if(kind==='twin')for(const p of pans)for(let i=0;i<2;i++)rec.rests.push(rest(p,p.getObjectByName(p.name+'Cell'+i)));
      else for(let i=0;i<6;i++)rec.rests.push(rest(beam,root.getObjectByName('LeverCell'+i)));
      const panBodies=pans.map(p=>body(0,0,kind==='order'?1.72:2.72,kind==='order'?1.72:1.62,0,kind==='order'?2.2:3.2,0,1));
      const sync=g.sync.bind(g);
      const crateMeshes=new Map(g.stock.map(b=>[b,meshes(b.mesh)]));
      const crateLocalBounds=new Map(g.stock.map(b=>{const copy=b.mesh.clone(true);copy.position.set(0,0,0);copy.quaternion.identity();copy.scale.set(1,1,1);copy.updateMatrixWorld(true);return[b,new T.Box3().setFromObject(copy,true)];}));
      const crateBounds=new T.Box3(),crateBodies=new Map(g.stock.map(b=>{const o=body(0,0,1,1,0,0);Object.assign(o,{balanceCrate:true,padding:.18,active:false});record.crateBodies.push(o);return[b,o];}));
      function settle(){root.updateWorldMatrix(true,true);rec.rests.forEach((r,i)=>{r.anchor.getWorldPosition(position);Object.assign(g.cells[i],{x:position.x,y:position.y,z:position.z});});sync();for(const b of g.stock){for(const mesh of crateMeshes.get(b))mesh.userData.cameraIgnored=b.at===-2;if(b.at===-2)continue;if(b.at===-1){b.mesh.rotation.set(0,0,0);b.mesh.position.copy(b.home);b.mesh.position.y-=bottoms.get(b);}else{const r=rec.rests[b.at];r.frame.getWorldQuaternion(quaternion);r.anchor.getWorldPosition(position);b.mesh.quaternion.copy(quaternion);b.mesh.position.copy(position).addScaledVector(up.clone().applyQuaternion(quaternion),-bottoms.get(b));}}
        // Pans and the lever already have continuous body volumes. Duplicating
        // those with tilted crate boxes can trap the carrier between two solids.
        for(const b of g.stock){const o=crateBodies.get(b);o.active=b.mesh.visible&&(b.at===-1||(kind==='order'&&b.at>=0&&b.at<5));o.disabled=!o.active;o.atHome=b.at===-1;o.walkTop=o.active;if(!o.active)continue;b.mesh.updateWorldMatrix(true,false);crateBounds.copy(crateLocalBounds.get(b)).applyMatrix4(b.mesh.matrixWorld);Object.assign(o,{x:(crateBounds.min.x+crateBounds.max.x)/2,z:(crateBounds.min.z+crateBounds.max.z)/2,x0:crateBounds.min.x,x1:crateBounds.max.x,z0:crateBounds.min.z,z1:crateBounds.max.z,minY:crateBounds.min.y,maxY:crateBounds.max.y});}
        // Returning a crate can restore it where the carrier is standing. Resolve
        // the measured body overlap before that frame's camera follows the actor.
        const a=record.actor;if(a?.rects===rects){const x=a.position.x,z=a.position.z;a._pushOut(a.position);if(Math.hypot(a.position.x-x,a.position.z-z)>1e-6)a.syncMesh();}
        if(kind==='lever')g.cellLabels.forEach((label,i)=>{const anchor=root.getObjectByName('LeverLabel'+i);anchor.getWorldPosition(label.position);anchor.getWorldQuaternion(label.quaternion);label.scale.set(.75,.5,1);});
      }
      function pose(dt,snap=false){let target;
        if(kind==='order'){const l=g.stock.find(b=>b.at===5)?.w||0,r=g.stock.find(b=>b.at===6)?.w||0;target=Math.sign(l-r)*spec.order.maxAngle;}
        else if(kind==='twin'){const [l,r]=g.sums();target=T.MathUtils.clamp((l-r)*.012,-spec.twin.maxAngle,spec.twin.maxAngle);}
        else{const[l,r]=g.torques();target=g.solved?0:T.MathUtils.clamp((l-r)*.025,-spec.lever.maxAngle,spec.lever.maxAngle);const px=(g.pivot-3)*1.4;rec.visualPivot=snap?px:T.MathUtils.damp(rec.visualPivot,px,14,dt);beam.position.x=rec.visualPivot;rec.pivot.position.x=rec.visualPivot;for(const[o,p]of bases)o.position.x=p.x-rec.visualPivot;}
        rec.angle=snap?target:T.MathUtils.damp(rec.angle,target,5,dt);beam.rotation.z=rec.angle;pans.forEach((p,i)=>{p.rotation.z=-rec.angle;p.updateWorldMatrix(true,true);p.getWorldPosition(position);const o=panBodies[i],w=kind==='order'?1.72:2.72,d=kind==='order'?1.72:1.62;Object.assign(o,{x:position.x,z:position.z,x0:position.x-w/2,x1:position.x+w/2,z0:position.z-d/2,z1:position.z+d/2});});settle();
      }
      g.sync=settle;
      const update=g.update.bind(g);g.update=(dt,a)=>{const result=update(dt,a);pose(dt);return result;};
      for(const method of['restart','restore']){const original=g[method].bind(g);g[method]=(...args)=>{const result=original(...args);pose(0,true);return result;};}
      if(kind==='order'){const prompt=g.prompt.bind(g);g.prompt=p=>{const text=prompt(p),l=g.stock.find(b=>b.at===5),r=g.stock.find(b=>b.at===6);if(g.held!==null||g.solved||!l||!r||Math.hypot(p.x,p.z-root.position.z)>3.6)return text;const relation=Math.abs(rec.angle)<.005?'두 접시가 수평이다':rec.angle>0?'왼쪽 접시가 내려갔다':'오른쪽 접시가 내려갔다';return text.startsWith('E — ')?text+' · '+relation:relation+' — 접시의 상자를 다시 들어 비교하라';};}
      rec.pose=pose;pose(0,true);return rec;
    }
    record.mechanisms=[mount(order,roots[0],'order'),mount(twin,roots[1],'twin'),mount(lever,roots[2],'lever')];
    const floorAt=rects.floorAt?.bind(rects);rects.floorAt=(x,z,y=0)=>{let h=floorAt?.(x,z,y)??0;for(const b of record.crateBodies)if(b.active&&b.walkTop&&x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1&&y+.26>=b.maxY)h=Math.max(h,b.maxY);return h;};
    const excluded=new Set(old.flatMap(meshes)),stock=new Set([order,twin,lever].flatMap(g=>g.stock.flatMap(b=>meshes(b.mesh))));
    // Keep the still-visible weight bars and original answer pads in the same
    // camera surface query as the native mechanisms and all selectable crates.
    const camera=[...room.dungeon.architectureParts.flatMap(meshes),...[order.root,twin.root,lever.root].flatMap(meshes).filter(m=>!excluded.has(m))];
    room.scene.traverse(o=>{if(o.userData.shrineSignboard)camera.push(...meshes(o));if(o.userData.balancePlaque&&!stock.has(o))camera.push(o);});
    rects.cameraOccluders=(rects.cameraOccluders||[]).filter(m=>!excluded.has(m));for(const m of new Set(camera)){m.updateWorldMatrix(true,false);installStaticRaycastTree(m);if(!rects.cameraOccluders.includes(m))rects.cameraOccluders.push(m);}
    rects.cameraSubjectZones=[order.seg,twin.seg,room.shrineSeg].map(s=>({...s,halfWidth:.22,pitchAssist:.24,minRetreat:3.5,yawAssist:.75,smoothOcclusion:true}));record.cameraMeshes=camera;record.loaded=true;
    record.reconcileActor=()=>{const a=record.actor;if(a?.rects!==rects)return;const before=a.position.clone();a._pushOut(a.position);if(a.position.distanceTo(before)>1e-6){a.syncMesh();a._camPlaced=false;record.lastSafeShift=a.position.distanceTo(before);}};record.reconcileActor();return true;
  });room.ready=Promise.all([room.ready,record.ready]);return room;
}
