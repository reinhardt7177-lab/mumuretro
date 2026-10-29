export function installFieldHud(){
  const root=document.body,quest=document.getElementById('questGuide'),prompt=document.getElementById('prompt'),note=document.getElementById('note'),water=document.getElementById('waterBracelet');
  const visible=el=>el&&!el.hidden&&(!['prompt','note'].includes(el.id)||el.classList.contains('show'));
  let scheduled=false,lastState='';
  function update(){scheduled=false;root.classList.toggle('water-hud',visible(water));const q=visible(quest)?quest.getBoundingClientRect().bottom:64,p=visible(prompt)?prompt.offsetHeight:0;root.style.setProperty('--hud-prompt-top',`${Math.ceil(q+8)}px`);root.style.setProperty('--hud-note-top',`${Math.ceil(q+8+(p?p+8:0))}px`);root.style.setProperty('--hud-note-bottom',`${Math.ceil(q+8+(p?p+8:0)+(visible(note)?note.offsetHeight:0))}px`);root.style.setProperty('--hud-water-top',`${Math.ceil((visible(note)?note.getBoundingClientRect().bottom:56)+8)}px`);}
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(update);}}
  const sizes=new ResizeObserver(schedule);for(const el of[quest,prompt,note,water])if(el)sizes.observe(el);
  const state=new MutationObserver(()=>{const next=[quest?.hidden,prompt?.className,note?.className,water?.hidden].join('/');if(next!==lastState){lastState=next;schedule();}});for(const el of[quest,prompt,note,water])if(el)state.observe(el,{attributes:true,attributeFilter:['class','hidden']});
  addEventListener('resize',schedule);schedule();return{update};
}
