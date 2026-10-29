const fs=require('node:fs'),A='art/arrival-dais/v05';fs.mkdirSync(A,{recursive:true});
const landmarks=fs.readFileSync('src/world/LandmarkAssets.js','utf8').replaceAll('arrival-dais-v03','arrival-dais-v05');fs.writeFileSync(A+'/preview-src__world__LandmarkAssets.js',landmarks);
let boot=fs.readFileSync('src/boot.js','utf8');const before='height:.16,inner:2.27,outer:2.64';if(!boot.includes(before))throw Error('Native support block changed');boot=boot.replace(before,'height:.16,inner:2.58,outer:2.64');fs.writeFileSync(A+'/preview-src__boot.js',boot);
const actor='art/arrival-coherence/v01/combined/preview-src__sphere__SurfaceActor.js';if(!fs.existsSync(actor))throw Error('Parent step-up preview missing');
let finalize=fs.readFileSync('tools/finalize-arrival-dais-v04.cjs','utf8').replaceAll('v04','v05');finalize=finalize.replace("supportUnchanged:{height:.16,inner:2.27,outer:2.64}","supportChanged:{height:.16,inner:2.58,outer:2.64,edgeBevelWidth:.06}");
finalize=finalize.replace("const files=[file,",`const files=['${A}/preview-src__boot.js','${actor}',file,`);
finalize=finalize.replace("apply:[{from:file",`apply:[{from:'${A}/preview-src__boot.js',to:'src/boot.js',merge:'change only arrivalSupport inner2.27→2.58; keep height.16 outer2.64 and all other current edits'},{from:'${actor}',to:'src/sphere/SurfaceActor.js',merge:'parent-owned generic step-up preview; integrate parent version rather than this model branch owning it'},{from:file`);
// The shared finalizer only rewrites the LandmarkAsset preview and asset metadata.
// boot and the parent SurfaceActor remain explicit additional manifest entries.
fs.writeFileSync('tools/finalize-arrival-dais-v05.cjs',finalize);console.log('Prepared v05 separate boot and model finalizer; Root untouched');
