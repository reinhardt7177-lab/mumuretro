import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { installStaticRaycastTree } from '../render/StaticRaycastTree.js';

let pending;
const meshes=root=>{const found=[];root.traverse(o=>{if(o.isMesh)found.push(o);});return found;};
function assets(){return pending??=fetch('assets/models/adventure/balance-onboarding-v01.json').then(async r=>{if(!r.ok)return null;const spec=await r.json(),gltf=await new GLTFLoader().loadAsync(spec.model);return{spec,source:gltf.scene};}).catch(e=>{console.warn('[balance-onboarding] original plaques retained',e);return null;});}

export function registerBalanceOnboarding(room){
  if(room.spec.id!=='balance')return room;
  const record=room.balanceOnboarding={loaded:false,models:[],colliders:[]};
  record.ready=Promise.all([assets(),room.ready]).then(([asset])=>{
    if(!asset){record.reason='optional asset unavailable';return false;}
    const{spec,source}=asset,names=['ChoicePedestal','ChoiceLabel','ChoiceIndicator','StatusStand','StatusLabel'];
    record.missing=names.filter(n=>!source.getObjectByName(n));if(record.missing.length)return false;
    source.updateMatrixWorld(true);record.floors=spec.parts.map(n=>({name:n,y:new T.Box3().setFromObject(source.getObjectByName(n),true).min.y}));
    if(record.floors.some(v=>Math.abs(v.y)>.001)){record.reason='floor datum mismatch';return false;}
    const g=room.gates[0].gate,old=g.choices.map(c=>c.group);
    function add(name,pos){const root=source.getObjectByName(name).clone(true);root.position.fromArray(pos);g.root.add(root);record.models.push(root);for(const m of meshes(root)){m.castShadow=m.receiveShadow=true;m.material.userData.outlineParameters={visible:false};}return root;}
    function mount(label,root,name,width){const anchor=root.getObjectByName(name);anchor.add(label);label.position.set(0,0,0);label.rotation.set(0,0,0);label.scale.setScalar(width/label.geometry.parameters.width);}
    const indicators=[];
    for(const c of g.choices){const root=add('ChoicePedestal',[c.x,0,c.z]);mount(c.label,root,'ChoiceLabel',spec.choice.labelWidth);const light=root.getObjectByName('ChoiceIndicator');light.material=light.material.clone();indicators.push({c,light});c.group.visible=false;}
    const status=add('StatusStand',spec.status.position);mount(g.statusLabel,status,'StatusLabel',spec.status.labelWidth);
    // Bounds include front frames/rivets instead of using only the base dimensions.
    for(const root of record.models){root.updateWorldMatrix(true,true);const b=new T.Box3().setFromObject(root,true),size=b.getSize(new T.Vector3()),centre=b.getCenter(new T.Vector3());
      const o={shape:'box',x:centre.x,z:centre.z,r:Math.hypot(size.x,size.z)/2+spec.bodyPadding,x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z,minY:b.min.y,maxY:b.max.y,padding:spec.bodyPadding,balanceOnboarding:true};record.colliders.push(o);room.obstacles.push(o);}
    const update=g.update.bind(g);g.update=(dt,a)=>{const result=update(dt,a);for(const{c,light}of indicators){const selected=c.n===g.count;light.material.color.copy(c.mat.color);light.material.emissive.set(selected?0xb79542:0x164b4b);light.material.emissiveIntensity=selected?.4:.12;}return result;};
    const excluded=new Set(old.flatMap(meshes)),list=room.dungeon.rects.cameraOccluders;
    for(let i=list.length-1;i>=0;i--)if(excluded.has(list[i]))list.splice(i,1);
    record.cameraMeshes=record.models.flatMap(meshes);
    for(const m of record.cameraMeshes){m.updateWorldMatrix(true,false);installStaticRaycastTree(m);if(!list.includes(m))list.push(m);}
    record.spec=spec;record.loaded=true;g.update(0);room.balanceArt.reconcileActor?.();return true;
  });
  room.ready=Promise.all([room.ready,record.ready]);return room;
}
