import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { installStaticRaycastTree } from '../render/StaticRaycastTree.js';

let pending;
function assets(){return pending??=fetch('assets/models/adventure/water-devices-v02.json').then(async response=>{if(!response.ok)throw Error('device metadata unavailable');const spec=await response.json(),gltf=await new GLTFLoader().loadAsync(spec.model);return{spec,source:gltf.scene};}).catch(error=>{pending=null;console.warn('[water-devices] original devices retained',error);return null;});}
const meshList=root=>{const result=[];root.traverse(o=>{if(o.isMesh)result.push(o);});return result;};

export function registerWaterDevices(room){
  const record=room.waterDevices={loaded:false,models:[],colliders:[],cameraMeshes:[],oldParts:[],surfaces:[],ready:null};
  room.world.devices=record;
  const resume=room.resume.bind(room);room.resume=actor=>{resume(actor);record.actor=actor;record.reconcile?.();};
  record.ready=Promise.all([assets(),room.ready]).then(([asset])=>{
    if(!asset)return false;
    const {spec,source}=asset,[carry,flow,cycle]=room.gates.map(v=>v.gate),required=['WaterBasin','BraceletStand','ReceiverFrame','LiftDeck','LiftGuides','LiftPlunger','LowerPedestal','CollectorSupports','CollectorHood','CollectorApron','RearReturnRamp','ConduitCollar'];
    if(required.some(name=>!source.getObjectByName(name)||!spec.parts?.[name])||spec.contract.wallHeight!==flow.wallHeight||spec.contract.liftBounds?.join()!=='3.3,0.22,3')throw Error('device spatial contract');
    const staging=new T.Group();staging.name='Water apparatus';
    function place(name,position,scale=[1,1,1],body=true){
      const root=new T.Group();root.name='Water device '+name;root.position.fromArray(position);root.scale.fromArray(scale);root.add(source.getObjectByName(name).clone(true));staging.add(root);record.models.push(root);
      for(const mesh of meshList(root)){mesh.material=mesh.material.clone();mesh.material.userData.outlineParameters={visible:false};mesh.material.envMapIntensity=.50;if(mesh.material.transparent)mesh.material.depthWrite=false;mesh.castShadow=!mesh.material.transparent;mesh.receiveShadow=true;mesh.userData.waterDevice=name;if(!mesh.material.transparent)record.cameraMeshes.push(mesh);}
      if(body)for(const box of spec.parts[name].solids){const[x,y,z]=box.position.map((n,i)=>n*scale[i]+position[i]),[w,h,d]=box.size.map((n,i)=>n*scale[i]);const collider={shape:'box',x,z,r:Math.hypot(w,d)/2+.28,x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,minY:y-h/2,maxY:y+h/2,padding:.28,waterDevice:name};record.colliders.push(collider);
        // Tops above the existing fail zone are real jump/landing surfaces. The
        // lower bowl remains below the current temple's non-playable fall plane.
        if(collider.maxY>=0&&!/Clear/.test(box.name))record.surfaces.push({x0:collider.x0,x1:collider.x1,z0:collider.z0,z1:collider.z1,height:collider.maxY,waterDevice:name});
      }
      return root;
    }
    const bowls=[];room.scene.traverse(o=>{if(o.userData.waterBasin)bowls.push(o);});if(bowls.length!==7)throw Error('original basin slots');
    for(const old of bowls){const{w,d,role}=old.userData.waterBasin;old.updateWorldMatrix(true,false);const position=old.getWorldPosition(new T.Vector3()).toArray();place(role==='receiver'?'ReceiverFrame':'WaterBasin',position,role==='receiver'?[1,1,1]:[Math.max(2,w)/2,1,Math.max(1.84,d)/2]);record.oldParts.push(old);}
    place('BraceletStand',carry.braceletPos.toArray());place('LiftGuides',flow.liftPos.toArray());
    record.deck=place('LiftDeck',flow.liftPos.toArray(),[1,1,1],false);record.plunger=place('LiftPlunger',flow.liftPos.toArray(),[1,1,1],false);
    place('LowerPedestal',[cycle.bowlPos.x,-5,cycle.bowlPos.z]);record.supports=place('CollectorSupports',[4,2.5,cycle.collector.z]);record.hood=place('CollectorHood',[4,4.8,cycle.collector.z],[1,1,1],false);
    record.apron=place('CollectorApron',[4.2,0,cycle.collector.z]);
    record.rearRamp=place('RearReturnRamp',[5.7,0,flow.wallZ-2.6],[1,1,1],false);
    record.oldParts.push(carry.braceletStand,flow.lift,...flow.liftGuides,...flow.receiverGlass,cycle.collectorHood,flow.rearReturnRamp,flow.rearReturnLanding);
    // Keep the original continuous transparent conduits and merge decorative
    // open collars per material; their bores never cap the moving parcel route.
    const collars=new Map();for(const [conduit,radius]of [[flow.aqueduct,.18],[cycle.drainPipe,.2],[cycle.steamPipe,.26],[cycle.condensation,.12]]){
      for(const t of [.12,.48,.84]){const root=source.getObjectByName('ConduitCollar').clone(true),p=conduit.curve.getPointAt(t),direction=conduit.curve.getTangentAt(t);const wrapper=new T.Group();wrapper.position.copy(p);wrapper.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction);wrapper.scale.set(radius/.18,1,radius/.18);wrapper.add(root);wrapper.updateMatrixWorld(true);
        for(const mesh of meshList(root)){const key=mesh.material.name;let item=collars.get(key);if(!item){const material=mesh.material.clone();material.userData.outlineParameters={visible:false};item={material,geometry:[]};collars.set(key,item);}item.geometry.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));}
      }
    }
    for(const [name,item]of collars){const geometry=mergeGeometries(item.geometry,false);if(!geometry)throw Error('conduit collar attributes');const mesh=new T.Mesh(geometry,item.material);mesh.name='Open conduit collars '+name;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.waterDevice='ConduitCollar';staging.add(mesh);record.models.push(mesh);record.cameraMeshes.push(mesh);}
    for(const mesh of record.cameraMeshes)installStaticRaycastTree(mesh);
    const plungerBody={x:0,z:flow.liftPos.z,r:.29,minY:0,maxY:0,waterDevice:'LiftPlunger'};record.colliders.push(plungerBody);
    record.sync=()=>{record.deck.position.y=flow.liftHeight-.22;const height=Math.max(0,flow.liftHeight-.22);record.plunger.scale.y=Math.max(.001,height);record.plunger.visible=height>.001;plungerBody.maxY=height;};record.sync();
    const paint=flow.paint.bind(flow);flow.paint=()=>{paint();record.sync();};
    room.scene.add(staging);for(const old of record.oldParts)old.visible=false;room.obstacles.push(...record.colliders);room.dungeon.occluders.push(...record.cameraMeshes);
    room.dungeon.surfaces.push(...record.surfaces);
    const ceiling=room.dungeon.rects.ceilingAt,hoodMeshes=[...meshList(record.hood),...meshList(record.supports)],ray=new T.Raycaster();room.dungeon.rects.ceilingAt=(x,z,y=0)=>{let h=ceiling?.(x,z,y)??Infinity;record.hood.updateWorldMatrix(true,true);record.supports.updateWorldMatrix(true,true);ray.set(new T.Vector3(x,y+.05,z),new T.Vector3(0,1,0));const hit=ray.intersectObjects(hoodMeshes,false)[0];if(hit)h=Math.min(h,hit.point.y);return h;};
    record.reconcile=()=>{const actor=record.actor;if(actor?.rects!==room.dungeon.rects)return;const before=actor.position.clone();actor._pushOut(actor.position);if(actor.position.distanceTo(before)>1e-6){actor.syncMesh();actor._camPlaced=false;record.safeShift=actor.position.distanceTo(before);}};
    record.spec=spec;record.loaded=true;flow.paint();record.reconcile();return true;
  }).catch(error=>{record.reason=error.message;console.warn('[water-devices] original devices retained',error);return false;});
  room.ready=Promise.all([room.ready,record.ready]);return room;
}
