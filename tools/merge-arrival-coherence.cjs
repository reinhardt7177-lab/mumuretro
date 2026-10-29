const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const A='art/arrival-coherence/v01/combined',B='reports/2026-10-27/evidence/arrival-coherence',m=JSON.parse(fs.readFileSync(A+'/manifest.json'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function set(file,body){let row=m.files.find(r=>r.file===file);if(!row){row={file,preview:A+'/preview-'+file.replaceAll('/','__'),beforeSha256:fs.existsSync(file)?sha(fs.readFileSync(file)):null};m.files.push(row);}fs.writeFileSync(row.preview,body);row.previewSha256=sha(body);}
for(const row of JSON.parse(fs.readFileSync('art/arrival-coherence/v01/lighting/final/files.json')).sources)set(row.file,fs.readFileSync(row.source));
// The light and ground agents both change Scatter. Apply only the two radial
// reseating calls from the ground candidate, preserving the Toon colour fix.
for(const name of ['Scatter','Forage','Kitchen','Waterway']){
 const file='src/world/'+name+'.js',source='art/arrival-coherence/v01/static-ground/preview-'+file.replaceAll('/','__');
 if(name!=='Scatter')set(file,fs.readFileSync(source));
 else{let body=fs.readFileSync(m.files.find(r=>r.file===file).preview,'utf8');const needle='planet.surfaceAt(';assert.equal(body.split(needle).length-1,2,'Scatter radial reseat callers changed');body=body.replaceAll(needle,'planet.groundSurfaceAt(');set(file,body);}
}
let boot=fs.readFileSync(m.files.find(r=>r.file==='src/boot.js').preview,'utf8');
assert(boot.includes('planet.enableMeshGround({step:.025});'));boot=boot.replace('planet.enableMeshGround({step:.025});','planet.enableMeshGround({step:.025});\nconst meshGroundReseat=scatter.reseat();');set('src/boot.js',boot);
let debug=fs.readFileSync('src/debug/introspect.js','utf8');const marker='planet.R + planet.heightAt(v)';assert(debug.includes(marker));debug=debug.replace(marker,'planet.R + planet.groundHeightAt(v)');set('src/debug/introspect.js',debug);
for(const row of m.files)row.previewSha256=sha(fs.readFileSync(row.preview));
m.pending=m.pending.filter(v=>!v.startsWith('lighting final')&&!v.startsWith('fresh actual'));m.updatedUtc=new Date().toISOString();fs.writeFileSync(A+'/manifest.json',JSON.stringify(m,null,2));
console.log(JSON.stringify({files:m.files.length,assets:m.assets.length,merged:'final lighting + static ground; exact prior previews preserved'}));
