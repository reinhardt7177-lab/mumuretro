// Keep historical checks intact; retain the current executed source alongside evidence.
const assert=require('node:assert/strict');
module.exports=function adapt(name,source,adaptations){
  if(name==='check-adventure-interiors.cjs'){
    const from='t.walk(g.choices.find(c=>c.n===3).x,4.2);t.act();';assert(source.includes(from));
    source=source.replace(from,'t.walk(g.choices.find(c=>c.n===3).x,5.2);t.act();t.walk(2.6,5.2);t.walk(2.6,3.5);');
    adaptations.push('actual count selection stands at physical front5.2 and walks around the new solid pedestal; all solve/signal/geometry assertions retained');
  }
  if(name==='check-moon-courts.cjs'){
    const from='state.every(r=>r.version===2&&r.valid&&r.restore!==false&&r.same)';
    assert(source.includes(from));
    source=source.replace(from,'state.every((r,i)=>r.version===[2,2,3][i]&&r.valid&&r.restore!==false&&r.same)');
    const old='r.gates.every(v=>v.gate.progressCodec.capture().version===2)';assert(source.includes(old));
    source=source.replace(old,'r.gates.every((v,i)=>v.gate.progressCodec.capture().version===[2,2,3][i])');
    assert(source.includes('**/moon-courts-v01.glb'));
    source=source.replaceAll('**/moon-courts-v01.glb','**/moon-courts-v02.glb');
    adaptations.push('fresh saves have exact versions[2,2,3]; optional architecture failure targets the actually loaded v02; all216 camera assertions retained');
  }
  if(name==='check-shadow-journey.cjs'){
    const start=source.indexOf('const screen=await p.evaluate('),end=source.indexOf('const guardian=',start);
    assert(start>=0&&end>start);
    source=source.slice(0,start)+`
const screen=await p.evaluate(()=>{
 const g=game.room.gates[2].gate,a=game.roomActor;sj.walk(.6,g.seg.z1-1);const rounds=[];
 for(let stage=0;stage<2;stage++){
  const handle=g.theatre.handle();sj.walk(handle.x,g.objZ+.5);sj.act();if(!g.held)throw Error('Panel was not grabbed');
  sj.walk(handle.x,g.theatre.target().position+g.dragOffset);sj.tick(2);rounds.push(g.round);
 }
 const before=g.theatre.status();if(!g.held||g.solved||!before.sizeMatch||before.spacingMatch)throw Error('Second condition did not remain meaningful');
 sj.act();if(g.held)throw Error('Panel was not released');const carriage=g.objZ,w=g.theatre.wheel.position;
 sj.walk(.6,a.position.z);sj.walk(.6,w.z+.55);sj.walk(w.x,w.z+.55);
 const prompt=document.querySelector('#prompt').textContent;let turns=0;while(!g.solved&&turns<3){sj.act();turns++;}
 rounds.push(g.round);const unchanged=Math.abs(carriage-g.objZ)<1e-7;
 sj.walk(.6,a.position.z);sj.walk(.6,g.seg.z0-1);game.save();sj.render();
 return{rounds,turns,prompt,unchanged,version:g.progressCodec.capture().version,valid:g.progressCodec.valid(g.progressCodec.capture()),solved:game.room.gates[2].solved,held:g.held,all:game.room.gates.every(g=>g.solved),z:a.position.z,frames:sj.frames,maxExposure:sj.maxExposure,positions:sj.positions,raw:localStorage.getItem('mumuplanet.progress.v1')};
});
check('continue to panel and lamp wheel, combine two conditions and reach final bridge',screen.all&&JSON.stringify(screen.rounds)==='[1,1,2]'&&!screen.held&&screen.unchanged&&screen.turns>0&&screen.turns<=3&&screen.prompt.includes('등불 간격')&&screen.version===3&&screen.valid,screen);
await p.screenshot({path:path.join(OUT,'actual-third-door.png')});
`+source.slice(end);
    adaptations.push('actual input solves fresh single-source then dual-source stages; require width alone to fail, release panel, walk to wheel, use E, cross door; no completion flags injected');
  }
  return source;
};
