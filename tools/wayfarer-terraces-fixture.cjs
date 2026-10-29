const fs=require('node:fs'),path=require('node:path'),base=require('./field-meadow-fixture.cjs');
const A='art/wayfarer-terraces/v01',B='reports/2026-10-26/evidence/wayfarer-terraces';exports.A=A;exports.B=B;
exports.prepare=async(page,phase='goal',quality='mid',options={})=>{
 const files=JSON.parse(fs.readFileSync(B+'/baseline.json')).files;
 for(const file of [...files,'src/world/TerracedRelief.js']){
   const previous=B+'/before-'+file.replaceAll('/','__'),preview=A+'/preview-'+file.replaceAll('/','__');
   const location=phase==='before'?previous:phase==='goal'&&fs.existsSync(preview)?preview:file;
   if(!fs.existsSync(location))continue;
   await page.route('**/'+file,r=>{let body=fs.readFileSync(location,'utf8');if(options.transform)body=options.transform(file,body);return r.fulfill({contentType:'text/javascript',body});});
 }
 if(phase==='goal')for(const file of ['field-boulders-v02.glb','meadow-kit-v03.json','meadow-field-v03.png']){
   const filename=A+'/exports/'+file;
   if(!fs.existsSync(filename))continue;
   await page.route('**/assets/models/adventure/'+file,r=>r.fulfill({contentType:file.endsWith('.glb')?'model/gltf-binary':file.endsWith('.png')?'image/png':'application/json',body:fs.readFileSync(filename)}));
 }
 await base.prepare(page,'after',quality);
};
