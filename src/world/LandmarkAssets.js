import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader=new GLTFLoader(),models=new Map(),geometries=new Map();
export const landmarkSpec={version:3,loaded:false,observatory:{height:4.1,plinth:{radius:.60},mastOffsetFromOverlook:2.4,gliderReachPreserved:2.1},overlookSite:{levelRadius:3.4,blendRadius:8,equipmentSideOffset:1.25}};
export async function loadLandmarkAssets(){
  const config=fetch('assets/models/adventure/landmark-spec-v03.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(data=>{
    const finite=(...values)=>values.every(Number.isFinite);
    if(data.version!==3||!finite(data.overlookSite?.levelRadius,data.overlookSite?.blendRadius,data.overlookSite?.equipmentSideOffset,data.observatory?.plinth?.radius,data.observatory?.mastOffsetFromOverlook,data.observatory?.gliderReachPreserved,data.trees?.height,data.trees?.branchStartHeight,data.trees?.wind?.speed,data.trees?.wind?.phaseX,data.trees?.wind?.phaseZ)||data.overlookSite.levelRadius<=0||data.overlookSite.blendRadius<=data.overlookSite.levelRadius||data.trees.height<=data.trees.branchStartHeight)throw Error('Invalid landmark contract');
    Object.assign(landmarkSpec,data,{loaded:true});
  }).catch(error=>console.warn('[landmark] Using default contract:',error.message));
  await Promise.all([config,...['observatory','woodland','arrival'].map(async id=>{
    try{const source=(await loader.loadAsync((id==='arrival'?'assets/models/adventure/arrival-dais-surface-v01-a0.glb':`assets/models/adventure/${id}-v03.glb`))).scene;source.updateMatrixWorld(true);source.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])m.userData.outlineParameters={visible:false};}});models.set(id,source);}
    catch(error){console.warn(`[landmark] ${id} unavailable:`,error.message);}
  })]);
}
export function observatoryPart(){return models.get('observatory')?.clone(true)||null;}
export function woodlandPart(kind){
  const source=models.get('woodland')?.getObjectByName(kind);if(!source?.isMesh)return null;
  if(!geometries.has(kind)){
    const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);geometry.computeBoundingBox();geometry.computeBoundingSphere();
    geometries.set(kind,{geometry,material:source.material});
  }
  return geometries.get(kind);
}

// A true surface tangent for grounded architecture; radius coordinates and save
// positions remain unchanged. The model's authored bottom stays local Y=0.
export function landmarkFrame(planet,direction,liftAt){
  const up=direction.clone().normalize(),east=new THREE.Vector3(0,1,0).cross(up).normalize();
  if(east.lengthSq()<.1)east.set(1,0,0).cross(up).normalize();
  const north=up.clone().cross(east).normalize();
  const point=d=>planet.surfaceAt(d).addScaledVector(d,liftAt(d));
  const position=point(up),a=point(up.clone().addScaledVector(east,.25/planet.R).normalize()).sub(position),b=point(up.clone().addScaledVector(north,.25/planet.R).normalize()).sub(position),normal=a.cross(b).normalize();
  if(normal.dot(up)<0)normal.negate();
  const x=east.addScaledVector(normal,-east.dot(normal)).normalize(),z=x.clone().cross(normal).normalize();
  return{position,normal,quaternion:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,normal,z))};
}

// The asset stays editable with local floor0. Bake each source world transform,
// then seat the whole foundation/stone/glass on the exact native height field.
export function arrivalPart(planet,frame){
  const source=models.get('arrival');if(!source)return null;
  source.updateMatrixWorld(true);
  const group=new THREE.Group();group.name='Mumu authored arrival dais';
  const transform=new THREE.Matrix4().compose(frame.position,frame.quaternion,new THREE.Vector3(1,1,1)),inverse=transform.clone().invert();
  const direction=new THREE.Vector3(),point=new THREE.Vector3();
  source.traverse(o=>{if(!o.isMesh)return;
    const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld),positions=geometry.attributes.position;
    // The artist-painted stone tones are exported in the second colour slot.
    if(o.name==='Arrival_Weathered'&&geometry.getAttribute('color_1'))geometry.setAttribute('color',geometry.getAttribute('color_1'));
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
      direction.set(x,0,z).applyMatrix4(transform).normalize();
      planet.surfaceAt(direction,point).addScaledVector(direction,y-.22+.006).applyMatrix4(inverse);
      positions.setXYZ(i,point.x,point.y,point.z);
    }
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const material=o.material.clone();if(o.name==='Arrival_Aged')material.metalness=Math.min(material.metalness,.30);
    if(material.userData.mumuSurfaceVersion===1){const intensity=material.userData.mumuExpectedEnvMapIntensity;if(Number.isFinite(intensity)&&intensity>=0&&intensity<=2)material.envMapIntensity=intensity;}material.userData.outlineParameters={visible:false};
    const mesh=new THREE.Mesh(geometry,material);mesh.name=o.name;mesh.castShadow=mesh.receiveShadow=true;
    group.add(mesh);
  });
  group.userData={asset:'arrival-dais-surface-v01-a0',sourceFloor:0,sourceWalkHeight:.22,conformed:true,surfaceOffset:.006,meshes:group.children.length};
  return group;
}

export function arrivalReady(){return models.has('arrival');}
