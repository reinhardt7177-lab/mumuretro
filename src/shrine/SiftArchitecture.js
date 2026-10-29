import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { installStaticRaycastTree } from '../render/StaticRaycastTree.js';

let pending;
function assets(){return pending??=fetch('assets/models/adventure/sift-architecture-v01.json').then(async r=>{
  if(!r.ok)return null;const spec=await r.json(),gltf=await new GLTFLoader().loadAsync(spec.model);gltf.scene.updateMatrixWorld(true);return{spec,source:gltf.scene};
}).catch(e=>{console.warn('[sift-architecture] retained original workshop',e);return null;});}

export function registerSiftArchitecture(room){
  if(room.spec.id!=='sift')return room;
  const record=room.architectureArt={loaded:false,models:[],colliders:[],aprons:[],ready:null};
  record.ready=Promise.all([assets(),room.ready]).then(([asset])=>{
    if(!asset)return false;const{source,spec}=asset,parts={};
    for(const name of spec.parts){parts[name]=source.getObjectByName(name);if(!parts[name])return false;}
    const floorBounds=new T.Box3().setFromObject(parts.HallFloor),statueBounds=new T.Box3().setFromObject(parts.SiftGuardian);
    if(Math.abs(floorBounds.min.y-spec.hall.foundationBottom)>.003||Math.abs(floorBounds.max.y-spec.hall.inlayMaxY)>.003||Math.abs(statueBounds.min.y)>.003)return false;
    const scene=room.scene,rects=room.dungeon.rects,root=new T.Group();root.name='분리 신전 석조 전당';scene.add(root);record.root=root;record.spec=spec;
    const courts=[room.sieveCourt,room.sortCourt,room.evaporationCourt,room.siftSanctum],segments=[...room.gates.map(g=>g.gate.seg),room.shrineSeg];
    const placements=segments.map(s=>({x:0,y:0,z:(s.z0+s.z1)/2,sx:(s.x1-s.x0)/12,sz:(s.z1-s.z0)/12}));
    const portalPlacements=Object.entries(room.dungeon.doors).map(([id,d])=>({id,x:0,y:0,z:d.rect.z1+spec.portal.zOffset,sx:1,sz:1,door:d}));
    const nativeOccluders=[],boards=[];
    // Goal/hint boards are scene children, outside the workshop batches.
    // Register their faces, solid backs and posts as well as the native kit.
    scene.traverse(o=>{if(o.userData.shrineSignboard)o.traverse(m=>{if(m.isMesh)boards.push(m);});});
    record.boards=boards;
    function instances(name,list,camera=true){
      for(const part of parts[name].children){if(!part.isMesh)continue;
        const geometry=part.geometry.clone().applyMatrix4(part.matrixWorld),material=part.material;material.userData.outlineParameters={visible:false};
        const m=new T.InstancedMesh(geometry,material,list.length),matrix=new T.Matrix4(),q=new T.Quaternion();
        list.forEach((p,i)=>{matrix.compose(new T.Vector3(p.x,p.y,p.z),q,new T.Vector3(p.sx,1,p.sz));m.setMatrixAt(i,matrix);});
        m.name='Sift architecture '+name+' '+material.name;m.userData.siftArchitecture=name;m.castShadow=name!=='HallFloor';m.receiveShadow=true;m.computeBoundingSphere();installStaticRaycastTree(m);root.add(m);record.models.push(m);
        if(camera&&!material.name.endsWith('brass'))nativeOccluders.push(m);
      }
    }
    instances('WorkHall',placements);instances('HallFloor',placements,false);instances('ThresholdArch',portalPlacements);
    instances('SiftGuardian',[{x:0,y:0,z:room.final.gz-3,sx:1,sz:1}]);
    const old=new Set(courts.flatMap(c=>c.architectureParts));for(const m of room.final.workshop.guardianParts)old.add(m);
    for(const m of scene.children)if(m.userData.doorFrame||segments.some(s=>s.id===m.userData.slabRim))old.add(m);
    for(const m of old)m.visible=false;record.oldParts=[...old];
    rects.cameraOccluders=(rects.cameraOccluders||[]).filter(m=>!old.has(m));rects.cameraOccluders.push(...nativeOccluders,...boards);
    for(const court of courts){court.cameraOccluders=court.cameraOccluders.filter(m=>!old.has(m));court.cameraOccluders.push(...nativeOccluders);}
    record.cameraOccluders=nativeOccluders;
    function solid(p,x,y,z,w,h,d,escapeX=0,escapeZ=0){
      const cx=p.x+x*p.sx,cz=p.z+z*p.sz,ww=w*p.sx,dd=d*p.sz;
      const o={shape:'box',x:cx,z:cz,r:Math.hypot(ww,dd)/2+.28,x0:cx-ww/2,x1:cx+ww/2,z0:cz-dd/2,z1:cz+dd/2,minY:y-h/2,maxY:y+h/2,padding:.28,escapeX,escapeZ,siftArchitecture:true};record.colliders.push(o);room.obstacles.push(o);
    }
    for(const p of placements)for(const side of[-1,1]){
      const x=side*spec.hall.columnX;
      for(const z of spec.hall.bayZ){solid(p,x,.18,z,1,.36,1.04,-side);solid(p,x,.44,z,.83,.16,.85,-side);solid(p,x,2.40,z,.68,3.76,.68,-side);}
      for(const[start,end]of[[-5.2,-.4],[.4,5.2]]){
        solid(p,x,.19,(start+end)/2,.64,.38,end-start,-side);solid(p,x,1.02,(start+end)/2,.44,.16,end-start,-side);
        for(let i=0;i<6;i++){const z=start+.25+(end-start-.5)*i/5;solid(p,x,.66,z,.24,.64,.16,-side);}
      }
    }
    for(const p of portalPlacements){
      for(const side of[-1,1]){solid(p,side*2.8,.16,0,.8,.32,.70,0,1);solid(p,side*2.8,1.82,0,.72,3,.60,0,1);}
      const s=spec.portal,apron={id:'architecture-apron-'+p.id,kind:'corridor',x0:-s.apronWidth/2,x1:s.apronWidth/2,z0:p.z+s.apronZ-s.apronDepth/2,z1:p.z+s.apronZ+s.apronDepth/2,h:4.2,camH:80,field:true,architectureApron:true};
      Object.defineProperty(apron,'open',{enumerable:true,get:()=>p.door.opened});rects.push(apron);record.aprons.push(apron);
    }
    // Change only this authored room's atmosphere after the native kit loads.
    // The original sun direction, reflection environment and puzzle lights stay.
    const l=spec.lighting;scene.background.set(l.horizon);if(scene.fog)scene.fog.color.copy(scene.background);
    for(const o of scene.children){
      if(o.userData.sky&&o.material?.uniforms?.uTop){o.material.uniforms.uTop.value.set(l.skyTop);o.material.uniforms.uHorizon.value.set(l.horizon);}
      if(o.isHemisphereLight){o.color.set(l.ambientSky);o.intensity=l.ambientIntensity;}
      if(o.isDirectionalLight){o.color.set(l.sun);o.intensity=l.sunIntensity;}
    }
    // Reuse the measured nine-point subject rule for the final room as well.
    rects.cameraSubjectZones=segments.map(s=>({...s,halfWidth:.22}));
    record.loaded=true;scene.userData.siftArchitecture=true;return true;
  });room.ready=Promise.all([room.ready,record.ready]);return room;
}
