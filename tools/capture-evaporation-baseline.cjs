const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'','playwright'));
const base=process.env.AUDIT_URL||'http://127.0.0.1:5512',out=path.resolve(__dirname,'../reports/2026-09-09/evidence/evaporation-court');
(async()=>{fs.mkdirSync(out,{recursive:true});if(fs.existsSync(path.join(out,'legacy-save.json')))throw Error('Preserve baseline');
const browser=await chromium.launch({channel:'msedge',headless:true});try{
const c=await browser.newContext({viewport:{width:1440,height:900}});await c.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
const p=await c.newPage();await p.goto(base);await p.waitForFunction(()=>window.game);await p.locator('#title .go').click();await p.waitForTimeout(800);
const result=await p.evaluate(()=>{game.loop.stop();game.dialogue.close();game.brief.hide();game.lab.importState({version:1,dials:[3,5,8],hasNote:true,read:true,open:true,done:false,sent:false});game.notebook.setHas(true);game.landOnPlanet();game.enterShrine(game.shrines.shrines[2]);
const r=game.room,g=r.gates[2].gate;if(g.workshop)throw Error('Pre-upgrade source required');game.dialogue.close();game.brief.hide();for(const i of [0,1]){r.gates[i].solved=true;r.dungeon.openDoor(r.gates[i].room);}game.roomActor.setAt(0,-27);r.nudge('r3',60);
g.interact(g.potHome);g.interact(g.magnet);g.interact(g.filter);g.interact(g.tap);game.save();const raw=localStorage.getItem('mumuplanet.progress.v1'),state=r.exportState();
g.interact(g.potHome);game.save();const held=localStorage.getItem('mumuplanet.progress.v1');g.held=false;g.pot.position.copy(g.potHome);game.roomActor.camYaw=0;game.input.camDist=6.5;game.input.camPitch=.4;game.roomActor.syncMesh();game.roomActor._camPlaced=false;game.roomActor.updateCamera(game.engine.camera,game.input,0);
return{raw,held,seed:r.seed,state};});await p.waitForTimeout(900);result.metrics=await p.evaluate(()=>{const i=game.engine.renderer.info,a=i.autoReset;i.autoReset=false;i.reset();game.engine.render();const r={...i.render};i.autoReset=a;return r;});await p.screenshot({path:path.join(out,'before.png')});
fs.writeFileSync(path.join(out,'legacy-save.json'),result.raw);fs.writeFileSync(path.join(out,'legacy-held.json'),result.held);delete result.raw;delete result.held;fs.writeFileSync(path.join(out,'before.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({seed:result.seed,metrics:result.metrics}));
}finally{await browser.close();}})();


