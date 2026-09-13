import * as THREE from 'three';
import { bindCoopBalance } from '../core/CoopBalance.js';
export function attachCoop(settings,getState,hooks={}){
 const root=document.createElement('section');root.className='now';root.id='coopMenu';
 root.innerHTML='<b>친구와 함께 · 접속 시험</b><p>균형 신전 공동 실험 · 개인 기록과 별도로 진행한다.</p><input aria-label="초대 코드" placeholder="초대 코드" maxlength="8"><button type="button">방 만들기</button><button type="button">참여</button><button type="button">나가기</button><button type="button">균형 신전 함께하기</button><p role="status">최대 3명 · 기록은 각 기기에 저장</p>';
 settings.appendSection(root);const [create,join,leave,temple]=root.querySelectorAll('button'),code=root.querySelector('input'),status=root.querySelector('[role=status]');
 const endpoint=location.hostname==='127.0.0.1'||location.hostname==='localhost'?'http://127.0.0.1:5520':null;
 let session=null,busy=false,polling=false,binding=null,latest=null,sending=false;const markers=new Map();
 const clear=()=>{for(const m of markers.values()){m.removeFromParent();m.geometry.dispose();m.material.dispose();}markers.clear();};
 const request=async(route,body)=>{const r=await fetch(endpoint+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});const data=await r.json();if(!r.ok)throw Error(data.error);return data;};
 const showError=e=>{status.textContent=({full:'이미 3명이 있는 방이다',missing:'초대 코드를 확인하자',expired:'연결이 만료됐다. 다시 참여하자'}[e.message]||'협동 서버에 연결하지 못했다');};
 const enter=async route=>{if(busy||session)return;if(!endpoint){status.textContent='온라인 협동 서버를 준비 중이다';return;}busy=true;try{session=await request(route,{code:code.value.trim().toUpperCase()});code.value=session.code;status.textContent=`초대 코드 ${session.code} · 접속됨`;}catch(e){showError(e)}finally{busy=false;}};
 temple.onclick=()=>{if(!session||!latest||binding)return;const r=hooks.enter?.();if(!r)return;binding=bindCoopBalance(r,session.id,async command=>{if(sending)return;sending=true;try{const result=await request('/balance',{...session,command});binding?.apply(result.balance);}catch(e){showError(e)}finally{sending=false;}});binding.apply(latest);settings.setOpen(false);};
 const stopBinding=()=>{binding?.dispose();binding=null;hooks.exit?.();};
 create.onclick=()=>enter('/create');join.onclick=()=>enter('/join');leave.onclick=async()=>{const old=session;stopBinding();session=null;latest=null;clear();status.textContent='방에서 나왔다';if(old)try{await request('/leave',old)}catch{}};
 setInterval(async()=>{if(!session||polling)return;polling=true;const current=session;try{const state=getState();const pose=['lab','planet','balance'].includes(state.mode)?{scene:state.mode,position:state.position.toArray()}:null;const data=await request('/state',{...current,pose});if(session!==current)return;latest=data.balance;if(binding&&!getState().cooperative){binding.dispose();binding=null;for(const [stage,s] of latest.stages.entries()){const box=s.owners.indexOf(current.id);if(box>=0)await request('/balance',{...current,command:{stage,type:'drop',box}});}}binding?.apply(latest);status.textContent=`초대 코드 ${current.code} · ${data.players.length}/3명`;
 const ids=new Set();for(const p of data.players){if(p.id===current.id)continue;ids.add(p.id);let m=markers.get(p.id);if(!m){m=new THREE.Mesh(new THREE.OctahedronGeometry(.35),new THREE.MeshBasicMaterial({color:0x77ffe0}));markers.set(p.id,m);}m.visible=!!pose&&p.pose?.scene===pose.scene;if(m.visible){state.scene.add(m);m.position.fromArray(p.pose.position);if(state.mode==='planet')m.position.multiplyScalar(1.012);else m.position.y+=1.8;}}
 for(const [id,m]of markers)if(!ids.has(id)){m.removeFromParent();m.geometry.dispose();m.material.dispose();markers.delete(id);}
 }catch(e){clear();showError(e);if(e.message==='expired'){stopBinding();session=null;}}finally{polling=false;}},150);
}
