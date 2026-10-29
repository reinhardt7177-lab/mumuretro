const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const A='art/arrival-coherence/v01/combined',m=JSON.parse(fs.readFileSync(A+'/manifest.json')),row=m.files.find(r=>r.file==='src/world/MeadowDetail.js');
let s=fs.readFileSync(row.preview,'utf8');const marker='mesh.count=0;mesh.receiveShadow=true;mesh.castShadow=false;mesh.frustumCulled=false;';assert(s.includes(marker));
fs.copyFileSync(row.preview,A+'/before-plant-shadows-src__world__MeadowDetail.js');
s=s.replace(marker,`mesh.count=0;mesh.receiveShadow=true;mesh.castShadow=authored;mesh.frustumCulled=false;\n    if(authored){\n      // Depth vertices use the exact same wind and traveller bend as visible leaves.\n      const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});\n      depth.onBeforeCompile=mat.onBeforeCompile;mesh.customDepthMaterial=depth;\n    }`);
fs.writeFileSync(row.preview,s);row.previewSha256=crypto.createHash('sha256').update(s).digest('hex');m.updatedUtc=new Date().toISOString();fs.writeFileSync(A+'/manifest.json',JSON.stringify(m,null,2));console.log('Prepared matching-wind native plant shadows, preview only.');
