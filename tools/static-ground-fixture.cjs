const fs=require('node:fs'),base=require('./field-meadow-fixture.cjs');
const A='art/arrival-coherence/v01/static-ground',B='reports/2026-10-27/evidence/arrival-static-ground';exports.A=A;exports.B=B;
exports.prepare=async(page,phase='goal')=>{
 const m=JSON.parse(fs.readFileSync(A+'/manifest.json'));
 for(const row of m.combinedSnapshot)await page.route('**/'+row.file,r=>{let body=fs.readFileSync(row.preview,'utf8');
  if(row.file==='src/boot.js'&&phase==='goal'){const marker='planet.enableMeshGround({step:.025});';if(!body.includes(marker))throw Error('Combined mesh enable marker changed');body=body.replace(marker,marker+'\nconst staticGroundReseat=scatter.reseat();');}
  return r.fulfill({contentType:'text/javascript',body});
 });
 for(const row of m.changes)await page.route('**/'+row.file,r=>{let body=fs.readFileSync(phase==='goal'?row.preview:row.before,'utf8');
  if(row.file==='src/world/Forage.js')body=body.replace('sites, bag, found, caught, blocks, resolve,','sites, bag, found, caught, blocks, resolve, __groundProbe:{groundY},');
  if(row.file==='src/world/Kitchen.js')body=body.replace('group: g, plates, made, dir: kdir,','group: g, plates, made, dir: kdir, __groundProbe:{groundY,lift},');
  return r.fulfill({contentType:'text/javascript',body});
 });
 for(const row of m.assets)await page.route('**/'+row.file,r=>r.fulfill({contentType:row.file.endsWith('.glb')?'model/gltf-binary':row.file.endsWith('.png')?'image/png':'application/json',body:fs.readFileSync(row.preview)}));
 await base.prepare(page,'after','mid');
};
