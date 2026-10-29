const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const A='art/arrival-coherence/v01/combined',B='reports/2026-10-27/evidence/arrival-coherence',root=fs.realpathSync('.'),m=JSON.parse(fs.readFileSync(A+'/manifest.json')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert(!fs.existsSync(B+'/installation.json'),'Preserve completed installation receipt');
const proofFile=B+'/'+(process.argv[2]||'final-colour')+'-mid.json',proof=JSON.parse(fs.readFileSync(proofFile));assert(proof.pass&&proof.errors.length===0&&proof.shots.length===3&&proof.shots.every(s=>s.field.loaded),'Require the final native three-camera preview and current bake');
const changed=m.baseInventory.filter(r=>!fs.existsSync(r.file)||sha(fs.readFileSync(r.file))!==r.sha256);assert.deepEqual(changed,[],'Preserve concurrent user edits; rebase rather than overwrite');
const rows=[...m.files,...m.assets];for(const row of rows){
 const abs=path.resolve(row.file);assert(abs.startsWith(root+path.sep)&&/^(src|assets)\//.test(row.file),'Only declared runtime paths may be written');
 assert(fs.existsSync(row.preview));const h=sha(fs.readFileSync(row.preview));assert(proof.network.some(n=>n.file===row.file&&n.status===200&&n.sha256===h),'Preview changed after native capture: '+row.file);
 if(row.beforeSha256)assert.equal(sha(fs.readFileSync(row.file)),row.beforeSha256);else assert(!fs.existsSync(row.file),'Preserve existing new-name file: '+row.file);
}
const written=[];try{
 for(const row of rows){const backup=B+'/before-install/'+row.file,staged=B+'/install-stage/'+row.file;if(fs.existsSync(row.file)){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(row.file,backup);}fs.mkdirSync(path.dirname(staged),{recursive:true});fs.copyFileSync(row.preview,staged);assert.equal(sha(fs.readFileSync(staged)),sha(fs.readFileSync(row.preview)));fs.mkdirSync(path.dirname(row.file),{recursive:true});fs.renameSync(staged,row.file);written.push({...row,backup:fs.existsSync(backup)?backup:null,sha256:sha(fs.readFileSync(row.file))});}
 for(const row of written)assert.equal(sha(fs.readFileSync(row.file)),sha(fs.readFileSync(row.preview)));
 const allowed=new Set(m.files.map(r=>r.file)),preserved=m.baseInventory.filter(r=>!allowed.has(r.file));for(const row of preserved)assert.equal(sha(fs.readFileSync(row.file)),row.sha256);
 const receipt={installedUtc:new Date().toISOString(),previewManifest:A+'/manifest.json',nativeProof:proofFile,written,preservedOldInventory:preserved.length,scope:'Local Three.js integration, not public deployment or full-goal completion'};
 fs.writeFileSync(B+'/installation.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify({installed:true,files:written.length,preservedOldInventory:preserved.length}));
}catch(e){for(const row of written.reverse())if(fs.existsSync(row.file)&&sha(fs.readFileSync(row.file))===row.sha256){if(row.backup)fs.copyFileSync(row.backup,row.file);else fs.unlinkSync(row.file);}throw e;}
