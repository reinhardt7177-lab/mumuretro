// Camera steered by test, actual Input movement; only initial shrine entry is staged.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=process.env.AUDIT_NODE_MODULES?require(path.join(process.env.AUDIT_NODE_MODULES,'playwright')):require('playwright');
const OUT=path.join(__dirname,'../reports/2026-10-02/evidence/water-adventure');fs.mkdirSync(OUT,{recursive:true});
const broken=process.argv.includes('--break-first-step');
const report={date:new Date().toISOString(),checks:[],errors:[],movement:'Automatic camera steering and actual Input intents; shrine entry staged.',funVerified:false,failureInjection:broken};
function check(name,value,details){report.checks.push({name,pass:!!value,details});assert.ok(value,`${name}: ${JSON.stringify(details)}`);console.log('PASS '+name);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>report.errors.push(e.message));
 const base=process.env.AUDIT_URL||'http://127.0.0.1:5512/';
 await p.route('**/*',r=>r.request().url().startsWith(new URL(base).origin+'/')?r.continue():r.abort());
 await p.goto(base);await p.waitForFunction(()=>window.game&&game.mode==='title'&&document.querySelector('#title .go')&&document.getElementById('load').style.display==='none',null,{timeout:90000});
 await p.locator('#title .go').click();await p.evaluate(async()=>{game.loop.stop();game.dialogue.close();game.brief.hide();game.landOnPlanet();game.dialogue.close();game.enterShrine(game.shrines.shrines[3]);game.dialogue.close();game.brief.hide();await game.room.final.heritagePromise;
  window.waterTest={
   tick(n=1,intent={},dismiss=true){for(let i=0;i<n;i++){if(dismiss){game.dialogue.close();game.brief.hide();}game.input.setTestIntent(intent);game.step(1/60);}},
   walk(x,z,jump=false){let n=0;const a=game.roomActor;while(Math.hypot(a.position.x-x,a.position.z-z)>.16&&n++<1800){a.camYaw=Math.atan2(-(x-a.position.x),-(z-a.position.z));this.tick(1,{y:1,run:true,jump:jump&&a.grounded});}if(n>=1800)throw Error(`Walk blocked to ${x},${z} at ${a.position.toArray()}`);this.tick(1);},
   face(x,z){const a=game.roomActor;a.camYaw=Math.atan2(-(x-a.position.x),-(z-a.position.z));this.tick(16,{y:1});this.tick(1);},
   action(){this.tick(1,{action:true});this.tick(1);},
   power(power){this.tick(1,{waterPower:power});this.tick(145);},
   render(){game.roomActor.updateCamera(game.engine.camera,game.input,0);game.engine.render();},
  };
 });
 check('new water room replaces old control panels',await p.evaluate(()=>game.room.waterAdventure&&game.room.gates.every(g=>!g.gate.controls)));
 await p.evaluate(()=>{waterTest.walk(0,game.room.gates[0].gate.braceletPos.z+.8);waterTest.action();});
 check('bracelet acquired with E',await p.evaluate(()=>game.room.bracelet));
 if(broken)await p.evaluate(()=>{const r=game.room,s=r.dungeon.surfaces.find(s=>s.x0===-2.4&&s.height===1.55);s.height+=.7;});
 await p.evaluate(()=>{const g=game.room.gates[0].gate;waterTest.walk(-4,g.seg.z1-2.5);waterTest.face(-4,g.seg.z1-4);waterTest.render();});
 await p.screenshot({path:path.join(OUT,'01-entry.png')});
 if(process.argv.includes('--smoke')){check('no browser errors',report.errors.length===0,report.errors);return;}
 await p.keyboard.press('r');await p.evaluate(()=>{game.input.setTestIntent(null);game.step(1/60);waterTest.tick(80);});
 check('R freezes one parcel but does not open the first door',await p.evaluate(()=>game.room.gates[0].gate.state.phase==='ice'&&!game.room.gates[0].solved));
 await p.evaluate(()=>waterTest.tick(300));check('waiting does not auto-solve',await p.evaluate(()=>!game.room.gates[0].solved));
 await p.evaluate(()=>{waterTest.action();const g=game.room.gates[0].gate;waterTest.walk(-5.5,g.bonusPoint.z+4);waterTest.walk(-5.5,g.bonusPoint.z+3.1);waterTest.action();waterTest.walk(-5.5,g.bonusPoint.z+.5,true);});
 check('optional water fragment earned by actual jumping',await p.evaluate(()=>game.room.gates[0].gate.state.bonus));
 await p.evaluate(()=>{waterTest.tick(1,{waterTool:'recover'});const g=game.room.gates[0].gate;waterTest.walk(-4,g.seg.z1-2.5);waterTest.face(-4,g.seg.z1-4);waterTest.power('cool');waterTest.action();
  waterTest.walk(0,g.ledge.z+5.2);waterTest.walk(0,g.ledge.z+3.9);waterTest.action();waterTest.walk(0,g.ledge.z+1.7,true);waterTest.walk(0,g.ledge.z,true);waterTest.render();});
 check('ice placement and two jumps open first room',await p.evaluate(()=>game.room.gates[0].solved));await p.screenshot({path:path.join(OUT,'02-ice-steps.png')});
 await p.evaluate(()=>{const g=game.room.gates[1].gate;waterTest.walk(0,g.seg.z1-1.3);waterTest.walk(4,g.seg.z1-2.5);waterTest.face(4,g.seg.z1-4);waterTest.power('heat');});
 check('wrong lower heating never fills upper receiver',await p.evaluate(()=>game.room.gates[1].gate.state.zone!=='receiver'&&!game.room.gates[1].solved));
 await p.evaluate(()=>{waterTest.tick(1,{waterTool:'recover'});const g=game.room.gates[1].gate;waterTest.face(4,g.seg.z1-4);waterTest.power('cool');waterTest.action();});
 const save=await p.evaluate(()=>{const r=game.room,s=r.exportState(),before=JSON.stringify(s),bad=JSON.parse(before);bad.devices[1].mass=2;return {rejected:!r.importState(bad),unchanged:JSON.stringify(r.exportState())===before,s};});
 check('malformed save rejected atomically',save.rejected&&save.unchanged);
 check('held-ice snapshot preserves one stable parcel',save.s.devices[1].mass===1&&!save.s.devices[1].held&&save.s.devices[1].phase==='ice');
 await p.evaluate(()=>{const g=game.room.gates[1].gate;waterTest.walk(0,g.seg.z1-1.1);waterTest.walk(-5,g.seg.z1-1.3);waterTest.walk(-5,g.cz+2.1);waterTest.walk(-4.5,g.cz+3.5);waterTest.walk(-4.5,g.cz+2.1);waterTest.action();waterTest.face(g.state.pos[0],g.state.pos[2]);waterTest.power('heat');waterTest.render();});
 check('water physically arrives through upper drain',await p.evaluate(()=>game.room.gates[1].gate.state.zone==='receiver'&&game.room.gates[1].gate.state.phase==='liquid'));
 await p.screenshot({path:path.join(OUT,'03-water-flow.png')});
 const wallJump=await p.evaluate(()=>{const g=game.room.gates[1].gate;waterTest.walk(-5.8,g.cz+.7);let minZ=Infinity,maxY=0;
  for(let i=0;i<120;i++){game.roomActor.camYaw=0;waterTest.tick(1,{y:1,run:true,jump:game.roomActor.grounded});minZ=Math.min(minZ,game.roomActor.position.z);maxY=Math.max(maxY,game.roomActor.position.y);}return {minZ,maxY,wallZ:g.wallZ,solved:game.room.gates[1].solved};});
 check('upper platform jumping cannot bypass lift wall',wallJump.minZ>wallJump.wallZ&&!wallJump.solved,wallJump);
 await p.evaluate(()=>{const g=game.room.gates[1].gate;waterTest.walk(0,g.wallZ+1.05);waterTest.walk(0,g.seg.z1-1.3);waterTest.walk(-5,g.seg.z1-1.3);waterTest.walk(0,g.cz+2);waterTest.walk(-2,g.wallZ+1.2);waterTest.face(g.receiver.x,g.receiver.z);});
 check('wall blocks nearby water ability',await p.evaluate(()=>{const g=game.room.gates[1].gate;return game.roomActor.position.clone().add({x:0,y:1.25,z:0}).distanceTo(g.packetPoint)<5&&!g.target(game.roomActor)&&!g.change(true,game.roomActor)&&g.state.phase==='liquid';}));
 await p.evaluate(()=>{const g=game.room.gates[1].gate;waterTest.walk(0,g.liftPos.z);waterTest.tick(160);waterTest.walk(0,g.wallZ);waterTest.walk(0,g.seg.z0+1.1);});
 check('boarding rising lift and walking across opens second room',await p.evaluate(()=>game.room.gates[1].solved));
 await p.evaluate(()=>{const g=game.room.gates[2].gate;waterTest.walk(0,g.seg.z1-1.2);waterTest.walk(0,g.cz+4.2);waterTest.power('cool');waterTest.walk(0,g.cz-4.8);waterTest.render();});
 check('ice crossing unfolds permanent stone return bridge',await p.evaluate(()=>game.room.gates[2].gate.state.safety));await p.screenshot({path:path.join(OUT,'04-reuse-bridge.png')});
 await p.evaluate(()=>{const g=game.room.gates[2].gate;waterTest.face(0,g.cz);waterTest.power('heat');});
 check('melting reuses same parcel in lower bowl',await p.evaluate(()=>game.room.gates[2].gate.state.zone==='bowl'&&game.room.gates[2].gate.state.mass===1));
 await p.evaluate(()=>{const g=game.room.gates[2].gate;waterTest.walk(-6,g.cz-4);waterTest.walk(-6,g.cz+4);waterTest.walk(-6,g.cz-4);});
 check('stone return bridge is walkable after thawing',await p.evaluate(()=>game.room.gates[2].gate.state.zone==='bowl'&&game.roomActor.position.z<game.room.gates[2].gate.cz-3.7));
 await p.evaluate(()=>{const g=game.room.gates[2].gate;waterTest.walk(-2.9,g.cz-4.4);waterTest.face(-2.9,g.cz-2.4);waterTest.power('heat');});
 check('vapour travels through rising conduit',await p.evaluate(()=>game.room.gates[2].gate.state.zone==='collector'&&game.room.gates[2].gate.state.phase==='vapour'));
 await p.evaluate(()=>{const g=game.room.gates[2].gate;waterTest.walk(5.8,g.cz-4);waterTest.walk(5.8,g.cz-8.8);waterTest.walk(4,g.cz-8.9);waterTest.face(4,g.cz-7.2);waterTest.power('cool');waterTest.render();});
 check('condensation fills altar and opens third door',await p.evaluate(()=>game.room.gates[2].solved&&game.room.gates[2].gate.state.mass===1));await p.screenshot({path:path.join(OUT,'05-condensation.png')});
 const round=await p.evaluate(()=>{const r=game.room,s=r.exportState();return r.importState(s)&&JSON.stringify(r.exportState())===JSON.stringify(s);});check('v3 save round-trip',round);
 await p.evaluate(()=>{waterTest.walk(0,game.room.shrineSeg.z1-1.2);waterTest.walk(0,game.room.final.altar.z+1);waterTest.render();});await p.screenshot({path:path.join(OUT,'06-water-deity.png')});
 await p.evaluate(()=>{waterTest.tick(1,{action:true},false);for(let i=0;i<1500&&game.mode==='room';i++)waterTest.tick(1,{},false);});
 check('deity event awards once and automatically exits',await p.evaluate(()=>game.mode==='planet'&&game.shrines.shrines[3].cleared&&game.snapshot().waterRoom.prize.taken));
 check('no browser errors',report.errors.length===0,report.errors);report.pass=true;
 }catch(error){report.failure=error.message;throw error;}finally{fs.writeFileSync(path.join(OUT,broken?'failure-injection.json':'report.json'),JSON.stringify(report,null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
