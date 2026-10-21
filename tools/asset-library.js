import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const select=document.querySelector('#models'),stage=document.querySelector('#stage'),status=document.querySelector('#status');
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#view'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x203137);
const camera=new THREE.PerspectiveCamera(38,1,.01,1000),target=new THREE.Vector3();scene.add(new THREE.HemisphereLight(0xf5efdf,0x54696a,2));
const sun=new THREE.DirectionalLight(0xffecd0,3.5);sun.position.set(-10,14,-10);scene.add(sun);
const rim=new THREE.DirectionalLight(0xb9dfed,2);rim.position.set(10,8,6);scene.add(rim);
let model=null,angle=0,pitch=.20,distance=12,drag=null,animation=false,selected=null,serial=0;
const grid=new THREE.GridHelper(100,100,0x718278,0x364d4c);scene.add(grid);
function render(){renderer.setSize(stage.clientWidth,stage.clientHeight,false);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle)*Math.cos(pitch),Math.sin(pitch),Math.cos(angle)*Math.cos(pitch)).multiplyScalar(distance));camera.lookAt(target);renderer.render(scene,camera);}
function dispose(root){root?.traverse(o=>{if(!o.isMesh)return;o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])m[key]?.dispose();m.dispose();}});}
async function show(id){
  const token=++serial;selected=manifest.models.find(m=>m.id===id);status.textContent='불러오는 중…';
  const gltf=await new GLTFLoader().loadAsync('/'+selected.file);if(token!==serial){dispose(gltf.scene);return;}
  if(model){scene.remove(model);dispose(model);}model=gltf.scene;scene.add(model);
  const box=new THREE.Box3().setFromObject(model);model.position.y-=box.min.y;box.setFromObject(model);box.getCenter(target);const size=box.getSize(new THREE.Vector3());distance=Math.max(size.x,size.y,size.z)*2.1;angle=Math.PI;pitch=.17;
  camera.far=Math.max(1000,distance*10);status.textContent=`${selected.label} · ${selected.triangles.toLocaleString()} 삼각형 · ${(selected.bytes/1048576).toFixed(2)} MB`;status.dataset.asset=id;render();
}
const manifest=await(await fetch('/assets/models/heritage/manifest.json')).json();
document.querySelector('#total').textContent=`웹으로 옮긴 모델 ${manifest.models.length}개`;
for(const m of manifest.models){const option=document.createElement('option');option.value=m.id;option.textContent=m.label;select.append(option);}
select.addEventListener('change',()=>show(select.value).catch(e=>status.textContent=e.message));
document.querySelector('#animate').addEventListener('click',()=>{animation=!animation;document.querySelector('#animate').textContent=animation?'움직임 멈추기':'움직임 보기';});
stage.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];stage.setPointerCapture(e.pointerId);});stage.addEventListener('pointerup',()=>drag=null);stage.addEventListener('pointermove',e=>{if(!drag)return;angle-=(e.clientX-drag[0])*.008;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-drag[1])*.006,-1.3,1.3);drag=[e.clientX,e.clientY];render();});stage.addEventListener('wheel',e=>{e.preventDefault();distance*=Math.exp(e.deltaY*.001);distance=Math.max(.5,Math.min(1000,distance));render();},{passive:false});addEventListener('resize',render);
function tick(t){if(animation&&model){const leaf=model.getObjectByName('Leaf');if(leaf)leaf.rotation.y=(Math.sin(t*.002)+1)*Math.PI/2;const left=model.getObjectByName('Left'),right=model.getObjectByName('Right');if(left)left.rotation.y=-(Math.sin(t*.001)**2)*1.3;if(right)right.rotation.y=Math.sin(t*.001)**2*1.3;if(!leaf&&!left)angle+=.003;render();}requestAnimationFrame(tick);}requestAnimationFrame(tick);
await show(manifest.models[0].id);
window.assetLibrary={scene,camera,renderer,render,get model(){return model;},get selected(){return selected;}};
