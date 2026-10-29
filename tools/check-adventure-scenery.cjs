// Isolated real input walks both original routes. Camera fixtures are separate.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const out=path.resolve('reports/2026-10-22/evidence/adventure-scenery');fs.mkdirSync(out,{recursive:true});
const inject=process.argv.find(a=>a.startsWith('--break-')),report={checks:[],errors:[],inject};
function check(name,ok,details){report.checks.push({name,pass:!!ok,details});assert.ok(ok,name+': '+JSON.stringify(details));console.log('PASS '+name);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/i.test(m.text()))report.errors.push(m.text());});
 await p.goto(process.env.AUDIT_URL||'http://127.0.0.1:5512/?q=high');await p.waitForFunction(()=>window.game,null,{timeout:90000});await p.locator('#title .go').click();
 await p.evaluate(async inject=>{game.loop.stop();game.dialogue.close();game.brief.hide();game.lab.importState({version:1,dials:[3,5,8],hasNote:true,read:true,open:true,done:false,sent:false,parcelRecovered:true});game.notebook.setHas(true);
  window.T=await import('three');window.trailTest={
   stage(){game.landOnPlanet();game.dialogue.close();game.brief.hide();game.input.setTestIntent({});game.step(1/60);game.step(1/60);},
   walk(target,limit=2000,tolerance=.42){let n=0,previous=Infinity,stall=0,maxH=0;while(game.player.position.angleTo(target)*game.planet.R>tolerance&&n<limit){const a=game.player,d=target.clone().addScaledVector(a.up,-target.dot(a.up)).normalize();game.engine.camFwd.copy(d);game.engine.camRight.crossVectors(a.up,d).normalize();game.input.setTestIntent({y:1});game.step(1/60);const dist=a.position.angleTo(target)*game.planet.R;if(dist<previous-.003)stall=0;else stall++;previous=dist;maxH=Math.max(maxH,a.jumpH);n++;if(stall>120)break;}game.input.setTestIntent({});return{frames:n,remaining:game.player.position.angleTo(target)*game.planet.R,stall,maxH,speed:game.player.travelSpeed};},
   settle(){for(let n=0;n<30;n++){game.input.setTestIntent({});game.step(1/60);}}
  };trailTest.stage();
  if(inject==='--break-collision')game.adventure.collision.enabled=false;
  if(inject==='--break-camera-index')game.worldCamera.query=()=>[];
 },inject);
 const model=await p.evaluate(()=>{const a=game.adventure;return{count:a.count,meshes:a.meshes.length,parts:a.sources.map(s=>({height:s.box.max.y,bottom:s.box.min.y,triangles:(s.geometry.index?.count||s.geometry.attributes.position.count)/3,texture:!!s.material.map,vertexColor:!!s.geometry.attributes.color})),placements:a.items.map(i=>({clearance:i.pathClearance,seating:i.seating})),cameraEntries:game.worldCamera.count};});
 check('decoded Blender kit has three grounded textured parts with a small triangle budget',model.parts.length===3&&model.parts.every((s,i)=>Math.abs(s.height-[.7,1.3,2.1][i])<1e-5&&Math.abs(s.bottom)<1e-5&&s.triangles<6000&&s.texture&&s.vertexColor),model);
 check('instanced placements keep the 2m trail clear and bury the complete lower contour',model.count>=6&&model.meshes===3&&model.placements.every(i=>i.clearance>=1.65&&i.seating.maxGap<0&&i.seating.minGap>-.4),model.placements);
 const ridge=await p.evaluate(()=>game.firstTrail.plan.routes.find(r=>r.key==='ridge').dirs.map(d=>trailTest.walk(d)));
 check('ridge from landing to observatory remains reachable by real walking',ridge.every(r=>r.remaining<.45&&r.maxH===0),ridge);
 const glider=await p.evaluate(()=>{const prompt=game.firstTrail.getPrompt(game.player.position);game.input.setTestIntent({action:true});game.step(1/60);game.input.setTestIntent({});game.step(1/60);return{prompt,acquired:game.player.canGlide,saved:JSON.parse(localStorage.getItem('mumuplanet.progress.v1'))?.progress?.expedition?.trail?.glider};});
 check('observatory interaction still grants and saves the glider',glider.acquired&&glider.saved&&glider.prompt?.startsWith('E — 접이식'),glider);
 const meadow=await p.evaluate(()=>{trailTest.stage();return game.firstTrail.plan.routes.find(r=>r.key==='meadow').dirs.map(d=>trailTest.walk(d));});
 check('meadow alternative remains walkable',meadow.every(r=>r.remaining<.45&&r.maxH===0),meadow);
 // Move back along the same walkable route; never set player coordinates to get a screenshot.
 await p.evaluate(()=>{trailTest.stage();for(const d of game.firstTrail.plan.routes.find(r=>r.key==='ridge').dirs.slice(0,3))trailTest.walk(d);trailTest.settle();});
 await p.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#flash')).opacity)<.001);
 const framing=[];
 for(const [name,yaw]of[['rear',0],['side',Math.PI/2],['front',Math.PI]]){
  const frame=await p.evaluate(yaw=>{const a=game.player,e=game.engine;game.input.camPitch=.32;game.input.camDist=7.6;e.camFwd.copy(a.heading).applyAxisAngle(a.up,yaw);e._camPlaced=false;a.lastArc=0;e.camColliders=game.worldCamera.query(a.position,7.6);e.updateCamera(a,game.input,0);game.sky.update(a,e.camera);e.renderer.info.autoReset=false;e.renderer.info.reset();e.render();const render={...e.renderer.info.render};e.renderer.info.autoReset=true;const feet=a.mesh.position.clone().project(e.camera),head=a.mesh.position.clone().addScaledVector(a.up,1.5).project(e.camera);return{yaw,nominalDistance:7.6,pitch:.32,fov:e.camera.fov,actualDistance:e.camera.position.distanceTo(a.position.clone().addScaledVector(a.up,e.lookHeight)),heightFraction:Math.abs(head.y-feet.y)/2,feetY:(1-feet.y)/2,candidates:e.camColliders.length,render,memory:{...e.renderer.info.memory},grassTufts:game.meadow.count};},yaw);
  framing.push({name,...frame});await p.screenshot({path:path.join(out,'route-'+name+'.png')});
 }
 report.framing=framing;
 check('same nominal camera captures preserve full-body framing in three directions',framing.every(f=>f.heightFraction>.07&&f.heightFraction<.3&&f.feetY<.95&&f.feetY>.35),framing);
 const wall=await p.evaluate(()=>{trailTest.stage();const route=game.firstTrail.plan.routes.find(r=>r.key==='ridge');for(const d of route.dirs.slice(0,2))trailTest.walk(d);const it=game.adventure.items.slice().sort((a,b)=>a.position.distanceToSquared(game.player.position)-b.position.distanceToSquared(game.player.position))[0];const result=trailTest.walk(it.dir,1200,.05);trailTest.settle();const query=game.worldCamera.query(game.player.position,game.input.camDist);return{result,distance:game.player.position.angleTo(it.dir)*game.planet.R,activeMeshes:query.length,registered:query.some(m=>m.userData.partitionedSolid&&m.geometry===game.adventure.sources[it.variant].geometry),gait:{...game.player.body.userData.gait}};});
 check('walking directly into the new visible rock stops before its centre',wall.result.stall>100&&wall.distance>.35&&wall.result.speed<.25,wall);
 check('production camera query contains the actual nearby granite instance',wall.activeMeshes>0&&wall.registered,wall);
 const perf=await p.evaluate(()=>{const t=performance.now();for(let n=0;n<500;n++)game.worldCamera.query(game.player.position,7.6);return{indexEntries:game.worldCamera.count,queryCpuMs:(performance.now()-t)/500,worldInstances:game.adventure.count};});
 report.performance=perf; // CPU query timing is not whole-frame FPS.
 await p.evaluate(async()=>{const{quality}=await import('/src/render/Quality.js');quality.pin('min');game.engine.render();});await p.screenshot({path:path.join(out,'minimum.png')});
 check('minimum quality retains the solid route and model collision',await p.evaluate(()=>game.adventure.group.visible&&game.adventure.count>0&&game.engine.renderer.info.render.calls>0));
 check('no browser errors',!report.errors.length,report.errors);report.pass=true;
 }catch(error){report.failure=error.message;throw error;}finally{fs.writeFileSync(path.join(out,inject?inject.slice(2)+'.json':'report.json'),JSON.stringify(report,null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
