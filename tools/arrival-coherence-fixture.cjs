const fs=require('node:fs'),base=require('./field-meadow-fixture.cjs');
const A='art/arrival-coherence/v01/combined',B='reports/2026-10-27/evidence/arrival-coherence';exports.A=A;exports.B=B;
exports.route=async(page,phase='goal')=>{
 if(phase==='before'||phase==='after')return;
 const m=JSON.parse(fs.readFileSync(A+'/manifest.json'));
 for(const row of m.files)await page.route('**/'+row.file,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(row.preview)}));
 for(const row of m.assets)await page.route('**/'+row.file,r=>r.fulfill({contentType:row.file.endsWith('.glb')?'model/gltf-binary':row.file.endsWith('.png')?'image/png':'application/json',body:fs.readFileSync(row.preview)}));
};
exports.prepare=async(page,phase='goal',quality='mid')=>{await exports.route(page,phase);await base.prepare(page,'after',quality);};
