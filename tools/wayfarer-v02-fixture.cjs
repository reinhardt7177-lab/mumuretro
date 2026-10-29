const fs=require('node:fs'),base=require('./field-meadow-fixture.cjs');
const A='art/wayfarer-terraces/v02',B='reports/2026-10-27/evidence/wayfarer-terraces-v02';exports.A=A;exports.B=B;
exports.prepare=async(page,phase='goal',quality='mid',options={})=>{
 const files=JSON.parse(fs.readFileSync(B+'/baseline.json')).files;
 for(const file of [...files,'src/world/TerracedRelief.js']){
   const previous=B+'/before-'+file.replaceAll('/','__'),preview=A+'/preview-'+file.replaceAll('/','__');
   const location=phase==='before'?previous:fs.existsSync(preview)?preview:file;
   if(!fs.existsSync(location))continue;
   await page.route('**/'+file,r=>{let body=fs.readFileSync(location,'utf8');if(options.transform)body=options.transform(file,body);return r.fulfill({contentType:'text/javascript',body});});
 }
 if(phase!=='before')await page.route('**/assets/models/adventure/field-boulders-v02.glb',r=>r.fulfill({contentType:'model/gltf-binary',body:fs.readFileSync(A+'/exports/field-boulders-v02.glb')}));
 await base.prepare(page,'after',quality);
};
