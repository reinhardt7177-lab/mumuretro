const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const A='art/arrival-coherence/v01/combined',D='art/arrival-dais/v05',m=JSON.parse(fs.readFileSync(A+'/manifest.json')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function edit(file,from,to){const row=m.files.find(r=>r.file===file);let body=fs.readFileSync(row.preview,'utf8');assert(body.includes(from),file+': missing marker');body=body.replaceAll(from,to);fs.writeFileSync(row.preview,body);row.previewSha256=sha(body);}
edit('src/boot.js','height:.16,inner:2.27,outer:2.64','height:.16,inner:2.58,outer:2.64');
edit('src/world/LandmarkAssets.js','arrival-dais-v03','arrival-dais-v05');
for(const name of ['arrival-dais-v05.glb','arrival-dais-v05.json']){assert(!m.assets.some(r=>r.file.endsWith(name)));fs.copyFileSync(D+'/exports/'+name,A+'/exports/'+name);m.assets.push({file:'assets/models/adventure/'+name,preview:A+'/exports/'+name});}
m.pending=m.pending.filter(s=>s!=='dais v04 decision');m.updatedUtc=new Date().toISOString();fs.writeFileSync(A+'/manifest.json',JSON.stringify(m,null,2));console.log('Merged flat v05 plinth and matching support; Root untouched.');
