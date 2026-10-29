const fs=require('node:fs'),fixture=require('./arrival-coherence-fixture.cjs');
const A='art/arrival-refinement/v01',B='reports/2026-10-27/evidence/arrival-refinement';exports.A=A;exports.B=B;
exports.route=async(page,phase='goal')=>{if(phase==='after'||phase==='before')return;const m=JSON.parse(fs.readFileSync(A+'/manifest.json'));for(const r of [...m.files,...m.assets])await page.route('**/'+r.file,request=>request.fulfill({contentType:r.file.endsWith('.glb')?'model/gltf-binary':'text/javascript',body:fs.readFileSync(r.preview)}));};
exports.prepare=async(page,phase='goal',quality='mid')=>{await exports.route(page,phase);await fixture.prepare(page,'after',quality);};
