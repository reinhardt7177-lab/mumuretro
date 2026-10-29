const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),A='art/field-meadow/v01',B='reports/2026-10-26/evidence/field-meadow',read=f=>JSON.parse(fs.readFileSync(f));exports.A=A;exports.B=B;
exports.route=async(page,phase='after',options={})=>{
 const base=read(B+'/baseline.json');for(const file of base.files)if(phase!=='after'||options.transform)await page.route('**/'+file,r=>{const body=fs.readFileSync(phase==='after'?file:(phase==='before'?B+'/before-':A+'/preview-')+file.replaceAll('/','__'),'utf8');return r.fulfill({contentType:'text/javascript',body:options.transform?options.transform(file,body):body});});
 if(phase==='goal'||options.transform){
  for(const file of['src/world/MeadowField.js'])await page.route('**/'+file,r=>{const body=fs.readFileSync(phase==='after'?file:A+'/preview-'+file.replaceAll('/','__'),'utf8');return r.fulfill({contentType:'text/javascript',body:options.transform?options.transform(file,body):body});});
 }
 if(phase==='goal'||options.asset){
  for(const file of['meadow-clusters-v01.glb','meadow-field-v01.png','meadow-kit-v01.json'])await page.route('**/assets/models/adventure/'+file,r=>{const body=fs.readFileSync((phase==='goal'?A+'/exports/':'assets/models/adventure/')+file),override=options.asset?.(file,body)||{body};return r.fulfill({contentType:file.endsWith('.glb')?'model/gltf-binary':file.endsWith('.png')?'image/png':'application/json',...override});});
 }
};
exports.prepare=async(page,phase='after',quality='mid',options={})=>{
 await exports.route(page,phase,options);
 await page.goto('http://127.0.0.1:5512/?q='+quality);await page.waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',null,{timeout:120000,polling:100});await page.evaluate(()=>game.loop.stop());await page.locator('#title .go').click({force:true});
 await page.evaluate(async quality=>{
  window.T=await import('three');game.loop.stop();game.dialogue.close();game.brief.hide();(await import('/src/render/Quality.js')).quality.pin(quality);game.lab.importState({version:1,dials:[3,5,8],hasNote:true,read:true,open:true,done:false,sent:false,parcelRecovered:true});game.notebook.setHas(true);game.landOnPlanet();game.dialogue.close();game.brief.hide();game.input.setTestIntent({});for(let i=0;i<150;i++)game.step(1/60);
  window.fieldProbe={
   stage(direction,target,yaw=0){const actor=game.player,planet=game.planet,engine=game.engine;actor.setLatLon(Math.asin(direction[1])*180/Math.PI,Math.atan2(direction[2],direction[0])*180/Math.PI);const forward=new T.Vector3().fromArray(target).addScaledVector(actor.up,-new T.Vector3().fromArray(target).dot(actor.up)).normalize();actor.heading.copy(forward);actor.syncMesh();engine.camFwd.copy(forward);engine.camUp.copy(actor.up);engine._camPlaced=false;game.input.camDist=7.6;game.input.camPitch=.32;game.input.setTestIntent({});game.dialogue.close();game.brief.hide();for(let i=0;i<90;i++)game.step(1/60);actor.lastArc=0;engine.camFwd.copy(forward).applyAxisAngle(actor.up,yaw);engine._camPlaced=false;engine.camColliders=game.worldCamera.query(actor.position,7.6);engine.updateCamera(actor,game.input,0);game.sky.update(actor,engine.camera);game.engine.render();game.engine.render();},
   shot(){const a=game.player,c=game.engine.camera;return{actor:a.position.toArray(),foot:a.getFootPosition(new T.Vector3()).toArray(),camera:c.position.toArray(),up:c.up.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov,aspect:c.aspect,meadow:{count:game.meadow.count,enabled:game.meadow.enabled,source:game.meadow.assetSource||'legacy-leaf-profiles',triangles:game.meadow.group.children.reduce((n,m)=>n+m.count*(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0)},render:__dbg.perf()};}
  };
 },quality);
};
exports.hashes=phase=>{const files=[...read(B+'/baseline.json').files,...(phase==='before'?[]:['src/world/MeadowField.js'])];return Object.fromEntries(files.map(f=>{const source=phase==='after'?f:(phase==='before'?B+'/before-':A+'/preview-')+f.replaceAll('/','__');return[f,crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')];}));};
