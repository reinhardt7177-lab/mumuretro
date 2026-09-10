const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
for(const mobile of [false,true]){
 const c=await b.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5512');await p.waitForFunction(()=>window.game);assert(await p.locator('#questGuide').isHidden());
 await p.locator('#title .go').click();await p.evaluate(()=>{game.dialogue.close();game.brief.hide();});
 await p.locator('#questGuide').waitFor({state:'visible'});
 assert.match(await p.locator('#questText').innerText(),/소포 건져/);
 const before=await p.evaluate(()=>JSON.stringify(game.snapshot()));
 if(mobile)await p.locator('#questGuide button').tap();else await p.locator('#questGuide button').click();
 await p.waitForFunction(()=>!document.querySelector('#questDirection').hidden);
 assert.equal(await p.evaluate(()=>JSON.stringify(game.snapshot())),before);
 assert.equal(await p.locator('#questGuide button').getAttribute('aria-pressed'),'true');
 assert(!(await p.locator('#questArrow').isHidden()));
 const box=await p.locator('#questGuide').boundingBox();assert(box.x>=0&&box.x+box.width<=(mobile?390:1440));
 fs.mkdirSync('reports/2026-09-10/evidence/quest-guide',{recursive:true});await p.screenshot({path:`reports/2026-09-10/evidence/quest-guide/${mobile?'mobile':'desktop'}.png`});
 await p.evaluate(()=>game.shipView.open());assert(await p.locator('#questGuide').isHidden());await p.evaluate(()=>game.shipView.close());
 const results=await p.evaluate(async()=>{
   game.loop.stop();const {currentQuest,floorRoute}=await import('/src/ui/QuestGuide.js');const T=await import('three');
   const q=()=>currentQuest(game).id,ids=[q()];
   game.lab.interact(new T.Vector3(4.3,0,4));ids.push(q());game.lab.update(2);ids.push(q());
   game.lab.interact(new T.Vector3(.4,0,0));ids.push(q());game.lab.markRead();ids.push(q());
   game.lab.state.open=true;ids.push(q());game.landOnPlanet();game.dialogue.close();ids.push(q());game.questGuide.update(1);
   game.player.position.copy(game.shrines.shrines[5].pos);const lockedSkipped=q()!=='visit-5';
   game.enterShrine(game.shrines.shrines[0]);game.dialogue.close();game.brief.hide();ids.push(q());
   game.room.gates[0].solved=true;ids.push(q());game.room.gates[1].solved=true;ids.push(q());game.room.final.solved=true;ids.push(q());
   const rect=[{x0:-4,x1:4,z0:-8,z1:8,open:true},{x0:-4,x1:4,z0:-.5,z1:.5,open:false}],a=new T.Vector3(0,0,6),z=new T.Vector3(0,0,-6);
   const blocked=floorRoute(a,z,rect).length;rect[1].open=true;
   const around=floorRoute(a,z,rect,[{x:0,z:0,r:1.5}]);
   return {ids,blocked,around:around.length,avoids:around.every(v=>Math.hypot(v.x,v.z)>=1.9),lockedSkipped};
 });
 assert.deepEqual(results.ids.slice(0,6),['recover','recovering','parcel','read','navigation','depart']);
 assert.match(results.ids[6],/^visit-/);assert.deepEqual(results.ids.slice(7),['balance-r1','balance-r2','balance-final','audience']);
 assert.equal(results.blocked,0);assert(results.around>0&&results.avoids&&results.lockedSkipped);assert.deepEqual(errors,[]);
 console.log('PASS '+(mobile?'mobile':'desktop')+' quest progression, toggle, save unchanged, overlay, viewport, closed door and obstacle routing, no errors');await c.close();
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
