const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const A='art/arrival-surfaces/v01',sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert(!fs.existsSync(A+'/runtime-manifest.json'),'Preserve existing preview');
const source=fs.readFileSync('src/world/LandmarkAssets.js','utf8'),pulse=fs.readFileSync('src/world/Landing.js','utf8');
assert(source.includes('arrival-dais-v05.glb')&&source.includes("if(o.name==='Arrival_Aged')material.metalness=Math.min(material.metalness,.30);"));
const baseline=['src/world/LandmarkAssets.js','src/world/Landing.js','assets/models/adventure/arrival-dais-v05.glb'].map(file=>({file,sha256:sha(file)})),variants=[];
for(const variant of ['a0','a1']){
 const dir=A+'/runtime-'+variant;fs.mkdirSync(dir,{recursive:true});
 let runtime=source.replaceAll('arrival-dais-v05','arrival-dais-surface-v01-'+variant);
 const standard="if(o.name==='Arrival_Aged')material.metalness=Math.min(material.metalness,.30);";
 const physical="if(o.name==='Arrival_Aged'&&material.userData.mumuSurfaceVersion!==1)material.metalness=Math.min(material.metalness,.30);";
 runtime=runtime.replace(standard,(variant==='a1'?physical:standard)+"\n    if(material.userData.mumuSurfaceVersion===1){const intensity=material.userData.mumuExpectedEnvMapIntensity;if(Number.isFinite(intensity)&&intensity>=0&&intensity<=2)material.envMapIntensity=intensity;}");
 const landing=pulse.replace("mesh.material.emissiveIntensity=.14+Math.sin(t*1.8)*.025;","mesh.material.emissiveIntensity=mesh.material.userData.mumuSurfaceVersion===1?.8+Math.sin(t*1.8)*.08:.14+Math.sin(t*1.8)*.025;");
 assert.notEqual(landing,pulse);
 const files=[{file:'src/world/LandmarkAssets.js',preview:dir+'/LandmarkAssets.js'},{file:'src/world/Landing.js',preview:dir+'/Landing.js'}];
 fs.writeFileSync(files[0].preview,runtime);fs.writeFileSync(files[1].preview,landing);
 const asset={file:'assets/models/adventure/arrival-dais-surface-v01-'+variant+'.glb',preview:A+'/model-'+variant+'/exports/arrival-dais-surface-v01-'+variant+'.glb'};
 for(const r of [...files,asset])r.sha256=sha(r.preview);
 variants.push({variant,files,asset});
}
fs.writeFileSync(A+'/runtime-manifest.json',JSON.stringify({status:'isolated preview only',baseline,variants,geometryUnchanged:true},null,2));
console.log('Prepared two isolated surface previews; Root runtime unchanged');
