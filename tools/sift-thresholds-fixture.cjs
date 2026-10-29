const fs=require('node:fs'),A='art/sift-thresholds/v01',B='reports/2026-10-25/evidence/sift-thresholds';
exports.prepare=async(p,{phase='after',fault=null}={})=>{
 const baseline=JSON.parse(fs.readFileSync(B+'/baseline.json'));
 for(const f of baseline.files)await p.route('**/'+f,async route=>{let body=phase==='before'?fs.readFileSync(B+'/baseline-'+f.replaceAll('/','__'),'utf8'):phase==='goal'?fs.readFileSync(A+'/preview-'+f.replaceAll('/','__'),'utf8'):fs.readFileSync(f,'utf8');if(f==='src/shrine/Room.js')body=body.replace('seed = Math.floor(Math.random() * 4294967296)','seed = 20261022');await route.fulfill({contentType:'text/javascript',body});});
 if(phase==='goal'){
  for(const name of['SiftRecords','SiftThresholds'])await p.route('**/src/shrine/'+name+'.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(A+'/'+name+'-preview.js')}));
  await p.route('**/assets/models/adventure/sift-thresholds-v01.json',route=>route.fulfill({contentType:'application/json',body:fs.readFileSync(A+'/design-spec.json')}));
  await p.route('**/assets/models/adventure/sift-thresholds-v01.glb',route=>route.fulfill({contentType:'model/gltf-binary',body:fs.readFileSync(A+'/sift-thresholds-v01.glb')}));
 }
 if(fault==='model')await p.route('**/assets/models/adventure/sift-thresholds-v01.glb',r=>r.abort());
 if(fault==='records')await p.route('**/panel-workshop-v01.glb',r=>r.abort());
 if(fault==='margin')await p.route('**/assets/models/adventure/sift-thresholds-v01.json',route=>{const spec=JSON.parse(fs.readFileSync(phase==='goal'?A+'/design-spec.json':'assets/models/adventure/sift-thresholds-v01.json'));for(const p of spec.records.placements)if(p.position[0]>0)p.position[0]=4.5;return route.fulfill({contentType:'application/json',body:JSON.stringify(spec)});});
 await p.goto('http://127.0.0.1:5512/?q=mid');await p.waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',null,{timeout:120000,polling:100});await p.evaluate(()=>game.loop.stop());await p.locator('#title .go').click({force:true});
 await p.evaluate(async()=>{game.loop.stop();game.enterShrine(game.shrines.shrines[2]);await game.room.ready;await game.engine.interiorArt?.ready;game.dialogue.close();game.brief.hide();game.input.setTestIntent({});});
};
