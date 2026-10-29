const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const A='art/arrival-coherence/v01/combined',P='art/arrival-coherence/v01/groundcover-v02',archive='art/arrival-coherence/v01/combined-iteration-01';
assert(!fs.existsSync(archive),'Preserve previous iteration archive');fs.cpSync(A,archive,{recursive:true});
const old=JSON.parse(fs.readFileSync(archive+'/manifest.json'));for(const row of [...old.files,...old.assets])row.preview=row.preview.replace(A+'/',archive+'/');old.note='Snapshot after baked-mid photos and low-step source preparation; historical photos are not proof that every snapshot module was used at their earlier capture time.';fs.writeFileSync(archive+'/manifest.json',JSON.stringify(old,null,2));
const m=JSON.parse(fs.readFileSync(A+'/manifest.json')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function edit(file,from,to){const row=m.files.find(r=>r.file===file);let s=fs.readFileSync(row.preview,'utf8');assert(s.includes(from),file+': missing '+from);s=s.replace(from,to);fs.writeFileSync(row.preview,s);}
for(const name of ['Forage','Kitchen']){const file='src/world/'+name+'.js';fs.copyFileSync('art/arrival-coherence/v01/static-ground/preview-'+file.replaceAll('/','__'),m.files.find(r=>r.file===file).preview);}
edit('src/world/MeadowLayers.js','version:1,','version:2,samplesPerCell:70,capacities:[900,900,300,300],');
edit('src/world/MeadowDetail.js','for(const geo of geometryList){','for(const [variantIndex,geo] of geometryList.entries()){');
edit('src/world/MeadowDetail.js','new THREE.InstancedMesh(geo,mat,600)','new THREE.InstancedMesh(geo,mat,authored?MEADOW_LAYERS.capacities[variantIndex]:600)');
edit('src/world/MeadowDetail.js','for(let i=0;i<50;i++)','for(let i=0;i<MEADOW_LAYERS.samplesPerCell;i++)');
edit('src/world/MeadowDetail.js','const capacity=authored?600:(quality.name===\'high\'?600:300);','const capacity=authored?Infinity:(quality.name===\'high\'?600:300);');
edit('src/world/MeadowDetail.js','if(mesh.count>=capacity)continue;','if(mesh.count>=Math.min(capacity,mesh.instanceMatrix.count))continue;');
edit('src/world/MeadowDetail.js',"return authored?'arrival-groundcover-v01'","return authored?'arrival-groundcover-v02'");
edit('src/world/MeadowField.js','count!==54','(count!==meta.variants[i].triangles||count>110)');
for(const row of m.files)if(row.file==='src/world/MeadowField.js'){let s=fs.readFileSync(row.preview,'utf8').replaceAll('arrival-groundcover-v01','arrival-groundcover-v02').replaceAll('arrival-coherent-field-v01','arrival-coherent-field-v02');fs.writeFileSync(row.preview,s);}
const meta=JSON.parse(fs.readFileSync(P+'/exports/arrival-groundcover-v02.json'));meta.tufts.maximumTrianglesPerVariant=90;meta.tufts.trianglesPerVariant=[90,90,70,70];meta.tufts.segmentsPerBlade=5;meta.tufts.bladesPerVariant=[9,9,4,4];meta.placement.samplesPerCell=70;meta.placement.maximumPerVariantHigh=[900,900,300,300];meta.placement.maximumPerVariantMid=[900,900,300,300];meta.placement.maximumTotal=2400;meta.placement.rootsFollowActualCarpet='rendered soil triangle + existing analytic carpet lift, not a new carpet raycast';
fs.copyFileSync(P+'/exports/arrival-groundcover-v02.json',P+'/exports/initial-arrival-groundcover-v02.json');fs.writeFileSync(P+'/exports/arrival-groundcover-v02.json',JSON.stringify(meta,null,2));
for(const name of ['arrival-groundcover-v02.glb','arrival-groundcover-v02.json'])fs.copyFileSync(P+'/exports/'+name,A+'/exports/'+name);
m.assets=m.assets.filter(r=>!r.file.includes('arrival-groundcover-v01')&&!r.file.includes('arrival-coherent-field-v01'));for(const name of ['arrival-groundcover-v02.glb','arrival-groundcover-v02.json'])m.assets.push({file:'assets/models/adventure/'+name,preview:A+'/exports/'+name});
for(const row of m.files)row.previewSha256=sha(fs.readFileSync(row.preview));m.updatedUtc=new Date().toISOString();m.pending.push('v02 field bake after v05 support is merged');fs.writeFileSync(A+'/manifest.json',JSON.stringify(m,null,2));console.log('Preserved iteration01 and prepared curved plants v02 / updated static ground. Root unchanged.');
