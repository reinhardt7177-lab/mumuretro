const fs=require('node:fs'),path=require('node:path'),{prepare,A}=require('./ground-support-fixture.cjs');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright')),variant=process.argv[2]||'root';
if(!['root','terraces'].includes(variant))throw Error('variant root|terraces');
const report={previewOnly:true,variant,wholeFPSClaim:false,checks:[],errors:[]};
function check(name,pass,data){report.checks.push({name,pass:!!pass,data});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(e.message));await prepare(page,variant,true);
 const result=await page.evaluate(()=>{
  const p=game.planet,index=p.meshGroundIndex(),r=new T.Raycaster(),dirs=[],g=p.mesh.geometry,positions=g.attributes.position;
  const checksum=()=>{let h=2166136261;const a=new Uint8Array(positions.array.buffer,positions.array.byteOffset,positions.array.byteLength);for(let i=0;i<a.length;i++)h=Math.imul(h^a[i],16777619);return h>>>0;};const before=checksum();
  for(let i=0;i<620;i++){const y=1-2*(i+.5)/620,a=i*2.399963229728653;dirs.push(new T.Vector3(Math.sqrt(1-y*y)*Math.cos(a),y,Math.sqrt(1-y*y)*Math.sin(a)));}
  for(const lat of[-90,-89.999,0,89.999,90])for(const lon of[-180,-179.999,179.999,180]){const la=lat*Math.PI/180,lo=lon*Math.PI/180;dirs.push(new T.Vector3(Math.cos(la)*Math.cos(lo),Math.sin(la),Math.cos(la)*Math.sin(lo)));}
  let missing=0,maxError=0,maxAnalyticError=0,oracleMs=0,indexMs=0;const candidates=[];
  for(const d of dirs){let started=performance.now();const radius=index.radiusAt(d);indexMs+=performance.now()-started;candidates.push(index.lastCandidates);r.set(d.clone().multiplyScalar(110),d.clone().negate());r.far=110;started=performance.now();const hit=r.intersectObject(p.mesh,false)[0];oracleMs+=performance.now()-started;if(!hit||!Number.isFinite(radius)){missing++;continue;}maxError=Math.max(maxError,Math.abs(radius-hit.point.length()));maxAnalyticError=Math.max(maxAnalyticError,Math.abs(p.R+p.heightAt(d)-(p.arrivalSupport?.delta(d)||0)-radius));}
  const started=performance.now();for(let i=0;i<30000;i++)index.radiusAt(dirs[i%dirs.length]);const queryMs=performance.now()-started;
  const landing=p.groundSurfaceAt(game.landing.dir),soil=index.radiusAt(game.landing.dir),analytic=p.heightAt(game.landing.dir),support=p.arrivalSupport.delta(game.landing.dir);
  return{...index.stats,samples:dirs.length,missing,maxError,maxAnalyticError,fullOracleMs:oracleMs,indexSampleMs:indexMs,queries:30000,queryMs,microsecondsPerQuery:queryMs/30,meanCandidates:candidates.reduce((a,b)=>a+b,0)/candidates.length,maxCandidates:Math.max(...candidates),geometryUnchanged:before===checksum(),support:{added:landing.length()-soil,expected:support,analyticUnchanged:analytic===p.heightAt(game.landing.dir),configured:p.arrivalSupport.height},source:'actual product/candidate geometry, unchanged triangles'};
 });
 check('actual entire-planet sample index matches full Raycaster',!result.missing&&result.maxError<1e-7,result);
 check('mesh coordinates and analytic authoring stay unchanged',result.geometryUnchanged&&result.support.analyticUnchanged);
 check('0.16m arrival support is added exactly once',Math.abs(result.support.added-result.support.expected)<1e-10&&result.support.configured===.16,result.support);
 // Native keyboard W with game steps. Record soil proxy and analytic alternative.
 await page.evaluate(()=>{game.input.setTestIntent(null);game.input.reset();game.dialogue.close();game.brief.hide();window.groundWalk=[];});
 await page.locator('canvas').first().click({position:{x:1050,y:450},force:true});
 const initial=await page.evaluate(()=>game.player.position.toArray());await page.keyboard.down('KeyW');
 await page.evaluate(()=>{for(let i=0;i<110;i++){game.step(1/60);if(i%5===0)groundWalk.push({position:game.player.position.toArray(),jumpH:game.player.jumpH,grounded:game.player.grounded});}});await page.keyboard.up('KeyW');
 const walk=await page.evaluate(initial=>{for(let i=0;i<15;i++)game.step(1/60);return{moved:game.player.position.distanceTo(new T.Vector3().fromArray(initial)),grounded:game.player.grounded,samples:groundWalk};},initial);
 const previous=JSON.parse(fs.readFileSync('reports/2026-10-27/evidence/wayfarer-terraces-v02/controls.json')).candidate;
 await page.evaluate(c=>{fieldProbe.stage(c.start,c.end,0);game.input.setTestIntent(null);game.input.reset();window.groundJump={start:game.player.position.toArray(),samples:[],peak:0};},previous);
 await page.keyboard.down('KeyW');await page.keyboard.down('Space');await page.evaluate(()=>game.step(1/60));await page.keyboard.up('Space');
 await page.evaluate(c=>{for(let i=0;i<100;i++){const target=new T.Vector3().fromArray(c.end),a=game.player;if(a.position.angleTo(target)*game.planet.R<.25)break;const f=target.addScaledVector(a.up,-target.dot(a.up)).normalize();game.engine.camFwd.copy(f);game.engine.camRight.crossVectors(a.up,f).normalize();game.step(1/60);groundJump.peak=Math.max(groundJump.peak,a.jumpH);groundJump.samples.push({position:a.position.toArray(),jumpH:a.jumpH,grounded:a.grounded});}},previous);
 await page.keyboard.up('KeyW');const jump=await page.evaluate(()=>{for(let i=0;i<110;i++){game.step(1/60);if(i%10===0)groundJump.samples.push({position:game.player.position.toArray(),jumpH:game.player.jumpH,grounded:game.player.grounded});}return{...groundJump,end:game.player.position.toArray(),grounded:game.player.grounded,moved:game.player.position.distanceTo(new T.Vector3().fromArray(groundJump.start))};});
 const contacts=await page.evaluate(samples=>{
  const p=game.planet,ray=new T.Raycaster();return samples.filter(s=>s.grounded).map(s=>{const d=new T.Vector3().fromArray(s.position).normalize(),support=p.arrivalSupport.delta(d),radius=new T.Vector3().fromArray(s.position).length();ray.set(d.clone().multiplyScalar(110),d.clone().negate());ray.far=110;const hit=ray.intersectObject(p.mesh,false)[0];return{actualGap:hit?radius-hit.point.length()-support:null,analyticGap:hit?p.R+p.heightAt(d)-hit.point.length()-support:null,carpetLift:game.carpet.liftAt(d),note:'actor soil/support proxy; animated grass carpet and skeletal toe are separate'};});
 },[...walk.samples,...jump.samples]);
 check('native W and Space retain movement, jump and grounded landing',walk.moved>3&&walk.grounded&&jump.moved>1.9&&jump.peak>.65&&jump.grounded,{walk:{...walk,samples:walk.samples.length},jump:{...jump,samples:jump.samples.length}});
 check('native grounded trajectory follows actual soil triangles',contacts.length>8&&contacts.every(c=>c.actualGap!==null&&Math.abs(c.actualGap)<1e-7),{samples:contacts.length,maxActualGap:Math.max(...contacts.map(c=>Math.abs(c.actualGap))),maxPreviousAnalyticGap:Math.max(...contacts.map(c=>Math.abs(c.analyticGap))),maxCarpetLift:Math.max(...contacts.map(c=>c.carpetLift)),contacts});
 const fault=await page.evaluate(()=>{const p=game.planet,index=p.meshGroundIndex(),old=index.radiusAt.bind(index),d=game.player.position.clone().normalize();index.radiusAt=(direction,hit)=>old(direction,hit)+.35;const wrong=p.groundSurfaceAt(d).length(),expected=old(d)+p.arrivalSupport.delta(d);index.radiusAt=old;return{gap:wrong-expected,detected:Math.abs(wrong-expected)>.1};});
 check('contact oracle detects a deliberate 0.35m wrong support',fault.detected,fault);
 const rebuild=await page.evaluate(()=>{const p=game.planet,old=p.meshGroundIndex(),oldGeometry=p.mesh.geometry;p.rebuildTerrain();const rejected=!old.isCurrent(),next=p.meshGroundIndex(),d=game.landing.dir.clone();return{rejected,replaced:old!==next&&oldGeometry!==p.mesh.geometry,finite:Number.isFinite(next.radiusAt(d)),triangles:next.triangles};});
 check('actual terrain rebuild invalidates and lazily reconstructs index',rebuild.rejected&&rebuild.replaced&&rebuild.finite,rebuild);
 check('no browser exceptions',!report.errors.length,report.errors);report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;console.error(e);process.exitCode=1;}finally{fs.writeFileSync(A+'/browser-'+variant+'.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,5000))]);process.exit(process.exitCode||0);}})();
