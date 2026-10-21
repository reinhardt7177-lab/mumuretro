const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'reports/2026-10-02/evidence/asset-transfer');fs.mkdirSync(OUT,{recursive:true});
const sha=d=>crypto.createHash('sha256').update(d).digest('hex');
const preservation=JSON.parse(fs.readFileSync(path.join(ROOT,'art/engine-transfer/preservation.json')));
for(const f of preservation.files){assert.equal(sha(fs.readFileSync(path.join(ROOT,f.preserved))),f.sha256,f.preserved);if(fs.existsSync(path.join(ROOT,f.source)))assert.equal(sha(fs.readFileSync(path.join(ROOT,f.source))),f.sha256,f.source);}
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/models/heritage/manifest.json')));
for(const m of manifest.models)assert.equal(sha(fs.readFileSync(path.join(ROOT,m.file))),m.sha256,m.id);
const report={pass:false,date:'2026-10-02',preserved:preservation.files.length,models:[],runtime:{},errors:[]};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>report.errors.push(e.message));
 p.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:5512')&&r.status()>=400)report.errors.push(r.status()+' '+r.url());});
 console.log('Starting model render checks');
 if(!process.argv.includes('--runtime-only')) {
 await p.goto('http://127.0.0.1:5512/tools/asset-library.html');await p.waitForFunction(()=>window.assetLibrary);
 for(const m of manifest.models){
   await p.locator('#models').selectOption(m.id);await p.waitForFunction(id=>document.querySelector('#status').dataset.asset===id,m.id);
   const result=await p.evaluate(()=>{const a=assetLibrary;let vertices=0,finite=true,meshes=0,textured=0,normal=false;
     a.model.traverse(o=>{if(!o.isMesh)return;meshes++;const p=o.geometry.attributes.position;vertices+=p.count;finite&&=Array.from(p.array).every(Number.isFinite);for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.map)textured++;if(m.normalMap)normal=true;}});a.render();
     return {id:a.selected.id,meshes,vertices,finite,textured,normal,drawn:a.renderer.info.render.triangles};
   });assert(result.finite&&result.meshes>0&&result.drawn>0,JSON.stringify(result));if(m.id==='water-deity')assert(result.textured>0&&result.normal);
   report.models.push(result);if(['balance-deity','water-deity','weight-exterior','explorer-notebook','ice-hall-v07','glacier-temple','water-mountain','solar-mirror'].includes(m.id))await p.screenshot({path:path.join(OUT,m.id+'.png')});
 }
 } else {report.models=JSON.parse(fs.readFileSync(path.join(OUT,'report.json'))).models;assert.deepEqual(report.models.map(m=>m.id),manifest.models.map(m=>m.id));}
 console.log(`PASS ${report.models.length} GLBs decoded and rendered in WebGL; ${report.preserved} source hashes match`);
 await p.goto('http://127.0.0.1:5512/');await p.waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',null,{timeout:90000});
 await p.locator('#title .go').click();await p.evaluate(()=>{game.loop.stop();game.dialogue.close();game.brief.hide();game.notebook.setHas(true);game.notebook.setOpen(true);});
 assert(await p.locator('#nb .notebook-art').isVisible());await p.screenshot({path:path.join(OUT,'notebook-in-game.png')});
 await p.evaluate(()=>game.notebook.go('letter'));await p.waitForTimeout(650);assert(await p.locator('#nb .notebook-art').isVisible());
 await p.evaluate(()=>game.notebook.setOpen(false));assert.equal(await p.locator('#nb .notebook-art').count(),0);
 await p.evaluate(()=>{for(let i=0;i<18;i++){game.notebook.setOpen(true);game.notebook.setOpen(false);}game.engine.render();});
 assert(await p.evaluate(()=>!game.engine.renderer.getContext().isContextLost()));report.runtime.notebook=true;
 console.log('PASS notebook turn and 18 open/close cycles without losing game context');
 const exterior=await p.evaluate(()=>game.shrines.shrines.filter(s=>s.group.userData.heritageAsset).map(s=>s.group.userData.heritageAsset));assert.deepEqual(exterior,['weight-exterior','glacier-temple']);report.runtime.exteriors=exterior;
 assert(await p.evaluate(()=>!!game.firstTrail.gateModel));report.runtime.directWaterEntrance=true;
 await p.evaluate(async()=>{game.enterShrine(game.shrines.shrines[0]);game.dialogue.close();game.brief.hide();await game.room.dungeon.heritagePromise;game.roomActor.setAt(0,-57,-1);game.room.dungeon.openDoor('shrine');game.room.dungeon.update(1.2);game.engine.camera.position.set(3.8,3.5,-56);game.engine.camera.lookAt(0,2.6,-60);game.engine.render();});
 assert(await p.evaluate(()=>!!game.room.scene.getObjectByName('heritage-balance-deity')));await p.screenshot({path:path.join(OUT,'balance-in-game.png')});report.runtime.balanceDeity=true;
 await p.evaluate(async()=>{game.exitShrine();game.landOnPlanet();game.enterShrine(game.shrines.shrines[3]);game.dialogue.close();game.brief.hide();await game.room.final.heritagePromise;game.roomActor.setAt(0,game.room.final.seg.z0+12,-1);game.roomActor.updateCamera(game.engine.camera,game.input,0);game.engine.render();});
 assert(await p.evaluate(()=>!!game.room.scene.getObjectByName('heritage-water-deity')));await p.screenshot({path:path.join(OUT,'water-in-game.png')});report.runtime.waterDeity=true;
 await p.evaluate(async()=>{game.exitShrine();game.landOnPlanet();game.dialogue.close();game.brief.hide();const {quality}=await import('/src/render/Quality.js');quality.pin('high');game.meadow.setEnabled(true);game.meadow.update(1,game.player.position);game.engine.render();});
 const grass=await p.evaluate(()=>({enabled:game.meadow.enabled,visible:game.meadow.group.visible,count:game.meadow.count,batches:game.meadow.group.children.length}));assert(grass.enabled&&grass.visible&&grass.count<=1800&&grass.batches===4,JSON.stringify(grass));
 await p.keyboard.press('g');assert(await p.evaluate(()=>!game.meadow.group.visible&&localStorage.getItem('mumuplanet.meadow.enabled.v1')==='false'));
 await p.keyboard.press('g');assert(await p.evaluate(()=>game.meadow.enabled));
 await p.evaluate(async()=>{const {quality}=await import('/src/render/Quality.js');quality.set('low');});assert(await p.evaluate(()=>!game.meadow.group.visible));report.runtime.grassToggle=grass;
 await p.evaluate(()=>{game.player.position.copy(game.planet.surfaceAt(game.firstTrail.gateDir));game.player._initFrame();game.player.resetTraversal();game.input.setTestIntent({});for(let i=0;i<3;i++){game.dialogue.close();game.brief.hide();game.step(1/60);}game.input.setTestIntent({action:true});game.step(1/60);});assert.equal(await p.evaluate(()=>game.mode),'room');report.runtime.waterEntryByAction=true;
 assert.deepEqual(report.errors,[]);report.pass=true;console.log('PASS live deities, exteriors, direct entry, notebook turn/disposal and grass toggle');
}catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
