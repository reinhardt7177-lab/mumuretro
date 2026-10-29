// Preserve earlier evidence folders while rechecking their relevant contracts.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const name=path.basename(process.argv[2]),file=path.join(__dirname,name),dest=path.resolve('reports/2026-10-24/evidence/chronicle-portal/regressions',name.replace('.cjs',''));fs.mkdirSync(dest,{recursive:true});
let code=fs.readFileSync(file,'utf8');const old="B='reports/2026-10-24/evidence/chronicle-evidence'";assert(code.includes(old));code=code.replace(old,'B='+JSON.stringify(dest.replace(/\\/g,'/')));
const adaptations=[];
if(name==='check-chronicle-evidence.cjs'){
  const assertion='physical.camera===8';assert(code.includes(assertion));code=code.replace(assertion,"physical.camera===4&&await p.evaluate(()=>game.room.strataPortal.loaded&&game.room.strataPortal.cameraMeshes.length===18&&game.room.strataPortal.colliders.length===9)");
  adaptations.push('The short WallFrame is superseded: four core-stand camera meshes remain; require new portal eighteen camera meshes and nine fixed solids. Stand count, floor, real carry/jump and save assertions retained.');
}
if(name==='check-chronicle-evidence-touch.cjs'){
 const marker="check('no touch browser errors'";assert(code.includes(marker));
 code=code.replace(marker,`
// Prepare the other two insertions and the last carrying location; the final
// action and movement through the newly opening door use real touch events.
await p.setViewportSize({width:390,height:844});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
await p.evaluate(()=>{const g=game.room.gates[0].gate,left=g.fossils.filter(f=>!f.slot),last=left.find(f=>Math.abs(g.marks.find(m=>m.slot.level===f.level).x)<1.2);if(!last)throw Error('Central final marker missing');for(const f of left.filter(f=>f!==last)){g.interact(f.home);g.interact(g.marks.find(m=>m.slot.level===f.level));}g.interact(last.home);const m=g.marks.find(m=>m.slot.level===last.level);game.roomActor.setAt(m.x,m.z+.15);game.roomActor.camYaw=0;live(2);});
await p.locator('#tcAct').tap();await p.evaluate(()=>live(2));check('real last touch action starts the authored lifting door',await p.evaluate(()=>game.room.gates[0].solved&&game.room.strataPortal.loaded&&game.room.strataPortal.lift<2.7));
for(let i=0;i<12;i++){if(await p.evaluate(()=>game.roomActor.position.z)<-12)break;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:75,y:600,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:75,y:520,id:1}]});await p.evaluate(()=>live(35));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.evaluate(()=>live(2));}
const passage=await p.evaluate(()=>({z:game.roomActor.position.z,lift:game.room.strataPortal.lift,open:game.room.dungeon.doors.r1.rect.open}));check('real touch joystick crosses the lifted stone passage',passage.z<-12&&passage.lift===3.45&&passage.open,passage);
`+marker);
 adaptations.push('Add final real tap and repeated real joystick movement through the lifted door; preceding extra placements and last carrying position are explicitly prepared, not claimed as touch full puzzle play.');
}
fs.writeFileSync(path.join(dest,'adaptations.json'),JSON.stringify(adaptations,null,2));const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(code,file);
