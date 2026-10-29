require('./forest-render-output-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),fixture=require('./forest-render-fixture.cjs'),{B}=fixture,{chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright')),phase=process.argv[2]||'goal',report={phase,checks:[],errors:[],scope:'PC GPU with real touch/viewport browser emulation;not physical school hardware'};
const check=(name,pass,details)=>{report.checks.push({name,pass:!!pass,details});assert(pass,name+': '+JSON.stringify(details));};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))report.errors.push(m.text());});await fixture.prepare(page,phase,'mid');
 const tiers=await page.evaluate(async()=>{
  const{quality}=await import('/src/render/Quality.js'),helpers=await import('/src/world/StaticMeshBatch.js'),batches=[],rows=[],saved=localStorage.getItem('mumuplanet.progress.v1');game.planetScene.traverse(mesh=>{if(mesh.userData.staticBatch)batches.push({mesh,sources:helpers.staticBatchSources(mesh)});});
  const materials=new Map();for(const b of batches)for(const source of b.sources)materials.set(source,source.material);
  const r=game.engine.renderer,gl=r.getContext();function mode(batched){for(const {mesh,sources}of batches){mesh.visible=batched;for(const source of sources)source.material=batched?materials.get(source):helpers.staticBatchSourceMaterial(source);}}
  function pixels(){r.info.autoReset=false;r.info.reset();game.engine.render();const calls=r.info.render.calls,data=new Uint8Array(r.domElement.width*r.domElement.height*4);gl.readPixels(0,0,r.domElement.width,r.domElement.height,gl.RGBA,gl.UNSIGNED_BYTE,data);r.info.autoReset=true;return{calls,data};}
  for(const tier of['high','mid','low','min']){quality.pin(tier);mode(false);const before=pixels();mode(true);const after=pixels();let sum=0,max=0;for(let i=0;i<before.data.length;i++){const difference=Math.abs(before.data[i]-after.data[i]);sum+=difference;max=Math.max(max,difference);}rows.push({tier,before:before.calls,after:after.calls,max,mean:sum/before.data.length,canvas:[r.domElement.width,r.domElement.height],batches:batches.length});}
  return{rows,saveUnchanged:saved===localStorage.getItem('mumuplanet.progress.v1')};
 });
 check('all four qualities keep the original rendered scene with fewer submissions and unchanged progress',tiers.saveUnchanged&&tiers.rows.every(r=>r.after<r.before&&r.mean<.02),tiers);
 const views=[];for(const[width,height]of [[390,844],[844,390]]){
  await page.setViewportSize({width,height});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{game.engine.render();resolve();}))));
  const row=await page.evaluate(()=>{
   game.engine.render();const r=game.engine.renderer,gl=r.getContext(),data=new Uint8Array(r.domElement.width*r.domElement.height*4);gl.readPixels(0,0,r.domElement.width,r.domElement.height,gl.RGBA,gl.UNSIGNED_BYTE,data);let coloured=0;for(let i=0;i<data.length;i+=64)if(data[i]+data[i+1]+data[i+2]>30)coloured++;
   let batches=0;game.planetScene.traverse(m=>{if(m.userData.staticBatch&&m.visible)batches++;});return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,aspect:game.engine.camera.aspect,canvas:[r.domElement.width,r.domElement.height],batches,coloured};
  });views.push(row);await page.screenshot({path:B+'/touch-'+phase+'-'+width+'.png',animations:'disabled',timeout:60000});
 }
 check('portrait and landscape touch layouts keep actual coloured world pixels and visible batches',views.every(r=>r.width===r.scroll&&Math.abs(r.aspect-r.width/r.height)<1e-8&&r.canvas.every(n=>n>0)&&r.batches>20&&r.coloured>1000),views);
 check('no browser or shader exception',report.errors.length===0,report.errors);report.pass=true;
}catch(error){report.pass=false;report.failure=error.stack;console.error(error);}finally{fs.writeFileSync(B+'/variants-'+phase+'.json',JSON.stringify(report,null,2));await browser.close();if(!report.pass)process.exitCode=1;}})();
