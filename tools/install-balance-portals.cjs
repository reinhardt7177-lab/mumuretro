const fs=require('node:fs'),A='art/balance-portals/v01',B='reports/2026-10-25/evidence/balance-portals',patches=JSON.parse(fs.readFileSync(A+'/patches.json'));
const files=[...new Set(patches.map(p=>p.file))];
for(const f of files){const before=fs.readFileSync(B+'/baseline-'+f.replaceAll('/','__'),'utf8').replace(/\r\n/g,'\n'),current=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n'),goal=fs.readFileSync(A+'/preview-'+f.replaceAll('/','__'),'utf8');if(current!==before&&current!==goal)throw Error('Source changed during review: '+f);}
const target='assets/models/balance-temple-v07.glb';if(fs.existsSync(target)&&!fs.readFileSync(target).equals(fs.readFileSync(A+'/balance-temple-v07.glb')))throw Error('Versioned target changed during review');
for(const f of files)fs.copyFileSync(A+'/preview-'+f.replaceAll('/','__'),f);fs.copyFileSync(A+'/balance-temple-v07.glb',target);
fs.writeFileSync(B+'/installed.json',JSON.stringify({files,newAsset:target,previewReviewed:true},null,2));console.log('INSTALLED '+files.length+' sources + versioned model; previous sources/models preserved');
