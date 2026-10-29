const fs=require('node:fs'),A='art/balance-observatory/v01',B='reports/2026-10-25/evidence/balance-observatory',patches=JSON.parse(fs.readFileSync(A+'/patches.json')),files=[...new Set(patches.map(p=>p.file))];
for(const f of files){const before=fs.readFileSync(B+'/baseline-'+f.replaceAll('/','__'),'utf8').replace(/\r\n/g,'\n'),current=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n'),goal=fs.readFileSync(A+'/preview-'+f.replaceAll('/','__'),'utf8');if(current!==before&&current!==goal)throw Error('Source changed during review '+f);}
const motionUpdate=process.argv.includes('--camera-follow');
for(const f of['src/shrine/BalanceCourtArt.js','assets/models/balance-temple-v08.glb'])if(fs.existsSync(f)){
 if(!motionUpdate)throw Error('New version target already exists '+f);
 const goal=f.endsWith('.glb')?fs.readFileSync(A+'/balance-temple-v08.glb'):fs.readFileSync(A+'/BalanceCourtArt-preview.js','utf8').replace('    for(const zone of rects.cameraSubjectZones||[])zone.anticipateMotion=true;\n','').replace('    rects.cameraApproachZones=spec.positions.map(([x,y,z])=>({x,z,near:2.5,far:5.5,distance:2.7}));\n','');
 const current=fs.readFileSync(f);if(!current.equals(Buffer.from(goal)))throw Error('Installed artifact changed during camera review '+f);
}
if(motionUpdate){const check=JSON.parse(fs.readFileSync(B+'/portal-input-preview.json'));if(!check.pass||check.errors.length)throw Error('Camera preview must pass first');fs.copyFileSync('src/shrine/BalanceCourtArt.js',B+'/pre-motion-BalanceCourtArt.js');}
for(const f of files)fs.copyFileSync(A+'/preview-'+f.replaceAll('/','__'),f);fs.copyFileSync(A+'/BalanceCourtArt-preview.js','src/shrine/BalanceCourtArt.js');fs.copyFileSync(A+'/balance-temple-v08.glb','assets/models/balance-temple-v08.glb');fs.writeFileSync(B+'/installed.json',JSON.stringify({files,added:['src/shrine/BalanceCourtArt.js','assets/models/balance-temple-v08.glb']},null,2));console.log('INSTALLED reviewed court sources and v08; earlier files retained');
