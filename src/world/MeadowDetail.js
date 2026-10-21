import * as THREE from 'three';
import { quality } from '../render/Quality.js';

let profiles = null;
export async function loadMeadowProfiles() {
  try { profiles = (await (await fetch('assets/models/heritage/leaf-profiles.json')).json()).profiles; }
  catch (error) { console.warn('[meadow] detailed leaves unavailable:', error.message); }
}
export function buildMeadowDetail(scene, planet, carpet, opts) {
  const group = new THREE.Group(); group.name='heritage-meadow';scene.add(group);
  const clock={value:0}, anchor=new THREE.Vector3(Infinity,Infinity,Infinity), meshes=[];
  let enabled=true;
  try{enabled=localStorage.getItem('mumuplanet.meadow.enabled.v1')!=='false';}catch{}
  for(const profile of profiles||[]){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(profile.positions,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(profile.normals,3));geo.setAttribute('bendWeight',new THREE.Float32BufferAttribute(profile.weights,1));geo.setIndex(profile.indices);
    geo.scale(2.7,.6,1);
    const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9,side:THREE.DoubleSide});mat.userData.outlineParameters={visible:false};
    mat.onBeforeCompile=shader=>{
      shader.uniforms.meadowTime=clock;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float meadowTime; attribute float bendWeight;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        float phase=instanceMatrix[3].x*.4+instanceMatrix[3].z*.3;
        float bend=sin(meadowTime*1.25+phase)*bendWeight*bendWeight;
        transformed.x+=bend*.12;transformed.z+=bend*.07;`);
    };
    const mesh=new THREE.InstancedMesh(geo,mat,450);mesh.count=0;mesh.receiveShadow=true;mesh.castShadow=false;mesh.frustumCulled=false;
    group.add(mesh);meshes.push(mesh);
  }
  function visible(){group.visible=enabled&&(quality.name==='high'||quality.name==='mid');}
  quality.onChange(visible);visible();
  const dummy=new THREE.Object3D(), color=new THREE.Color();
  function update(time,position){
    clock.value=time;if(!group.visible||!meshes.length||position.distanceToSquared(anchor)<36)return;
    anchor.copy(position);const up=position.clone().normalize(), east=new THREE.Vector3(0,1,0).cross(up).normalize();
    if(east.lengthSq()<.1)east.set(1,0,0).cross(up).normalize();
    const north=up.clone().cross(east).normalize();let seed=71326;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
    meshes.forEach(m=>m.count=0);
    for(let i=0;i<1800;i++){
      const angle=rnd()*Math.PI*2,radius=2+Math.sqrt(rnd())*14;
      const dir=up.clone().addScaledVector(east,Math.cos(angle)*radius/planet.R).addScaledVector(north,Math.sin(angle)*radius/planet.R).normalize();
      if(opts.exclude(dir)||opts.grassAt(dir)<.45)continue;
      const mesh=meshes[i%meshes.length];if(mesh.count>=450)continue;
      const p=planet.surfaceAt(dir).addScaledVector(dir,carpet.liftAt(dir)-.015),fr=planet.frameAt(p,rnd()*Math.PI*2);
      dummy.position.copy(fr.position);dummy.quaternion.copy(fr.quaternion);dummy.scale.setScalar(.65+rnd()*.65);dummy.updateMatrix();mesh.setMatrixAt(mesh.count,dummy.matrix);
      color.setHSL(.21+rnd()*.06,.34,.30+rnd()*.18);mesh.setColorAt(mesh.count++,color);
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
  return {group,update,attachSetting,setEnabled,get enabled(){return enabled;},get count(){return meshes.reduce((n,m)=>n+m.count,0);}};
}
