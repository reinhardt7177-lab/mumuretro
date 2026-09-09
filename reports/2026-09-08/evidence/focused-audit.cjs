// Targeted reproductions for findings from the initial source/browser audit.
const fs=require('fs'), path=require('path');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const out=__dirname, base=process.env.AUDIT_URL||'http://127.0.0.1:5500/';
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1365,height:900}});
 await context.addInitScript(()=>{const Native=window.Audio;window.__auditAudio=[];window.Audio=function(...args){const a=new Native(...args);window.__auditAudio.push({requested:args[0],el:a});return a;};});
 const p=await context.newPage(); const r={date:new Date().toISOString(),errors:[]};
 p.on('pageerror',e=>r.errors.push(String(e)));
 try {
 await p.goto(base,{waitUntil:'networkidle'});
 await p.locator('#title').click({position:{x:900,y:300}});
 await p.waitForTimeout(1800);
 r.firstClickAudio=await p.evaluate(()=>({mode:game.mode,tracks:__auditAudio.map(x=>({requested:x.requested,src:x.el.currentSrc,paused:x.el.paused,volume:x.el.volume}))}));
 r.muteDuringFade=await p.evaluate(async()=>{const A=await import('/src/core/Audio.js');A.bgm('assets/audio/bgm/planet.mp3');await new Promise(r=>setTimeout(r,100));A.setMuted(true);const current=__auditAudio.at(-1).el;const immediate=current.volume;await new Promise(r=>setTimeout(r,1500));const answer={muted:A.isMuted(),immediate,afterFade:current.volume,paused:current.paused};A.bgm(null);return answer;});
 await p.evaluate(()=>{game.loop.stop();while(game.dialogue.active)game.dialogue.next();game.landOnPlanet();while(game.dialogue.active)game.dialogue.next();game.enterShrine(game.shrines.shrines[0]);game.notebook.setHas(true);game.notebook.setOpen(true);});
 r.overlayMovement=await p.evaluate(()=>{const before=game.roomActor.position.clone();game.input.setTestIntent({y:1});for(let i=0;i<20;i++)game.step(1/60);game.input.setTestIntent(null);return {open:game.notebook.isOpen,before:before.toArray(),after:game.roomActor.position.toArray(),distance:before.distanceTo(game.roomActor.position)};});
 r.blur=await p.evaluate(()=>{game.input.keys={};dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));const before=game.input.poll().y;dispatchEvent(new Event('blur'));const after=game.input.poll().y;dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));return {before,after};});
 r.water=await p.evaluate(()=>{game.notebook.setOpen(false);game.enterShrine(game.shrines.shrines[3]);const f=game.room.final;const initial=f.si;for(let i=0;i<600;i++)f.update(1/60);const after10seconds=f.si;return {initial,after10seconds,goal:game.room.goals.shrine,hints:game.room.hints.shrine.texts,leverPrompt:f.prompt(f.lever)};});
 r.overlayTimer=await p.evaluate(()=>{game.exitShrine();game.enterShrine(game.shrines.shrines[4]);game.notebook.setOpen(true);const g=game.room.gates[0].gate;const before=g.t;game.step(0.05);return {open:game.notebook.isOpen,before,after:g.t};});
 r.render=await p.evaluate(()=>{game.notebook.setOpen(false);game.exitShrine();game.step(1/60);const renderer=game.engine.renderer;renderer.info.autoReset=false;renderer.info.reset();game.engine.render();const info=JSON.parse(JSON.stringify(renderer.info));renderer.info.autoReset=true;return {render:info.render,memory:info.memory,programCount:info.programs?.length,terrainTriangles:game.planet.mesh.geometry.attributes.position.count/3,scatterMeshes:game.scatter.meshes.length};});
 r.resourceSummary=await p.evaluate(()=>{const a=performance.getEntriesByType('resource');return {requests:a.length,origins:[...new Set(a.map(x=>new URL(x.name).origin))],glbRequests:a.filter(x=>/\.glb/.test(x.name)).length};});
 console.log('Targeted desktop reproductions done.');
 const blocked=await browser.newContext({viewport:{width:1365,height:900}});await blocked.route(/fonts\.(googleapis|gstatic)\.com/,route=>route.abort());
 const b=await blocked.newPage();let selfLog=[];b.on('console',m=>{if(m.text().includes('[selftest]'))selfLog.push(m.text());});await b.goto(base,{waitUntil:'networkidle'});
 r.fontBlocked=await b.evaluate(()=>{game.loop.stop();return {fontStatus:document.fonts.status,ok:__selftest()};});r.fontBlocked.log=selfLog;await blocked.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const m=await mobile.newPage();await m.goto(base,{waitUntil:'networkidle'});await m.locator('#title').tap({position:{x:200,y:400}});await m.waitForTimeout(700);
 await m.evaluate(()=>{game.notebook.setHas(true);game.notebook.setOpen(true);});
 await m.screenshot({path:path.join(out,'05-notebook-mobile.png')});
 r.mobile=await m.evaluate(()=>({touchVisible:game.touch.visible,notebook:game.notebook.isOpen,buttons:[...document.querySelectorAll('#notebook button')].map(b=>({text:b.textContent,label:b.getAttribute('aria-label')})),viewport:{width:innerWidth,height:innerHeight}}));
 await mobile.close();
 const cdn=await browser.newContext();await cdn.route('https://cdn.jsdelivr.net/**',route=>route.abort());const c=await cdn.newPage();await c.goto(base,{waitUntil:'networkidle'});r.cdnBlocked=await c.evaluate(()=>({gameExists:!!window.game,loading:document.getElementById('load').innerText}));await cdn.close();
 }catch(e){r.auditError=e.stack;}finally{fs.writeFileSync(path.join(out,'focused-audit.json'),JSON.stringify(r,null,2));await browser.close();}
 console.log(JSON.stringify(r,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
