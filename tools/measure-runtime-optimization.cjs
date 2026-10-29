// Same fixed view, alternating preserved source/current source; isolated saves.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const fixture=require('./arrival-performance-fixture.cjs'),{stats}=require('./arrival-performance.cjs');
const base='reports/2026-10-29/evidence/runtime-optimization',dest=base+'/performance.json';
const collector=fs.readFileSync('tools/arrival-performance.cjs','utf8'),core=collector.slice(collector.indexOf('async function measurePage('),collector.indexOf('\nasync function run(')),measure=vm.runInNewContext('('+core+')');
const files=['src/core/Engine.js','src/world/PlanetCameraOcclusion.js','src/render/Post.js'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
 assert(!fs.existsSync(dest),'Preserve measured output');
 const config={warmupFrames:40,sampleFrames:120,simulationDt:1/60};
 const report={scope:'Local PC fixed arrival front, 1280x800 DPR1 mid; ABBA actual rAF. Not all-game or school-device FPS. No personal save.',config,measurementCoreSha256:sha(core),rows:[],errors:[]};
 const pins=files.map(file=>({file,before:sha(fs.readFileSync(base+'/before/'+file)),after:sha(fs.readFileSync(file))}));report.files=pins;
 const checkpoint=()=>fs.writeFileSync(dest,JSON.stringify(report,null,2));checkpoint();
 const browser=await chromium.launch({channel:'msedge',headless:true});report.browser=browser.version();
 try{
  for(const [order,phase]of ['before','after','after','before'].entries()){
   const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1}),page=await context.newPage(),errors=[],pending=[];
   const observer=response=>{const file=new URL(response.url()).pathname.slice(1);if(files.includes(file))pending.push(response.body().then(body=>({file,status:response.status(),sha256:sha(body)}),error=>({file,error:error.message})));};
   page.on('response',observer);page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/i.test(m.text()))errors.push(m.text());});
   try{
    if(phase==='before')for(const file of files)await page.route('**/'+file,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(base+'/before/'+file)}));
    await fixture.prepare(page,'after','mid','front',JSON.parse(fs.readFileSync('art/arrival-coherence/v01/performance/cameras.json')));
    const data=await measure(page,config);page.off('response',observer);const network=await Promise.all(pending);
    for(const pin of pins)assert(network.some(r=>r.file===pin.file&&r.status===200&&r.sha256===pin[phase]),'Actual source '+pin.file);
    assert.equal(data.samples.length,config.sampleFrames);assert.equal(data.maxCameraError,0);assert.equal(data.maxActorDisplacement,0);assert.deepEqual(data.drawingBuffer,[1280,800]);assert.equal(data.field.signature,'f2a7ee29');assert(data.field.loaded);assert.equal(data.quality.name,'mid');assert(data.quality.forced);assert.deepEqual(errors,[]);
    report.rows.push({order:order+1,phase,...data,network,errors});checkpoint();
    if(order<2)await page.screenshot({path:base+'/'+phase+'-measured.png'});
    console.log(JSON.stringify({completed:order+1,total:4,phase,rafMeanMs:stats(data.samples.map(v=>v.rafIntervalMs)).mean,stepMs:stats(data.samples.map(v=>v.stepWallMs)).mean,renderSubmitMs:stats(data.samples.map(v=>v.renderSubmitMs)).mean,calls:stats(data.samples.map(v=>v.submittedCalls)).mean}));
   }finally{page.off('response',observer);await Promise.all(pending);await context.close();}
  }
  report.comparisons={};for(const phase of ['before','after']){const rows=report.rows.filter(r=>r.phase===phase),samples=rows.flatMap(r=>r.samples);report.comparisons[phase]={repeats:rows.map(r=>stats(r.samples.map(v=>v.rafIntervalMs)).mean),...Object.fromEntries(['rafIntervalMs','stepWallMs','renderSubmitMs','submittedCalls','submittedTriangles'].map(key=>[key,stats(samples.map(v=>v[key]))]))};}
  for(const pin of pins)assert.equal(sha(fs.readFileSync(pin.file)),pin.after,'Runtime changed during measurement');
  report.pass=true;report.finishedUtc=new Date().toISOString();
 }catch(error){report.pass=false;report.failure=error.stack;console.error(error);process.exitCode=1;}
 finally{checkpoint();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
