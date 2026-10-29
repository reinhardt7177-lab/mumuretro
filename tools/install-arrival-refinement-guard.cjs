const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {A,B}=require('./arrival-refinement-fixture.cjs'),G=A+'/uint32-guard',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert(!fs.existsSync(B+'/guard-installation.json'),'Preserve existing capability installation');
const g=read(G+'/manifest.json'),initial=read(B+'/installation.json'),proof=read(G+'/forced-01/report.json'),unit=read(G+'/unit.json'),original=fs.readFileSync(A+'/manifest.json'),m=JSON.parse(original);
assert(proof.pass&&unit.pass&&g.files.length===2,'Require unsupported/supported branch evidence');
for(const row of initial.written)assert.equal(sha(row.file),row.sha256,'Preserve concurrent source changes '+row.file);
for(const row of g.files){assert(['src/boot.js','src/render/CompactTerrain.js'].includes(row.file));assert.equal(sha(row.file),row.beforeSha256);assert.equal(sha(row.preview),row.sha256);}
const written=[];try{
 for(const row of g.files){const backup=B+'/before-uint32-guard/'+row.file,staged=B+'/guard-stage/'+row.file;fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(row.file,backup);fs.mkdirSync(path.dirname(staged),{recursive:true});fs.copyFileSync(row.preview,staged);assert.equal(sha(staged),row.sha256);fs.renameSync(staged,row.file);written.push({...row,backup});}
 assert(!fs.existsSync(A+'/manifest-before-guard.json'));fs.writeFileSync(A+'/manifest-before-guard.json',original);
 for(const row of written){const target=m.files.find(r=>r.file===row.file);assert(target);target.preview=row.preview;target.sha256=row.sha256;}
 m.guard={manifest:G+'/manifest.json',sha256:sha(G+'/manifest.json'),reason:'WebGL1 without OES_element_index_uint retains original nonindexed terrain'};m.scope='Installed local A0 + exact terrain finalization, including unsupported-index fallback; whole-app goal remains active';
 fs.writeFileSync(A+'/manifest.json',JSON.stringify(m,null,2));for(const row of [...m.files,...m.assets])assert.equal(sha(row.file),row.sha256,row.file);
 const touched=new Set(initial.written.map(r=>r.file));for(const row of m.baseInventory)if(!touched.has(row.file))assert.equal(sha(row.file),row.sha256,row.file);
 fs.writeFileSync(B+'/guard-installation.json',JSON.stringify({pass:true,installedUtc:new Date().toISOString(),written,originalManifest:A+'/manifest-before-guard.json',finalManifestSha256:sha(A+'/manifest.json'),proof:G+'/forced-01/report.json',scope:'Conditional browser capability fallback; no geometry or save change on supported hardware'},null,2));console.log(JSON.stringify({pass:true,installed:2,runtimeFiles:476}));
}catch(e){for(const row of written.reverse())if(fs.existsSync(row.file)&&sha(row.file)===row.sha256)fs.copyFileSync(row.backup,row.file);if(m.guard)fs.writeFileSync(A+'/manifest.json',original);throw e;}
