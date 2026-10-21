const fs=require('node:fs'),path=require('path'),assert=require('node:assert/strict');const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{const pages=[];for(let i=0;i<3;i++){const context=await b.newContext();const p=await context.newPage();await p.goto(process.env.AUDIT_URL||'http://127.0.0.1:5512');await p.waitForFunction(()=>window.game,null,{timeout:90000});await p.locator('#title .go').click();await p.evaluate(()=>{game.dialogue.close();game.settings.setOpen(true)});pages.push(p);}await pages[0].getByRole('button',{name:'방 만들기',exact:true}).click();await pages[0].waitForFunction(()=>document.querySelector('input[aria-label="초대 코드"]').value.length===8);const code=await pages[0].getByRole('textbox',{name:'초대 코드'}).inputValue();for(const p of pages.slice(1)){await p.getByRole('textbox',{name:'초대 코드'}).fill(code);await p.getByRole('button',{name:'참여',exact:true}).click();}for(const p of pages)await p.getByText(`초대 코드 ${code} · 3/3명`,{exact:true}).waitFor();for(const p of pages)await p.getByRole('button',{name:'균형 신전 함께하기',exact:true}).click();
for(const p of pages)await p.waitForFunction(()=>game.mode==='room'&&game.room.gates[0].gate.count===3);
await pages[0].evaluate(()=>{const g=game.room.gates[0].gate;g.interact(g.stock[0].mesh.position);});
await pages[0].waitForFunction(()=>game.room.gates[0].gate.held===0);
await pages[1].waitForFunction(()=>game.room.gates[0].gate.stock[0].at===-2);
await pages[0].evaluate(()=>{const g=game.room.gates[0].gate;g.interact(g.stock[0].mesh.position.clone().set(g.cells[0].x,0,g.cells[0].z));});
for(const p of pages)await p.waitForFunction(()=>game.room.gates[0].gate.stock[0].at===0);
for(let i=1;i<3;i++){await pages[i].evaluate(i=>{const g=game.room.gates[0].gate;g.interact(g.stock[i].mesh.position)},i);await pages[i].waitForFunction(i=>game.room.gates[0].gate.held===i,i);await pages[i].evaluate(i=>{const g=game.room.gates[0].gate;g.interact(g.stock[i].mesh.position.clone().set(g.cells[i].x,0,g.cells[i].z))},i);}
for(const p of pages){await p.waitForFunction(()=>game.room.gates[0].gate.solved);await p.evaluate(()=>{for(let i=0;i<90;i++){game.dialogue.close();game.brief.hide();game.input.setTestIntent({});game.step(1/60);}});await p.waitForFunction(()=>game.room.dungeon.doors.r1.rect.open);}
for(const stage of [1,2]){
 const cells=stage===1?[0,2,3,1]:[0,2];
 for(const [box,cell]of cells.entries()){
  const p=pages[box%3];await p.evaluate(({stage,box})=>{const g=game.room.gates[stage]?.gate||game.room.final;g.interact(g.stock[box].mesh.position);},{stage,box});
  await p.waitForFunction(({stage,box})=>(game.room.gates[stage]?.gate||game.room.final).held===box,{stage,box});
  await p.evaluate(({stage,box,cell})=>{const g=game.room.gates[stage]?.gate||game.room.final;g.interact(g.stock[box].mesh.position.clone().set(g.cells[cell].x,0,g.cells[cell].z));},{stage,box,cell});
  for(const q of pages)await q.waitForFunction(({stage,box,cell})=>(game.room.gates[stage]?.gate||game.room.final).stock[box].at===cell,{stage,box,cell});
 }
 for(const p of pages)await p.waitForFunction(stage=>(game.room.gates[stage]?.gate||game.room.final).solved,stage);
}
for(const p of pages){assert.equal(await p.evaluate(()=>game.save(true)),false);await p.evaluate(()=>{
 game.loop.stop();const tick=(n=1,intent={})=>{for(let i=0;i<n;i++){while(game.dialogue.active)game.dialogue.next();game.brief.hide();game.input.setTestIntent(intent);game.step(1/60);}};
 const walk=(x,z)=>{let n=0;while(game.mode==='room'&&Math.hypot(game.roomActor.position.x-x,game.roomActor.position.z-z)>.16&&n++<2400){const a=game.roomActor;a.camYaw=Math.atan2(-(x-a.position.x),-(z-a.position.z));tick(1,{y:1,run:true});}if(n>=2400)throw Error('Coop walk blocked');tick(3);};
 tick(90);for(const [x,z]of [[0,3.8],[5.5,3.5],[5.5,-9],[0,-10],[0,-18],[5.5,-19],[5.5,-29],[0,-30],[0,-38],[6,-39],[6,-51],[0,-52],[0,-55.5],[0,-57]])if(game.mode==='room')walk(x,z);tick(10);
 });assert.equal(await p.evaluate(()=>game.mode),'lab');assert.equal(await p.evaluate(()=>game.shrines.shrines[0].cleared),false);assert.equal(await p.evaluate(()=>game.dialogue.hasSeen('balance-audience-v2')),false);assert.equal(await p.evaluate(()=>game.snapshot().shrineRuns.rooms.balance),undefined);}
const out=path.resolve('reports/2026-10-21/evidence/app-completion');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'classroom-browser.json'),JSON.stringify({pass:true,url:process.env.AUDIT_URL||'http://127.0.0.1:5512',clients:3,date:new Date().toISOString(),checks:['three independent browser contexts create and join by visible room code','shared ownership and placements in all three stages','actual walk through opened doors to guardian','return to original ship','personal reward, dialogue and save remain isolated'],separatePhysicalStudentDevices:false},null,2));
console.log('PASS three browser shared placements in all stages, actual walk to guardian, return to original ship, autosave isolation and personal dialogue preserved');}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});


