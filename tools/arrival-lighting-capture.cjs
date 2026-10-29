const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture=require('./arrival-dais-fixture.cjs'),{chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const A='art/arrival-coherence/v01/lighting',phase=process.argv[2]||'preview',tag=process.argv[3]||phase;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f));
const own=read(A+'/preview-files.json').files,baseline=read(A+'/baseline.json');
function guard(){for(const r of baseline.runtimeFiles)assert.equal(hash(fs.readFileSync(r.file)),r.sha256,'Root changed '+r.file);}
(async()=>{guard();const browser=await chromium.launch({channel:'msedge',headless:true});const report={phase,tag,preparedView:true,actualTraversal:false,shots:[],errors:[],http:[],source:own,rootFiles:baseline.runtimeFiles.length};
try{
 const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const network=[];
 p.on('response',r=>{const f=new URL(r.url()).pathname.slice(1);if(own.some(s=>s.file===f))network.push((async()=>({file:f,status:r.status(),fromServiceWorker:r.fromServiceWorker(),sha256:hash(await r.body())}))());});
 if(phase!=='before')for(const row of own)await p.route('**/'+row.file,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(A+'/preview-'+row.file.replaceAll('/','__'),'utf8')}));
 await fixture.prepare(p,'after','mid');
 const site=read('reports/2026-10-26/evidence/world-horizon/sites.json').find(s=>s.id==='landing'),locks=read('reports/2026-10-26/evidence/arrival-dais/after.json');
 for(const [view,yaw] of [['front',0],['side',Math.PI/2],['rear',Math.PI]]){
  const locked=locks.shots.find(s=>s.view===view);
  const data=await p.evaluate(({site,yaw,locked})=>{
    fieldProbe.stage(site.dir,site.target,yaw);const e=game.engine,c=e.camera;c.position.fromArray(locked.camera);c.quaternion.fromArray(locked.quaternion);c.up.fromArray(locked.up);c.fov=locked.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);game.sky.update(game.player,c);e.render();e.render();
    const direction=l=>new T.Vector3().subVectors(l.position,l.target.position).normalize().toArray();
    return {...fieldProbe.shot(),lighting:{hemiDirection:e.hemi.position.toArray(),hemiIntensity:e.hemi.intensity,sunDirection:direction(e.sun),sunIntensity:e.sun.intensity,fillDirection:direction(e.fill),fillIntensity:e.fill.intensity,environment:!!e.scene.environment,environmentData:e.scene.userData.outdoorLighting??null,fog:e.scene.fog?{type:e.scene.fog.type,color:e.scene.fog.color.getHexString(),near:e.scene.fog.near,far:e.scene.fog.far,density:e.scene.fog.density}:null,exposure:e.renderer.toneMappingExposure,toneMapping:e.renderer.toneMapping,outputColorSpace:e.renderer.outputColorSpace,bloom:game.post?.bloomStrength??e.post.bloomStrength,saturation:e.post.saturation}};
  },{site,yaw,locked});
  for(const key of ['camera','quaternion','up','fov','aspect'])assert.deepEqual(data[key],locked[key],'Camera mismatch '+view+':'+key);
  await p.screenshot({path:A+'/'+tag+'-'+view+'.png'});report.shots.push({view,...data});
 }
 report.http=await Promise.all(network);assert.equal(report.http.length,own.length);for(const r of report.http){assert.equal(r.status,200);assert.equal(r.fromServiceWorker,false);assert.equal(r.sha256,phase==='before'?own.find(o=>o.file===r.file).beforeSha256:own.find(o=>o.file===r.file).previewSha256);}
 assert.deepEqual(report.errors,[]);guard();report.pass=true;console.log(JSON.stringify({pass:true,phase,tag,matchedCameras:3,sourceResponses:report.http.length,rootPreserved:466}));
}catch(e){report.pass=false;report.failure=e.stack;console.error(e);process.exitCode=1;}finally{fs.writeFileSync(A+'/'+tag+'.json',JSON.stringify(report,null,2));await browser.close();}})();
