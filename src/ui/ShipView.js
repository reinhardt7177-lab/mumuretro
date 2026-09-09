import { registerOverlay, soloOpen, hasOpenOverlay } from './overlay.js';

export function buildShipView({camera,input,available}) {
  const style=document.createElement('style');style.textContent=`
  #shipViewButton{position:fixed;left:16px;top:calc(58px + env(safe-area-inset-top));z-index:32;border:1px solid #9dbfc477;border-radius:22px;padding:11px 16px;background:#122632dc;color:#e7eee4;cursor:pointer}
  #shipViewButton[hidden],#shipView[hidden]{display:none}
  #shipView{position:fixed;inset:0;z-index:100;touch-action:none;outline:none}
  #shipView .bar{position:absolute;bottom:calc(20px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100% - 24px);box-sizing:border-box;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:12px;border:1px solid #9dbfc466;border-radius:18px;background:#10222be8;color:#edf5ee;font:14px system-ui}
  #shipView p{width:100%;text-align:center;margin:0 0 4px}#shipView button{min-height:44px;min-width:44px;border:1px solid #9dbfc455;border-radius:10px;background:#294550;color:white;padding:8px 12px;cursor:pointer}
  body.ship-view #touchUI,body.ship-view #mute,body.ship-view #gfx,body.ship-view #hint{visibility:hidden!important}
  #shipView button:focus-visible,#shipViewButton:focus-visible{outline:3px solid #9ee9dd;outline-offset:3px}`;document.head.appendChild(style);
  const button=document.createElement('button');button.id='shipViewButton';button.textContent='⛵ 배 관찰';button.hidden=true;button.setAttribute('aria-haspopup','dialog');document.body.appendChild(button);
  const panel=document.createElement('div');panel.id='shipView';panel.hidden=true;panel.tabIndex=-1;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','배 관찰');
  panel.innerHTML='<div class="bar"><p>배 관찰 · 드래그로 회전 · 휠 / 두 손가락으로 확대</p><button data-act="left" aria-label="왼쪽으로 회전">↶</button><button data-act="right" aria-label="오른쪽으로 회전">↷</button><button data-act="in" aria-label="확대">＋</button><button data-act="out" aria-label="축소">−</button><button data-act="reset">전체 보기</button><button data-act="close">돌아가기 · Esc</button></div>';document.body.appendChild(panel);
  let open=false,saved,yaw=.73,pitch=.43,distance=47;const pointers=new Map();
  const draw=()=>{const fit=Math.max(1,1/Math.max(.35,camera.aspect));camera.fov=42;camera.updateProjectionMatrix();const d=distance*fit;camera.position.set(Math.sin(yaw)*Math.cos(pitch)*d,3+Math.sin(pitch)*d,Math.cos(yaw)*Math.cos(pitch)*d);camera.lookAt(0,3,0);};
  const reset=()=>{yaw=.73;pitch=.43;distance=47;draw();};
  const close=()=>{if(!open)return;open=false;pointers.clear();panel.hidden=true;document.body.classList.remove('ship-view');camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);camera.fov=saved.fov;camera.updateProjectionMatrix();input.reset();button.setAttribute('aria-expanded','false');button.focus();};
  const me=registerOverlay({get isOpen(){return open;},close});
  const enter=()=>{if(!available()||open)return;soloOpen(me);saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};input.reset();open=true;panel.hidden=false;document.body.classList.add('ship-view');button.setAttribute('aria-expanded','true');reset();panel.querySelector('[data-act="close"]').focus();};
  button.addEventListener('click',enter);button.addEventListener('pointerdown',e=>e.stopPropagation());
  const zoom=delta=>{distance=Math.max(24,Math.min(72,distance+delta));draw();};
  panel.addEventListener('click',e=>{const a=e.target.dataset.act;if(a==='close')close();if(a==='reset')reset();if(a==='left'){yaw-=.22;draw();}if(a==='right'){yaw+=.22;draw();}if(a==='in')zoom(-4);if(a==='out')zoom(4);});
  panel.addEventListener('pointerdown',e=>{if(e.target.closest('button,.bar'))return;panel.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});});
  panel.addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;const next={x:e.clientX,y:e.clientY};if(pointers.size===2){const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)[1];zoom((Math.hypot(old.x-other.x,old.y-other.y)-Math.hypot(next.x-other.x,next.y-other.y))*.07);}else{yaw-=(next.x-old.x)*.006;pitch=Math.max(-.15,Math.min(1.25,pitch+(next.y-old.y)*.005));draw();}pointers.set(e.pointerId,next);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])panel.addEventListener(event,e=>pointers.delete(e.pointerId));
  panel.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY*.025);},{passive:false});
  panel.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();yaw+=e.key==='ArrowLeft'?-.12:.12;draw();}else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();pitch=Math.max(-.15,Math.min(1.25,pitch+(e.key==='ArrowUp'?.08:-.08)));draw();}else if(e.key==='+'||e.key==='=')zoom(-3);else if(e.key==='-')zoom(3);else if(e.key==='Tab'){const items=[...panel.querySelectorAll('button')],i=items.indexOf(document.activeElement);e.preventDefault();items[(i+(e.shiftKey?-1:1)+items.length)%items.length].focus();}});
  addEventListener('resize',()=>{if(open)requestAnimationFrame(draw);});
  return {get isOpen(){return open;},open:enter,close,update(){button.hidden=!available()||open||hasOpenOverlay();if(open&&!available())close();}};
}
