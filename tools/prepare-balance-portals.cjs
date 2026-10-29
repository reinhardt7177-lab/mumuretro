// One-time baseline: preserve current sources, assets and release before this refinement.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const A='art/balance-portals/v01',B='reports/2026-10-25/evidence/balance-portals';
fs.mkdirSync(A,{recursive:true});fs.mkdirSync(B,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['src/boot.js','src/shrine/Room.js','src/shrine/BalanceTemple.js','src/shrine/BalanceRecords.js','src/data/balanceTemple.js','src/render/InteriorDirection.js','src/shrine/BalanceArt.js'];
if(fs.existsSync(B+'/baseline.json'))throw Error('Baseline already exists; do not overwrite');
for(const f of files)fs.copyFileSync(f,B+'/baseline-'+f.replaceAll('/','__'));
const inventory={};function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=dir+'/'+e.name;if(e.isDirectory())walk(f);else inventory[f]=hash(fs.readFileSync(f));}}
for(const d of ['assets','src','vendor'])walk(d);for(const f of ['index.html','fire-trial.html'])inventory[f]=hash(fs.readFileSync(f));
const release=JSON.parse(fs.readFileSync('dist/assets/release.json'));
fs.writeFileSync(B+'/baseline.json',JSON.stringify({files,inventory,release},null,2));
const poses=[];for(const[id,camera,target,actor]of[
 ['first-front',[0,3.4,-5],[0,2.7,-12.15],[2,-6.5]],
 ['first-side',[6,3,-7],[0,2.2,-12.15],[0,-9]],
 ['first-rear',[0,3.4,-19],[0,2.7,-12.15],[0,-17.7]],
 ['second-front',[0,3.4,-25],[0,2.7,-32.15],[2,-27]],
 ['second-rear',[0,3.4,-39],[0,2.7,-32.15],[0,-37.7]],
 ['final-front',[0,3.5,-47],[0,2.7,-54],[2,-49]],
 ['final-side',[7,3.8,-49],[0,2.7,-54],[0,-51]],
 ['final-rear',[5.5,3.5,-59],[0,2.7,-54],[0,-56.5]],
 ])for(const open of [false,true])poses.push({id:id+(open?'-open':'-closed'),camera,target,actor,open});
for(const pose of JSON.parse(fs.readFileSync('art/balance-walls/v01/cameras.json')).filter(p=>['order-front','twin-front','lever-front'].includes(p.id)))poses.push({...pose,id:'overview-'+pose.id,open:true});
fs.writeFileSync(A+'/cameras.json',JSON.stringify(poses,null,2));console.log(JSON.stringify({baselineFiles:Object.keys(inventory).length,assets:Object.keys(inventory).filter(f=>f.startsWith('assets/')).length,poses:poses.length}));
