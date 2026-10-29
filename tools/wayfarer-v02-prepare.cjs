const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const A='art/wayfarer-terraces/v02',B='reports/2026-10-27/evidence/wayfarer-terraces-v02';
assert(!fs.existsSync(B+'/baseline.json'),'Keep v02 baseline');
fs.mkdirSync(A+'/exports',{recursive:true});fs.mkdirSync(B,{recursive:true});
const old=JSON.parse(fs.readFileSync('reports/2026-10-26/evidence/arrival-dais/installation.json')),inventory={};
for(const[file,expected]of Object.entries(old.inventory)){inventory[file]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');assert.equal(inventory[file],expected,'466 baseline mismatch '+file);}
const files=['src/sphere/Planet.js','src/world/Landscape.js','src/world/WorldArt.js','src/world/Scatter.js','src/boot.js','src/world/Forage.js','src/world/PlanetCameraOcclusion.js','src/world/WorldTrails.js','src/world/MeadowField.js'];
for(const file of files)fs.copyFileSync(file,B+'/before-'+file.replaceAll('/','__'));
for(const view of ['front','side','rear']){fs.copyFileSync('reports/2026-10-26/evidence/arrival-dais/after-'+view+'.png',B+'/before-'+view+'.png');fs.copyFileSync('art/arrival-dais/v01/reference-'+view+'.png',A+'/reference-'+view+'.png');}
fs.writeFileSync(B+'/baseline.json',JSON.stringify({createdUtc:new Date().toISOString(),runtimeFiles:466,inventory,files,source:'Installed 466-file arrival-dais product; v01 terraces kept untouched',reference:'Existing arrival-dais AI targets, not implemented geometry'},null,2));
const previous=JSON.parse(fs.readFileSync('art/wayfarer-terraces/v01/design-spec.json'));
const spec={...previous,version:2,baseRuntimeFiles:466,terrain:{...previous.terrain,centre:[21,-3],innerRadius:20,outerRadius:27,stepHeight:1.1,faceStart:.68,faceEnd:.98,maximumHeightDelta:1.1,preserveLanding:6,trailInner:1.7,trailOuter:3.1,refinementRadius:27,refinementRounds:4},surface:{status:'not baked: expected fallback to vertex colours until final integration',previousProductSignature:'b3cdf014'},references:{...previous.references,type:'Existing arrival-dais target images; no new generation; actual product captures remain separate'},boulders:{...previous.boulders,radialSegments:20,rings:9,file:'field-boulders-v02.glb',maxTrianglesPerVariant:360}};
fs.writeFileSync(A+'/design-spec.json',JSON.stringify(spec,null,2));
console.log('Prepared immutable 466-file baseline and copied existing targets; root untouched');
