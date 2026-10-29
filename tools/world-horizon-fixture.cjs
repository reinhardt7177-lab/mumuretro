const fs=require('node:fs'),crypto=require('node:crypto'),base=require('./field-meadow-fixture.cjs');
const A='art/world-horizon/v01',B='reports/2026-10-26/evidence/world-horizon';exports.A=A;exports.B=B;
exports.route=async(page,phase='after',options={})=>{
 const files=JSON.parse(fs.readFileSync(B+'/baseline.json')).files;
 for(const file of [...files,...(phase==='before'?[]:['src/render/HorizonBackdrop.js'])]){
  const location=phase==='after'?file:(phase==='before'?B+'/before-':A+'/preview-')+file.replaceAll('/','__');
  if(!fs.existsSync(location))continue;
  if(phase!=='after'||options.transform)await page.route('**/'+file,r=>{const source=fs.readFileSync(location,'utf8');return r.fulfill({contentType:'text/javascript',body:options.transform?options.transform(file,source):source});});
 }
 if(phase==='goal'||options.asset)for(const file of['world-horizon-v01.glb','world-horizon-v01.json','world-horizon-v02.glb','world-horizon-v02.json','world-horizon-v03.glb','world-horizon-v03.json','meadow-field-v02.png','meadow-kit-v02.json']){
  const location=(phase==='goal'?A+'/exports/':'assets/models/adventure/')+file;if(!fs.existsSync(location))continue;
  await page.route('**/assets/models/adventure/'+file,r=>{const body=fs.readFileSync(location),override=options.asset?.(file,body)||{body};return r.fulfill({contentType:file.endsWith('.glb')?'model/gltf-binary':file.endsWith('.png')?'image/png':'application/json',...override});});
 }
};
exports.prepare=async(page,phase='after',quality='mid',options={})=>{await exports.route(page,phase,options);await base.prepare(page,'after',quality);};
exports.lockPose=async(page,s)=>page.evaluate(s=>{const a=game.player,c=game.engine.camera;a.position.fromArray(s.actor);a.heading.fromArray(s.heading);a.syncMesh();c.position.fromArray(s.camera);c.quaternion.fromArray(s.quaternion);c.up.fromArray(s.up);c.fov=s.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);game.scatter.updateFocus?.(a);game.sky.update(a,c);game.engine.render();game.engine.render();},s);
exports.hashes=phase=>Object.fromEntries([...JSON.parse(fs.readFileSync(B+'/baseline.json')).files,...(phase==='before'?[]:['src/render/HorizonBackdrop.js'])].map(f=>{const p=phase==='after'?f:(phase==='before'?B+'/before-':A+'/preview-')+f.replaceAll('/','__');return[f,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')];}));
