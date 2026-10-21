const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const out='reports/2026-09-20/planet-detail';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});
 const report={errors:[],views:[]};
 try{
  const p=await b.newPage({viewport:{width:1440,height:900}});
  p.on('pageerror',e=>report.errors.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))report.errors.push(m.text());});
  await p.goto('http://127.0.0.1:5512/?q=high');await p.waitForFunction(()=>window.game,null,{timeout:90000});
  await p.locator('#title .go').click();
  await p.evaluate(async()=>{
   game.loop.stop();game.dialogue.close();game.brief.hide();
   const {PORTAL_CODE}=await import('/src/world/Lab.js');
   if(!game.lab.importState({...game.lab.exportState(),dials:PORTAL_CODE,hasNote:true,read:true,open:true,parcelRecovered:true}))throw Error('Lab fixture rejected');
   game.notebook.setHas(true);game.landOnPlanet();game.dialogue.close();game.brief.hide();
   const T=await import('/vendor/three/build/three.module.js');
   window.mapDetailHarness={T,landing:game.player.position.clone().normalize(),
    frame(viewDir,targetDir){
     const {player,planet,engine,input,sky}=game;player.position.copy(planet.surfaceAt(viewDir));
     const up=player.position.clone().normalize(),aim=planet.surfaceAt(targetDir).sub(player.position);
     player.heading.copy(aim.addScaledVector(up,-aim.dot(up)).normalize());player._initFrame();player.resetTraversal();
     engine.camFwd.copy(player.heading);engine.camUp.copy(player.up);engine._camPlaced=false;input.camDist=7.7;input.camPitch=.36;
     engine.updateCamera(player,input,0);sky.update(player,engine.camera);game.scatter.update(1);game.carpet.update(1);engine.render();
    },
    nearest(kind){let best=null,dist=Infinity;const m=new T.Matrix4(),v=new T.Vector3();for(const mesh of game.scatter.meshes){if(mesh.userData.natureKind!==kind)continue;for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);v.setFromMatrixPosition(m).normalize();const d=v.angleTo(this.landing);if(d<dist){dist=d;best=v.clone();}}}return best;},
    scenery(kind){const d=this.nearest(kind),side=new T.Vector3().crossVectors(d,new T.Vector3(0,1,0)).normalize();this.frame(d.clone().addScaledVector(side,5/game.planet.R).normalize(),d);},
    stats(){const byKind={};for(const m of game.scatter.meshes){byKind[m.userData.natureKind]=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;}return {byKind,meshes:game.scatter.meshes.length,instances:game.scatter.meshes.reduce((s,m)=>s+m.count,0),colliders:game.scatter.colliders.length};}
   };
  });
  // Let the landing flash finish in wall-clock time, without moving the actor.
  await p.waitForTimeout(850);
  report.routes=await p.evaluate(()=>{
   const result={};
   for(const key of ['ridge','meadow']){
    game.landOnPlanet();game.dialogue.close();game.brief.hide();
    result[key]=game.firstTrail.plan.routes.find(r=>r.key===key).dirs.map(target=>{
     let frames=0;const remaining=()=>game.player.position.angleTo(target)*game.planet.R;
     while(remaining()>.45 && frames++<1800){
      const tangent=target.clone().addScaledVector(game.player.up,-target.dot(game.player.up)).normalize();
      game.engine.camFwd.copy(tangent);game.engine.camRight.crossVectors(game.player.up,tangent).normalize();
      game.input.setTestIntent({x:0,y:1});game.step(1/60);
     }
     game.input.setTestIntent({});if(remaining()>.45)throw Error(`Blocked ${key}: ${remaining()}`);
     return {frames,remaining:remaining()};
    });
   }
   return result;
  });
  const high=await p.evaluate(()=>mapDetailHarness.stats());
  assert(await p.evaluate(()=>game.scatter.meshes.every(m=>m.geometry.attributes.color)), 'Blender colours loaded for every kind');
  for(const view of ['landing','forest','rocks','overlook','waterway']){
   await p.evaluate(view=>{const h=mapDetailHarness,dir=ll=>game.planet.latLonToPos(...ll).normalize();
    if(view==='landing')h.frame(h.landing,dir([22,0]));
    else if(view==='forest')h.scenery('trunk');
    else if(view==='rocks')h.scenery('rockA');
    else if(view==='overlook')h.frame(dir([20,-3]),dir([22,0]));
    else h.frame(dir([7,10]),dir([9,14]));
   },view);
   await p.screenshot({path:`${out}/${view}.png`});report.views.push(view);
  }
  const before=await p.evaluate(()=>game.scatter.colliders.map(c=>[...c.dir.toArray(),c.r,c.height]));
  await p.evaluate(async()=>{const {quality}=await import('/src/render/Quality.js');quality.pin('min');mapDetailHarness.scenery('trunk');});
  const low=await p.evaluate(()=>mapDetailHarness.stats());
  assert.equal(high.meshes,low.meshes);assert.equal(high.instances,low.instances);assert.equal(high.colliders,low.colliders);
  assert(high.byKind.trunk>low.byKind.trunk);assert(high.byKind.rockA>low.byKind.rockA);
  assert.deepEqual(await p.evaluate(()=>game.scatter.colliders.map(c=>[...c.dir.toArray(),c.r,c.height])),before);
  await p.screenshot({path:`${out}/forest-min.png`});
  await p.evaluate(async()=>{const {quality}=await import('/src/render/Quality.js');quality.pin('high');mapDetailHarness.scenery('trunk');});
  assert.deepEqual(await p.evaluate(()=>mapDetailHarness.stats()),high);
  await p.screenshot({path:`${out}/forest.png`});
  await p.goto('http://127.0.0.1:5512/art/asset-upgrade/preview.html');await p.waitForFunction(()=>window.assetPreview,null,{timeout:30000});
  await p.locator('[data-view="nature"]').click();await p.waitForFunction(()=>assetPreview.view==='nature');
  await p.screenshot({path:`${out}/nature-workshop.png`});
  Object.assign(report,{high,low});fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));assert.deepEqual(report.errors,[]);
  console.log('PASS Blender nature geometry, actual ridge/meadow walking, five map views, quality roundtrip, stable instances/collisions, no shader errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
