import * as THREE from 'three';
import { STARSAIL } from '../data/starsail.js';

// Read progress only: guidance must never solve a device or change a save.
export function currentQuest(g) {
  const point=(x,z)=>new THREE.Vector3(x,0,z);
  const q=(id,text,target,hint='E · 조사하기')=>({id,text,target,hint});
  if(g.mode==='title')return null;
  if(g.mode==='lab'){
    const s=g.lab.state,v=g.lab.visualBindings;
    if(s.sent)return q('sent','여행의 기록을 소포로 보냈다',null,'탐사 완료');
    if(s.done)return q('send','소포에 여행의 기록 담기',point(v.table.position.x,v.table.position.z+2));
    if(!g.lab.starsail.recovered)return q('recover','우현 손잡이로 소포 건져 올리기',point(STARSAIL.winch.x-1.2,STARSAIL.winch.z),'E · 소포 회수');
    if(g.lab.starsail.recovering)return q('recovering','소포가 갑판에 도착하기를 기다리기',null,'소포를 끌어올리는 중');
    if(!s.hasNote)return q('parcel','소포에서 수첩 찾기',point(v.table.position.x,v.table.position.z+2));
    if(!s.read)return q('read','수첩을 펼쳐 목적지 단서 읽기',null,'📓 수첩 버튼 · PC는 N');
    if(!s.open)return q('navigation','수첩의 단서로 항해 고리 맞추기',point(0,v.con.position.z+1.5),'E · 항해 고리 조작');
    return q('depart','출항 장치에서 무무 행성으로 출발하기',point(3.3,v.gimbal.position.z),'E · 출발');
  }
  if(g.mode==='planet'){
    const count=g.shrines.clearedCount();
    const candidates=g.shrines.shrines.filter((s,i)=>!s.cleared&&count>=(g.SHRINES[i].locked||0));
    candidates.sort((a,b)=>g.player.position.angleTo(a.dir)-g.player.position.angleTo(b.dir));
    const s=candidates[0];
    if(!s)return q('home','범선으로 돌아가 소포 보내기',g.landing.pos.clone(),'E · 범선으로');
    return q('visit-'+g.shrines.shrines.indexOf(s),s.theme.name?`${s.theme.name} 찾기`:`${g.SHRINES[g.shrines.shrines.indexOf(s)].name} 찾기`,s.pos.clone().addScaledVector(s.facing,g.shrines.ENTER_R-.5),'E · 사당 들어가기');
  }
  const r=g.room;
  if(!r)return null;
  if(g.cleared)return q('exit','사당 밖으로 돌아가기',point(0,17),'E · 밖으로');
  const gate=r.gates.find(x=>!x.solved);
  if(gate){const seg=r.dungeon.rectOf(gate.room);return q(r.spec.id+'-'+gate.room,r.goals[gate.room],point((seg.x0+seg.x1)/2,seg.z1-2),'장치를 살펴보고 퍼즐을 풀어 보자');}
  if(r.final.solved || r.prize.drop>=0){
    return r.spec.id==='balance'?q('audience','마지막 문을 지나 균형의 신 만나기',point(0,-57),'신에게 다가가기'):q('prize','지혜의 구슬 받아 수첩에 기록하기',r.prize.pos.clone(),'E · 구슬 받기');
  }
  const seg=r.dungeon.rectOf('shrine');
  return q(r.spec.id+'-final',r.goals.shrine,point((seg.x0+seg.x1)/2,seg.z1-2),'장치를 살펴보고 퍼즐을 풀어 보자');
}

