const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),base=require('./field-meadow-fixture.cjs'),A='art/arrival-dais/v05';
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const v05Only=true,report={previewOnly:true,base:'Root466',wholeJourney:false,checks:[],shots:v05Only?JSON.parse(fs.readFileSync('art/arrival-dais/v04/iteration-01/native-validation.json')).shots.filter(s=>s.revision==='v03'):[],errors:[],baselineReused:v05Only?'Unchanged Root466/v03 actual locked-camera captures from preserved iteration-01':''};const check=(name,pass,data)=>{report.checks.push({name,pass:!!pass,data});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name);};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const locked=JSON.parse(fs.readFileSync('reports/2026-10-26/evidence/arrival-dais/after.json')),site=JSON.parse(fs.readFileSync('reports/2026-10-26/evidence/world-horizon/sites.json')).find(s=>s.id==='landing');
 for(const revision of(v05Only?['v05']:['v03','v05'])){
  const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(e.message));
  if(revision==='v05'){
   await page.route('**/src/boot.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(A+'/preview-src__boot.js','utf8')}));
   await page.route('**/src/sphere/SurfaceActor.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('art/arrival-coherence/v01/combined/preview-src__sphere__SurfaceActor.js','utf8')}));
   await page.route('**/src/world/LandmarkAssets.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(A+'/preview-src__world__LandmarkAssets.js','utf8')}));
   await page.route('**/assets/models/adventure/arrival-dais-v05.glb',r=>r.fulfill({contentType:'model/gltf-binary',body:fs.readFileSync(A+'/exports/arrival-dais-v05.glb')}));
  }
  await base.prepare(page,'after','mid');
  for(const[view,yaw]of[['front',0],['side',Math.PI/2],['rear',Math.PI]]){
   const camera=locked.shots.find(s=>s.view===view);const data=await page.evaluate(({site,yaw,camera})=>{fieldProbe.stage(site.dir,site.target,yaw);const c=game.engine.camera;c.position.fromArray(camera.camera);c.quaternion.fromArray(camera.quaternion);c.up.fromArray(camera.up);c.fov=camera.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);game.sky.update(game.player,c);game.engine.render();game.engine.render();return fieldProbe.shot();},{site,yaw,camera});
   const file=A+'/native-'+revision+'-'+view+'.png';await page.screenshot({path:file});report.shots.push({revision,view,file,...data});
  }
  if(revision==='v05'){
   const contact=await page.evaluate(()=>{
    const group=game.landing.group.getObjectByName('Mumu authored arrival dais');group.updateWorldMatrix(true,true);const meshes=group.children.filter(m=>m.isMesh),ray=new T.Raycaster(),q=game.planet.frameAt(game.landing.pos).quaternion,point=new T.Vector3(),direction=new T.Vector3(),samples=[];
    for(const radius of[.08,.4,.8,1.3,1.8,2.12,2.3,2.43,2.55])for(let i=0;i<32;i++){
     const angle=(i+.31)*Math.PI/16;point.set(Math.cos(angle)*radius,0,Math.sin(angle)*radius).applyQuaternion(q).add(game.landing.pos);direction.copy(point).normalize();const support=game.planet.surfaceAt(direction,new T.Vector3());ray.set(support.clone().addScaledVector(direction,2),direction.clone().negate());ray.far=4;const floor=ray.intersectObjects(meshes,false)[0],soil=ray.intersectObjects([game.planet.mesh,game.carpet.mesh],false)[0];samples.push({radius,angle,gap:floor?floor.point.length()-support.length():null,clear:!!floor&&(!soil||floor.distance<=soil.distance+.002)});
    }
    const materials=meshes.map(m=>({name:m.name,vertexColors:m.material.vertexColors,colorCount:m.geometry.attributes.color?.count,color1:!!m.geometry.attributes.color_1,map:!!m.material.map,normalMap:!!m.material.normalMap,metalness:m.material.metalness,emissiveIntensity:m.material.emissiveIntensity}));
    const outerSamples=[];
    for(const radius of[2.58,2.60,2.62,2.635])for(let i=0;i<64;i++){
     const angle=(i+.31)*Math.PI/32;point.set(Math.cos(angle)*radius,0,Math.sin(angle)*radius).applyQuaternion(q).add(game.landing.pos);direction.copy(point).normalize();const support=game.planet.surfaceAt(direction,new T.Vector3());ray.set(support.clone().addScaledVector(direction,2),direction.clone().negate());ray.far=4;const visible=ray.intersectObjects([...meshes,game.planet.mesh,game.carpet.mesh],false)[0];outerSamples.push({radius,angle,gap:visible?visible.point.length()-support.length():null,surface:visible?.object.name??null});
    }
    return{triangles:meshes.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0),meshes:meshes.length,materials,asset:group.userData,field:game.meadowField,support:{height:game.planet.arrivalSupport.height,inner:game.planet.arrivalSupport.inner,outer:game.planet.arrivalSupport.outer},samples,outerSamples,cameraMeshes:meshes.filter(m=>game.worldCamera.entries.some(e=>e.source===m)).length};
   });
   fs.writeFileSync(A+'/contact-samples.json',JSON.stringify(contact,null,2));
   const stone=contact.materials.find(m=>m.name==='Arrival_Weathered'),missing=contact.samples.filter(s=>s.gap===null),maxGap=Math.max(...contact.samples.filter(s=>s.gap!==null).map(s=>Math.abs(s.gap))),covered=contact.samples.filter(s=>!s.clear);
   check('four real parts and four materials within 20k triangles',contact.meshes===4&&contact.materials.length===4&&contact.triangles<=20000&&contact.asset.asset==='arrival-dais-v05',{triangles:contact.triangles,asset:contact.asset});
   check('authored COLOR_0 is consumed by actual stone shader',stone.vertexColors&&stone.colorCount>0&&!stone.color1&&stone.map&&stone.normalMap,contact.materials);
   check('real model contact follows the declared v05 native support',!missing.length&&maxGap<=.05&&covered.length<=7&&contact.support.height===.16&&contact.support.inner===2.58&&contact.support.outer===2.64,{samples:contact.samples.length,missing:missing.length,maxGap,covered:covered.length,support:contact.support,worst:contact.samples.slice().sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap)).slice(0,5)});
   check('six centimetre edge bevel follows the actual visible floor',contact.outerSamples.every(s=>s.gap!==null&&Math.abs(s.gap)<=.05),{samples:contact.outerSamples.length,maxGap:Math.max(...contact.outerSamples.map(s=>Math.abs(s.gap))),field:contact.field,note:'Visible surface includes soil exposed by stone corner wear at the outside foot; the fixed .16m centre is the stone surface'});
   check('all actual opaque parts remain camera collision geometry',contact.cameraMeshes===4,{cameraMeshes:contact.cameraMeshes});
   await page.evaluate(()=>{const q=game.planet.frameAt(game.landing.pos).quaternion,start=new T.Vector3(0,0,3.15).applyQuaternion(q).add(game.landing.pos).normalize();fieldProbe.stage(start.toArray(),game.landing.dir.toArray());game.input.setTestIntent(null);game.input.reset();window.stepEntry=[];});
   await page.locator('canvas').first().click({position:{x:1050,y:450},force:true});await page.keyboard.down('KeyW');
   const entry=await page.evaluate(()=>{const a=game.player,start=a.position.clone();for(let i=0;i<90;i++){game.step(1/60);stepEntry.push({jumpH:a.jumpH,support:game.planet.arrivalSupport.delta(a.position.clone().normalize()),grounded:a.grounded,distance:game.landing.dir.angleTo(a.position.clone().normalize())*game.planet.R});}return{moved:a.position.distanceTo(start),maxSupport:Math.max(...stepEntry.map(s=>s.support)),maxJumpH:Math.max(...stepEntry.map(s=>s.jumpH)),nearest:Math.min(...stepEntry.map(s=>s.distance)),allGrounded:stepEntry.every(s=>s.grounded),maxStepHeight:a.maxStepHeight,samples:stepEntry};});
   await page.keyboard.up('KeyW');check('parent generic step-up walks onto the 0.16m stone lip without Space',entry.moved>2.5&&entry.maxSupport>.159&&entry.maxJumpH<1e-4&&entry.nearest<1.5&&entry.allGrounded&&entry.maxStepHeight===.22,entry);
   await page.evaluate(()=>{fieldProbe.stage(game.landing.dir.toArray(),game.firstTrail.plan.overlook.toArray());game.input.setTestIntent(null);game.input.reset();});await page.locator('canvas').first().click({position:{x:1050,y:450},force:true});const start=await page.evaluate(()=>game.player.position.toArray());await page.keyboard.down('KeyW');await page.keyboard.down('Space');await page.evaluate(()=>game.step(1/60));await page.keyboard.up('Space');const walk=await page.evaluate(()=>{let peak=0;for(let i=0;i<100;i++){game.step(1/60);peak=Math.max(peak,game.player.jumpH);}return{peak,position:game.player.position.toArray()};});await page.keyboard.up('KeyW');const finish=await page.evaluate(()=>{for(let i=0;i<60;i++)game.step(1/60);return{grounded:game.player.grounded,near:game.landing.near(game.player.position)};});const moved=Math.hypot(...walk.position.map((v,i)=>v-start[i]));check('native W and Space leave the model and land',moved>3&&walk.peak>.65&&finish.grounded&&!finish.near,{moved,peak:walk.peak,...finish});
  }
  await page.close();
 }
 check('same three locked cameras for both actual models',report.shots.every(s=>{const c=locked.shots.find(x=>x.view===s.view);return s.fov===c.fov&&s.camera.every((v,i)=>Math.abs(v-c.camera[i])<1e-10)&&s.quaternion.every((v,i)=>Math.abs(v-c.quaternion[i])<1e-10);}),{shots:report.shots.length});
 check('no browser exceptions',!report.errors.length,report.errors);report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;console.error(e);process.exitCode=1;}finally{fs.writeFileSync(A+'/native-validation.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,5000))]);process.exit(process.exitCode||0);}})();
