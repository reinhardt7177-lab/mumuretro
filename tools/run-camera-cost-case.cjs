const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),kind=process.argv[2],phase=process.env.CAMERA_COST_PHASE||'after',B='reports/2026-10-26/evidence/camera-cost',table={
 views:['probe-workspace-camera.cjs','reports/2026-10-26/evidence/workspace-camera'],
 controls:['check-workspace-camera-controls.cjs','reports/2026-10-26/evidence/workspace-camera'],
 measure:['measure-workspace-camera.cjs','unused'],
 scene:['check-scene-ray-query.cjs','reports/2026-10-23/evidence/camera-query'],
 any:['check-camera-anyhit.cjs','reports/2026-10-23/evidence/field-view']
};if(!table[kind])throw Error('Unknown cost case');const[name,old]=table[kind],file=path.resolve('tools/'+name),dest=B+'/'+kind;fs.mkdirSync(dest,{recursive:true});let source=fs.readFileSync(file,'utf8');
if(kind==='views'||kind==='controls'||kind==='measure'){
 source=source.replace("require('./workspace-camera-fixture.cjs')","require('./camera-cost-fixture.cjs')");
 if(kind==='views'){process.argv=[process.execPath,file,phase,...process.argv.slice(3)];source=source.replace("if(phase==='goal'){", "if(false&&phase==='goal'){").replace('(async()=>{const browser',"report.costSourceHashes=require('./camera-cost-fixture.cjs').hashes(phase);\n(async()=>{const browser");}
 else if(kind==='controls'){source=source.replace("phase=process.argv.includes('--preview')?'goal':'after'",'phase='+JSON.stringify(phase));process.argv=[process.execPath,file,...process.argv.slice(3)];}
 else{source=source.replace('Camera poses differ by design.','Identical actor/camera paths are required; only calculation changes.').replace("for(const phase of['before','after'])", "for(const phase of['before',"+JSON.stringify(phase==='after'?'after':'goal')+"])").replace("B+'/performance.json'","B+'/performance-"+phase+(process.argv.includes('--portrait')?'-portrait':'')+".json'");source=source.replace('(async()=>{const b=',"report.sources={before:require('./camera-cost-fixture.cjs').hashes('before'),"+JSON.stringify(phase)+":require('./camera-cost-fixture.cjs').hashes("+JSON.stringify(phase)+")};\n(async()=>{const b=");if(process.argv.includes('--portrait'))source=source.replace('viewport:{width:1280,height:800}','viewport:{width:390,height:844},isMobile:true,hasTouch:true');}
}else{
 source=source.replaceAll(old,dest).replaceAll("fs.readFileSync(file,'utf8')","require('./camera-cost-fixture.cjs').source(file,"+JSON.stringify(phase)+")").replace("fs.readFileSync('src/render/StaticRaycastTree.js','utf8')","require('./camera-cost-fixture.cjs').source('src/render/StaticRaycastTree.js',"+JSON.stringify(phase)+")");
 process.argv=[process.execPath,file,...process.argv.slice(3)];
}
fs.writeFileSync(dest+'/executed-'+phase+'.cjs',source);const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
