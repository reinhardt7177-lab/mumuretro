const fs=require('node:fs'),A='art/workspace-camera/v01',B='reports/2026-10-26/evidence/workspace-camera';exports.A=A;exports.B=B;
exports.prepare=async(p,kind,phase='after',options={})=>{
 const baseline=JSON.parse(fs.readFileSync(B+'/baseline.json'));for(const file of baseline.files)await p.route('**/'+file,route=>{let body=fs.readFileSync(phase==='before'?B+'/before-'+file.replaceAll('/','__'):phase==='goal'?A+'/preview-'+file.replaceAll('/','__'):file,'utf8');if(file==='src/render/VisibleCameraFollow.js'&&options.fault==='follow')body=fs.readFileSync(B+'/before-'+file.replaceAll('/','__'),'utf8');if(file==='src/shrine/Room.js')body=body.replace('seed = Math.floor(Math.random() * 4294967296)','seed = 20261022');if(options.transform)body=options.transform(file,body);return route.fulfill({contentType:'text/javascript',body});});
 for(const file of['src/shrine/WorkspaceViews.js','src/render/WorkspaceFraming.js'])if(phase==='goal'||options.fault==='late'&&file.endsWith('WorkspaceViews.js'))await p.route('**/'+file,route=>{
  let body=fs.readFileSync(phase==='goal'?A+'/preview-'+file.replaceAll('/','__'):file,'utf8');
  if(options.fault==='late'&&file.endsWith('WorkspaceViews.js')){for(const marker of['record.actor?.rects===rects&&','actor.rects!==rects||']){if(!body.includes(marker))throw Error('Late-room fault marker missing');body=body.replace(marker,'');}}
  return route.fulfill({contentType:'text/javascript',body});
 });
 await p.goto('http://127.0.0.1:5512/?q=mid');await p.waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',null,{timeout:120000,polling:100});await p.evaluate(()=>game.loop.stop());await p.locator('#title .go').click({force:true});
 await p.evaluate(async kind=>{game.loop.stop();game.enterShrine(game.shrines.shrines[kind==='balance'?0:2]);await game.room.ready;await game.engine.interiorArt?.ready;game.dialogue.close();game.brief.hide();game.input.setTestIntent({});game.input.camPitch=.38;game.input.camDist=6.5;},kind);
 if(options.fault==='workspace')await p.evaluate(()=>game.room.workspaceViews.zones.forEach(z=>z.active=()=>false));
};
