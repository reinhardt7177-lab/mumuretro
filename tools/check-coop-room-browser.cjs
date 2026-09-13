const path=require('path'),assert=require('node:assert/strict');const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{const pages=[];for(let i=0;i<3;i++){const context=await b.newContext();const p=await context.newPage();await p.goto('http://127.0.0.1:5512');await p.waitForFunction(()=>window.game,null,{timeout:90000});await p.locator('#title .go').click();await p.evaluate(()=>{game.dialogue.close();game.settings.setOpen(true)});pages.push(p);}await pages[0].getByRole('button',{name:'방 만들기',exact:true}).click();await pages[0].waitForFunction(()=>document.querySelector('input[aria-label="초대 코드"]').value.length===8);const code=await pages[0].getByRole('textbox',{name:'초대 코드'}).inputValue();for(const p of pages.slice(1)){await p.getByRole('textbox',{name:'초대 코드'}).fill(code);await p.getByRole('button',{name:'참여',exact:true}).click();}for(const p of pages)await p.getByText(`초대 코드 ${code} · 3/3명`,{exact:true}).waitFor();for(const p of pages)await p.getByRole('button',{name:'균형 신전 함께하기',exact:true}).click();
for(const p of pages)await p.waitForFunction(()=>game.mode==='room'&&game.room.gates[0].gate.count===3);
await pages[0].evaluate(()=>{const g=game.room.gates[0].gate;g.interact(g.stock[0].mesh.position);});
await pages[0].waitForFunction(()=>game.room.gates[0].gate.held===0);
await pages[1].waitForFunction(()=>game.room.gates[0].gate.stock[0].at===-2);
await pages[0].evaluate(()=>{const g=game.room.gates[0].gate;g.interact(g.stock[0].mesh.position.clone().set(g.cells[0].x,0,g.cells[0].z));});
for(const p of pages)await p.waitForFunction(()=>game.room.gates[0].gate.stock[0].at===0);
for(let i=1;i<3;i++){await pages[i].evaluate(i=>{const g=game.room.gates[0].gate;g.interact(g.stock[i].mesh.position)},i);await pages[i].waitForFunction(i=>game.room.gates[0].gate.held===i,i);await pages[i].evaluate(i=>{const g=game.room.gates[0].gate;g.interact(g.stock[i].mesh.position.clone().set(g.cells[i].x,0,g.cells[i].z))},i);}
for(const p of pages){await p.waitForFunction(()=>game.room.gates[0].gate.solved);await p.evaluate(()=>{for(let i=0;i<90;i++){game.dialogue.close();game.brief.hide();game.input.setTestIntent({});game.step(1/60);}});await p.waitForFunction(()=>game.room.dungeon.doors.r1.rect.open);}
for(const p of pages){assert.equal(await p.evaluate(()=>game.save(true)),false);await p.evaluate(()=>game.exitShrine());}
console.log('PASS three browser shared placements, shared door open, coop autosave blocked and exit');}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});


