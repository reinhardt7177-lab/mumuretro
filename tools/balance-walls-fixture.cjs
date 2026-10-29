const fs=require('node:fs'),A='art/balance-walls/v01';
exports.prepare=async(p,{phase='after',fault=null}={})=>{
 const patches=JSON.parse(fs.readFileSync(A+'/patches.json')),goal=phase==='goal'||phase==='replay-goal',baseline=phase==='legacy'||phase==='replay-goal';
 if(goal)await p.route('**/src/shrine/BalanceRecords.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(A+'/BalanceRecords-preview.js')}));
 const files=baseline?['src/boot.js','src/shrine/Room.js','src/shrine/BalanceTemple.js','src/data/balanceTemple.js']:[...new Set(['src/shrine/Room.js',...(goal?patches.map(p=>p.file):[])])];
 for(const file of files)await p.route('**/'+file,async route=>{const response=await route.fetch();let source=baseline?fs.readFileSync('reports/2026-10-25/evidence/balance-walls/baseline-'+file.replaceAll('/','__'),'utf8'):await response.text();if(goal)for(const q of patches.filter(p=>p.file===file)){if(!source.includes(q.from))throw Error('Preview marker missing: '+q.from);source=source.replace(q.from,q.to);}if(file==='src/shrine/Room.js')source=source.replace('seed = Math.floor(Math.random() * 4294967296)','seed = 20261022');await route.fulfill({response,body:source});});
 if(goal)await p.route('**/balance-temple-v06.glb',route=>route.fulfill({contentType:'model/gltf-binary',body:fs.readFileSync(A+'/balance-temple-v06.glb')}));
 if(fault==='old')await p.route('**/balance-temple-v06.glb',route=>route.fulfill({contentType:'model/gltf-binary',body:fs.readFileSync('assets/models/balance-temple-v05.glb')}));
 if(fault==='fallback')await p.route('**/strata-records-v01.json',route=>route.abort());
 await p.goto('http://127.0.0.1:5512/?q=mid');await p.waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',null,{timeout:120000});await p.evaluate(()=>game.loop.stop());await p.locator('#title .go').click({noWaitAfter:true});
 await p.evaluate(async()=>{game.loop.stop();game.enterShrine(game.shrines.shrines[0]);await game.room.ready;await game.room.dungeon.heritagePromise;await game.engine.interiorArt?.ready;game.dialogue.close();game.brief.hide();game.input.setTestIntent({});});
};
