import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SKY,HORIZON} from '../data/lighting.js';

export const horizonAssets={loaded:false,contract:null,meshes:[]};
let loading;
export function loadHorizonAssets(){
  return loading??=(async()=>{
    try{
      const [response,gltf]=await Promise.all([fetch('assets/models/adventure/world-horizon-v03.json'),new GLTFLoader().loadAsync('assets/models/adventure/world-horizon-v03.glb')]);
      if(!response.ok)throw Error('HTTP '+response.status);const contract=await response.json();
      if(contract.version!==1||contract.planetRadius!==68||contract.localBottom!==0||contract.walkable!==false||contract.meshes?.length!==3||contract.fadeHeight?.length!==2||!contract.fadeHeight.every(Number.isFinite)||contract.fadeHeight[1]<=contract.fadeHeight[0]||!Number.isFinite(contract.anchorBelowGround)||!Number.isFinite(contract.runtimeScale)||contract.runtimeScale<=0||contract.runtimeScale>1)throw Error('Invalid distant landscape contract');
      gltf.scene.updateMatrixWorld(true);const meshes=[];
      for(const row of contract.meshes){
        const source=gltf.scene.getObjectByName(row.name);if(!source?.isMesh||!source.geometry.attributes.normal||!source.geometry.attributes.color||!Number.isFinite(row.haze)||row.haze<0||row.haze>1)throw Error('Missing authored distant cliff '+row.name);
        const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);geometry.computeBoundingBox();geometry.computeBoundingSphere();
        const triangles=(geometry.index?.count||geometry.attributes.position.count)/3;
        if(Math.abs(geometry.boundingBox.min.y)>1e-5||Math.abs(geometry.boundingBox.max.y-row.maximumY)>1e-4||triangles!==row.triangles)throw Error('Distant cliff dimensions differ from source');
        meshes.push({geometry,name:row.name,haze:row.haze});
      }
      Object.assign(horizonAssets,{loaded:true,contract,meshes});
    }catch(error){console.warn('[horizon] Original distant ridges retained:',error.message);}
  })();
}
const VERT=`
varying vec3 vHorizonLocal,vHorizonNormal,vHorizonTone;
void main(){
  vHorizonLocal=position;vHorizonNormal=normalize(mat3(modelMatrix)*normal);vHorizonTone=color.rgb;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;
const FRAG=`
uniform vec3 uAir,uCliff,uSun,uUp;
uniform vec2 uFade;
uniform float uHaze,uShade;
varying vec3 vHorizonLocal,vHorizonNormal,vHorizonTone;
void main(){
  float altitude=smoothstep(uFade.x,uFade.y,vHorizonLocal.y);
  float light=max(0.,dot(normalize(vHorizonNormal),uSun));
  float top=max(0.,dot(normalize(vHorizonNormal),uUp));
  vec3 cliff=uCliff*(.60+.24*top+light*uShade*1.65)*vHorizonTone;
  float haze=clamp(uHaze+(1.-smoothstep(5.,42.,vHorizonLocal.y))*.22,0.,.98);
  gl_FragColor=vec4(mix(cliff,uAir,haze),altitude);
}`;
export function buildHorizonBackdrop(){
  if(!horizonAssets.loaded)return null;
  const group=new THREE.Group();group.name='authored-world-horizon';group.userData.decorativeBackdrop=true;group.scale.setScalar(horizonAssets.contract.runtimeScale);
  const meshes=horizonAssets.meshes.map((part,i)=>{
    const material=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,vertexColors:true,transparent:true,depthWrite:false,depthTest:true,side:THREE.FrontSide,uniforms:{uAir:{value:new THREE.Color(SKY.horizon)},uCliff:{value:new THREE.Color(HORIZON.layers[i])},uSun:{value:new THREE.Vector3(0,1,0)},uUp:{value:new THREE.Vector3(0,1,0)},uFade:{value:new THREE.Vector2(...horizonAssets.contract.fadeHeight)},uHaze:{value:part.haze},uShade:{value:HORIZON.shade}}});
    material.userData.outlineParameters={visible:false};
    const mesh=new THREE.Mesh(part.geometry,material);mesh.name=part.name;mesh.renderOrder=-96+i;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.cameraOccluder=false;mesh.userData.decorativeBackdrop=true;group.add(mesh);return mesh;
  });
  const sun=new THREE.Vector3();
  return{group,meshes,contract:horizonAssets.contract,update(up,ground,quaternion,light){group.position.copy(ground).addScaledVector(up,-horizonAssets.contract.anchorBelowGround);group.quaternion.copy(quaternion);sun.copy(light.position).sub(light.target.position).normalize();for(const mesh of meshes){mesh.material.uniforms.uSun.value.copy(sun);mesh.material.uniforms.uUp.value.copy(up);}}};
}
