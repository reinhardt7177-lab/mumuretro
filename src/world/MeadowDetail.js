import * as THREE from 'three';
import { quality } from '../render/Quality.js';
import {MEADOW} from '../data/lighting.js';
import {MEADOW_LAYERS,plantPatchAt} from './MeadowLayers.js';
import {loadMeadowFieldAssets,meadowAssets} from './MeadowField.js';

let profiles = null;
export async function loadMeadowProfiles() {
  await loadMeadowFieldAssets();if(meadowAssets.modelLoaded)return;
  try { profiles = (await (await fetch('assets/models/heritage/leaf-profiles.json')).json()).profiles; }
  catch (error) { console.warn('[meadow] detailed leaves unavailable:', error.message); }
}
export function buildMeadowDetail(scene, planet, carpet, opts) {
  const group = new THREE.Group(); group.name='heritage-meadow';scene.add(group);
  const clock={value:0},playerUniform={value:new THREE.Vector3()},anchor=new THREE.Vector3(Infinity,Infinity,Infinity),meshes=[],placements=[];
  // Five curved authored leaves per tuft. Roots are fixed in a global grid;
  // changing the player anchor never re-rolls the grass beneath their feet.
  function tuftGeometry(profile){
    const positions=[],normals=[],weights=[],indices=[],colours=[];
    for(let leaf=0;leaf<5;leaf++){
      const angle=leaf*2.39996,c=Math.cos(angle),s=Math.sin(angle),scale=.72+leaf*.075,base=positions.length/3;
      for(let i=0;i<profile.positions.length;i+=3){const x=profile.positions[i]*1.2,y=profile.positions[i+1]*.6*scale,z=profile.positions[i+2]*.36;positions.push(x*c+z*s+c*.025,y,-x*s+z*c+s*.025);const nx=profile.normals[i],ny=profile.normals[i+1],nz=profile.normals[i+2],weight=profile.weights[i/3];normals.push(nx*c+nz*s,ny,-nx*s+nz*c);weights.push(weight);colours.push(.65+weight*.35,.70+weight*.36,.60+weight*.24);}
      indices.push(...profile.indices.map(i=>i+base));
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('bendWeight',new THREE.Float32BufferAttribute(weights,1));g.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  let enabled=true;
  try{enabled=localStorage.getItem('mumuplanet.meadow.enabled.v1')!=='false';}catch{}
  const authored=meadowAssets.modelLoaded,geometryList=authored?meadowAssets.clusters:(profiles||[]).map(tuftGeometry);
  for(const [variantIndex,geo] of geometryList.entries()){
    const mat=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.9,side:THREE.DoubleSide});mat.userData.outlineParameters={visible:false};
    const height=geo.userData.nativeHeight||.42;mat.userData.meadowWindAmplitude=authored?Math.min(.075,.18*height):.16;mat.userData.meadowBodyBend=authored?Math.min(.14,.4*height):.4;
    mat.onBeforeCompile=shader=>{
      if(authored){shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=normalize(objectNormal*.45+vec3(0.,.9,0.));');shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;','/* two-sided meadow retains its upward sky response */'));}
      if(authored)shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\nvColor.xyz=mix(vColor.xyz,color.xyz,plantAccent);');
      shader.uniforms.meadowWind={value:mat.userData.meadowWindAmplitude};shader.uniforms.meadowBodyBend={value:mat.userData.meadowBodyBend};
      shader.uniforms.meadowTime=clock;
      shader.uniforms.meadowPlayer=playerUniform;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float meadowTime; uniform vec3 meadowPlayer; uniform float meadowWind; uniform float meadowBodyBend; attribute float bendWeight; attribute float plantAccent;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vec3 base=instanceMatrix[3].xyz;
        float phase=base.x*.4+base.z*.3;
        float gust=sin(meadowTime*1.25+phase)+.35*sin(meadowTime*.57+phase*.31);
        vec3 worldWind=normalize(vec3(.85,.1,.4));
        vec3 localWind=vec3(dot(instanceMatrix[0].xyz,worldWind),0.,dot(instanceMatrix[2].xyz,worldWind));
        vec3 away=base-meadowPlayer;
        float distanceToPlayer=length(away);
        vec3 localAway=vec3(dot(instanceMatrix[0].xyz,away),0.,dot(instanceMatrix[2].xyz,away));
        float bend=pow(bendWeight,2.);
        transformed+=localWind*(gust*meadowWind*bend);
        transformed+=localAway/max(.1,length(localAway))*(1.-smoothstep(.15,1.1,distanceToPlayer))*meadowBodyBend*bend;
        transformed.y*=1.-smoothstep(13.,17.,distanceToPlayer);`);
    };
    const mesh=new THREE.InstancedMesh(geo,mat,authored?MEADOW_LAYERS.capacities[variantIndex]:600);mesh.count=0;mesh.receiveShadow=true;mesh.castShadow=authored;mesh.frustumCulled=false;
    if(authored){
      // Depth vertices use the exact same wind and traveller bend as visible leaves.
      const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
      depth.onBeforeCompile=mat.onBeforeCompile;mesh.customDepthMaterial=depth;
    }
    group.add(mesh);meshes.push(mesh);
  }
  function visible(){group.visible=enabled&&(quality.name==='high'||quality.name==='mid');anchor.set(Infinity,Infinity,Infinity);}
  quality.onChange(visible);visible();
  const dummy=new THREE.Object3D(), color=new THREE.Color();
  const cells=new Map(),cacheStats={hits:0,misses:0,cells:0};let terrainGeometry=planet.mesh.geometry;
  const hash=(r,c,i)=>{let h=Math.imul(r+8192,73856093)^Math.imul(c+4096,19349663)^Math.imul(i+713,83492791);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;};
  function cachedCell(r,c,columns,step){const key=r+':'+c;let values=cells.get(key);if(values){cells.delete(key);cells.set(key,values);cacheStats.hits++;return values;}cacheStats.misses++;values=[];for(let i=0;i<MEADOW_LAYERS.samplesPerCell;i++){const la=-Math.PI/2+(r+hash(r,c,i*7))*step,lo=-Math.PI+(c+hash(r,c,i*7+1))/columns*Math.PI*2;values.push({dir:new THREE.Vector3(Math.cos(la)*Math.cos(lo),Math.sin(la),Math.cos(la)*Math.sin(lo)),r,c,i,key:r+':'+c+':'+i,tested:false});}cells.set(key,values);while(cells.size>256)cells.delete(cells.keys().next().value);cacheStats.cells=cells.size;return values;}

  function update(time,position){
    clock.value=time;playerUniform.value.copy(position);if(!group.visible||!meshes.length||position.distanceToSquared(anchor)<6.25)return;
    anchor.copy(position);const up=position.clone().normalize(),step=3.5/planet.R,latitude=Math.asin(up.y),longitude=Math.atan2(up.z,up.x),row=Math.floor((latitude+Math.PI/2)/step),candidates=[];
    if(terrainGeometry!==planet.mesh.geometry){cells.clear();terrainGeometry=planet.mesh.geometry;}
    for(let r=Math.max(0,row-5);r<=Math.min(Math.floor(Math.PI/step)-1,row+5);r++){
      const lat=-Math.PI/2+(r+.5)*step,columns=Math.max(1,Math.round(Math.PI*2*Math.cos(lat)/step)),column=Math.floor((longitude+Math.PI)/(Math.PI*2)*columns),span=Math.min(columns,Math.ceil(18/(3.5*Math.max(.12,Math.cos(lat)))));
      const columnIds=new Set();for(let cc=column-span;cc<=column+span;cc++)columnIds.add((cc%columns+columns)%columns);
      for(const c of columnIds){
        if(authored){for(const sample of cachedCell(r,c,columns,step)){const distance=sample.dir.angleTo(up)*planet.R;if(distance>17)continue;if(!sample.tested){sample.tested=true;sample.rim=!!opts.landingDir&&sample.dir.angleTo(opts.landingDir)*planet.R>MEADOW_LAYERS.nearPadInner&&sample.dir.angleTo(opts.landingDir)*planet.R<MEADOW_LAYERS.nearPadOuter;sample.valid=(!opts.exclude(sample.dir)||(sample.rim&&(opts.pathAt?.(sample.dir)||0)<.25))&&opts.grassAt(sample.dir)>=.45&&plantPatchAt(sample.dir,planet.R)>=MEADOW_LAYERS.patchThreshold;if(sample.valid){const p=(planet.groundSurfaceAt?planet.groundSurfaceAt(sample.dir):planet.surfaceAt(sample.dir)).addScaledVector(sample.dir,carpet.liftAt(sample.dir)-.015),frame=planet.frameAt(p,hash(r,c,sample.i*7+2)*360);sample.matrix=new THREE.Matrix4().compose(p,frame.quaternion,new THREE.Vector3(.68+.64*hash(r,c,sample.i*7+4),1,.68+.64*hash(r,c,sample.i*7+5)).multiplyScalar(.65+hash(r,c,sample.i*7+3)*.65));sample.position=p;}}if(sample.valid)candidates.push({...sample,distance});}}else{
        for(let i=0;i<30;i++){
          const la=-Math.PI/2+(r+hash(r,c,i*7))*step,lo=-Math.PI+(c+hash(r,c,i*7+1))/columns*Math.PI*2,dir=new THREE.Vector3(Math.cos(la)*Math.cos(lo),Math.sin(la),Math.cos(la)*Math.sin(lo));
          const distance=dir.angleTo(up)*planet.R;if(distance>17||opts.exclude(dir)||opts.grassAt(dir)<.45)continue;
          candidates.push({dir,distance,r,c,i,key:r+':'+c+':'+i});
        }
        }
      }
    }
    candidates.sort((a,b)=>a.distance-b.distance);meshes.forEach(m=>m.count=0);placements.length=0;
    const capacity=authored?Infinity:(quality.name==='high'?600:300);
    for(const sample of candidates){
      const {dir,r,c,i,key}=sample;
      const rnd=k=>hash(r,c,i*7+k),choice=rnd(6);
      const variant=!authored?(r+c+i)%meshes.length:sample.rim?0:choice<MEADOW_LAYERS.creamWeight?2:choice<MEADOW_LAYERS.creamWeight+MEADOW_LAYERS.goldWeight?3:choice<.48?0:1;
      const mesh=meshes[variant];if(mesh.count>=Math.min(capacity,mesh.instanceMatrix.count))continue;
      const p=sample.position||planet.surfaceAt(dir).addScaledVector(dir,carpet.liftAt(dir)-.015),fr=sample.matrix?null:planet.frameAt(p,rnd(2)*360);
      if(sample.matrix)dummy.matrix.copy(sample.matrix);else{dummy.position.copy(p);dummy.quaternion.copy(fr.quaternion);dummy.scale.setScalar(.65+rnd(3)*.65);dummy.updateMatrix();}mesh.setMatrixAt(mesh.count,dummy.matrix);
      if(authored)color.set(MEADOW[Math.floor(rnd(4)*MEADOW.length)]).multiplyScalar(.96+rnd(5)*.18);else color.setHSL(.21+rnd(4)*.045,.32,.32+rnd(5)*.16);mesh.setColorAt(mesh.count++,color);
      placements.push({key,position:p.clone(),matrix:dummy.matrix.clone(),mesh,index:mesh.count-1});
    }
    meshes.forEach(m=>{m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;});
  }
  function setEnabled(value){enabled=!!value;visible();anchor.set(Infinity,Infinity,Infinity);try{localStorage.setItem('mumuplanet.meadow.enabled.v1',String(enabled));}catch{}syncButton();}
  let button=null;
  function syncButton(){if(button){button.textContent=enabled?'풀 켜짐 · G':'풀 꺼짐 · G';button.setAttribute('aria-pressed',String(enabled));}}
  function attachSetting(){
    const card=document.querySelector('#gfxWrap .card');if(!card)return;
    const row=document.createElement('div');row.className='meadow-setting';row.style.cssText='margin-top:14px;padding-top:12px;border-top:1px dashed #d5d8ce';
    row.innerHTML='<strong>바람에 흔들리는 풀</strong><p style="margin:6px 0">느린 기기에서는 끌 수 있다.</p>';
    button=document.createElement('button');button.type='button';button.style.cssText='padding:10px 14px;border-radius:8px;border:1px solid #bdc8b9;font:inherit;background:#e4ecdf;color:#274534';button.addEventListener('click',()=>setEnabled(!enabled));row.append(button);card.append(row);syncButton();
  }
  addEventListener('keydown',e=>{if(e.code==='KeyG'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target?.closest?.('input,textarea,select,[contenteditable]')){e.preventDefault();setEnabled(!enabled);}});
  return {group,update,attachSetting,setEnabled,placements,clock,playerUniform,cacheStats,layerContract:MEADOW_LAYERS,get assetSource(){return authored?'arrival-groundcover-v02':'legacy-leaf-profiles';},get enabled(){return enabled;},get count(){return meshes.reduce((n,m)=>n+m.count,0);}};
}
