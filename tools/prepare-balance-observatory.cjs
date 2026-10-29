const fs=require('node:fs'),crypto=require('node:crypto');const A='art/balance-observatory/v01',B='reports/2026-10-25/evidence/balance-observatory';
fs.mkdirSync(A,{recursive:true});fs.mkdirSync(B,{recursive:true});if(fs.existsSync(B+'/baseline.json'))throw Error('Baseline already exists');
const files=['src/boot.js','src/shrine/Room.js','src/shrine/BalanceTemple.js','src/shrine/BalanceArt.js','src/data/balanceTemple.js'],inventory={};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');for(const f of files)fs.copyFileSync(f,B+'/baseline-'+f.replaceAll('/','__'));
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=dir+'/'+e.name;if(e.isDirectory())walk(f);else inventory[f]=hash(fs.readFileSync(f));}}
for(const dir of ['src','assets','vendor'])walk(dir);for(const f of['index.html','fire-trial.html'])inventory[f]=hash(fs.readFileSync(f));
fs.writeFileSync(B+'/baseline.json',JSON.stringify({files,inventory,release:JSON.parse(fs.readFileSync('dist/assets/release.json'))},null,2));
const poses=[
 ['order-front',[0,4.5,8],[0,.7,-3],[3,.8]],['order-side',[6,4,-2],[0,.3,-3],[3,.8]],['order-rear',[0,4.2,-10.6],[0,.4,0],[3,.8]],['order-roof',[0,5,4],[0,9,-4],[3,.8]],
 ['twin-front',[0,4.5,-16],[0,.7,-24],[3,-20.2]],['twin-side',[6,3.5,-23],[0,1,-27],[0,-24]],['twin-rear',[0,4,-30],[0,2.5,-22],[3,-24]],['twin-roof',[0,5,-18],[0,9,-27],[3,-21]],
 ['gauge-front',[4.6,2.6,-23.3],[4.6,1.25,-28.65],[2.9,-24.5]],['gauge-side',[6,2.8,-29.8],[4.6,1.3,-28.65],[0,-30]],['gauge-rear',[5.5,2.8,-30.8],[4.6,1.3,-28.65],[0,-30]],
 ['lever-front',[0,4.5,-36],[0,.7,-46],[3,-41]],['lever-side',[7,4,-46],[0,1,-48],[3,-41]],['lever-rear',[5,5.8,-62],[0,7.5,-48],[0,-56.5]],['lever-roof',[0,7.5,-40],[0,12,-50],[3,-42]],['entry-roof',[0,3,14],[0,8,5],[1,9]],
].map(([id,camera,target,actor])=>({id,camera,target,actor}));fs.writeFileSync(A+'/cameras.json',JSON.stringify(poses,null,2));console.log(JSON.stringify({runtime:Object.keys(inventory).length,assets:Object.keys(inventory).filter(k=>k.startsWith('assets/')).length,poses:poses.length}));
