import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { installStaticRaycastTree } from '../render/StaticRaycastTree.js';

let pending;
const meshes=root=>{const found=[];root.traverse(o=>{if(o.isMesh)found.push(o);});return found;};
function assets(){return pending??=fetch('assets/models/adventure/moon-sanctum-v01.json').then(async r=>{if(!r.ok)return null;const spec=await r.json(),gltf=await new GLTFLoader().loadAsync(spec.model);return{spec,source:gltf.scene};}).catch(e=>{console.warn('[moon-sanctum] original statue and optics retained',e);return null;});}

export function registerMoonSanctum(room){
  if(room.spec.id!=='shadow')return room;
  const record=room.moonSanctum={loaded:false,models:[],colliders:[],ready:null};
  const resume=room.resume.bind(room);room.resume=a=>{const result=resume(a);record.actor=a;record.reconcileActor?.();return result;};
  record.ready=Promise.all([assets(),room.ready]).then(([asset])=>{
    if(!asset){record.reason='optional asset unavailable';return false;}
    const{source,spec}=asset,parts={};for(const name of spec.parts){parts[name]=source.getObjectByName(name);if(!parts[name]){record.reason='missing part '+name;return false;}}
    source.updateMatrixWorld(true);const guardianBox=new T.Box3().setFromObject(parts.MoonGuardian,true),floorBox=new T.Box3().setFromObject(parts.LunarFloor,true);
    if(Math.abs(guardianBox.min.y)>.001||guardianBox.max.y>=4.16||Math.abs(floorBox.min.y-spec.hall.foundationBottom)>.001||Math.abs(floorBox.max.y)>.001){record.reason='floor or light clearance';return false;}
    const pieces=spec.guardian.casters;
    if(!Array.isArray(pieces)||pieces.length<20||pieces.length>500||pieces.some(p=>!Array.isArray(p.vertices)||p.vertices.length<3||p.vertices.some(v=>!Array.isArray(v)||v.length!==3||v.some(n=>!Number.isFinite(n))||v[1]<-.001||v[1]>=4.16||Math.hypot(v[0],v[2])>spec.guardian.protectedRadius))){record.reason='invalid projection pieces';return false;}
    const s=room.sanctum,g=room.final,cz=g.gz,root=new T.Group();root.name='달그림자 수호자 전당';room.scene.add(root);record.root=root;record.spec=spec;
    function add(name){const o=parts[name].clone(true);o.position.set(0,0,cz);root.add(o);record.models.push(o);for(const m of meshes(o)){m.castShadow=false;m.receiveShadow=false;m.material.userData.outlineParameters={visible:false};m.material.envMapIntensity=.45;m.material.emissive.copy(m.material.color);m.material.emissiveIntensity=.08;}return o;}
    const statue=add('MoonGuardian'),arcade=add('LunarArcade'),floor=add('LunarFloor');
    // Only the computed statue projection draws a shadow. Lit stone still
    // follows the real lamp, with no decorative engine shadow on the puzzle.
    for(const m of meshes(floor)){m.material.roughness=.85;m.material.side=T.DoubleSide;m.material.userData.outlineParameters={visible:false};}
    const oldStatue=s.statue,oldParts=[oldStatue,...s.artSlots.floor,...s.artSlots.structure],oldMeshes=new Set(oldParts.flatMap(meshes));record.oldParts=oldParts;oldParts.forEach(o=>o.visible=false);
    const eyeMeshes=[];oldStatue.traverse(m=>{if(m.isMesh&&g.eyes.mats.includes(m.material))eyeMeshes.push(m);});
    const eyeAnchor=new T.Group();eyeAnchor.name='Moon guardian eye anchor';eyeAnchor.position.fromArray(spec.guardian.eye);statue.add(eyeAnchor);
    eyeMeshes.forEach((m,i)=>{eyeAnchor.add(m);m.position.set((i===0?-1:1)*spec.guardian.eyeGap,0,0);m.rotation.set(0,0,0);m.scale.set(.85,.8,1);m.visible=true;});record.eyes=eyeMeshes;
    statue.updateWorldMatrix(true,true);const nextParts=pieces.map(p=>p.vertices.map(v=>new T.Vector3(...v).applyMatrix4(statue.matrixWorld)));
    for(const m of eyeMeshes){const positions=m.geometry.attributes.position,vertices=[];for(let i=0;i<positions.count;i++)vertices.push(new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(m.matrixWorld));nextParts.push(vertices);}
    const newCasterMeshes=meshes(statue);s.replaceOptics(statue,nextParts,newCasterMeshes);record.opticalPieces=nextParts.length;
    const oldObstacles=new Set(s.obstacles.filter(o=>Math.abs(o.x)===9.5));record.oldObstacles=[...oldObstacles];
    for(const list of[room.obstacles,s.obstacles])for(let i=list.length-1;i>=0;i--)if(oldObstacles.has(list[i]))list.splice(i,1);
    for(const v of spec.hall.solids){const[x,y,z]=v.position,[w,h,d]=v.size,o={shape:'box',x,z:z+cz,r:Math.hypot(w,d)/2+.28,x0:x-w/2,x1:x+w/2,z0:cz+z-d/2,z1:cz+z+d/2,minY:y-h/2,maxY:y+h/2,padding:.28,escapeX:z<-7.8?0:Math.abs(x)>8?-Math.sign(x):0,escapeZ:z<-7.8?1:0,moonSanctum:true};record.colliders.push(o);room.obstacles.push(o);}
    const rects=room.dungeon.rects,newMeshes=[...newCasterMeshes,...meshes(arcade)];
    rects.cameraOccluders=(rects.cameraOccluders||[]).filter(m=>!oldMeshes.has(m));s.cameraOccluders.splice(0,s.cameraOccluders.length,...s.cameraOccluders.filter(m=>!oldMeshes.has(m)));
    for(const m of newMeshes){m.updateWorldMatrix(true,false);installStaticRaycastTree(m);rects.cameraOccluders.push(m);s.cameraOccluders.push(m);}
    record.cameraMeshes=newMeshes;record.loaded=true;
    rects.cameraSubjectZones=[...(rects.cameraSubjectZones||[]).filter(z=>z.id!==room.shrineSeg.id),{...room.shrineSeg,halfWidth:.22,pitchAssist:.42,smoothOcclusion:true}];
    record.reconcileActor=()=>{const a=record.actor;if(a?.rects!==rects)return;const p=a.position.clone();a._pushOut(a.position);if(a.position.distanceTo(p)>1e-6){a.syncMesh();a._camPlaced=false;record.safeShift=a.position.distanceTo(p);}};record.reconcileActor();return true;
  });room.ready=Promise.all([room.ready,record.ready]);return room;
}
