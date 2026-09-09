// Staged ending integration + actual keyboard/touch UI checks.
// Positions/progress are supplied for setup: this is NOT a full puzzle playthrough.
const fs=require('fs'),path=require('path');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const out=__dirname,base=process.env.AUDIT_URL||'http://127.0.0.1:5500/';
(async()=>{
const browser=await chromium.launch({channel:'msedge',headless:true});const r={date:new Date().toISOString()};
try{
const context=await browser.newContext({viewport:{width:1365,height:900}});const p=await context.newPage();await p.goto(base,{waitUntil:'networkidle'});
await p.locator('#title .by a').dispatchEvent('pointerdown');
r.authorLink=await p.evaluate(()=>({modeAfterLinkPointerDown:game.mode}));
await p.evaluate(()=>{game.loop.stop();game.dialogue.close();game.landOnPlanet();game.dialogue.close();game.enterShrine(game.shrines.shrines[0]);game.notebook.setHas(true);game.notebook.setOpen(true);});
const before=await p.evaluate(()=>game.roomActor.position.toArray());await p.keyboard.down('w');await p.evaluate(()=>{for(let i=0;i<20;i++)game.step(1/60);});await p.keyboard.up('w');r.actualKeyboardOverlay=await p.evaluate(before=>({before,after:game.roomActor.position.toArray(),notebookOpen:game.notebook.isOpen}),before);
r.ending=await p.evaluate(()=>{
 game.notebook.setOpen(false);while(game.dialogue.active)game.dialogue.next();game.exitShrine();
 for(let i=0;i<5;i++)game.shrines.markCleared(game.shrines.shrines[i]);game.enterShrine(game.shrines.shrines[5]);
 const room=game.room;room.dungeon.rects.forEach(r=>r.open=true);game.roomActor.obstacles=[];
 const f=room.final;for(const o of f.orbs){f.interact(o);f.interact(f.altars.find(a=>a.id===o.id));}
 game.roomActor.setAt(room.prize.pos.x,room.prize.pos.z,-1);
 for(let i=0;i<220;i++)game.step(1/60);
 for(let i=0;i<30&&game.dialogue.active;i++)game.dialogue.next();game.brief.hide();
 game.input.requestAction();game.step(1/60);
 for(let i=0;i<40&&game.dialogue.active;i++)game.dialogue.next();
 const afterOrb={cleared:game.shrines.clearedCount(),gameDone:game.gameDone,labDone:game.lab.done};
 game.exitShrine();game.returnToLab();while(game.dialogue.active)game.dialogue.next();
 const parcel=game.lab.reachables.find(x=>x.name==='소포');game.roomActor.setAt(parcel.x,parcel.z,-1);game.input.requestAction();game.step(1/60);
 while(game.dialogue.active)game.dialogue.next();game.engine.render();
 return {afterOrb,labSent:game.lab.sent,endCard:game.title.isEnding,cardText:game.title.el.innerText,grandHints:room.hints.shrine.texts};
});await p.waitForTimeout(1000);await p.screenshot({path:path.join(out,'06-ending-staged.png')});
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const m=await mobile.newPage();await m.goto(base,{waitUntil:'networkidle'});await m.locator('#title').tap({position:{x:200,y:400}});await m.waitForTimeout(600);await m.evaluate(()=>{game.notebook.setHas(true);game.notebook.setOpen(true);});
r.mobileButtons=await m.locator('#nb button').evaluateAll(buttons=>buttons.map(b=>({text:b.textContent,label:b.getAttribute('aria-label')})));
await m.locator('#nbX').tap();r.mobileClose=await m.evaluate(()=>({isOpen:game.notebook.isOpen}));
}catch(e){r.auditError=e.stack;}finally{fs.writeFileSync(path.join(out,'flow-audit.json'),JSON.stringify(r,null,2));await browser.close();}console.log(JSON.stringify(r,null,2));
})();
