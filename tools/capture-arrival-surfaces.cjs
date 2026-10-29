const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright')),fixture=require('./arrival-coherence-fixture.cjs');
const A='art/arrival-surfaces/v01',B='reports/2026-10-27/evidence/arrival-surfaces',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync(A+'/runtime-manifest.json')),locked=JSON.parse(fs.readFileSync('reports/2026-10-27/evidence/arrival-coherence/final-after-mid.json'));
const sites=JSON.parse(fs.readFileSync('reports/2026-10-26/evidence/world-horizon/sites.json')),landing=sites.find(s=>s.id==='landing');
(async()=>{
 fs.mkdirSync(B,{recursive:true});assert(!fs.existsSync(B+'/capture.json'),'Preserve existing capture');
 const browser=await chromium.launch({channel:'msedge',headless:true}),report={scope:'Prepared native baseline and isolated material previews, not installed or traversal',shots:[],errors:[]};
 try{
  for(const variant of ['before','a0','a1']){
   const page=await browser.newPage({viewport:{width:1280,height:800}}),entry=manifest.variants.find(v=>v.variant===variant),responses=[];
   page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/i.test(m.text()))report.errors.push(m.text());});
   if(entry){
    for(const row of [...entry.files,entry.asset])await page.route('**/'+row.file,r=>r.fulfill({contentType:row.file.endsWith('.glb')?'model/gltf-binary':'text/javascript',body:fs.readFileSync(row.preview)}));
    page.on('response',r=>{const row=[...entry.files,entry.asset].find(x=>new URL(r.url()).pathname==='/'+x.file);if(row)responses.push(r.body().then(b=>({file:row.file,status:r.status(),sha256:sha(b)})));});
   }
   await fixture.prepare(page,'after','mid');
   for(const view of ['front','side','rear']){
    const data=await page.evaluate(({landing,view,pose})=>{
     fieldProbe.stage(landing.dir,landing.target,view==='front'?0:view==='side'?Math.PI/2:Math.PI);
     const c=game.engine.camera;c.position.fromArray(pose.camera);c.quaternion.fromArray(pose.quaternion);c.up.fromArray(pose.up);c.fov=pose.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);game.sky.update(game.player,c);game.engine.render();game.engine.render();
     const g=game.landing.group.getObjectByName('Mumu authored arrival dais');
     return{...fieldProbe.shot(),environment:!!game.engine.scene.environment,field:game.meadowField,asset:g.userData,materials:g.children.map(m=>({name:m.name,type:m.material.type,vertexColors:m.material.vertexColors,color:m.material.color.toArray(),metalness:m.material.metalness,roughness:m.material.roughness,clearcoat:m.material.clearcoat??0,clearcoatRoughness:m.material.clearcoatRoughness??0,transmission:m.material.transmission??0,envMapIntensity:m.material.envMapIntensity,emissive:m.material.emissive.toArray(),emissiveIntensity:m.material.emissiveIntensity,surface:m.material.userData.mumuSurfaceVersion||0,role:m.material.userData.mumuSurfaceRole||null,geometry:m.geometry.uuid,positions:m.geometry.attributes.position.count,triangles:(m.geometry.index?.count||m.geometry.attributes.position.count)/3})),glError:game.engine.renderer.getContext().getError()};
    },{landing,view,pose:locked.shots.find(s=>s.view===view)});
    assert(data.environment&&data.field.loaded&&data.glError===0);assert.equal(data.materials.reduce((n,m)=>n+m.triangles,0),16922);assert.equal(data.materials.length,4);
    const pose=locked.shots.find(s=>s.view===view);for(const key of ['camera','up','quaternion','fov','aspect'])assert.deepEqual(data[key],pose[key]);
    if(entry){const b=data.materials.find(m=>m.role==='brass'),l=data.materials.find(m=>m.role==='lens');assert(b?.vertexColors&&l?.vertexColors);assert.equal(b.envMapIntensity,variant==='a1'?.65:1);assert.equal(l.envMapIntensity,variant==='a1'?.85:1);assert.equal(l.clearcoat,variant==='a1'?.75:0);assert.equal(l.transmission,0);assert(Math.max(...l.emissive)*l.emissiveIntensity<=.02);}
    const file=B+'/'+variant+'-'+view+'.png';await page.screenshot({path:file});report.shots.push({variant,view,file,...data});
   }
   if(entry){const rows=await Promise.all(responses);for(const row of [...entry.files,entry.asset])assert(rows.some(r=>r.file===row.file&&r.status===200&&r.sha256===row.sha256),'Native response '+row.file);report.shots.filter(r=>r.variant===variant).forEach(r=>r.network=rows);}
   await page.close();
  }
  for(const r of manifest.baseline)assert.equal(sha(fs.readFileSync(r.file)),r.sha256,r.file);assert.equal(report.errors.length,0);report.pass=true;
  console.log(JSON.stringify({pass:true,variants:3,views:3,rootUnchanged:true}));
 }catch(e){report.pass=false;report.failure=e.stack;console.error(e);process.exitCode=1;}
 finally{fs.writeFileSync(B+'/capture.json',JSON.stringify(report,null,2));await browser.close();}
})();
