// Q/R and touch buttons enqueue the same one-shot intent. No UI-only puzzle mutation.
export function buildWaterBracelet(getGame){
  const style=document.createElement('style');style.textContent=`
  #waterBracelet[hidden]{display:none!important}
  #waterBracelet{position:fixed;left:18px;bottom:110px;z-index:31;width:286px;box-sizing:border-box;padding:13px 14px;border:1px solid #c8ae7280;border-radius:16px;background:linear-gradient(135deg,#122d3ded,#1c4650ed);box-shadow:0 8px 24px #0005;color:#fff2d2;font:15px/1.5 system-ui,'Malgun Gothic',sans-serif;touch-action:manipulation}
  #waterBracelet strong{font-size:16px}#waterBracelet .water-target{margin:5px 0 9px;min-height:22px;color:#c8eef1;font-size:14px}
  #waterBracelet .water-actions{display:flex;gap:9px}#waterBracelet button{appearance:none;cursor:pointer;border:1px solid #b7cacc80;border-radius:10px;background:#12313b;color:#edf7f3;font:600 14px/1.25 system-ui;padding:11px 8px;min-height:46px;flex:1}
  #waterBracelet button[data-power=heat]{color:#ffdfb4;background:#573c2a}#waterBracelet button[data-power=cool]{color:#dbf8ff;background:#254b66}
  #waterBracelet button:disabled{opacity:.42;cursor:default}#waterBracelet button:focus-visible{outline:3px solid #ffe6a0;outline-offset:3px}
  #waterBracelet .water-tools{display:flex;gap:8px;margin-top:9px}#waterBracelet .water-tools button{background:transparent;padding:6px;min-height:36px;font-size:12px;color:#d2d9c8}
  #waterBracelet output{display:block;margin-top:7px;font-size:13px;color:#ffe6a5}#waterBracelet output:empty{display:none}
  @media(max-width:650px){#waterBracelet{left:10px;bottom:calc(87px + env(safe-area-inset-bottom));width:222px;padding:10px;font-size:13px}#waterBracelet strong{font-size:14px}#waterBracelet .water-target{font-size:12px;margin:3px 0 6px}#waterBracelet button{padding:10px 6px;font-size:13px}#waterBracelet .water-tools button{font-size:11px;min-height:34px}}
  @media(max-height:520px){#waterBracelet{width:222px;bottom:calc(70px + env(safe-area-inset-bottom));padding:8px}#waterBracelet strong{font-size:14px}#waterBracelet .water-target{font-size:12px;margin:3px 0 6px}#waterBracelet button{font-size:12px;min-height:40px;padding:8px 5px}#waterBracelet .water-tools button{font-size:11px;min-height:32px}#waterBracelet output{max-height:52px;overflow:auto;font-size:11px}}
  `;document.head.appendChild(style);
  const el=document.createElement('section');el.id='waterBracelet';el.setAttribute('aria-label','물의 팔찌');el.hidden=true;
  el.innerHTML='<strong>물의 팔찌</strong><div class="water-target"></div><div class="water-actions"><button type="button" data-power="heat" aria-keyshortcuts="Q">Q · 데우기</button><button type="button" data-power="cool" aria-keyshortcuts="R">R · 식히기</button></div><div class="water-tools"><button type="button" data-tool="recover">물 되돌리기</button><button type="button" data-tool="hint">힌트 펼치기</button></div><output aria-live="polite"></output>';
  document.body.appendChild(el);const heat=el.querySelector('[data-power=heat]'),cool=el.querySelector('[data-power=cool]'),out=el.querySelector('output');let current=null,lastRoom=null;
  el.addEventListener('pointerdown',e=>e.stopPropagation());el.addEventListener('click',e=>{const button=e.target.closest('button');if(!button||el.hidden||button.disabled)return;const g=getGame();
    if(button.dataset.power)g.input.requestWaterPower(button.dataset.power);
    else if(button.dataset.tool==='recover'){g.input.requestWaterTool('recover');out.textContent='';}
    else g.input.requestWaterTool('hint');
  });
  return {el,update(blocked=false){const g=getGame(),room=g.room,trial=g.mode==='room'&&room?.waterAdventure?room.activeTrial(g.roomActor):null;
    el.hidden=blocked||!trial||trial.state.completed||!room.bracelet;
    if(lastRoom!==room){out.textContent='';lastRoom=room;}
    current=trial;if(el.hidden)return;
    const target=trial.target(g.roomActor),s=trial.state,busy=!!s.transition||!!s.motion;
    const phase={ice:'얼음 · 옮기고 밟기',liquid:'물 · 낮은 곳으로 흐르기',vapour:'기체 · 상승 통로로 이동'}[s.phase];
    el.querySelector('.water-target').textContent=target?(busy?'물이 변하고 있다':phase):'가까운 물을 바라보자';
    heat.disabled=!target||busy||s.phase==='vapour';cool.disabled=!target||busy||s.phase==='ice';
    const mobile=g.touch.visible;heat.textContent=mobile?'☀ 데우기':'Q · 데우기';cool.textContent=mobile?'❄ 식히기':'R · 식히기';
    if(s.bonus)el.querySelector('strong').textContent='물의 팔찌 · 물결 조각 발견';else el.querySelector('strong').textContent='물의 팔찌';
  },showHint(text){out.textContent=text;},get trial(){return current;}};
}
