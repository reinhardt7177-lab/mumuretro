const fs=require('node:fs'),path=require('node:path'),fixture=require('./camera-cost-fixture.cjs'),{chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'.','playwright'));
const report={scope:'Local isolated Edge CPU step attribution,300warmup+600controller updates per page; no rendering or FPS claim. Before/goal/goal/before ordering limits systematic warmup bias.',rows:[],errors:[]},phases=['before','goal','goal','before'],name=process.argv.find(v=>v.startsWith('--out='))?.slice(6)||'cpu-confirm';
if(!/^[a-z0-9-]+$/.test(name))throw Error('Use a plain lowercase evidence name');const output=fixture.B+'/'+name+'.json';if(fs.existsSync(output))throw Error('Preserve the existing CPU observation; use --out=new-observation-name');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const kind of['balance','sift'])for(const phase of kind==='balance'?phases:[...phases].reverse()){
  const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(e.message));await fixture.prepare(page,kind,phase);
  const row=await page.evaluate(({kind,phase})=>{
   const actor=game.roomActor,targets=[[3.1,5.4],[3.1,3.4],[0,3.4]],samples=[];let index=0,travel=0,moving=0;
   function tick(){let target=targets[index];if(Math.hypot(actor.position.x-target[0],actor.position.z-target[1])<.1){index=(index+1)%targets.length;target=targets[index];}const before=actor.position.clone();actor.camYaw=Math.atan2(-(target[0]-actor.position.x),-(target[1]-actor.position.z));game.brief.hide();game.input.setTestIntent({y:1,run:true});const start=performance.now();game.step(1/60);const ms=performance.now()-start;return{ms,travel:actor.position.distanceTo(before)};}
   for(let i=0;i<300;i++)tick();const from={...actor._cameraRayQuery.stats},start=performance.now();for(let i=0;i<600;i++){const s=tick();samples.push(s.ms);travel+=s.travel;moving+=s.travel>.001;}const elapsed=performance.now()-start; samples.sort((a,b)=>a-b);
   return{kind,phase,updates:600,elapsedMs:elapsed,meanStepMs:elapsed/600,medianStepMs:samples[300],p90StepMs:samples[540],travel,movingSamples:moving,actor:actor.position.toArray(),camera:game.engine.camera.position.toArray(),queries:Object.fromEntries(Object.entries(actor._cameraRayQuery.stats).filter(([k,v])=>typeof v==='number').map(([k,v])=>[k,v-(from[k]||0)]))};
  },{kind,phase});row.sources=fixture.hashes(phase);report.rows.push(row);console.log(JSON.stringify(row));await page.close();
 }
 report.pass=report.rows.length===8&&report.rows.every(r=>r.updates===600&&r.movingSamples>400)&&!report.errors.length;
}catch(e){report.pass=false;report.failure=e.stack;process.exitCode=1;console.error(e);}finally{fs.writeFileSync(output,JSON.stringify(report,null,2));await browser.close();}})();
