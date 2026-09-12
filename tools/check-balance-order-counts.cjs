const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const out='reports/2026-09-12/evidence/balance-order';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5512');await p.waitForFunction(()=>window.game,null,{timeout:90000});await p.locator('#title .go').click();
await p.evaluate(()=>{game.dialogue.close();game.brief.hide();game.enterShrine(game.shrines.shrines[0]);game.loop.stop();window.orderTest={
 tick(n=1,intent={}){for(let i=0;i<n;i++){game.dialogue.close();game.brief.hide();game.input.setTestIntent(intent);game.step(1/60);}},
 walk(x,z){let n=0;const a=game.roomActor;while(Math.hypot(x-a.position.x,z-a.position.z)>.1&&n++<2400){a.camYaw=Math.atan2(-(x-a.position.x),-(z-a.position.z));this.tick(1,{y:1});}if(n>=2400)throw Error('Walk blocked '+[x,z,...a.position.toArray()]);this.tick();},act(){this.tick(1,{action:true});this.tick();}
};});
const results=[];
for(const count of [3,4,5]){
 const result=await p.evaluate(count=>{const r=game.room,g=r.gates[0].gate,t=orderTest;r.restart();r.hasProgress=true;game.roomActor.setAt(0,10);t.walk(g.choices.find(c=>c.n===count).x,4.2);t.act();if(g.count!==count)throw Error('Selection failed');
 for(let i=0;i<count;i++){const h=g.stock[i].home;t.walk(5.5,3.5);t.walk(h.x,h.z+.8);t.act();if(g.held!==i)throw Error('Pickup failed '+i);t.walk(5.5,3.5);t.walk(5.5,-8.1);t.walk(g.cells[i].x,-8.1);t.act();if(g.stock[i].at!==i)throw Error('Place failed '+i);}
 t.tick(80);const door=r.dungeon.doors.r1,solved=g.solved,open=door.rect.open;
 t.walk(5.5,-9);t.walk(0,-10);t.walk(0,-18);
 const save=r.exportState(game.roomActor),restored=r.importState(save);t.tick(80);
 return {count,solved,open,at:g.state().at,z:game.roomActor.position.z,restored,restoredOpen:door.rect.open};},count);
 results.push(result);assert(result.solved&&result.open&&result.z<=-17&&result.restored&&result.restoredOpen,JSON.stringify(result));
 await p.evaluate(()=>game.engine.render());await p.screenshot({path:`${out}/${count}-passed.png`});console.log('PASS '+count+' boxes, actual E placement, doorway crossing and save/restore');
}
assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/report.json`,JSON.stringify({results,errors},null,2));
const edge=await p.evaluate(()=>{const r=game.room,g=r.gates[0].gate;r.restart();g.select(3);
 g.stock[0].at=1;g.stock[1].at=0;g.stock[2].at=2;orderTest.tick(2);const wrongBlocked=!g.solved&&!r.dungeon.doors.r1.opened&&g.orderStatus().includes('순서가 달라요');
 g.stock[0].at=0;g.stock[1].at=1;g.stock[2].at=5;orderTest.tick(2);const panBlocked=!g.solved&&!r.dungeon.doors.r1.opened;
 g.stock[2].at=2;g.solved=false;orderTest.tick(80);return {wrongBlocked,panBlocked,reconciled:g.solved&&r.dungeon.doors.r1.rect.open};});
assert(Object.values(edge).every(Boolean),JSON.stringify(edge));fs.writeFileSync(`${out}/report.json`,JSON.stringify({results,edge,errors},null,2));console.log('PASS incorrect order and scale pans stay blocked; correct layout reconciles and opens door');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
