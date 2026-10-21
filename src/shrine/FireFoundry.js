import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FoundryState,FOUNDRY as F} from './FoundryState.js';
import {sfx} from '../core/Audio.js';

const V=(...p)=>new T.Vector3(...p),near=(p,q,r=1.7)=>Math.hypot(p.x-q[0],p.z-q[1])<r;
function label(parent,text,x,y,z){const c=document.createElement('canvas');c.width=512;c.height=128;const a=c.getContext('2d');a.fillStyle='#1c2c32';a.fillRect(0,0,512,128);a.strokeStyle='#bd995d';a.lineWidth=8;a.strokeRect(4,4,504,120);a.fillStyle='#f2dfb4';a.font='bold 48px "Malgun Gothic",sans-serif';a.textAlign='center';a.textBaseline='middle';a.fillText(text,256,64,480);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(1,.25),new T.MeshBasicMaterial({map:tex}));m.position.set(x,y,z);parent.add(m);return m;}
function molten(){return new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},cool:{value:0},surface:{value:0}},vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`
 uniform float time,cool,surface;varying vec2 uv0;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
 float fbm(vec2 p){float n=0.,a=.55;for(int i=0;i<3;i++){n+=a*noise(p);p=p*2.03+7.1;a*=.5;}return n;}
 void main(){vec2 p=uv0*vec2(17.,25.)+vec2(time*.035,0.);float n=fbm(p);float veins=1.-smoothstep(.018,.075,abs(fbm(p*1.7)-.48));float islands=smoothstep(.43,.65,n);float edge=min(min(uv0.x,1.-uv0.x),min(uv0.y,1.-uv0.y));float crust=smoothstep(.06,.9,cool+(1.-edge*3.)*.18+n*.12);vec3 hot=mix(vec3(1.15,.16,.009),vec3(.10,.022,.009),islands*.88)+veins*vec3(.65,.22,.016);vec3 colour=mix(hot,vec3(.055,.068,.074),crust);float alpha=mix(1.,1.-smoothstep(.75,1.,cool),surface);gl_FragColor=vec4(colour,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});}

export async function buildFireFoundry(){
 const root=new T.Group();root.name='lava-foundry';const loader=new GLTFLoader(),base='assets/models/fire-temple/';
 const ids=['static','rotor','stand','wheel','slab','gate'];const [loaded,response,anchorGLB]=await Promise.all([Promise.all(ids.map(k=>loader.loadAsync(base+`foundry-${k}-v01.glb`))),fetch(base+'foundry-manifest.json'),loader.loadAsync(base+'fracture-anchor-v01.glb')]);if(!response.ok)throw Error('주조실 배치 파일을 불러오지 못했다');const manifest=await response.json(),parts=Object.fromEntries(ids.map((id,i)=>[id,loaded[i].scene]));
 for(const p of [...Object.values(parts),anchorGLB.scene])p.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});root.add(parts.static);
 const mechanics=new FoundryState(),rotors=F.rotors.map((p,i)=>{const o=parts.rotor.clone(true);o.position.set(...p);o.rotation.y=mechanics.state.channels[i]*Math.PI/2;root.add(o);return o;});
 const wheels=[];for(const [i,p] of [...F.controls,F.valve].entries()){const stand=parts.stand.clone(true);stand.position.set(p[0],0,p[1]);root.add(stand);label(stand,i===2?'용암 공급':`수로 ${i===0?'A':'B'}`,0,.56,.37);const wheel=parts.wheel.clone(true);wheel.position.set(p[0],1.25,p[1]+.30);root.add(wheel);wheels.push(wheel);}
 // Visible mechanical shafts connect each wheel to its elevated channel bearing.
 const bronze=new T.MeshStandardMaterial({color:0xb38b4f,metalness:.65,roughness:.4});
 function pipe(points,r=.07,mat=bronze,parent=root){const curve=new T.CurvePath();for(let j=1;j<points.length;j++)curve.add(new T.LineCurve3(V(...points[j-1]),V(...points[j])));const m=new T.Mesh(new T.TubeGeometry(curve,Math.max(2,points.length*8),r,8,false),mat);m.castShadow=true;parent.add(m);return m;}
 F.controls.forEach((p,i)=>{const r=F.rotors[i];pipe([[p[0],1.2,p[1]-.2],[p[0],1.2,r[2]],[p[0],2.6,r[2]]]);});pipe([[35,1.25,9],[36.1,1.25,9],[36.1,2.8,9]]);
 const anchor=anchorGLB.scene;anchor.position.set(28,0,-8);root.add(anchor);label(root,'돌길 잠금',28,2.25,-7.4);
 const gate=parts.gate;gate.position.set(16,0,8);root.add(gate);let gateOpen=0;
 const slab=parts.slab;slab.position.set(28,0,0);root.add(slab);slab.visible=false;
 const lava=molten(),surfaceMaterial=molten();surfaceMaterial.uniforms.surface.value=1;const surface=new T.Mesh(new T.PlaneGeometry(3.92,6.25),surfaceMaterial);surface.rotation.x=-Math.PI/2;surface.position.set(28,-.6,0);surface.renderOrder=1;root.add(surface);
 const flows=[
  pipe([[20.7,2.85,5.8],[22.6,2.85,5.8]],.12,lava),
  pipe([[24,2.85,4.4],[24,2.85,3.6],[29.6,2.85,3.6]],.12,lava),
  pipe([[31,2.85,2.2],[31,2.85,1.5],[30.45,2.85,1.5],[30.45,.20,1.5],[29.65,.04,1.5]],.12,lava)
 ];
 const rotorFlows=rotors.map(o=>pipe([[-1.35,.06,0],[0,.06,0],[0,.06,-1.35]],.12,lava,o));
 // Misrouting is contained; it never creates invisible lava across a walk path.
 const drainPaths=F.rotors.map(p=>[[p[0]-.5,2.25,p[2]],[p[0]-.5,.3,p[2]],[p[0]-.5,.3,3.15],[p[0]-.5,-1.7,3.15]]);drainPaths.forEach(p=>pipe(p,.16,bronze));const drains=drainPaths.map(p=>pipe([p.at(-1),[p.at(-1)[0],-2,3.15]],.10,lava));
 const glow=new T.PointLight(0xff7a21,0,13,2);glow.position.set(28,1.9,0);root.add(glow);
 const seal=new T.Mesh(new T.TorusGeometry(.40,.05,8,32),new T.MeshStandardMaterial({color:0xc6a45d,emissive:0xc57d29,emissiveIntensity:.15}));seal.position.set(28,1.5,-7.38);root.add(seal);
 const cameraOccluders=manifest.cameraOccluders.map(b=>{const o=new T.Mesh(new T.BoxGeometry(...b.max.map((n,i)=>n-b.min[i])),new T.MeshBasicMaterial());o.position.set(...b.max.map((n,i)=>(n+b.min[i])/2));o.updateMatrixWorld(true);return o;});
 const rects=[{id:'east',x0:8,x1:18.35,z0:6,z1:10,h:7,open:true},{id:'foundry',x0:18,x1:38,z0:-12,z1:14,h:7,open:true}];
 const obstacles=[...manifest.pillars,...manifest.solids,...[...F.controls,F.valve].map(p=>({x:p[0],z:p[1],r:.68})),{x:28,z:-8,r:.89},...[21.5,34.5].map(x=>({x,z:-10,r:.85})),...F.controls.map(p=>({x:p[0],z:p[1]-1,r:.18}))];
 let message='',messageT=0,falls=0,hintLevel=0,time=0,low=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const notify=(m,t=4)=>{message=m;messageT=t;};
 const contains=(x,z)=>rects.some(r=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1);
 function floorAt(x,z){if(x>18&&x<38&&z>-3&&z<3)return mechanics.state.solid&&Math.abs(x-28)<2?0:-3;return 0;}
 function candidate(actor){if(!actor.grounded||Math.abs(actor.position.y)>.3)return null;const p=actor.position,s=mechanics.state;if(near(p,F.valve))return {kind:'valve',label:s.valve?'용암 공급 닫기':'용암 공급 열기'};for(let i=0;i<2;i++)if(near(p,F.controls[i]))return {kind:'channel',id:i,label:`수로 ${i===0?'A':'B'} 돌리기`};if(near(p,F.anchor,1.8))return {kind:'anchor',label:s.latched?'돌길 잠금 완료':'돌길 잠그기'};return null;}
 function interact(actor){const t=candidate(actor);if(!t)return false;const s=mechanics.state;
  if(t.kind==='channel'){if(!mechanics.turn(t.id)){notify('공급을 닫고 수로를 움직이자');return false;}sfx('lever');return true;}
  if(t.kind==='valve'){mechanics.toggle();notify(s.solid?'굳은 돌길은 유지된다':s.valve?mechanics.connected?'연결된 수로를 따라 틀이 차오른다':'연결되지 않은 흐름은 배수 홈으로 돌아간다':s.fill===1?'공급을 끊었다 · 표면이 굳는 변화를 살펴보자':'채운 양은 남았다 · 틀을 더 채울 수 있다');sfx('lever');return true;}
  if(t.kind==='anchor'){if(s.latched)return false;if(!mechanics.latch())return false;notify('새 돌길을 잠갔다 · 중앙 홀로 돌아가자',5);sfx('door_open');return true;}return false;
 }
 function recover(actor){mechanics.recover();actor.setAt(...F.near,-1);falls++;notify('가까운 바닥으로 돌아왔다 · 채운 틀과 굳은 길은 남았다',5);sfx('gate_fail');}
 function afterMove(actor){if(actor.position.x<18)return;const p=actor.position,s=mechanics.state;if(p.y<-.6||!s.solid&&s.fill>0&&Math.abs(p.x-28)<2&&p.z>-3&&p.z<3&&p.y<.4)recover(actor);}
 function animate(dt,actor,unlocked){time+=dt;messageT=Math.max(0,messageT-dt);const s=mechanics.state,wasSolid=s.solid;mechanics.tick(dt);if(!wasSolid&&s.solid){notify('표면의 잔열이 사라졌다 · 새 돌길을 건너자',5);sfx('door_open');}
  gateOpen=T.MathUtils.damp(gateOpen,unlocked?1:0,8,dt);if(dt===0)gateOpen=unlocked?1:0;gate.position.y=gateOpen*4.3;
  rotors.forEach((o,i)=>{const target=s.channels[i]*Math.PI/2,delta=Math.atan2(Math.sin(target-o.rotation.y),Math.cos(target-o.rotation.y));o.rotation.y+=delta*(dt===0?1:1-Math.exp(-dt*12));wheels[i].rotation.z=o.rotation.y;});wheels[2].rotation.z=T.MathUtils.damp(wheels[2].rotation.z,s.valve?-Math.PI*.6:0,10,dt);
  flows[0].visible=s.valve;flows[1].visible=s.valve&&s.channels[0]===0;flows[2].visible=s.valve&&mechanics.connected&&!s.solid;rotorFlows.forEach((o,i)=>o.visible=s.valve&&(i===0||s.channels[0]===0));drains.forEach((o,i)=>o.visible=s.valve&&(i===0?s.channels[0]!==0:s.channels[0]===0&&s.channels[1]!==0)||s.valve&&s.solid&&i===1);
  surface.visible=s.fill>0&&!s.solid;surface.position.y=-.59+s.fill*.62;surfaceMaterial.uniforms.cool.value=s.cooling/F.coolTime;lava.uniforms.time.value=surfaceMaterial.uniforms.time.value=reduced.matches?0:time;slab.visible=s.fill===1;glow.intensity=low?0:(s.fill>0&&!s.solid?8*(1-s.cooling/F.coolTime):s.valve?2:0);seal.material.emissiveIntensity=s.latched?.8:.15;
  if(unlocked&&actor.position.x>18&&!s.visited){s.visited=true;mechanics.changed=true;}
  if(s.latched&&!s.returned&&near(actor.position,F.hub,3)){s.returned=true;mechanics.changed=true;notify('새 돌길을 만들었다 · 다음은 증기 승강실이다',6);}
 }
 function target(){const s=mechanics.state;if(s.returned)return {point:V(0,0,-8),label:'두 실험 완료 · 다음은 증기 승강실이다'};if(s.latched)return {point:V(5,0,8),label:'새 돌길로 돌아가 중앙 홀에 도달하자'};if(s.solid)return {point:V(28,0,-8),label:'새 돌길을 건너 먼 쪽에서 잠그자'};if(s.valve&&s.fill===1)return {point:V(35,0,9),label:'공급을 닫아 새 돌길을 굳히자'};if(!s.valve&&s.fill===1)return {point:V(28,0,3.6),label:'표면의 잔열이 사라지는 변화를 살펴보자'};if(s.valve&&!mechanics.connected)return {point:V(35,0,9),label:'공급을 닫고 끊긴 수로를 살펴보자'};if(mechanics.connected)return {point:V(35,0,9),label:s.valve?'수로를 따라 틀이 차오르는 모습을 살펴보자':'용암을 흘려 다리 틀을 채우자'};return {point:V(F.controls[s.channels[0]!==0?0:1][0],0,7),label:s.visited?'수로의 열린 끝을 이어 틀까지 연결하자':'오른쪽 주조실의 수로를 살펴보자'};}
 return {root,mechanics,rects,contains,floorAt,obstacles,cameraOccluders,manifest,rotors,wheels,slab,surface,flows,gate,animate,afterMove,interact,recover,target,
  get gateOpen(){return gateOpen;},get falls(){return falls;},get message(){return messageT>0?message:'';},prompt(actor){const c=candidate(actor);return c?'E — '+c.label:null;},setLow(v){low=v;},
  hint(){return ['공급 밸브와 높은 수로의 열린 끝을 살펴보자.','뜨거운 공급을 끊고 손잡이로 수로의 두 끝을 고정 관과 이어 보자.','두 수로가 이어지면 공급을 열어 틀을 채우고, 다시 닫아 잔열이 사라진 뒤 건너자.'][Math.min(hintLevel++,2)];},
  record(){const s=mechanics.state;return s.latched?'용암을 틀에 모으고 공급을 끊었다. 표면이 굳자 새 돌길을 건너 잠글 수 있었다.':s.solid?'공급을 끊자 가장자리부터 어두운 껍질이 퍼졌다. 잔열이 사라진 뒤 걸을 수 있었다.':s.fill>0?'연결된 수로로 용암이 흘러 틀이 차올랐다. 공급과 표면 변화를 더 살펴보자.':'높은 수로 두 곳이 끊겨 있다. 가까운 손잡이와 공급 밸브가 연결되어 있다.';}
 };
}
