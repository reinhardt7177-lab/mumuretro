const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5512');await p.waitForFunction(()=>window.game,null,{timeout:90000});await p.locator('#title .go').tap();
 await p.evaluate(async()=>{const {PORTAL_CODE}=await import('/src/world/Lab.js');game.dialogue.close();game.brief.hide();game.lab.importState({...game.lab.exportState(),hasNote:true,read:true,open:true,parcelRecovered:true,dials:PORTAL_CODE});game.notebook.setHas(true);game.landOnPlanet();game.dialogue.close();game.enterShrine(game.shrines.shrines[3]);game.dialogue.close();game.brief.hide();const g=game.room.gates[0].gate,c=g.controls[0];game.roomActor.setAt(c.p.x,c.p.z+.6);});
 await p.waitForTimeout(800);await p.evaluate(()=>{game.dialogue.close();game.brief.hide();});
 await p.locator('#tcAct').waitFor({state:'visible'});await p.locator('#tcAct').tap();
 await p.waitForFunction(()=>game.room.gates[0].gate.state.heat===1);await p.waitForTimeout(700);
 const before=await p.evaluate(()=>{game.loop.stop();const s=game.room.gates[0].gate.state;const ok=game.save(true);return{ok,plug:s.plug,heat:s.heat};});assert(before.ok&&before.plug<1&&before.plug>0);
 fs.mkdirSync('reports/2026-09-10/evidence/water-phases',{recursive:true});await p.screenshot({path:'reports/2026-09-10/evidence/water-phases/mobile.png'});
 await p.reload();await p.waitForFunction(()=>window.game,null,{timeout:90000});
 if(await p.locator('#title .go').isVisible())await p.locator('#title .go').tap();
 await p.waitForFunction(()=>game.mode==='room'&&game.room.spec.id==='water');
 const after=await p.evaluate(()=>{game.loop.stop();return{version:game.room.exportState().version,...game.room.gates[0].gate.state};});assert.equal(after.version,2);assert.equal(after.heat,1);assert(after.plug<=before.plug+.01);assert.deepEqual(errors,[]);
 fs.writeFileSync('reports/2026-09-10/evidence/water-phases/mobile.json',JSON.stringify({before,after,errors},null,2));console.log('PASS mobile actual action button, partial melting, full game save/reload, no errors');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
