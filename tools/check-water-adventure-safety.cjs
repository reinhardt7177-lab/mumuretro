// Isolated save migration, actual reload, keyboard and touch verification.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=process.env.AUDIT_NODE_MODULES?require(path.join(process.env.AUDIT_NODE_MODULES,'playwright')):require('playwright');
const base=(process.env.AUDIT_URL||'http://127.0.0.1:5512').replace(/\/$/,'');
const out=path.resolve(__dirname,'../reports/2026-10-02/evidence/water-adventure');
fs.mkdirSync(out,{recursive:true});const report={checks:[],errors:[],date:new Date().toISOString()};
function check(name,ok,details){report.checks.push({name,pass:!!ok,details});assert.ok(ok,`${name}: ${JSON.stringify(details)}`);console.log('PASS '+name);}
async function helpers(p){await p.evaluate(()=>{window.wt={
  tick(n=1,intent={},dismiss=true){for(let i=0;i<n;i++){if(dismiss){game.dialogue.close();game.brief.hide();}game.input.setTestIntent(intent);game.step(1/60);}},
  walk(x,z){let n=0;const a=game.roomActor;while(Math.hypot(x-a.position.x,z-a.position.z)>.15&&n++<1800){a.camYaw=Math.atan2(-(x-a.position.x),-(z-a.position.z));this.tick(1,{y:1,run:true});}if(n>=1800)throw Error('Walk blocked');this.tick();},
  face(x,z){const a=game.roomActor;a.camYaw=Math.atan2(-(x-a.position.x),-(z-a.position.z));this.tick(15,{y:1});this.tick();},
  live(n=1){game.input.setTestIntent(null);for(let i=0;i<n;i++)game.step(1/60);},
  render(){game.roomActor.updateCamera(game.engine.camera,game.input,0);game.engine.render();},
};});}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 async function fresh(options={}){const c=await browser.newContext({viewport:{width:1280,height:800},...options});
  await c.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto(base);await p.waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',null,{timeout:90000});
  await p.locator('#title .go').click();await p.evaluate(()=>{game.loop.stop();game.dialogue.close();game.brief.hide();
   game.lab.importState({version:1,dials:[3,5,8],hasNote:true,read:true,open:true,done:false,sent:false});game.notebook.setHas(true);
   game.landOnPlanet();game.dialogue.close();game.enterShrine(game.shrines.shrines[3]);game.dialogue.close();game.brief.hide();});
  await helpers(p);return {c,p};}
 const {c,p}=await fresh();
 const migrations=await p.evaluate(async()=>{const {buildRoom}=await import('/src/shrine/Room.js');const r=buildRoom(game.SHRINES[3],2210),results=[];
  const hints=Object.fromEntries(Object.keys(r.hints).map(k=>[k,{level:0,t:0}]));
  for(const version of [1,2])for(const count of [0,1,2,3])for(const awarded of count===3?[false,true]:[false]){
   const solved=[0,1,2].map(i=>i<count),prize={taken:awarded,drop:awarded?1:-1,t:0};
   const old={version,tier:2,solved,prize,hints,checkpoint:{x:0,y:0,z:10,yaw:0}};
   if(version===1)Object.assign(old,{freeze:Array.from({length:3},()=>({base:4,phase:'water',t:0})),holes:Array.from({length:4},(_,i)=>({x:i%2?-2:2,z:-40-i*2,r:1.5})),
    steam:{ti:0,wants:['ice','water','steam'],filled:[0,1,2].map(i=>count===3),bridge:count===3?1:0},final:{si:0,want:0,got:awarded?3:0,flash:0}});
   else Object.assign(old,{devices:solved.map(done=>({heat:0,align:0,freeze:done,cool:false,bridgeReady:done,completed:done,plug:done?0:1,water:done?1:0,ice:done?1:0,tank:done?1:0})),final:{active:awarded,progress:awarded?1:0},legacyWater:null});
   const ok=r.importState(old),s=r.exportState();
   results.push({version,count,awarded,ok,same:ok&&JSON.stringify(s.solved)===JSON.stringify(solved)&&s.prize.taken===awarded&&s.version===3&&s.legacyWater.version===version,
    doors:ok&&r.gates.every((g,i)=>r.dungeon.doors[g.room].rect.open===solved[i]),checkpoint:ok&&s.checkpoint.z===(count<3?r.gates[count].gate.seg:r.shrineSeg).z1-1.3,
    roundtrip:ok&&r.importState(s)});
  }return results;});
 check('v1/v2 migration preserves all completion and reward combinations',migrations.every(v=>v.ok&&v.same&&v.doors&&v.checkpoint&&v.roundtrip),migrations);
 const wrongSteam=await p.evaluate(async()=>{const {createWaterPacket,beginWaterChange,advanceWater}=await import('/src/shrine/WaterAdventureState.js'),seg=game.room.gates[2].gate.seg,s=createWaterPacket('cycle',seg);
  const tick=()=>{for(let i=0;i<180;i++)advanceWater(s,'cycle',seg,1/60);};beginWaterChange(s,true);tick();const outside=s.zone==='cloud'&&!s.completed&&s.mass===1;
  beginWaterChange(s,false);tick();return outside&&s.zone==='bridge'&&s.phase==='liquid'&&s.mass===1;});
 check('wrong bridge heating cannot bypass collection and remains reversible',wrongSteam);
 await p.evaluate(()=>{wt.walk(0,game.room.gates[0].gate.braceletPos.z+.8);wt.tick(1,{action:true});wt.tick();const g=game.room.gates[0].gate;wt.walk(-4,g.seg.z1-2.5);wt.face(-4,g.seg.z1-4);});
 check('quest points at high goal instead of revealing ice placement',await p.evaluate(()=>game.questGuide.current.target.equals(game.room.gates[0].gate.ledge)));
 await p.keyboard.press('r');await p.evaluate(()=>{document.activeElement.blur();wt.live(90);wt.tick(1,{action:true});wt.tick();game.save(true);});
 const stored=await p.evaluate(()=>JSON.parse(localStorage.getItem('mumuplanet.progress.v1')));
 check('real local save normalizes carried ice without duplication',stored.progress.waterRoom.devices[0].phase==='ice'&&!stored.progress.waterRoom.devices[0].held&&stored.progress.waterRoom.devices[0].mass===1);
 await p.reload();await p.waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',null,{timeout:90000});
 await p.locator('#title .go').click();await p.evaluate(()=>{game.loop.stop();game.dialogue.close();game.brief.hide();});await helpers(p);
 check('reload resumes water room at a safe floor with bracelet and ice',await p.evaluate(()=>game.mode==='room'&&game.room.bracelet&&game.room.gates[0].gate.state.phase==='ice'&&game.roomActor.position.y===0&&game.roomActor.position.z===game.room.gates[0].gate.seg.z1-1.3));
 await p.evaluate(()=>{const g=game.room.gates[0].gate;wt.walk(-4,g.seg.z1-2.5);wt.face(-4,g.seg.z1-4);document.activeElement.blur();game.input.setTestIntent(null);});
 await p.keyboard.press('e');await p.evaluate(()=>wt.live());
 check('restored ice can be picked up with real E input',await p.evaluate(()=>game.room.gates[0].gate.state.held));
 await p.keyboard.down('q');await p.keyboard.down('q');await p.evaluate(()=>wt.live(300));await p.keyboard.up('q');
 check('held Q and repeat do not skip liquid phase',await p.evaluate(()=>game.room.gates[0].gate.state.phase==='liquid'&&!game.room.gates[0].gate.state.held&&!game.room.gates[0].gate.state.transition));
 check('melting carried ice remains a valid save',await p.evaluate(()=>{const r=game.room,s=r.exportState();return r.importState(s);}));
 const invalids=await p.evaluate(()=>{const r=game.room,s=r.exportState(),before=JSON.stringify(s),cases=[
  v=>v.devices[0].mass=2,v=>v.devices[0].zone='held',v=>v.devices[0].pos[0]=999,v=>v.devices[0].motion={t:0},
  v=>v.solved=[false,true,false],v=>v.bracelet=false,v=>v.final={active:true,progress:1},v=>v.checkpoint.y=3];
  return cases.map((mutate,i)=>{const bad=JSON.parse(before);mutate(bad);return {i,rejected:!r.importState(bad),unchanged:JSON.stringify(r.exportState())===before};});});
 check('malformed state cannot mutate progress or open doors',invalids.every(v=>v.rejected&&v.unchanged),invalids);
 await c.close();
 const mobile=await fresh({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const m=mobile.p;await m.evaluate(()=>{wt.walk(0,game.room.gates[0].gate.braceletPos.z+.8);});await m.locator('#tcAct').tap();await m.evaluate(()=>{wt.live();wt.tick();const g=game.room.gates[0].gate;wt.walk(-4,g.seg.z1-2.5);wt.face(-4,g.seg.z1-4);game.input.setTestIntent(null);});
 check('touch E acquires bracelet',await m.evaluate(()=>game.room.bracelet));
 await m.locator('#waterBracelet [data-power=cool]').tap();await m.evaluate(()=>wt.live(100));
 check('touch cool uses same state transition',await m.evaluate(()=>game.room.gates[0].gate.state.phase==='ice'));
 await m.locator('#tcAct').tap();await m.evaluate(()=>wt.live(2));
 check('touch E carries ice with gameplay pose',await m.evaluate(()=>game.room.gates[0].gate.state.held&&game.player.body.userData.carrying));
 const before=await m.evaluate(()=>JSON.stringify(game.room.gates[0].gate.state));
 await m.evaluate(()=>{game.notebook.setOpen(true);wt.live(90);});
 check('notebook pauses parcel and hides power HUD',await m.evaluate(value=>JSON.stringify(game.room.gates[0].gate.state)===value&&game.waterBracelet.el.hidden,before));
 await m.evaluate(()=>{game.notebook.setOpen(false);wt.live(2);});await m.locator('#waterBracelet [data-tool=recover]').tap();await m.evaluate(()=>wt.live(2));
 check('touch recovery restores one parcel and releases carrying',await m.evaluate(()=>{const s=game.room.gates[0].gate.state;return !s.held&&s.mass===1&&s.phase==='liquid'&&!game.player.body.userData.carrying;}));
 await m.locator('#waterBracelet [data-tool=hint]').tap();await m.evaluate(()=>wt.live(2));
 check('hint is requested rather than timed automatically',await m.evaluate(()=>game.room.hints.r1.level===1&&game.waterBracelet.el.querySelector('output').textContent.length>0&&!game.room.gates[0].solved));
 for(const [width,height] of [[390,844],[844,390],[1024,768]]){await m.setViewportSize({width,height});await m.evaluate(()=>{wt.live(2);wt.render();});
  const metric=await m.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};},a=rect(game.waterBracelet.el),b=rect(document.getElementById('questGuide')),c=rect(document.getElementById('tcJump'));
   const overlap=(x,y)=>x.x<y.right&&x.right>y.x&&x.y<y.bottom&&x.bottom>y.y;
   return {a,b,c,inside:a.x>=0&&a.y>=0&&a.right<=innerWidth&&a.bottom<=innerHeight,clear:!overlap(a,b)&&!overlap(a,c),buttons:[...game.waterBracelet.el.querySelectorAll('[data-power]')].map(e=>e.getBoundingClientRect().height)};});
  check(`touch HUD fits and clears quest/jump at ${width}x${height}`,metric.inside&&metric.clear&&metric.buttons.every(h=>h>=40),metric);
  await m.screenshot({path:path.join(out,`mobile-${width}x${height}.png`)});
 }
 check('no browser exceptions',report.errors.length===0,report.errors);report.pass=true;await mobile.c.close();
 }catch(error){report.failure=error.message;throw error;}finally{fs.writeFileSync(path.join(out,'safety-report.json'),JSON.stringify(report,null,2));await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
