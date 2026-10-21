import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const canvas=document.querySelector('#view'),stage=canvas.parentElement,status=document.querySelector('#status');
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(44,1,.03,600),target=new T.Vector3(),loaded=new Map(),loader=new GLTFLoader();
scene.add(new T.HemisphereLight(0xd7eaff,0x39302b,2.2));
for(const [pos,color,power] of [[[35,60,45],0xffdeaf,3.2],[[-45,25,-30],0x9fc9ef,1.8]]){const l=new T.DirectionalLight(color,power);l.position.set(...pos);scene.add(l);}
// Small local studio environment: reflections work without external HDR downloads.
const studio=new T.Scene();studio.background=new T.Color(0x74848c);
for(const [x,y,z,w,h,c] of [[-3,3,1,4,6,0xffedd4],[3,2,-3,3,5,0xc4e7ff],[0,4,0,5,5,0xe8efff]]){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:c,side:T.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);studio.add(m);}
const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.1);scene.environment=environment.texture;pmrem.dispose();studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
let model=null,kind='map',radius=50,distance=110,yaw=.60,pitch=.75,dirty=false,requestSerial=0,ready=false;
function render(){dirty=false;camera.position.copy(target).add(new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(distance));camera.lookAt(target);renderer.render(scene,camera);}
function invalidate(){if(!dirty){dirty=true;requestAnimationFrame(render);}}
function resize(){renderer.setSize(stage.clientWidth,stage.clientHeight,false);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();invalidate();}new ResizeObserver(resize).observe(stage);
function setView(view='default'){
 const fov=camera.fov*Math.PI/180;distance=radius/Math.sin(fov/2)*1.06;distance/=Math.min(1,camera.aspect);
 yaw=view==='front'?0:view==='top'?0:kind==='map'?.60:.38;pitch=view==='front'?.02:view==='top'?1.56:kind==='map'?.82:.21;invalidate();
}
async function selectModel(next){
 const serial=++requestSerial;ready=false;kind=next;status.textContent='실제 Blender 모델을 불러오는 중…';
 try{
  const file=next==='map'?'fire-temple-map-v01.glb':'fire-portal-v01.glb';
  if(!loaded.has(file)){const result=await loader.loadAsync(file);result.scene.traverse(o=>{if(o.isMesh){o.frustumCulled=true;for(const m of Array.isArray(o.material)?o.material:[o.material])m.envMapIntensity=.7;}});loaded.set(file,result.scene);}
  if(serial!==requestSerial)return;if(model)scene.remove(model);model=loaded.get(file);scene.add(model);model.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(model);box.getCenter(target);radius=box.getSize(new T.Vector3()).length()/2;
  camera.near=Math.max(.02,radius/300);camera.far=radius*30;camera.updateProjectionMatrix();
  const materials=new Set();let triangles=0,meshes=0;model.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m.uuid);}});
  const size=box.getSize(new T.Vector3());status.textContent=`${next==='map'?'전체 지도':'정문'} · 실제 GLB · ${meshes}개 메시 · ${Math.round(triangles).toLocaleString()}삼각형 · ${materials.size}개 재질 · ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)}m`;
  document.querySelectorAll('[data-model]').forEach(b=>b.classList.toggle('active',b.dataset.model===next));setView();ready=true;
 }catch(e){status.textContent='모델을 불러오지 못했습니다. Blender 제작 완료 뒤 새로고침해 주세요.';console.error(e);throw e;}
}
let pointers=new Map(),lastPinch=0;
canvas.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;const dx=e.clientX-old.x,dy=e.clientY-old.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(lastPinch)distance=T.MathUtils.clamp(distance*lastPinch/d,radius*.6,radius*12);lastPinch=d;}
 else{yaw-=dx*.006;pitch=T.MathUtils.clamp(pitch+dy*.006,-.10,1.56);}invalidate();});
for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,e=>{pointers.delete(e.pointerId);lastPinch=0;});
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=T.MathUtils.clamp(distance*Math.exp(e.deltaY*.001),radius*.6,radius*12);invalidate();},{passive:false});
document.querySelectorAll('[data-model]').forEach(b=>b.addEventListener('click',()=>selectModel(b.dataset.model)));
document.querySelector('#front').onclick=()=>setView('front');document.querySelector('#top').onclick=()=>setView('top');document.querySelector('#reset').onclick=()=>setView();
window.fireDesignReview={selectModel,setView,renderer,scene,camera,get ready(){return ready;},get model(){return model;},get kind(){return kind;}};
resize();await selectModel('map');
