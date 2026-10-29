// Isolate old test evidence. Every geometry/version fixture adaptation is retained.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const file=path.resolve(__dirname,process.argv[2]),dest=path.resolve(process.argv[3]),args=process.argv.slice(4),name=path.basename(file);
fs.mkdirSync(dest,{recursive:true});let s=fs.readFileSync(file,'utf8'),redirected=false;const adaptations=[];
s=s.replace(/\b(OUT|out)\s*=\s*(?:path\.(?:resolve|join)\([^)]*\)|'[^']*'|"[^"]*")/,(_,key)=>{redirected=true;return key+'='+JSON.stringify(dest);});assert(redirected,'missing output redirect');
function replace(from,to,reason){assert(s.includes(from),reason+' marker missing');s=s.replaceAll(from,to);adaptations.push(reason);}
if(['check-balance-temple.cjs','check-balance-order-counts.cjs','check-balance-mobile.cjs'].includes(name)){
  const marker='game.enterShrine(game.shrines.shrines[0]);';assert(s.includes(marker));s=s.replace('await p.evaluate(()=>{','await p.evaluate(async()=>{').replace(marker,marker+'await game.room.ready;');adaptations.push('wait for native kits before first old balance fixture');
}
if(name==='check-balance-temple.cjs'){
  replace('-26.1','-25.8','two-pan front approach uses1.2m physical clearance');
  replace('bt.walk(0,3.8);','bt.walk(0,5.2);bt.walk(2.6,5.2);bt.walk(2.6,3.5);bt.walk(0,3.5);','walk around new solid row instead of targeting inside its central pedestal');
}
if(name==='check-balance-order-counts.cjs')replace('t.walk(g.choices.find(c=>c.n===count).x,4.2);t.act();','t.walk(g.choices.find(c=>c.n===count).x,5.2);t.act();t.walk(2.6,5.2);t.walk(2.6,3.5);','choose from front of new solid pedestal and walk around its right end');
if(name==='check-balance-journey.cjs')replace('bj.walk(c.x,4.2);bj.act();return g.count;','bj.walk(c.x,5.2);bj.act();bj.walk(2.6,5.2);bj.walk(2.6,3.5);return g.count;','actual selection from front followed by actual walk around new solid pedestals');
if(name==='check-balance-mobile.cjs')replace('a.setAt(-1.4,4.2)','a.setAt(-1.4,5.2)','touch fixture stands in front of solid selection pedestal');
if(name==='check-balance-mechanisms.cjs')replace('r.gates[0].gate.progressCodec.capture().version===3','r.gates[0].gate.progressCodec.capture().version===4','first order codec now v4; separate native tests verify v3 exact migration');
if(name==='measure-balance-mechanisms.cjs')replace('native:r.balanceArt.loaded','native:r.balanceArt.loaded&&r.balanceOnboarding.loaded','performance requires both native mechanism and onboarding models loaded');
if(name==='check-coop-room-browser.cjs'){
  replace('[[0,3.8],[5.5,3.5]','[[0,5.2],[2.6,5.2],[2.6,3.5],[5.5,3.5]','shared-room actual walk goes around solid selection row');
  const marker="for(const p of pages)await p.waitForFunction(()=>game.mode==='room'&&game.room.gates[0].gate.count===3);";
  replace(marker,marker+`
for(const p of pages)await p.evaluate(async()=>await game.room.ready);
const selected=[];
for(const count of[4,3]){
 const accepted=await pages[0].evaluate(count=>{game.loop.stop();const a=game.roomActor,g=game.room.gates[0].gate,c=g.choices.find(c=>c.n===count);const tick=(intent={})=>{game.dialogue.close();game.brief.hide();game.input.setTestIntent(intent);game.step(1/60);};let frames=0;while(Math.hypot(c.x-a.position.x,5.2-a.position.z)>.085&&frames++<1500){a.camYaw=Math.atan2(-(c.x-a.position.x),-(5.2-a.position.z));tick({y:1});}if(frames>=1500)throw Error('Actual cooperative selection approach blocked');tick();const prompt=g.prompt(a.position),reach=!!g.choiceNear(a.position);tick({action:true});tick();return{prompt,reach,count,position:a.position.toArray(),frames};},count);
 assert(accepted.reach&&accepted.prompt.includes(count+'개'),'actual cooperative selection is in physical reach');
 for(const p of pages)await p.waitForFunction(n=>game.room.gates[0].gate.count===n,count,{timeout:15000});
 selected.push(accepted);
}
const sharedHomes=await Promise.all(pages.map(p=>p.evaluate(()=>game.room.gates[0].gate.stock.map(b=>({home:b.home.toArray(),scale:b.mesh.scale.toArray()})))));assert(sharedHomes.every(h=>JSON.stringify(h)===JSON.stringify(sharedHomes[0])),'shared homes/appearances use identical seed');
fs.writeFileSync(${JSON.stringify(path.join(dest,'actual-choice.json'))},JSON.stringify({pass:true,clients:3,selected,sharedHomes,actualInput:true},null,2));
`,'add actual cooperative4/3 selection from physical fronts and verify identical peer homes');
}
if(s.includes('waitForFunction(()=>window.game,'))replace('waitForFunction(()=>window.game,',"waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',",'wait for visible load completion');
for(const method of['click','tap']){const exact="await p.locator('#title .go')."+method+'()';if(s.includes(exact))replace(exact,"await p.evaluate(()=>game.loop.stop());await p.locator('#title .go')."+method+'({force:true,timeout:90000})','pause automatic title rendering before real title '+method);}
fs.writeFileSync(path.join(dest,'executed-check.cjs'),s);fs.writeFileSync(path.join(dest,'adaptations.json'),JSON.stringify({file,adaptations,assertionsWeakened:false},null,2));
process.argv=[process.execPath,file,...args];const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
