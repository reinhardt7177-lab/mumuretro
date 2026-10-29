const fs=require('node:fs'),base=require('./field-meadow-fixture.cjs');
const A='art/arrival-dais/v01',B='reports/2026-10-26/evidence/arrival-dais';exports.A=A;exports.B=B;
exports.prepare=async(page,phase='goal',quality='mid',options={})=>{
 const files=JSON.parse(fs.readFileSync(B+'/baseline.json')).files;
 for(const file of files){if(phase==='after'&&!options.transform)continue;const location=phase==='before'?B+'/before-'+file.replaceAll('/','__'):phase==='goal'?A+'/preview-'+file.replaceAll('/','__'):file;
   if(!fs.existsSync(location))continue;
   await page.route('**/'+file,r=>{let body=fs.readFileSync(location,'utf8');if(options.transform)body=options.transform(file,body);return r.fulfill({contentType:'text/javascript',body});});
 }
 if(phase==='goal'){
   await page.route('**/assets/models/adventure/arrival-dais-v03.glb',r=>options.missing?r.fulfill({status:404,body:'deliberately unavailable'}):r.fulfill({contentType:'model/gltf-binary',body:fs.readFileSync(A+'/exports/arrival-dais-v03.glb')}));
   for(const file of ['arrival-meadow-v01.json','arrival-field-v01.png'])if(fs.existsSync(A+'/exports/'+file))await page.route('**/assets/models/adventure/'+file,r=>r.fulfill({contentType:file.endsWith('.png')?'image/png':'application/json',body:fs.readFileSync(A+'/exports/'+file)}));
 }
 await base.prepare(page,'after',quality);
};
