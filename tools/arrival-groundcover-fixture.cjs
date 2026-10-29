const fs=require('node:fs'),base=require('./field-meadow-fixture.cjs');
const A='art/arrival-coherence/v01/groundcover',B='reports/2026-10-27/evidence/arrival-groundcover';exports.A=A;exports.B=B;
exports.prepare=async(page,phase='goal',quality='mid')=>{
 const files=[...JSON.parse(fs.readFileSync(B+'/baseline.json')).files,'src/world/MeadowLayers.js'];
 for(const file of files){const location=phase==='before'?B+'/before-'+file.replaceAll('/','__'):A+'/preview-'+file.replaceAll('/','__');if(!fs.existsSync(location))continue;await page.route('**/'+file,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(location,'utf8')}));}
 if(phase==='goal')for(const file of ['arrival-groundcover-v01.json','arrival-groundcover-v01.glb'])await page.route('**/assets/models/adventure/'+file,r=>r.fulfill({contentType:file.endsWith('.glb')?'model/gltf-binary':'application/json',body:fs.readFileSync(A+'/exports/'+file)}));
 await base.prepare(page,'after',quality);
};
