const fs=require('node:fs'),A='art/balance-portals/v01',B='reports/2026-10-25/evidence/balance-portals';
exports.prepare=async(p,{phase='after',fault=null}={})=>{
 const files=['src/boot.js','src/shrine/Room.js','src/shrine/BalanceTemple.js','src/shrine/BalanceRecords.js','src/data/balanceTemple.js','src/render/InteriorDirection.js','src/shrine/BalanceArt.js'];
 for(const file of files)await p.route('**/'+file,async route=>{const response=await route.fetch();let source=phase==='before'?fs.readFileSync(B+'/baseline-'+file.replaceAll('/','__'),'utf8'):phase==='goal'?fs.readFileSync(A+'/preview-'+file.replaceAll('/','__'),'utf8'):await response.text();if(file==='src/shrine/Room.js')source=source.replace('seed = Math.floor(Math.random() * 4294967296)','seed = 20261022');await route.fulfill({response,body:source});});
 if(phase==='goal')await p.route('**/balance-temple-v07.glb',route=>route.fulfill({contentType:'model/gltf-binary',body:fs.readFileSync(A+'/balance-temple-v07.glb')}));
 if(fault==='fallback')await p.route('**/balance-temple-v07.glb',route=>route.fulfill({contentType:'model/gltf-binary',body:fs.readFileSync('assets/models/balance-temple-v06.glb')}));
 if(fault==='coplanar')await p.route('**/balance-temple-v07.glb',route=>route.fulfill({contentType:'model/gltf-binary',body:fs.readFileSync(A+'/initial-balance-temple-v07.glb')}));
 if(fault==='gap')await p.route('**/balance-temple-v07.glb',route=>route.fulfill({contentType:'model/gltf-binary',body:fs.readFileSync(A+'/gap-balance-temple-v07.glb')}));
 await p.goto('http://127.0.0.1:5512/?q=mid');await p.waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',null,{timeout:120000});await p.evaluate(()=>game.loop.stop());await p.locator('#title .go').click({noWaitAfter:true});
 await p.evaluate(async()=>{game.loop.stop();game.enterShrine(game.shrines.shrines[0]);await game.room.ready;await game.room.dungeon.heritagePromise;await game.engine.interiorArt?.ready;game.dialogue.close();game.brief.hide();game.input.setTestIntent({});});
};
