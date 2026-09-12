const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5512');await p.waitForFunction(()=>window.game,null,{timeout:90000});await p.locator('#title .go').click();
const result=await p.evaluate(()=>{
 game.loop.stop();game.dialogue.close();game.brief.hide();game.enterShrine(game.shrines.shrines[0]);
 const r=game.room,g=r.gates[0].gate;g.select(3);g.stock.slice(0,3).forEach((b,i)=>b.at=i);g.solved=true;r.gates[0].solved=true;r.dungeon.resetDoors();
 game.input.setTestIntent({});for(let i=0;i<85;i++){game.dialogue.close();game.brief.hide();game.step(1/60);}
 const repaired=r.dungeon.doors.r1.rect.open;game.exitShrine();game.landOnPlanet();game.dialogue.close();game.brief.hide();
 const w=game.waterway,save=w.exportState(),restored=w.importState(save);
 game.player.position.copy(game.planet.surfaceAt(game.firstTrail.gateDir));game.player._initFrame();game.player.resetTraversal();
 const prompt=game.firstTrail.getPrompt(game.player.position),removed=!game.planetScene.getObjectByName('thawing-waterway'),noDevice=w.getPrompt(game.player.position)===null&&!w.held;
 game.input.setTestIntent({action:true});game.step(1/60);
 return {repaired,restored,removed,noDevice,prompt,mode:game.mode,unthawed:!w.solved};
});assert(result.repaired&&result.restored&&result.removed&&result.noDevice&&result.unthawed&&result.prompt.includes('들어가기')&&result.mode==='room',JSON.stringify(result));assert.deepEqual(errors,[]);fs.writeFileSync('reports/2026-09-12/evidence/balance-order/entry-check.json',JSON.stringify({result,errors},null,2));console.log('PASS stale completed door reopens; unthawed water entrance admits player using action input',result);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
