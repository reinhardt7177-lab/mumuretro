const fs=require('node:fs'),crypto=require('node:crypto'),base=require('./world-horizon-fixture.cjs');
const A='art/forest-render/v01',B='reports/2026-10-26/evidence/forest-render';exports.A=A;exports.B=B;
exports.prepare=async(page,phase='after',quality='mid',options={})=>{
 for(const file of['src/world/Forage.js','src/world/StaticMeshBatch.js']){
  const location=phase==='before'?(file.endsWith('Forage.js')?B+'/before-src__world__Forage.js':null):phase==='goal'?A+'/preview-'+file.replaceAll('/','__'):file;
  if(location&&fs.existsSync(location)&&(phase!=='after'||options.transform))await page.route('**/'+file,r=>{const body=fs.readFileSync(location,'utf8');return r.fulfill({contentType:'text/javascript',body:options.transform?options.transform(file,body):body});});
 }
 await base.prepare(page,'after',quality);
};
exports.hashes=phase=>Object.fromEntries(['src/world/Forage.js',...(phase==='before'?[]:['src/world/StaticMeshBatch.js'])].map(file=>{const location=phase==='before'?B+'/before-src__world__Forage.js':phase==='goal'?A+'/preview-'+file.replaceAll('/','__'):file;return[file,crypto.createHash('sha256').update(fs.readFileSync(location)).digest('hex')];}));
