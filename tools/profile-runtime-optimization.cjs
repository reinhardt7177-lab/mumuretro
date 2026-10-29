// Instrumented attribution only. Fresh context: never reads the user's save.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const fixture=require('./arrival-performance-fixture.cjs');
const out='reports/2026-10-29/evidence/runtime-optimization';
fs.mkdirSync(out,{recursive:true});
const phase=process.argv[2]||'baseline',dest=path.join(out,phase+'-profile.json');
if(fs.existsSync(dest))throw Error('Preserve existing evidence: '+dest);
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const cameras=JSON.parse(fs.readFileSync('art/arrival-coherence/v01/performance/cameras.json'));
  await fixture.prepare(page,'after','mid','front',cameras);
  const cdp=await context.newCDPSession(page);
  await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:100});await cdp.send('Profiler.start');
  const run=await page.evaluate(async()=>{
   const g=game,e=g.engine,r=e.renderer,m={},restore=[];
   function wrap(owner,key,label){const original=owner[key];if(typeof original!=='function')return;const stat=m[label]={calls:0,ms:0};owner[key]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{stat.calls++;stat.ms+=performance.now()-start;}};restore.push(()=>owner[key]=original);}
   for(const [owner,key,label]of [[g.worldCamera,'query','camera broad phase'],[e,'updateCamera','camera complete'],[g.scatter,'resolve','scatter body collision'],[g.scatter,'updateFocus','scatter focus'],[g.sky,'update','sky'],[g.meadow,'update','grass'],[g.player,'update','player'],[e,'render','render submission']])wrap(owner,key,label);
   const oldAuto=r.info.autoReset;r.info.autoReset=false;
   try{
    let submittedCalls=0,triangles=0;
    for(let i=0;i<240;i++){r.info.reset();g.step(1/60);e.render();submittedCalls+=r.info.render.calls;triangles+=r.info.render.triangles;}
    return{scope:'Instrumented synchronous 240 fixed updates/renders; CPU attribution, not FPS or GPU timing. Inclusive method rows overlap.',updates:240,methods:m,meanCalls:submittedCalls/240,meanTriangles:triangles/240,cameraEntries:g.worldCamera.count,selectedCameraEntries:e.camColliders.length,actor:g.player.position.toArray()};
   }finally{r.info.autoReset=oldAuto;restore.reverse().forEach(f=>f());}
  });
  const {profile}=await cdp.send('Profiler.stop');
  fs.writeFileSync(path.join(out,phase+'.cpuprofile'),JSON.stringify(profile));
  const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map();for(const n of nodes.values())for(const child of n.children||[])parents.set(child,n.id);
  const self=new Map(),inclusive=new Map();let total=0;
  for(let i=0;i<profile.samples.length;i++){const delta=profile.timeDeltas[i];total+=delta;let id=profile.samples[i],first=true;const seen=new Set();while(id){const n=nodes.get(id),key=n.callFrame.url+'#'+n.callFrame.functionName;if(first)self.set(key,(self.get(key)||0)+delta);if(!seen.has(key)){inclusive.set(key,(inclusive.get(key)||0)+delta);seen.add(key);}first=false;id=parents.get(id);}}
  const top=map=>[...map].filter(([key])=>key.includes('/src/')||key.includes('/vendor/')).sort((a,b)=>b[1]-a[1]).slice(0,18).map(([key,microseconds])=>({key,ms:microseconds/1000,percent:100*microseconds/total}));
  const files=['src/world/PlanetCameraOcclusion.js','src/core/Engine.js','src/world/Scatter.js','src/render/InteriorDirection.js'].filter(fs.existsSync).map(file=>({file,sha256:sha(file)}));
  const report={phase,browser:browser.version(),files,run,self:top(self),inclusive:top(inclusive),errors};
  fs.writeFileSync(dest,JSON.stringify(report,null,2));
  await page.screenshot({path:path.join(out,phase+'-front.png')});
  console.log(JSON.stringify({phase,run,self:report.self.slice(0,8),inclusive:report.inclusive.slice(0,8),errors}));
  if(errors.length)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
