const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {ROOT,A,COMBINED,read,json,sha}=require('./arrival-performance-prepare.cjs');
function checkSnapshot(){
 const m=json(A+'/manifest.json'),c=json(A+'/cameras.json'),candidate=json(COMBINED);
 for(const r of m.files){assert.equal(sha(read(r.snapshot)),r.beforeSha256,'Before snapshot drift: '+r.file);assert.equal(r.snapshotSha256,r.beforeSha256);}
 assert.equal(sha(read(A+'/cameras.json')),m.camerasSha256,'Camera snapshot drift');
 assert.deepEqual(candidate.files.map(r=>r.file).sort(),[...m.files.map(r=>r.file),...m.absentBefore].sort(),'Candidate target set changed; review tool before measurement');
 for(const r of m.files)assert.equal(candidate.files.find(v=>v.file===r.file).beforeSha256,r.beforeSha256,'Candidate baseline changed: '+r.file);
 assert.deepEqual(c.views.map(v=>v.view),['front','side','rear']);
 return{m,c,candidate};
}
function installedReceipt(){
 const {m,c,candidate}=checkSnapshot(),files=[...candidate.files,...candidate.assets].map(r=>({file:r.file,sha256:sha(read(r.file)),expectedSha256:sha(read(r.preview)),bytes:read(r.file).length}));
 for(const r of files)assert.equal(r.sha256,r.expectedSha256,'Installed native file does not match candidate: '+r.file);
 const intended=new Set(candidate.files.map(r=>r.file)),drift=m.baseInventory.filter(r=>!intended.has(r.file)&&(!fs.existsSync(path.join(ROOT,r.file))||sha(read(r.file))!==r.sha256)).map(r=>r.file);
 assert.deepEqual(drift,[],'Unrelated Root baseline changed; review scope before measuring');
 return{m,c,candidate,files,combinedManifestSha256:sha(read(COMBINED))};
}
async function prepare(page,phase,tier,view,cameras){
 const {m}=checkSnapshot();
 // Only current 466 originals. No historical forest/camera fixture is imported.
 if(phase==='before')for(const row of m.files)await page.route('**/'+row.file,r=>r.fulfill({contentType:'text/javascript',body:read(row.snapshot)}));
 await page.goto('http://127.0.0.1:5512/?q='+tier);
 await page.waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',null,{timeout:120000,polling:100});
 await page.evaluate(()=>game.loop.stop());await page.locator('#title .go').click({force:true});
 await page.evaluate(async({tier,view,cameras})=>{
  window.T=await import('three');game.loop.stop();game.dialogue.close();game.brief.hide();
  const quality=(await import('/src/render/Quality.js')).quality;quality.pin(tier);
  game.lab.importState({version:1,dials:[3,5,8],hasNote:true,read:true,open:true,done:false,sent:false,parcelRecovered:true});
  game.notebook.setHas(true);game.landOnPlanet();game.dialogue.close();game.brief.hide();game.input.setTestIntent({});
  for(let i=0;i<150;i++)game.step(1/60);
  const {landing}=cameras,a=game.player,e=game.engine;
  a.setLatLon(Math.asin(landing.dir[1])*180/Math.PI,Math.atan2(landing.dir[2],landing.dir[0])*180/Math.PI);
  const forward=new T.Vector3().fromArray(landing.target);forward.addScaledVector(a.up,-forward.dot(a.up)).normalize();
  a.heading.copy(forward);a.syncMesh();e.camFwd.copy(forward);e.camUp.copy(a.up);e._camPlaced=false;
  game.input.camDist=7.6;game.input.camPitch=.32;
  for(let i=0;i<90;i++)game.step(1/60);
  a.lastArc=0;e.camFwd.copy(forward).applyAxisAngle(a.up,view==='side'?Math.PI/2:view==='rear'?Math.PI:0);e._camPlaced=false;
  e.camColliders=game.worldCamera.query(a.position,7.6);
  const pose=cameras.views.find(v=>v.view===view),camera=e.camera;
  function lock(){camera.position.fromArray(pose.camera);camera.quaternion.fromArray(pose.quaternion);camera.up.fromArray(pose.up);if(camera.fov!==pose.fov){camera.fov=pose.fov;camera.updateProjectionMatrix();}camera.updateMatrixWorld(true);}
  const original=e.updateCamera;e.updateCamera=function(...args){const result=original.apply(this,args),start=performance.now();lock();window.__arrivalPerf.lockMs+=performance.now()-start;return result;};
  window.__arrivalPerf={lockMs:0,originalCameraUpdate:original,lock,pose,quality};
  e.updateCamera(a,game.input,0);game.scatter.updateFocus?.(a);game.sky.update(a,camera);e.render();e.render();
 },{tier,view,cameras});
}
module.exports={checkSnapshot,installedReceipt,prepare};
