const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),fixture=require('./forest-render-fixture.cjs'),{B}=fixture,{chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const phase=process.argv[2]||'goal',fault=process.argv.find(x=>x.startsWith('--fault='))?.slice(8),report={phase,fault,checks:[],pixels:[],errors:[],scope:'Isolated prepared geometry/render/camera checks,not actual walking or school hardware'};
const check=(name,pass,details)=>{report.checks.push({name,pass:!!pass,details});assert(pass,name+': '+JSON.stringify(details));};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))report.errors.push(m.text());});
 await fixture.prepare(page,phase,'mid',fault?{transform:(file,source)=>file.endsWith('StaticMeshBatch.js')&&fault==='camera'?source.replace('batch.userData.cameraOccluder = false','batch.userData.cameraOccluder = true'):file.endsWith('StaticMeshBatch.js')&&fault==='owner'?source.replace('parent.add(batch);','(parent.parent || parent).add(batch);'):file.endsWith('StaticMeshBatch.js')&&fault==='geometry'?source.replace('geometry.computeBoundingBox(); geometry.computeBoundingSphere();','geometry.translate(.1,0,0); geometry.computeBoundingBox(); geometry.computeBoundingSphere();'):source}:{});
 await page.evaluate(async()=>{
  const helpers=await import('/src/world/StaticMeshBatch.js'),batches=[];game.planetScene.traverse(mesh=>{if(mesh.userData.staticBatch)batches.push({mesh,sources:helpers.staticBatchSources(mesh)});});
  window.batchProbe={batches,helpers,batched:true,mode(batched){this.batched=batched;for(const {mesh,sources}of batches){mesh.visible=batched;for(const source of sources){if(!source.userData.batchHiddenMaterial)source.userData.batchHiddenMaterial=source.material;source.material=batched?source.userData.batchHiddenMaterial:helpers.staticBatchSourceMaterial(source);}}},pixels(){game.engine.render();game.engine.render();const r=game.engine.renderer,gl=r.getContext(),pixels=new Uint8Array(r.domElement.width*r.domElement.height*4);gl.readPixels(0,0,r.domElement.width,r.domElement.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;}};
 });
 const owners=await page.evaluate(()=>({batches:batchProbe.batches.length,sources:batchProbe.batches.reduce((n,b)=>n+b.sources.length,0),wrong:batchProbe.batches.filter(b=>b.sources.some(s=>s.parent!==b.mesh.parent)).length}));
 check('static batches stay inside their original owning candidate or moving crate',owners.batches>20&&owners.sources>200&&owners.wrong===0,owners);
 const geometry=await page.evaluate(()=>{
  let positionError=0,normalError=0,uvError=0,wrongState=0,triangles=0,vertices=0;
  const p=new T.Vector3(),n=new T.Vector3(),q=new T.Vector3();game.planetScene.updateMatrixWorld(true);
  for(const {mesh,sources}of batchProbe.batches){let offset=0,index=0;const g=mesh.geometry;triangles+=g.index.count/3;
   for(const source of sources){const old=source.geometry,mat=batchProbe.helpers.staticBatchSourceMaterial(source);if(mesh.material!==mat||mesh.castShadow!==source.castShadow||mesh.receiveShadow!==source.receiveShadow||mesh.layers.mask!==source.layers.mask)wrongState++;
    const oldNormal=new T.Matrix3().getNormalMatrix(source.matrixWorld),newNormal=new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
    for(let i=0;i<old.attributes.position.count;i++){p.fromBufferAttribute(old.attributes.position,i).applyMatrix4(source.matrixWorld);q.fromBufferAttribute(g.attributes.position,offset+i).applyMatrix4(mesh.matrixWorld);positionError=Math.max(positionError,p.distanceTo(q));if(old.attributes.normal){n.fromBufferAttribute(old.attributes.normal,i).applyMatrix3(oldNormal).normalize();q.fromBufferAttribute(g.attributes.normal,offset+i).applyMatrix3(newNormal).normalize();normalError=Math.max(normalError,n.distanceTo(q));}if(old.attributes.uv){uvError=Math.max(uvError,Math.abs(old.attributes.uv.getX(i)-g.attributes.uv.getX(offset+i)),Math.abs(old.attributes.uv.getY(i)-g.attributes.uv.getY(offset+i)));}vertices++;}
    const count=old.index?.count||old.attributes.position.count;for(let i=0;i<count;i++)if(g.index.getX(index++)!==offset+(old.index?old.index.getX(i):i))wrongState++;offset+=old.attributes.position.count;
   }
  }
  return{positionError,normalError,uvError,wrongState,triangles,vertices};
 });
 check('every merged world vertex normal UV and triangle retains its source material and shadow state',geometry.positionError<1e-5&&geometry.normalError<1e-6&&geometry.uvError===0&&geometry.wrongState===0,geometry);
 const camera=await page.evaluate(()=>{
  const added=game.worldCamera.entries.filter(e=>e.source.userData.staticBatch).length;let missing=0,expected=0;
  const current=new Set(game.worldCamera.entries.map(e=>e.source));
  for(const {sources}of batchProbe.batches)for(const source of sources){source.geometry.computeBoundingSphere();const sphere=source.geometry.boundingSphere.clone().applyMatrix4(source.matrixWorld);if(source.userData.cameraOccluder!==false&&sphere.radius>=.25){expected++;if(!current.has(source))missing++;}}
  const ray=new T.Raycaster(),batches= batchProbe.batches.filter(b=>b.sources.some(s=>current.has(s)));let hits=0,delta=0;
  for(const {sources}of batches)for(const source of sources.filter(s=>current.has(s))){const sphere=source.geometry.boundingSphere.clone().applyMatrix4(source.matrixWorld),origin=sphere.center.clone().add(new T.Vector3(1,2,3).normalize().multiplyScalar(sphere.radius+2));ray.set(origin,sphere.center.clone().sub(origin).normalize());const hidden=ray.intersectObject(source,false);const material=source.material;source.material=batchProbe.helpers.staticBatchSourceMaterial(source);const visible=ray.intersectObject(source,false);source.material=material;if(hidden.length&&visible.length){hits++;delta=Math.max(delta,Math.abs(hidden[0].distance-visible[0].distance));}else if(hidden.length!==visible.length)delta=Infinity;}
  return{added,missing,expected,hits,delta};
 });
 check('camera selection and actual rays retain the original pieces without aggregated obstacles',camera.added===0&&camera.missing===0&&camera.expected>20&&camera.hits>20&&camera.delta===0,camera);
 if(fault==='appearance')await page.evaluate(()=>{for(const b of batchProbe.batches)b.mesh.geometry.setDrawRange(0,0);});
 const before=JSON.parse(fs.readFileSync(B+'/before.json'));for(const shot of before.shots){
  const result=await page.evaluate(shot=>{
   const a=game.player,c=game.engine.camera;a.position.fromArray(shot.actor);a.syncMesh();c.position.fromArray(shot.camera);c.quaternion.fromArray(shot.quaternion);c.up.fromArray(shot.up);c.fov=shot.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);game.scatter.updateFocus(a);game.sky.update(a,c);
   batchProbe.mode(false);const previous=batchProbe.pixels();batchProbe.mode(true);const next=batchProbe.pixels();let max=0,sum=0,changed=0,large=0;for(let i=0;i<previous.length;i++){const d=Math.abs(previous[i]-next[i]);max=Math.max(max,d);sum+=d;if(d)changed++;if(d>8)large++;}return{max,mean:sum/previous.length,changed,large,total:previous.length};
  },shot);report.pixels.push({id:shot.id,view:shot.view,...result});
 }
 check('all fifteen fixed views preserve the original rendered appearance',report.pixels.every(r=>r.mean<.02&&r.large/r.total<.0001),report.pixels);
 if(fault==='visibility')await page.evaluate(()=>{const b=batchProbe.batches.find(b=>game.forage.sites.some(s=>s.cands?.some(c=>c.grp===b.mesh.parent)));b.mesh.parent.parent.add(b.mesh);});
 const visibility=await page.evaluate(()=>{
  let tested=0,leaked=0,wrong=0;const rows=[],renderer=game.engine.renderer,original=renderer.renderBufferDirect,camera=game.engine.camera,oldCamera={position:camera.position.clone(),quaternion:camera.quaternion.clone(),up:camera.up.clone()};
  try{for(const site of game.forage.sites)for(const candidate of site.cands||[]){
   // Select by the original owner, so a wrongly reparented batch cannot vanish
   // from this test's target list. First prove the target is actually drawn.
   const batches=batchProbe.batches.filter(b=>b.sources.some(source=>source.parent===candidate.grp));if(!batches.length)continue;tested++;
   candidate.grp.updateWorldMatrix(true,true);const point=candidate.grp.getWorldPosition(new T.Vector3()),up=new T.Vector3(0,1,0).applyQuaternion(site.group.quaternion),offset=new T.Vector3(0,2.4,5).applyQuaternion(site.group.quaternion);camera.position.copy(point).add(offset);camera.up.copy(up);camera.lookAt(point.clone().addScaledVector(up,.5));camera.updateMatrixWorld(true);
   let submitted=0;renderer.renderBufferDirect=function(...args){const before=renderer.info.render.calls,result=original.apply(this,args);if(batches.some(b=>b.mesh===args[4]))submitted+=renderer.info.render.calls-before;return result;};
   const old=candidate.grp.visible;candidate.grp.visible=true;game.engine.render();const visibleDraws=submitted;submitted=0;candidate.grp.visible=false;game.engine.render();leaked+=submitted;candidate.grp.visible=old;rows.push({site:site.id,visibleDraws,hiddenDraws:submitted});renderer.renderBufferDirect=original;
   for(const {sources}of batches)if(sources.some(source=>!source.userData.staticBatchWitness||source.material.visible))wrong++;
  }}finally{renderer.renderBufferDirect=original;camera.position.copy(oldCamera.position);camera.quaternion.copy(oldCamera.quaternion);camera.up.copy(oldCamera.up);camera.updateMatrixWorld(true);}
  return{tested,leaked,wrong,rows};
 });
 check('hiding one harvested candidate suppresses its real submitted batches and source pieces',visibility.tested>10&&visibility.rows.every(r=>r.visibleDraws>0)&&visibility.leaked===0&&visibility.wrong===0,visibility);
 if(fault==='calls')await page.evaluate(()=>{const mode=batchProbe.mode.bind(batchProbe);batchProbe.mode=function(batched){mode(batched);if(batched)for(const b of this.batches)for(const source of b.sources)source.material=this.helpers.staticBatchSourceMaterial(source);};});
 const calls=await page.evaluate(()=>{const r=game.engine.renderer,rows=[];for(const mode of[false,true]){batchProbe.mode(mode);r.info.autoReset=false;r.info.reset();game.engine.render();rows.push({mode,calls:r.info.render.calls,triangles:r.info.render.triangles});}r.info.autoReset=true;return rows;});
 check('the unchanged world view actually submits fewer draw calls',calls[1].calls<calls[0].calls,calls);
 check('no browser or shader exceptions',report.errors.length===0,report.errors);report.pass=true;
}catch(error){report.pass=false;report.failure=error.stack;console.error(error);}finally{fs.writeFileSync(B+'/check-'+phase+(fault?'-fault-'+fault:'')+'.json',JSON.stringify(report,null,2));await browser.close();if(!report.pass)process.exitCode=1;}})();
