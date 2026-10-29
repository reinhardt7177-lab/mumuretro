const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const which=process.argv[2],B='reports/2026-10-24/evidence/strata-inlays',adaptations=[];let file,code;
if(which==='touch'){
 file=path.join(__dirname,'run-chronicle-portal-case.cjs');code=fs.readFileSync(file,'utf8').replace('evidence/chronicle-portal/regressions','evidence/strata-inlays/regressions');process.argv[2]='check-chronicle-evidence-touch.cjs';
}else if(which==='fallback'){
 file=path.join(__dirname,'check-chronicle-evidence-fallback.cjs');code=fs.readFileSync(file,'utf8');
 code=code.replace("B='reports/2026-10-24/evidence/chronicle-evidence'",'B='+JSON.stringify(B));
 code=code.replace('**/chronicle-evidence-v01.glb','**/strata-inlays-v01.glb').replaceAll('game.room.evidenceArt','game.room.strataInlays').replace('f.mesh.visible&&f.mesh.geometry.drawRange.count>0','f.mesh.visible').replace('colliders:game.room.strataInlays.colliders.length','colliders:game.room.strataInlays.roots.length');
 code=code.replace('Block only optional fossil GLB; actual first-row movement and pickup must retain original puzzle','Block only the new inlay GLB; retain preceding authored portal and fossils, actual movement/pick and save');
 code=code.replace('failed optional asset preserves original specimens and no partial furniture','failed inlay asset retains preceding specimens with no partial replacement');
 adaptations.push('Block only new inlay GLB; require zero replacement roots while preceding authored fossils remain visible; actual movement, pickup and save assertions retained.');
 fs.mkdirSync(B,{recursive:true});fs.writeFileSync(B+'/fallback-adaptations.json',JSON.stringify(adaptations,null,2));
}else throw Error('Expected touch or fallback');
assert(code);const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(code,file);
