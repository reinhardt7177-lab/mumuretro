const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const A='art/wayfarer-terraces/v01',B='reports/2026-10-26/evidence/wayfarer-terraces';
assert(!fs.existsSync(B+'/baseline.json'),'Keep an existing terrain baseline');
fs.mkdirSync(A,{recursive:true});fs.mkdirSync(A+'/exports',{recursive:true});fs.mkdirSync(B,{recursive:true});
const old=JSON.parse(fs.readFileSync('reports/2026-10-26/evidence/forest-render/installation.json')),inventory={};
for(const[file,expected]of Object.entries(old.inventory)){inventory[file]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');assert.equal(inventory[file],expected,'Current baseline differs: '+file);}
const files=['src/sphere/Planet.js','src/world/Landscape.js','src/world/WorldArt.js','src/world/Scatter.js','src/boot.js','src/world/Forage.js','src/world/PlanetCameraOcclusion.js','src/world/WorldTrails.js','src/world/MeadowField.js'];
for(const file of files)fs.copyFileSync(file,B+'/before-'+file.replaceAll('/','__'));
for(const view of ['front','side','rear'])fs.copyFileSync('reports/2026-10-26/evidence/forest-render/after-landing-'+view+'.png',B+'/before-landing-'+view+'.png');
const generated='C:/Users/닭사랑농장/.codex/generated_images/01a07c89-09ae-7822-858b-f9678d050a5e/exec-c8663dad-68ca-4250-83b8-9070b9d92bb5.png';
assert(fs.existsSync(generated));assert(!fs.existsSync(A+'/reference-front.png'));fs.copyFileSync(generated,A+'/reference-front.png');
fs.writeFileSync(B+'/baseline.json',JSON.stringify({createdUtc:new Date().toISOString(),previousGoalTurn:'progress:463-file forage rendering installation,actual actions/saves and156 regressions,80 performance conditions,6 fault families completed. Subsequent source/skill reading established2 repeated boulder families and bounded existing terrain relief;full goal stays active.',runtimeFiles:463,inventory,files,referenceFront:{generatedSource:generated,projectCopy:A+'/reference-front.png',role:'AI design target using the original front camera;not actual implemented gameplay'}},null,2));
console.log('Prepared463-file baseline and saved generated front reference in the project.');
