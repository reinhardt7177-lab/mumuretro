import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let pending,lastRoom;
const one=new T.Vector3(1,1,1),down=new T.Quaternion().setFromEuler(new T.Euler(Math.PI/2,Math.PI/2,0,'YXZ'));
function assets(){return pending??=fetch('assets/models/adventure/separation-tools-v01.json').then(async r=>{
  if(!r.ok)return null;const spec=await r.json(),gltf=await new GLTFLoader().loadAsync(spec.model);gltf.scene.updateMatrixWorld(true);return{spec,source:gltf.scene};
}).catch(e=>{console.warn('[separation-art] retained existing tools',e);return null;});}
function badge(number){
  const c=document.createElement('canvas');c.width=128;c.height=96;const x=c.getContext('2d');
  x.fillStyle='#f1e5c6';x.fillRect(8,8,112,80);x.strokeStyle='#735127';x.lineWidth=7;x.strokeRect(8,8,112,80);
  x.fillStyle='#28241c';x.font='bold 66px system-ui,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(String(number),64,50);
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const sprite=new T.Sprite(new T.SpriteMaterial({map,depthWrite:false}));
  sprite.position.y=.44;sprite.scale.set(.32,.24,1);sprite.name='시료 번호 '+number;return sprite;
}
export function registerSeparationArt(room){
  if(room.spec.id!=='sift')return room;
  const sort=room.gates[1].gate,evap=room.gates[2].gate,record=room.separationArt={loaded:false,models:[],ready:null};
  const badges=sort.items.map((it,i)=>{const s=badge(i+1);it.mesh.add(s);return s;});
  const testBadge=badges[0].clone();sort.testMesh.add(testBadge);let testIndex=-1;
  const sync=sort.workshop.sync.bind(sort.workshop);sort.workshop.sync=(...args)=>{sync(...args);const i=sort.items.indexOf(sort.testItem);if(i>=0&&i!==testIndex){testIndex=i;testBadge.material=badges[i].material;testBadge.name='시료 번호 '+(i+1);}};
  record.badges=badges;record.testBadge=testBadge;
  record.ready=assets().then(asset=>{
    if(!asset)return false;const {source,spec}=asset,parts={};for(const name of ['WorkTable','FilterFunnel','InspectionMagnet']){parts[name]=source.getObjectByName(name);if(!parts[name])return false;}
    const rects=room.dungeon.rects;
    function add(name,parent,position,solid=true){const o=parts[name].clone(true);o.name='Separation art '+name;o.userData.separationArt=name;if(position)o.position.copy(position);parent.add(o);
      o.traverse(m=>{if(m.isMesh){m.castShadow=m.receiveShadow=false;m.material.userData.outlineParameters={visible:false};if(solid)(rects.cameraOccluders??=[]).push(m);}});record.models.push(o);return o;}
    record.oldMagnet=sort.magnet;sort.magnet.visible=false;sort.magnet=add('InspectionMagnet',sort.group,null,false);sort.magnet.visible=false;
    record.tool=sort.magnet;
    for(const name of ['magnet','filter','burner'])add('WorkTable',evap.group,new T.Vector3(evap[name].x,0,evap[name].z));
    for(const m of evap.workshop.tableParts)m.visible=false;
    record.funnel=add('FilterFunnel',evap.group,new T.Vector3(evap.filter.x,0,evap.filter.z));evap.workshop.funnel.visible=false;
    rects.cameraSubjectZones=room.gates.map(g=>({...g.gate.seg,halfWidth:.22}));
    record.loaded=true;record.spec=spec;return true;
  });room.ready=Promise.all([room.ready,record.ready]);return room;
}
// The model is in world metres. Applying the palm frame avoids inheriting the
// centimetre-scaled skeleton or stretching the magnet with animation bones.
export function syncSeparationHands(actor,room,paused=false){
  const u=actor.body.userData,n=u.navigator;
  if(lastRoom&&lastRoom!==room){lastRoom.gates[1].gate.magnet.visible=false;lastRoom.gates[2].gate.workshop.process.cancel();}
  lastRoom=room?.spec.id==='sift'?room:null;u.inspectMagnet=false;
  if(!lastRoom)return;
  const g=room.gates[1].gate,p=actor.position,s=g.seg,tool=g.magnet;
  const active=!g.solved&&p.x>=s.x0&&p.x<=s.x1&&p.z>=s.z0&&p.z<=s.z1;
  tool.visible=active;if(!active)return;
  if(!room.separationArt?.loaded||!n?.inspectionSlot)return;
  const inHand=!paused&&!u.carrying&&actor.grounded!==false&&n.poseLayer?.grips.Left;
  u.inspectMagnet=!!inHand;actor.body.updateWorldMatrix(true,true);
  const position=inHand?n.gripWorld('Left'):n.inspectionSlot.getWorldPosition(new T.Vector3());
  const quaternion=inHand?n.bones.LeftHand.getWorldQuaternion(new T.Quaternion()).multiply(n.poseLayer.grips.Left.quaternion):n.inspectionSlot.getWorldQuaternion(new T.Quaternion()).multiply(down);
  const matrix=new T.Matrix4().compose(position,quaternion,one);tool.parent.updateWorldMatrix(true,false);matrix.premultiply(new T.Matrix4().copy(tool.parent.matrixWorld).invert());
  matrix.decompose(tool.position,tool.quaternion,tool.scale);tool.updateWorldMatrix(false,true);recordPose(room,inHand,position);
}
function recordPose(room,inHand,position){room.separationArt.toolPose={inHand,position:position.toArray()};}
