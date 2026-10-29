// Staged asset comparison; fixture ownership is NOT a puzzle playthrough.
const fs=require('node:fs'),path=require('node:path');
const{chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright'));
const phase=process.argv.includes('--after')?'after':'before',OUT=path.resolve(__dirname,'../reports/2026-10-22/evidence/adventure-actions/'+phase);
fs.mkdirSync(OUT,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true}),report={phase,stagedPoseStudio:true,puzzleCompletionProof:false,seed:20261022,camera:{width:1200,height:900,fov:62,distance:4.5,pitch:.25,lookHeight:1.25},cases:[],errors:[]};
try{const p=await b.newPage({viewport:{width:1200,height:900}});p.on('pageerror',e=>report.errors.push(e.message));
if(phase==='before')await p.route('**/action-contract-v01.json',r=>r.fulfill({status:404,body:'Counterfactual: new action layer disabled'}));
await p.route('**/src/shrine/Room.js',async route=>{const response=await route.fetch(),text=await response.text();await route.fulfill({response,body:text.replace('seed = Math.floor(Math.random() * 4294967296)','seed = 20261022')});});
await p.goto('http://127.0.0.1:5512/');await p.waitForFunction(()=>window.game,null,{timeout:90000});await p.locator('#title .go').click();await p.evaluate(()=>{game.loop.stop();game.dialogue.close();game.brief.hide();});
await p.addStyleTag({content:'body>*:not(canvas){visibility:hidden!important} canvas{visibility:visible!important}'});
for(const id of ['crate','ice','sieve','pot','fossil','offering','tool','brace']){
const data=await p.evaluate(async id=>{const T=await import('three');if(game.mode==='room')game.exitShrine();const sid={crate:0,ice:3,sieve:2,pot:2,fossil:5,offering:5,tool:2,brace:4}[id];if(sid===5)for(const s of game.shrines.shrines.slice(0,5))game.shrines.markCleared(s);
const s=game.shrines.shrines[sid],r=game.roomFor(s);await r.ready;await r.final.heritagePromise;r.restart();game.enterShrine(s);await r.interiorArt?.ready;game.dialogue.close();game.brief.hide();const a=game.roomActor,n=a.body.userData.navigator;let d,mesh;
if(id==='crate'){d=r.gates[0].gate;d.held=0;d.stock[0].at=-2;mesh=d.stock[0].mesh;}
if(id==='ice'){d=r.gates[0].gate;r.world.bracelet=true;Object.assign(d.state,{phase:'ice',held:true,zone:'held'});d.held='ice';d.paint();mesh=d.ice;}
if(id==='sieve'){d=r.gates[0].gate;d.held=d.sieves[0];mesh=d.held.grp;}
if(id==='pot'){d=r.gates[2].gate;d.held=true;mesh=d.pot;}
if(id==='fossil'){d=r.gates[0].gate;d.held=d.fossils[0];mesh=d.held.mesh;}
if(id==='offering'){d=r.final;d.held=d.orbs[0];mesh=d.held.mesh;}
if(id==='tool'){d=r.final;d.held=d.tools[0];mesh=d.held.mesh;}
if(id==='brace'){d=r.world;d.mechanics.pick(0);mesh=d.braces[0];}
const seg=d.seg||r.shrineSeg;if(id==='brace')a.setAt(-28,8);else a.setAt(0,seg.z1-3);a.camYaw=0;a.body.userData.carrying=true;
for(let i=0;i<48;i++){game.dialogue.close();game.brief.hide();game.input.setTestIntent({});game.step(1/60);}
game.engine.scene.updateMatrixWorld(true);const box=new T.Box3().setFromObject(mesh),handPositions={};for(const side of ['Left','Right']){const wp=n.bones[side+'Hand'].getWorldPosition(new T.Vector3());handPositions[side]={world:wp.toArray(),bodyLocal:a.body.worldToLocal(wp.clone()).toArray(),boxDistance:box.distanceToPoint(wp)};}
const original=game.engine.scene,studio=new T.Scene();studio.background=new T.Color(0x34454b);studio.environment=original.environment;studio.add(new T.HemisphereLight(0xf8f3e2,0x33434c,1.6));const sun=new T.DirectionalLight(0xfff2d7,2.4);sun.position.set(3,6,4);studio.add(sun);const floor=new T.Mesh(new T.PlaneGeometry(40,40),new T.MeshStandardMaterial({color:0x58696a,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.set(a.position.x,a.position.y-.01,a.position.z);studio.add(floor);
window.actionStudio={studio,original,actor:a.mesh||a.body,actorParent:(a.mesh||a.body).parent,mesh,meshParent:mesh.parent,floor};studio.attach(actionStudio.actor);studio.attach(mesh);game.engine.scene=studio;
return{id,meshName:mesh.name,dimensions:box.getSize(new T.Vector3()).toArray(),position:mesh.getWorldPosition(new T.Vector3()).toArray(),actor:a.position.toArray(),hands:handPositions,presentation:a.body.userData.carryPresentation,gripErrors:a.body.userData.carryGripErrors};},id);
for(const [view,yaw]of [['rear',0],['side',Math.PI/2],['front',Math.PI]]){await p.evaluate(yaw=>{const a=game.roomActor,c=game.engine.camera,t=a.position.clone();t.y+=1.25;c.fov=62;c.updateProjectionMatrix();c.up.set(0,1,0);c.position.set(t.x+Math.sin(yaw)*4.5*Math.cos(.25),t.y+4.5*Math.sin(.25),t.z+Math.cos(yaw)*4.5*Math.cos(.25));c.lookAt(t);game.engine.render();},yaw);await p.screenshot({path:path.join(OUT,id+'-'+view+'.png')});}
await p.evaluate(()=>{const s=actionStudio;s.actorParent.attach(s.actor);s.meshParent.attach(s.mesh);game.engine.scene=s.original;s.floor.geometry.dispose();s.floor.material.dispose();delete window.actionStudio;});
report.cases.push(data);console.log('AUDIT '+id+' '+JSON.stringify({size:data.dimensions,gripErrors:data.gripErrors}));
}report.pass=!report.errors.length;}catch(e){report.failure=e.stack;report.pass=false;process.exitCode=1;console.error(e);}finally{fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));await b.close();}})();
