const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const out='reports/2026-09-10/evidence/water-phases';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5512');await p.waitForFunction(()=>window.game,null,{timeout:90000});await p.locator('#title .go').click();
 await p.evaluate(()=>{game.loop.stop();game.dialogue.close();game.brief.hide();game.landOnPlanet();game.dialogue.close();game.enterShrine(game.shrines.shrines[3]);game.dialogue.close();game.brief.hide();});
 await p.evaluate(()=>{window.phaseTest={
  tick(n=1,intent={}){for(let i=0;i<n;i++){game.dialogue.close();game.brief.hide();game.input.setTestIntent(intent);game.step(1/60);}},
  walk(x,z){let n=0;const a=game.roomActor;while(Math.hypot(a.position.x-x,a.position.z-z)>.16&&n++<2000){a.camYaw=Math.atan2(-(x-a.position.x),-(z-a.position.z));this.tick(1,{y:1,run:true});}if(n>=2000)throw Error(`Blocked ${x},${z}, now ${a.position.toArray()}`);this.tick(1);},
  control(g,id,times=1){const c=g.controls.find(c=>c.id===id);this.walk(c.p.x,c.p.z+.55);for(let i=0;i<times;i++){this.tick(1,{action:true});this.tick(1);}},
  render(){const a=game.roomActor;a.camYaw=0;game.input.camPitch=.4;game.input.camDist=8;a._camPlaced=false;a.updateCamera(game.engine.camera,game.input,0);game.engine.render();}
 };});
 const negatives=await p.evaluate(async()=>{const {initialPhaseState,advancePhase}=await import('/src/shrine/WaterPhases.js');
  const empty=initialPhaseState('bridge');empty.freeze=true;advancePhase(empty,'bridge',30);
  const heat=initialPhaseState('condenser');heat.heat=1;advancePhase(heat,'condenser',30);
  const miss={...heat,cool:true,align:0};advancePhase(miss,'condenser',30);
  const noBridge={...initialPhaseState('restore'),plug:0,water:1,heat:2,cool:true,align:2};advancePhase(noBridge,'restore',30);
  return {emptyIce:empty.ice,heatTank:heat.tank,missTank:miss.tank,noBridgeTank:noBridge.tank};});
 assert(Object.values(negatives).every(v=>v===0));
 await p.evaluate(()=>{const g=game.room.gates[0].gate;phaseTest.control(g,'freeze');phaseTest.tick(90);if(g.state.ice!==0)throw Error('Empty ditch froze');phaseTest.control(g,'heat');phaseTest.tick(420);phaseTest.render();});
 await p.screenshot({path:`${out}/01-bridge.png`});
 await p.evaluate(()=>{const g=game.room.gates[0].gate;phaseTest.tick(180);phaseTest.walk(0,g.seg.z0+.7);phaseTest.walk(0,game.room.gates[1].gate.seg.z1-1.2);});
 assert(await p.evaluate(()=>game.room.gates[0].solved));
 await p.evaluate(()=>{const g=game.room.gates[1].gate;phaseTest.control(g,'heat');phaseTest.control(g,'cool');phaseTest.tick(120);if(g.state.tank!==0)throw Error('Missed drops filled tank');phaseTest.control(g,'align',2);phaseTest.tick(150);phaseTest.render();});
 await p.screenshot({path:`${out}/02-condensation.png`});
 const saved=await p.evaluate(()=>{const s=game.room.exportState(game.roomActor),before=JSON.stringify(s);const bad=JSON.parse(before);bad.devices[2].tank=NaN;const rejected=!game.room.importState(bad);const unchanged=JSON.stringify(game.room.exportState(game.roomActor))===before;const ok=game.room.importState(s);game.room.resume(game.roomActor);return {s,ok,rejected,unchanged,restored:game.room.gates[1].gate.state.tank};});
 assert(saved.ok&&saved.rejected&&saved.unchanged);assert.equal(saved.restored,saved.s.devices[1].tank);
 await p.evaluate(()=>{phaseTest.tick(400);phaseTest.walk(0,game.room.gates[2].gate.seg.z1-1.2);const g=game.room.gates[2].gate;phaseTest.control(g,'heat');phaseTest.control(g,'freeze');phaseTest.tick(550);
  phaseTest.walk(-8,g.seg.z1-2);phaseTest.control(g,'cool');phaseTest.walk(-8,g.seg.z1-16);phaseTest.walk(8,g.seg.z1-16);phaseTest.control(g,'align',2);
  phaseTest.walk(8,g.seg.z1-2);phaseTest.control(g,'heat');phaseTest.tick(180);phaseTest.render();});
 await p.screenshot({path:`${out}/03-restoration.png`});
 await p.evaluate(()=>{phaseTest.tick(240);phaseTest.walk(0,game.room.shrineSeg.z1-3.3);phaseTest.tick(1,{action:true});phaseTest.tick(330);phaseTest.render();});
 await p.screenshot({path:`${out}/04-awakening.png`});
 const end=await p.evaluate(()=>({solved:game.room.gates.map(g=>g.solved),final:game.room.final.solvedBy(),drop:game.room.prize.drop}));
 assert(end.solved.every(Boolean)&&end.final&&end.drop>=0);assert.deepEqual(errors,[]);
 const migration=await p.evaluate(()=>{
  const r=game.room,old={version:1,tier:2,solved:[true,true,false],freeze:Array.from({length:3},()=>({base:4,phase:'water',t:0})),holes:Array.from({length:4},()=>({x:2,z:-20,r:1.5})),steam:{ti:1,wants:['ice','water','steam'],filled:[true,true,false],bridge:1},final:{si:0,got:0,want:1,flash:0},prize:{taken:false,drop:-1,t:0},hints:Object.fromEntries(Object.keys(r.hints).map(k=>[k,{level:k==='shrine'?3:0,t:0}])),checkpoint:{x:8,y:3,z:r.gates[2].gate.seg.z1-12,yaw:0}};
  const ok=r.importState(old),credited=r.gates[0].solved&&r.gates[1].solved&&r.gates[2].gate.state.tank===.5&&r.gates[2].gate.state.bridgeReady;
  const backup=JSON.stringify(r.exportState().legacyWater)===JSON.stringify(old),roundtrip=r.importState(r.exportState());
  old.solved=[true,true,true];old.steam.filled=[true,true,true];old.final.got=3;old.prize.taken=true;const done=r.importState(old)&&r.final.solved&&r.prize.taken;
  return {ok,credited,backup,roundtrip,done};
 });assert(Object.values(migration).every(Boolean),JSON.stringify(migration));
 fs.writeFileSync(`${out}/report.json`,JSON.stringify({negatives,saved:{ok:saved.ok,rejected:saved.rejected,unchanged:saved.unchanged},migration,end,errors},null,2));
 console.log('PASS water phase dependencies, actual walking through three rooms, intermediate save, atomic rejection, final awakening, no errors');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
