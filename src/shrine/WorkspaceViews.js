import * as T from 'three';
import {installStaticRaycastTree} from '../render/StaticRaycastTree.js';

export function registerWorkspaceViews(room){
  if(!['balance','sift'].includes(room.spec.id))return room;
  const record=room.workspaceViews={loaded:false,zones:[]};
  const resume=room.resume.bind(room);
  room.resume=actor=>{record.actor=actor;const result=resume(actor);record.registerCamera?.();record.settleActor?.();return result;};
  record.ready=room.ready.then(()=>{
    const gate=room.gates[0].gate,seg=gate.seg,bounds=[],points=[];
    let box;
    if(room.spec.id==='balance'){
      if(!room.balanceArt?.loaded)return false;
      box=new T.Box3().setFromObject(room.balanceArt.mechanisms[0].root);
      for(const sign of[-1,1])points.push(new T.Vector3(sign*1.9,.42,gate.scale.position.z+.3));
    }else{
      if(!room.architectureArt?.loaded)return false;
      const f=gate.frame;box=new T.Box3(new T.Vector3(f.x-1.7,.06,f.z-1.6),new T.Vector3(f.x+1.7,2.0,gate.tray.z+1));
      points.push(new T.Vector3(f.x,1.9,f.z),new T.Vector3(f.x-1.15,1.3,f.z+1),new T.Vector3(f.x+1.15,1.3,f.z+1));
    }
    for(const x of[box.min.x-.12,box.max.x+.12])for(const y of[box.min.y,box.max.y+.12])for(const z of[box.min.z,box.max.z])bounds.push(new T.Vector3(x,y,z));
    const zone={id:'workspace-'+room.spec.id+'-first',workspace:true,x0:seg.x0+.5,x1:seg.x1-.5,z0:(room.spec.id==='balance'?gate.scale.position.z:gate.frame.z)+1,z1:seg.z1,active:()=>!gate.solved,facing:yaw=>Math.abs(Math.atan2(Math.sin(yaw),Math.cos(yaw)))<.7,points:()=>points,framePoints:()=>bounds,signature:()=>room.spec.id==='balance'?[gate.count,gate.held?.id??gate.held??'',...gate.stock.map(b=>b.at),Math.round(gate.balanceMechanism.angle*1000)].join('/'):[gate.orderIndex,gate.fitted,gate.held?.gap??'',...gate.mix].join('/')};
    const rects=room.dungeon.rects,subject=rects.cameraSubjectZones?.find(s=>s.id===seg.id);
    rects.workspaceAspectFit=true;
    // The retained OpenField bridge uprights are visible but were absent from
    // Sift's later native-architecture camera list. Their measured source box
    // is .16 x1.0 x.16, including the post at x2.3/z6 exposed by the body rays.
    record.bridgePosts=[];
    record.bridgeSolids=[];
    if(room.spec.id==='sift')for(const m of room.scene.children){const p=m.geometry?.parameters;if(m.isMesh&&p?.width===.16&&p.height===1&&p.depth===.16){
      m.name='Sift preserved bridge post';installStaticRaycastTree(m);if(!rects.cameraOccluders.includes(m))rects.cameraOccluders.push(m);record.bridgePosts.push(m);
      const b=new T.Box3().setFromObject(m),solid={shape:'box',x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z,minY:b.min.y,maxY:b.max.y,padding:.28};
      room.obstacles.push(solid);record.bridgeSolids.push(solid);
      if(record.actor?.rects===rects&&record.actor.obstacles!==room.obstacles)record.actor.obstacles.push(solid);
    }}
    record.cameraAdditions=[];
    record.registerCamera=()=>{
      if(!record.actor)return;
      const known=new Set(rects.cameraOccluders);
      room.scene.traverse(m=>{
        if(!m.isMesh||m.material?.transparent)return;
        for(let parent=m;parent;parent=parent.parent)if(parent===record.actor.mesh)return;
        if(!known.has(m)){installStaticRaycastTree(m);rects.cameraOccluders.push(m);record.cameraAdditions.push(m);known.add(m);}
      });
    };
    record.registerCamera();
    record.settleActor=()=>{
      const actor=record.actor;if(!actor||actor.rects!==rects||!record.bridgeSolids.length)return;
      const old=actor.position.clone();actor._pushOut(actor.position,record.bridgeSolids);
      if(actor.position.distanceToSquared(old)>1e-12){actor.syncMesh();actor._camPlaced=false;}
    };
    record.settleActor();
    room.final.heritagePromise?.then(()=>record.registerCamera());
    if(subject)Object.assign(subject,{pitchAssist:.35,anticipateMotion:true});
    const entry=rects.find(s=>s.id==='entry');
    if(entry)(rects.cameraSubjectZones??=[]).push({...entry,halfWidth:.22,pitchAssist:.35,minRetreat:3.5,yawAssist:.75,smoothOcclusion:true,anticipateMotion:true});
    (rects.cameraTaskZones??=[]).push(zone);record.zones.push(zone);record.loaded=true;return true;
  });room.ready=Promise.all([room.ready,record.ready]);return room;
}