// A small walking grid follows open floor rectangles and avoids solid props.
// If a puzzle blocks the route, stop guidance instead of pointing through it.
export function floorRoute(from,to,rects,obstacles=[]) {
  const step=.8,key=(x,z)=>`${x},${z}`;
  const solid=(x,z,o)=>{const dx=(o.x2??o.x)-o.x,dz=(o.z2??o.z)-o.z,t=Math.max(0,Math.min(1,((x-o.x)*dx+(z-o.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-o.x-t*dx,z-o.z-t*dz)<o.r+.4;};
  const valid=(x,z)=>rects.some(r=>r.open&&x>=r.x0+.25&&x<=r.x1-.25&&z>=r.z0&&z<=r.z1)
    && !rects.some(r=>r.open===false&&x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1)
    && !obstacles.some(o=>solid(x,z,o));
  const start=[Math.round(from.x/step),Math.round(from.z/step)],queue=[start],seen=new Map([[key(...start),null]]);
  let end=null;
  for(let i=0;i<queue.length&&i<18000;i++){
    const p=queue[i];if(Math.hypot(p[0]*step-to.x,p[1]*step-to.z)<.7){end=p;break;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=[p[0]+dx,p[1]+dz],k=key(...n);if(!seen.has(k)&&[.25,.5,.75,1].every(t=>valid((p[0]+dx*t)*step,(p[1]+dz*t)*step))){seen.set(k,p);queue.push(n);}}
  }
  if(!end)return [];
  const path=[];for(let p=end;p;p=seen.get(key(...p)))path.push(new THREE.Vector3(p[0]*step,from.y,p[1]*step));
  return path.reverse();
}

export function buildQuestGuide(getGame) {
  const style=document.createElement('style');style.textContent=`
  #questGuide{position:fixed;top:calc(12px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(440px,calc(100% - 300px));z-index:30;font:14px system-ui;color:#fff3d1;text-align:center}
  #questGuide[hidden],#questGuide [hidden]{display:none!important}
  #questGuide button{width:100%;min-height:52px;border:1px solid #d6b87888;border-radius:14px;background:linear-gradient(120deg,#102732ef,#29403aeb);color:inherit;padding:8px 16px;cursor:pointer;font:inherit;box-shadow:0 4px 20px #0004}
  #questGuide button:focus-visible{outline:3px solid #ffe1a2;outline-offset:3px}#questGuide small{display:block;font-size:11px;color:#cfc8ad;margin-bottom:3px}#questText{display:block}
  #questDirection{margin:8px auto;padding:5px 12px;border-radius:20px;background:#12242bd9;width:fit-content;max-width:100%;font-size:12px}#questArrow{display:inline-block;font-size:25px;color:#ffe09a;text-shadow:0 0 12px #ffc760;vertical-align:middle;margin-right:9px}#questSparks{color:#edc478;animation:questGlow 1.6s ease-in-out infinite;margin-right:7px}@keyframes questGlow{50%{opacity:.3}}@media(prefers-reduced-motion:reduce){#questSparks{animation:none}}
  @media(max-width:650px){#questGuide{top:calc(108px + env(safe-area-inset-top));width:calc(100% - 32px);font-size:13px}#questGuide button{padding:7px 12px;min-height:48px}}
  `;document.head.appendChild(style);
  const el=document.createElement('section');el.id='questGuide';el.hidden=true;el.setAttribute('aria-label','현재 퀘스트');
  el.innerHTML='<button type="button" aria-pressed="false"><small>현재 퀘스트 · 눌러서 길 안내</small><span id="questText" aria-live="polite"></span></button><div id="questDirection" hidden><span id="questSparks" aria-hidden="true">✦ ·</span><span id="questArrow" aria-hidden="true">↑</span><span id="questDistance"></span></div>';document.body.appendChild(el);
  const button=el.querySelector('button'),label=el.querySelector('#questText'),arrow=el.querySelector('#questArrow'),direction=el.querySelector('#questDirection'),detail=el.querySelector('#questDistance');
  const trail=new THREE.Group();trail.name='퀘스트 길잡이';
  const shape=new THREE.Shape();shape.moveTo(0,.24);shape.lineTo(.19,-.12);shape.lineTo(0,-.02);shape.lineTo(-.19,-.12);shape.closePath();
  const geo=new THREE.ShapeGeometry(shape);
  for(let i=0;i<3;i++){const m=new THREE.MeshBasicMaterial({color:0xffdc87,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false});m.userData.outlineParameters={visible:false};trail.add(new THREE.Mesh(geo,m));}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let clock=0;
  let enabled=false,lastId='',timer=0,path=[],quest;
  button.addEventListener('pointerdown',e=>e.stopPropagation());
  button.addEventListener('click',()=>{enabled=!enabled;timer=0;getGame().input.reset();button.setAttribute('aria-pressed',String(enabled));});
  return {get enabled(){return enabled;},get current(){return quest;},update(dt,hidden=false){
    trail.visible=false;clock+=dt;
    const g=getGame();quest=currentQuest(g);el.hidden=hidden||!quest;if(el.hidden)return;
    if(quest.id!==lastId){lastId=quest.id;label.textContent=quest.text;timer=0;}
    button.querySelector('small').textContent=enabled?'현재 퀘스트 · 안내 끄기':'현재 퀘스트 · 눌러서 길 안내';
    direction.hidden=!enabled;if(!enabled)return;
    if(!quest.target){arrow.hidden=true;detail.textContent=quest.hint;return;}
    const actor=g.mode==='planet'?g.player:g.roomActor,from=actor.position,up=g.mode==='planet'?from.clone().normalize():new THREE.Vector3(0,1,0);
    let target=quest.target,dist=g.mode==='planet'?from.angleTo(target)*from.length():from.distanceTo(target);
    if(dist<(g.mode==='lab'?.65:1.8)){arrow.hidden=true;detail.textContent=quest.hint;return;}
    if(g.mode!=='planet'){
      timer-=dt;if(timer<=0){path=floorRoute(from,target,actor.rects,actor.obstacles);timer=.65;}
      while(path.length>1&&from.distanceTo(path[0])<1)path.shift();
      if(!path.length){arrow.hidden=true;detail.textContent='주변 장치와 열린 통로를 살펴보자';return;}
      target=path[Math.min(1,path.length-1)];
    }
    const forward=new THREE.Vector3();g.engine.camera.getWorldDirection(forward);forward.addScaledVector(up,-forward.dot(up)).normalize();
    const right=forward.clone().cross(up).normalize(),toward=target.clone().sub(from);toward.addScaledVector(up,-toward.dot(up)).normalize();
    if(toward.lengthSq()>.1){
      if(trail.parent!==g.engine.scene)g.engine.scene.add(trail);trail.visible=true;
      trail.children.forEach((mesh,i)=>{
        const offset=Math.min(.7+i*.45,from.distanceTo(target)),p=from.clone().addScaledVector(toward,offset);
        const normal=g.mode==='planet'?p.clone().normalize():up;
        if(g.mode==='planet')p.copy(g.planet.surfaceAt(normal));else p.y=actor.floorAt(p.x,p.z);
        mesh.position.copy(p).addScaledVector(normal,.09);
        const tangent=toward.clone().addScaledVector(normal,-toward.dot(normal)).normalize();
        mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent.clone().cross(normal).normalize(),tangent,normal));
        mesh.material.opacity=reduced.matches?.8:.55+.3*Math.sin(clock*4-i);
      });
    }
    arrow.hidden=false;arrow.style.transform=`rotate(${Math.atan2(toward.dot(right),toward.dot(forward))}rad)`;
    detail.textContent=g.mode==='planet'?`목적지 방향 · 약 ${Math.ceil(dist)}걸음`:'열린 통로를 따라 이동';
  }};
}
