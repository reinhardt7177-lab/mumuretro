const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright')),fixture=require('./arrival-performance-fixture.cjs'),{stats}=require('./arrival-performance.cjs'),{A,B}=require('./arrival-refinement-fixture.cjs');
const read=p=>JSON.parse(fs.readFileSync(p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const collector=fs.readFileSync('tools/arrival-performance.cjs','utf8'),core=collector.slice(collector.indexOf('async function measurePage('),collector.indexOf('\nasync function run(')),measure=vm.runInNewContext('('+core+')');
(async()=>{
 assert(process.argv.includes('--other-jobs-ended'),'Confirm all other browser/Blender work ended');
 const out=B+'/performance';assert(!fs.existsSync(out),'Preserve prior samples');fs.mkdirSync(out,{recursive:true});
 const m=read(A+'/manifest.json'),initial=read(B+'/installation.json'),guard=read(B+'/guard-installation.json'),cameras=read('art/arrival-coherence/v01/performance/cameras.json');
 assert(guard.pass&&guard.written.length===2,'Capability fallback must be installed before final measurement');
 const finalRows=[...m.files,...m.assets],installed={...initial,written:initial.written.map(row=>({...row,sha256:finalRows.find(r=>r.file===row.file).sha256}))};
 assert.equal(installed.runtimeFiles,476);for(const row of installed.written)assert.equal(sha(fs.readFileSync(row.file)),row.sha256,row.file);
 const conditions=[{tier:'mid',view:'front'},{tier:'mid',view:'side'},{tier:'mid',view:'rear'},{tier:'min',view:'front'}],config={warmupFrames:90,sampleFrames:240,simulationDt:1/60};
 const report={scope:'Local PC stationary Root474 versus installed476 package including capability fallback; three mid views and min front only. Not school-device or whole-game FPS, startup or GPU-time proof.',measurementCoreSha256:sha(core),manifestSha256:sha(fs.readFileSync(A+'/manifest.json')),guardReceiptSha256:sha(fs.readFileSync(B+'/guard-installation.json')),installedFiles:installed.written.map(r=>({file:r.file,sha256:r.sha256})),createdUtc:new Date().toISOString(),config,conditions,rows:[],errors:[]},checkpoint=()=>fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));checkpoint();
 const browser=await chromium.launch({channel:'msedge',headless:true});report.browser=browser.version();
 try{
  for(const condition of conditions)for(const [i,phase]of ['before','after','after','before'].entries()){
   const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1}),page=await context.newPage(),errors=[],pending=[];
   const sources=phase==='before'?installed.written.filter(r=>r.backup).map(r=>({file:r.file,path:r.backup,sha256:r.beforeSha256})):installed.written.map(r=>({file:r.file,path:r.file,sha256:r.sha256}));
   const oldModel=m.baseInventory.find(r=>r.file==='assets/models/adventure/arrival-dais-v05.glb');if(phase==='before')sources.push({file:oldModel.file,path:oldModel.file,sha256:oldModel.sha256});
   await page.addInitScript(files=>{const required=new Set(files),native=fetch.bind(window),a={pending:[],rows:[]};window.__refinementFetch=a;window.fetch=async(...args)=>{const r=await native(...args),file=new URL(r.url,location.href).pathname.slice(1);if(required.has(file)){const p=r.clone().arrayBuffer().then(async bytes=>{const d=await crypto.subtle.digest('SHA-256',bytes);a.rows.push({file,status:r.status,sha256:[...new Uint8Array(d)].map(v=>v.toString(16).padStart(2,'0')).join('')});}).catch(e=>a.rows.push({file,error:e.message}));a.pending.push(p);}return r;};},sources.filter(r=>r.file.endsWith('.glb')).map(r=>r.file));
   const observer=r=>{const file=new URL(r.url()).pathname.slice(1);if(sources.some(s=>s.file===file))pending.push(r.body().then(b=>({file,status:r.status(),sha256:sha(b)}),e=>({file,status:r.status(),error:e.message})));};page.on('response',observer);page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error'&&/shader|WebGL|THREE/i.test(msg.text()))errors.push(msg.text());});
   try{
    if(phase==='before')for(const row of sources.filter(r=>r.file.startsWith('src/')))await page.route('**/'+row.file,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(row.path)}));
    await fixture.prepare(page,'after',condition.tier,condition.view,cameras);
    const clone=await page.evaluate(async()=>{await Promise.all(__refinementFetch.pending);return __refinementFetch.rows;});page.off('response',observer);const network=[...await Promise.all(pending),...clone];
    for(const row of sources)assert(network.some(r=>r.file===row.file&&r.status===200&&r.sha256===row.sha256),'Response '+row.file);
    const data=await measure(page,config);assert.equal(data.samples.length,240);assert.equal(data.maxCameraError,0);assert.equal(data.maxActorDisplacement,0);assert(data.field.loaded&&data.field.signature==='f2a7ee29');assert.equal(data.terrainTriangles,179440);assert.equal(data.quality.name,condition.tier);assert(data.quality.forced);assert.deepEqual(errors,[]);
    report.rows.push({...condition,phase,order:i+1,...data,network,errors});checkpoint();console.log(JSON.stringify({completed:report.rows.length,total:16,...condition,phase,rafMeanMs:stats(data.samples.map(v=>v.rafIntervalMs)).mean,logicalBytes:data.logicalBuffers.logicalUniqueByteRanges}));
   }finally{page.off('response',observer);await Promise.all(pending);await context.close();}
  }
  report.comparisons=conditions.map(condition=>{const c={...condition};for(const phase of ['before','after']){const rows=report.rows.filter(r=>r.tier===condition.tier&&r.view===condition.view&&r.phase===phase),samples=rows.flatMap(r=>r.samples);assert.equal(rows.length,2);assert.deepEqual(rows[0].logicalBuffers,rows[1].logicalBuffers);c[phase]={replicateRafMeans:rows.map(r=>stats(r.samples.map(s=>s.rafIntervalMs)).mean),rafIntervalMs:stats(samples.map(s=>s.rafIntervalMs)),stepWallMs:stats(samples.map(s=>s.stepWallMs)),renderSubmitMs:stats(samples.map(s=>s.renderSubmitMs)),submittedCalls:stats(samples.map(s=>s.submittedCalls)),submittedTriangles:stats(samples.map(s=>s.submittedTriangles)),logicalBuffers:rows[0].logicalBuffers,drawingBuffer:rows[0].drawingBuffer};}assert.deepEqual(c.before.drawingBuffer,c.after.drawingBuffer);return c;});
  for(const row of installed.written)assert.equal(sha(fs.readFileSync(row.file)),row.sha256,row.file);const touched=new Set(installed.written.map(r=>r.file));for(const row of m.baseInventory)if(!touched.has(row.file))assert.equal(sha(fs.readFileSync(row.file)),row.sha256,row.file);
  report.pass=true;report.endedUtc=new Date().toISOString();console.log(JSON.stringify({pass:true,rows:report.rows.length,samples:3840}));
 }catch(e){report.pass=false;report.failure=e.stack;console.error(e);process.exitCode=1;}
 finally{checkpoint();await browser.close();}
})();
