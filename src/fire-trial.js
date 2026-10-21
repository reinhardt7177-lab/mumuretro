import * as T from 'three';
import {loadNavigator,buildNavigator} from './sphere/Navigator.js';
import {buildKid} from './sphere/Character.js';
import {RoomActor} from './shrine/RoomActor.js';
import {Input} from './core/Input.js';
import {Loop} from './core/Loop.js';
import {buildFireTrial} from './shrine/FireTrial.js';
import {createFireTrialStore} from './shrine/FireTrialState.js';
import {FRACTURE as F} from './shrine/FractureState.js';
import {startAudio,sfx,isMuted,setMuted} from './core/Audio.js';

 const $=s=>document.querySelector(s),canvas=$('#c'),load=$('#load');
try{
 const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const camera=new T.PerspectiveCamera(62,innerWidth/innerHeight,.12,150),input=new Input(canvas);
 const [room]=await Promise.all([buildFireTrial(),loadNavigator()]);
 const fallback=buildKid(),body=buildNavigator(fallback.userData.glider)||fallback,carrier=new T.Group();carrier.add(body);room.scene.add(carrier);body.userData.hasNotebook=false;
 const bounds=new T.Box3().setFromObject(body),actor=new RoomActor(carrier,body,-bounds.min.y,room.rects);actor.obstacles=room.obstacles;actor._in=(x,z)=>room.contains(x,z,actor.position.y);actor.freeCam=true;actor.setAt(...F.entry,-1);input.camDist=5.4;input.camPitch=.40;
 const fill=new T.PointLight(0xffe7bc,1.8,4,2);fill.position.set(0,1.7,1.2);carrier.add(fill);
 const contact=new T.Mesh(new T.CircleGeometry(.29,24),new T.MeshBasicMaterial({color:0x182028,transparent:true,opacity:.15,depthWrite:false}));contact.rotation.x=-Math.PI/2;room.scene.add(contact);
 const store=createFireTrialStore();let saved=store.read(),started=false,paused=false,canPersist=store.status!=='invalid',low=false,guideOn=false,externalMessage='',externalTime=0;const completionsShown=new Set();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const dustCanvas=document.createElement('canvas');dustCanvas.width=dustCanvas.height=32;const d=dustCanvas.getContext('2d'),g=d.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'#fff8d4');g.addColorStop(.25,'#fff3bd');g.addColorStop(1,'#ffffff00');d.fillStyle=g;d.fillRect(0,0,32,32);
 const dustGeometry=new T.BufferGeometry();dustGeometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(160*3),3));const guide=new T.Points(dustGeometry,new T.PointsMaterial({color:0xffd18a,size:.09,map:new T.CanvasTexture(dustCanvas),transparent:true,opacity:.72,blending:T.AdditiveBlending,depthWrite:false}));guide.frustumCulled=false;room.scene.add(guide);guide.visible=false;let guideTime=0;
 function notify(text,seconds=4){externalMessage=text;externalTime=seconds;}
 function persist(){if(!canPersist)return false;const ok=store.write(room.snapshot(actor));if(!ok)notify('이 기기에 보관할 수 없다 · 창을 닫기 전까지는 계속 플레이할 수 있다',6);return ok;}
 function updateGuide(dt){guide.visible=guideOn&&started&&!paused;if(!guide.visible)return;guideTime+=dt;const points=room.guidePoints(actor),lengths=points.slice(1).map((v,i)=>v.distanceTo(points[i])),total=lengths.reduce((a,b)=>a+b,0),count=Math.min(low?65:160,Math.ceil(total/.22));const attr=dustGeometry.attributes.position;
  for(let i=0;i<count;i++){let length=(i/count*total+(reduced.matches?0:guideTime*.40))%Math.max(.01,total),k=0;while(k<lengths.length-1&&length>lengths[k])length-=lengths[k++];const at=points[k].clone().lerp(points[k+1],length/Math.max(.001,lengths[k]));at.y+=reduced.matches?0:Math.sin(i*2.4+guideTime*1.5)*.025;attr.setXYZ(i,at.x,at.y,at.z);}attr.needsUpdate=true;dustGeometry.setDrawRange(0,count);
 }
 function paint(){const prompt=room.prompt(actor),s=room.mechanics.state;$('#objective').textContent=room.target(actor).label;$('#prompt').textContent=prompt||'';$('#prompt').classList.toggle('show',!!prompt);$('#notice').textContent=externalTime>0?externalMessage:room.message;$('#notice').classList.toggle('show',!!$('#notice').textContent);
  $('#action').hidden=!prompt||!prompt.startsWith('E — ');$('#action').textContent=prompt?.replace(/^E — /,'')||'상호작용';$('#action').disabled=room.mechanics.testing;
  $('#hud .trial-label').textContent=room.sanctum.exited?'화산의 신전 · 탐사 완료':actor.position.z<-40.1?'화산의 신전 · 불꽃 수호자 전당':room.foundry.mechanics.state.returned?'화산의 신전 · 세 번째 실험':s.returned?'화산의 신전 · 두 번째 실험':'화산의 신전 · 첫 번째 실험';const stages=room.stages();document.querySelectorAll('[data-stage]').forEach((e,i)=>{e.textContent=stages[i][0];e.classList.toggle('done',stages[i][1]);});
  const dialogue=room.sanctum.dialogue;$('#audience').hidden=!dialogue||paused;if(dialogue){$('#audience-line').textContent=dialogue.text;$('#audience-page').textContent=`${dialogue.index+1} / ${dialogue.total}`;$('#action').hidden=true;$('#complete').hidden=true;}
  const done=room.completion();if(done&&!completionsShown.has(done)){completionsShown.add(done);$('#complete b').textContent=['','첫 실험 완료','주조실 실험 완료','상층 도착','불꽃의 지혜를 얻었다'][done];$('#complete p').textContent=['','다리를 고정하고 건너왔다. 오른쪽에 용암 주조실 문이 열렸다.','용암을 모아 굳힌 새 돌길을 건너왔다. 중앙 홀 북쪽 승강실 문이 열렸다.','증기로 다리를 내리고 승강대에 타고 올라왔다. 전당의 수호자가 기다린다.','세 실험과 수호자의 말을 수첩에 담았다. 이 시제품의 신전은 밀봉되었다.'][done];$('#complete').hidden=false;sfx('orb_take');}
 }
 function step(dt){if(!started||paused||document.hidden){input.reset();return;}
  externalTime=Math.max(0,externalTime-dt);const intent=input.poll();if(intent.action)room.interact(actor);room.animate(dt,actor);body.userData.carrying=room.held!==null;if(!room.sanctum.frozen){actor.update(dt,intent,camera);room.afterMove(actor);}actor.updateCamera(camera,input,dt);
  contact.position.copy(actor.position);contact.position.y+=.018;updateGuide(dt);paint();if(room.dirty){room.clearDirty();persist();}
 }
 function render(){renderer.render(room.scene,camera);}
 const loop=new Loop(step,render);
 function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();actor._camPlaced=false;actor.updateCamera(camera,input,0);render();}addEventListener('resize',resize);resize();
 function start(resume){if(started)return;startAudio();
  if(resume&&saved){room.restore(saved);room.resume(actor);}
  else{if(store.status==='invalid')canPersist=store.archive();room.resume(actor);}
  started=true;$('#start').hidden=true;for(const el of ['#hud','#tools','#controls'])$(el).hidden=false;input.reset();actor.updateCamera(camera,input,0);room.animate(0,actor);paint();persist();
 }
 function setPaused(on){paused=on;$('#notes').hidden=!on;guide.visible=!on&&guideOn;input.reset();if(on){$('#notes-title').textContent=room.sanctum.awarded?'불꽃의 지혜':room.steam.mechanics.state.visited?'동력을 바꿔 얻은 높이':room.foundry.mechanics.state.visited?'흐름으로 만든 길':'흔들리는 다리';$('#record').textContent=room.record(actor);$('#close-notes').focus();}else canvas.focus();paint();}
 $('#begin').textContent=saved?'이어서 실험':'실험 시작';$('#fresh').hidden=!saved;$('#begin').onclick=()=>start(!!saved);
 if(store.status==='invalid'){$('#begin').textContent='기록을 보관하고 새로 실험';$('#save-info').textContent='이 실험 기록을 읽지 못했다. 원본을 별도로 보관하고 시작한다. 본편 기록은 그대로 남는다.';}
 if(store.migrated)$('#save-info').textContent='기존 실험 기록을 이어받았다. 이전 원본과 본편 기록은 그대로 남는다.';
 $('#fresh').onclick=()=>{canPersist=store.archive();saved=null;start(false);if(!canPersist)notify('이전 실험 기록을 보관하지 못해 임시 플레이로 시작했다',6);};
 $('#quest').onclick=()=>{guideOn=!guideOn;$('#quest').classList.toggle('on',guideOn);$('#quest').setAttribute('aria-pressed',String(guideOn));updateGuide(0);};
 $('#help').onclick=()=>setPaused(true);$('#close-notes').onclick=()=>setPaused(false);$('#hint').onclick=()=>{notify(room.hint(actor),7);};$('#recover').onclick=()=>{room.recover(actor);persist();paint();};$('#mute').onclick=()=>{setMuted(!isMuted());$('#mute').textContent=isMuted()?'소리 꺼짐':'소리 켜짐';};$('#mute').textContent=isMuted()?'소리 꺼짐':'소리 켜짐';
 $('#quality').onclick=()=>{low=!low;room.setLow(low);renderer.setPixelRatio(Math.min(devicePixelRatio,low?.85:1.25));renderer.shadowMap.enabled=!low;$('#quality').textContent=low?'화질 낮음':'화질 높음';resize();};$('#keep-playing').onclick=()=>{$('#complete').hidden=true;};
 const activate=(id,fn)=>{const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();fn();b.setPointerCapture(e.pointerId);});b.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();e.stopPropagation();if(!e.repeat)fn();}});};activate('#action',()=>input.requestAction());activate('#jump',()=>input.requestJump());
 $('#audience-next').onclick=()=>input.requestAction();$('#audience-skip').onclick=()=>{room.sanctum.skip();input.reset();persist();paint();};
 addEventListener('keydown',e=>{if(e.code==='Escape'&&paused){e.preventDefault();setPaused(false);}else if(e.code==='KeyN'&&started){e.preventDefault();setPaused(!paused);}});
 addEventListener('blur',()=>{input.reset();if(started)persist();});document.addEventListener('visibilitychange',()=>{input.reset();if(document.hidden&&started)persist();});addEventListener('pagehide',()=>{if(started)persist();});
 load.hidden=true;$('#start').hidden=false;$('#begin').focus();loop.start();
 window.fireTrial={room,actor,body,renderer,camera,input,loop,step,render,store,persist,start,setPaused,get paused(){return paused;},get started(){return started;},get guide(){return guide;}};
}catch(error){console.error(error);load.textContent='회랑을 불러오지 못했다. 새로고침해서 다시 시도해 주세요.';const a=document.createElement('a');a.href='art/fire-temple/v01/review.html';a.textContent='설계 검수로 돌아가기';load.append(document.createElement('br'),a);}
