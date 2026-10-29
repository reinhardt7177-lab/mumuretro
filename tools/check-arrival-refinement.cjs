const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright')),fixture=require('./arrival-refinement-fixture.cjs'),{A,B}=fixture;
const phase=process.argv[2]||'goal',fault=process.argv.includes('--fault=color'),tag=(process.argv.find(v=>v.startsWith('--name='))?.slice(7)||phase)+(fault?'-fault-color':''),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert(/^[a-zA-Z0-9_-]+$/.test(tag),'Invalid evidence name');
const report={phase,preview:phase!=='after',fault,scope:'Prepared three-camera material/geometry/contact observation; separate from input tests',checks:[],shots:[],errors:[]};
const check=(name,pass,details)=>{report.checks.push({name,pass:!!pass,details});assert(pass,name);};
(async()=>{
 assert(!fs.existsSync(B+'/check-'+tag+'.json'),'Preserve existing check');
 const m=JSON.parse(fs.readFileSync(A+'/manifest.json')),needed=[...m.files,...m.assets],pending=[];
 const locked=JSON.parse(fs.readFileSync('reports/2026-10-27/evidence/arrival-coherence/final-after-mid.json')),sites=JSON.parse(fs.readFileSync('reports/2026-10-26/evidence/world-horizon/sites.json')),landing=sites.find(s=>s.id==='landing');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>report.errors.push(e.message));p.on('console',msg=>{if(msg.type()==='error'&&/shader|WebGL|THREE/i.test(msg.text()))report.errors.push(msg.text());});
  // Observe the game's original GLB response before it is consumed. DevTools
  // may evict a streamed body; cloning adds no request or asset replacement.
  await p.addInitScript(files=>{const expected=new Set(files),native=fetch.bind(window),audit={pending:[],rows:[]};window.__refinementNativeFetch=audit;window.fetch=async(...args)=>{const response=await native(...args),file=new URL(response.url,location.href).pathname.slice(1);if(expected.has(file)){const pending=response.clone().arrayBuffer().then(async bytes=>{const digest=await crypto.subtle.digest('SHA-256',bytes);audit.rows.push({file,status:response.status,sha256:[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join(''),method:'original fetch response.clone; no extra request'});}).catch(e=>audit.rows.push({file,bodyError:e.message,method:'original fetch clone'}));audit.pending.push(pending);}return response;};},needed.filter(r=>r.file.endsWith('.glb')).map(r=>r.file));
  p.on('response',r=>{const row=needed.find(x=>new URL(r.url()).pathname==='/'+x.file);if(row)pending.push(r.body().then(b=>({file:row.file,status:r.status(),sha256:sha(b)}),e=>({file:row.file,status:r.status(),bodyError:e.message})));});
  await fixture.prepare(p,phase,'mid');
  if(fault)await p.evaluate(()=>{for(const mesh of game.landing.group.getObjectByName('Mumu authored arrival dais').children)if(mesh.material.userData.mumuSurfaceVersion===1){mesh.material.vertexColors=false;mesh.material.needsUpdate=true;}});
  for(const view of ['front','side','rear']){
   const data=await p.evaluate(({landing,view,pose})=>{
    fieldProbe.stage(landing.dir,landing.target,view==='front'?0:view==='side'?Math.PI/2:Math.PI);const c=game.engine.camera;c.position.fromArray(pose.camera);c.quaternion.fromArray(pose.quaternion);c.up.fromArray(pose.up);c.fov=pose.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);game.sky.update(game.player,c);game.engine.render();game.engine.render();
    const g=game.landing.group.getObjectByName('Mumu authored arrival dais'),soil=game.planet.mesh.geometry,carpet=game.carpet.mesh.geometry;
    const materials=g.children.map(mesh=>({name:mesh.name,type:mesh.material.type,role:mesh.material.userData.mumuSurfaceRole??null,version:mesh.material.userData.mumuSurfaceVersion??0,vertexColors:mesh.material.vertexColors,metalness:mesh.material.metalness,roughness:mesh.material.roughness,env:mesh.material.envMapIntensity,clearcoat:mesh.material.clearcoat||0,transmission:mesh.material.transmission||0,emissive:mesh.material.emissive.toArray(),emissiveIntensity:mesh.material.emissiveIntensity,triangles:(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3}));
    const up=game.landing.dir,fr=game.planet.frameAt(game.landing.pos),ray=new T.Raycaster(),point=new T.Vector3(),direction=new T.Vector3(),samples=[];g.updateWorldMatrix(true,true);
    for(const radius of [.08,.4,.8,1.3,1.8,2.12,2.3,2.43,2.55])for(let i=0;i<32;i++){
     const a=(i+.31)*Math.PI/16;point.set(Math.cos(a)*radius,0,Math.sin(a)*radius).applyQuaternion(fr.quaternion).add(game.landing.pos);direction.copy(point).normalize();const native=game.planet.surfaceAt(direction,new T.Vector3());ray.set(native.clone().addScaledVector(direction,2),direction.clone().negate());ray.far=4;
     const floor=ray.intersectObjects(g.children,false)[0],other=ray.intersectObjects([game.planet.mesh,game.carpet.mesh],false)[0];samples.push({radius,gap:floor?floor.point.length()-native.length():null,clear:!!floor&&(!other||floor.distance<=other.distance+.002)});
    }
    return{...fieldProbe.shot(),field:game.meadowField,environment:!!game.engine.scene.environment,asset:g.userData,materials,soil:{indexed:!!soil.index,positions:soil.attributes.position.count,triangles:(soil.index?.count||soil.attributes.position.count)/3,stats:soil.userData.exactTerrainIndex},carpet:{indexed:!!carpet.index,positions:carpet.attributes.position.count,stats:carpet.userData.exactTerrainIndex},cpuCache:game.planet._unpaintedColors.length,groundCurrent:game.planet.meshGroundIndex().isCurrent(),cameraMeshes:g.children.filter(mesh=>game.worldCamera.entries.some(e=>e.source===mesh)).length,samples,glError:game.engine.renderer.getContext().getError()};
   },{landing,view,pose:locked.shots.find(s=>s.view===view)});
   const pose=locked.shots.find(s=>s.view===view);for(const key of ['camera','up','quaternion','fov','aspect'])assert.deepEqual(data[key],pose[key]);
   const file=B+'/'+tag+'-'+view+'.png';await p.screenshot({path:file});report.shots.push({view,file,...data});
  }
  const d=report.shots[0];
  check('selected A0 material roles use actual vertex colour and quiet emission',report.shots.every(s=>{const brass=s.materials.find(m=>m.role==='brass'),lens=s.materials.find(m=>m.role==='lens');return brass?.version===1&&lens?.version===1&&brass.vertexColors&&lens.vertexColors&&brass.metalness<=.3&&lens.type==='MeshStandardMaterial'&&lens.clearcoat===0&&lens.transmission===0&&s.environment&&Math.max(...lens.emissive)*lens.emissiveIntensity<=.02;}),report.shots.map(s=>({view:s.view,materials:s.materials})));
  check('final terrain preserves triangle count and valid CPU repaint cache',d.soil.indexed&&d.carpet.indexed&&d.soil.triangles===179440&&d.cpuCache===d.soil.positions*3&&d.groundCurrent,{soil:d.soil,carpet:d.carpet,cpuCache:d.cpuCache,groundCurrent:d.groundCurrent});
  const missing=d.samples.filter(s=>s.gap===null),covered=d.samples.filter(s=>!s.clear),max=Math.max(...d.samples.filter(s=>s.gap!==null).map(s=>Math.abs(s.gap)));
  check('visible dais contact and all four camera meshes remain',!missing.length&&!covered.length&&max<=.05&&d.cameraMeshes===4,{samples:d.samples.length,missing:missing.length,covered:covered.length,maxAbsoluteGap:max,cameraMeshes:d.cameraMeshes});
  check('final field and all three WebGL renders are valid',report.shots.every(s=>s.field.loaded&&s.field.signature==='f2a7ee29'&&s.glError===0),report.shots.map(s=>({view:s.view,field:s.field,glError:s.glError})));
  const originalFetch=await p.evaluate(async()=>{await Promise.all(__refinementNativeFetch.pending);return __refinementNativeFetch.rows;});
  report.network=[...await Promise.all(pending),...originalFetch];check('all preview or native product responses match declared bytes',needed.every(row=>report.network.some(r=>r.file===row.file&&r.status===200&&r.sha256===row.sha256)),report.network);
  const changed=new Set(phase==='after'?needed.map(r=>r.file):[]),drift=m.baseInventory.filter(r=>!changed.has(r.file)&&sha(fs.readFileSync(r.file))!==r.sha256).map(r=>r.file);check('unrelated runtime and browser exceptions remain unchanged',!drift.length&&!report.errors.length,{drift,errors:report.errors});report.pass=true;
  console.log(JSON.stringify({phase,pass:true,checks:report.checks.length,photos:3,nativeHTTP:report.network.length,soilUnique:d.soil.positions,carpetUnique:d.carpet.positions}));
 }catch(e){report.pass=false;report.failure=e.stack;console.error(e);process.exitCode=1;}
 finally{fs.writeFileSync(B+'/check-'+tag+'.json',JSON.stringify(report,null,2));await browser.close();}
})();
