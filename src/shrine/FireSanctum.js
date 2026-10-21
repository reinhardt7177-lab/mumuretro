import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SanctumState,FIRE_AUDIENCE} from './SanctumState.js';
import {sfx} from '../core/Audio.js';
export async function buildFireSanctum(){
 const root=new T.Group(),loader=new GLTFLoader(),base='assets/models/fire-temple/',ids=['static','guardian','eyes','orb'];const [models,response]=await Promise.all([Promise.all(ids.map(k=>loader.loadAsync(`${base}sanctum-${k}-v01.glb`))),fetch(base+'sanctum-manifest.json')]);if(!response.ok)throw Error('전당 실측을 불러오지 못했다');const manifest=await response.json(),parts=Object.fromEntries(ids.map((k,i)=>[k,models[i].scene]));
 for(const p of Object.values(parts))p.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])m.userData.outlineParameters={visible:false};}});
 root.add(parts.static);const deity=new T.Group();deity.position.set(0,3.2,-53);deity.add(parts.guardian,parts.eyes,parts.orb);root.add(deity);const orb=parts.orb,mechanics=new SanctumState();
 const light=new T.PointLight(0xffc272,12,12,2);light.position.set(0,7,-49);root.add(light);const fill=new T.PointLight(0x9bbad4,6,9,2);fill.position.set(2,7.3,-51);root.add(fill);
 const medals=[-2.8,0,2.8].map((x,i)=>{const g=new T.Group();g.position.set(x,6.7,-56.49);root.add(g);const m=new T.MeshStandardMaterial({color:0xc4a56c,emissive:0xdba249,emissiveIntensity:.08,metalness:.5,roughness:.4});const ring=new T.Mesh(new T.TorusGeometry(.47,.04,8,36),m);g.add(ring);let symbol;
  if(i===0){symbol=new T.Mesh(new T.BoxGeometry(.65,.1,.1),m);g.add(symbol);for(const side of [-1,1]){const a=new T.Mesh(new T.BoxGeometry(.12,.5,.1),m);a.position.set(side*.22,-.05,0);g.add(a);}}
  else if(i===1){symbol=new T.Mesh(new T.ConeGeometry(.20,.65,7),m);g.add(symbol);}else for(const y of [-.22,0,.22]){const a=new T.Mesh(new T.TorusGeometry(.22,.025,6,20,Math.PI),m);a.position.y=y;g.add(a);}return {group:g,material:m};});
 const rects=[{id:'sanctumEntry',x0:-3,x1:3,z0:-42,z1:-40.1,h:11,open:true},{id:'sanctum',x0:-14,x1:14,z0:-57,z1:-41,h:12,open:true}];
 const cameraOccluders=manifest.cameraOccluders.map(b=>{const m=new T.Mesh(new T.BoxGeometry(...b.max.map((n,i)=>n-b.min[i])),new T.MeshBasicMaterial());m.position.set(...b.min.map((n,i)=>(n+b.max[i])/2));m.updateMatrixWorld(true);return m;});
 const obstacles=[...manifest.pillars,{x:0,z:-53,r:1.8},...[-4.8,4.8].flatMap(x=>[-44,-49,-54,-55].map(z=>({x,z,r:.6})))];let low=false,unlocked=false;
 function contains(x,z,y){return y>2.8&&rects.some(r=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1);}
 function prompt(a){const s=mechanics.state;if(!unlocked||s.phase!=='ready'||!a.grounded||Math.abs(a.position.y-3.2)>.2)return null;return Math.hypot(a.position.x,a.position.z+49.4)<2?'E — 불꽃 수호자와 이야기하기':null;}
 function animate(dt,actor,locks){unlocked=locks.every(Boolean);medals.forEach((m,i)=>m.material.emissiveIntensity=locks[i]?.65:.05);light.intensity=low?3:12;fill.intensity=low?1:6;
  const s=mechanics.state,award=s.phase==='reward';orb.position.y=award?mechanics.rewardTime*.8:0;orb.scale.setScalar(award?1+mechanics.rewardTime*.15:1);parts.eyes.visible=unlocked;const exit=mechanics.tick(dt);if(exit){actor.setAt(0,27,-1);sfx('portal');}return exit;
 }
 return {root,deity,orb,manifest,mechanics,rects,cameraOccluders,obstacles,contains,prompt,animate,
  interact(a){if(mechanics.state.phase==='audience')return mechanics.next();if(!prompt(a))return false;sfx('dlg_page');return mechanics.begin(unlocked);},
  target(){const s=mechanics.state;return {point:new T.Vector3(0,s.phase==='exited'?0:3.2,s.phase==='exited'?27:-49.4),label:s.phase==='exited'?'불꽃의 지혜를 기록했다 · 신전이 밀봉되었다':s.phase==='reward'?'불꽃의 지혜를 수첩에 담는 중이다':'전당에 들어가 불꽃 수호자와 이야기하자'};},
  get dialogue(){return mechanics.state.phase==='audience'?{who:'불꽃 수호자',text:FIRE_AUDIENCE[mechanics.state.line],index:mechanics.state.line,total:4}:null;},get awarded(){return mechanics.state.awards===1;},get exited(){return mechanics.state.phase==='exited';},get frozen(){return ['audience','reward'].includes(mechanics.state.phase);},skip(){return mechanics.skip();},setLow(v){low=v;}
 };
}
