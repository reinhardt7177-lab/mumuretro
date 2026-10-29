// Staged art comparison, never evidence of puzzle completion or original-game execution.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright'));
const ROOT=path.resolve(__dirname,'..'),phase=process.argv.includes('--before')?'before':'after';
const OUT=path.join(ROOT,'reports/2026-10-22/evidence/adventure-interiors',phase);
fs.mkdirSync(OUT,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});
const report={phase,seed:20261022,stagedArtCapture:true,puzzleCompletionProof:false,counterfactualScope:'Same current runtime and staged seed; before disables the interior art config and restores pre-phase twilight ambient.',shots:[],errors:[]};
try{const page=await browser.newPage({viewport:{width:1280,height:800}});
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&/THREE|Shader|ERROR:/.test(m.text()))report.errors.push(m.text());});
await page.route('**/src/shrine/Room.js',async route=>{const response=await route.fetch();let body=await response.text();const from='seed = Math.floor(Math.random() * 4294967296)';if(!body.includes(from))throw Error('Staged seed fixture no longer matches');body=body.replace(from,'seed = 20261022');await route.fulfill({response,body});});
if(phase==='before')await page.route('**/assets/models/adventure/interior-art-v01.json',r=>r.fulfill({status:404,body:'Baseline: interior direction disabled'}));
if(phase==='before')await page.route('**/src/shrine/OpenField.js',async route=>{const response=await route.fetch();let body=await response.text();const from='O.ambientSky??O.top, O.ground, O.ambientIntensity??(O.stars ? 0.35 : 0.85)';if(!body.includes(from))throw Error('Twilight baseline fixture no longer matches');await route.fulfill({response,body:body.replace(from,'O.top, O.ground, O.stars ? 0.35 : 0.85')});});
await page.goto(process.env.AUDIT_URL||'http://127.0.0.1:5512/');
await page.waitForFunction(()=>window.game,null,{timeout:90000});await page.locator('#title .go').click();
await page.evaluate(async()=>{game.loop.stop();game.dialogue.close();game.brief.hide();(await import('./src/render/Quality.js')).quality.pin('mid');});
for(const id of ['ship','balance','shadow','sift','water','fire','strata']){
await page.evaluate(async id=>{if(game.mode==='room')game.exitShrine();game.dialogue.close();game.brief.hide();
if(id!=='ship'){if(id==='strata')for(const s of game.shrines.shrines.slice(0,5))game.shrines.markCleared(s);
const s=game.shrines.shrines[game.SHRINES.findIndex(s=>s.id===id)];const r=game.roomFor(s);
await r.ready;await r.final.heritagePromise;await r.dungeon.heritagePromise;game.enterShrine(s);}
game.dialogue.close();game.brief.hide();},id);
for(const view of ['entry','device','door','sanctum']){
const metrics=await page.evaluate(async({id,view})=>{await game.engine.interiorArt?.ready;
const a=game.roomActor;game.input.setTestIntent({});
if(id==='ship')a.position.set(...({entry:[0,0,9],device:[-1,0,-1],door:[0,0,-5],sanctum:[0,0,-9]}[view]));
else if(id==='fire')a.position.set(...({entry:[0,0,22],device:[0,0,8],door:[0,0,-9],sanctum:[0,3.2,-48.5]}[view]));
else if(view==='door'){const d=game.room.dungeon.doors.r1;if(!d)throw Error('Missing first door '+id);a.position.set(0,0,d.rect.z1+3);}
else{const rect=view==='entry'?game.room.dungeon.rectOf('entry'):game.room.dungeon.rectOf(view==='device'?'r1':'shrine');
a.position.set(0,0,view==='entry'?10:rect.z1-3);}
a.position.y=a.floorAt(a.position.x,a.position.z,a.position.y);
a.vy=0;a.grounded=true;a.heading.set(0,0,-1);a.camYaw=0;a._camPlaced=false;
game.input.camPitch=.35;game.input.camZoom=1;
// Do not step puzzle simulation at staged locked locations; update only actor view/render.
a.syncMesh();a.updateCamera(game.engine.camera,game.input,0);
const focus=a.position.clone();focus.y+=a._cameraLookHeight;
const focusDistance=game.engine.camera.position.distanceTo(focus),footSeatError=Math.abs(a.position.y-a.floorAt(a.position.x,a.position.z,a.position.y));
if(focusDistance<2.8||footSeatError>1e-5)throw Error('Unseated staged camera '+id+' '+view+' '+JSON.stringify({focusDistance,footSeatError}));
game.engine.render();game.engine.render();
const scene=game.engine.scene,mats=new Set();scene.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))if(m)mats.add(m);});
return{position:a.position.toArray(),camera:game.engine.camera.position.toArray(),focusDistance,footSeatError,environment:!!scene.environment,materials:mats.size,metallic:[...mats].filter(m=>m.metalness>.3).length,render:__dbg.perf()};
},{id,view});
const file=id+'-'+view+'.png';await page.screenshot({path:path.join(OUT,file),animations:'disabled'});
report.shots.push({id,view,file,...metrics});console.log('CAPTURE '+phase+' '+id+' '+view);
}}
report.pass=!report.errors.length;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}finally{fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
