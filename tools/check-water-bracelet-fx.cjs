// Isolated browser only. Real walking + E/Q/R; no actual user save is accessed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright'));
const OUT=path.join(__dirname,'../reports/2026-10-03/evidence/water-bracelet');fs.mkdirSync(OUT,{recursive:true});
const broken=process.argv.includes('--break-wrist');
const report={date:new Date().toISOString(),checks:[],errors:[],failureInjection:broken};
function check(name,value,details){report.checks.push({name,pass:!!value,details});assert.ok(value,`${name}: ${JSON.stringify(details)}`);console.log('PASS '+name);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|program/i.test(m.text()))report.errors.push(m.text());});
 const base=process.env.AUDIT_URL||'http://127.0.0.1:5512/';await p.route('**/*',r=>r.request().url().startsWith(new URL(base).origin+'/')?r.continue():r.abort());
 await p.goto(base);await p.waitForFunction(()=>window.game&&game.mode==='title'&&document.querySelector('#title .go')&&document.getElementById('load').style.display==='none',null,{timeout:90000});
 await p.evaluate(()=>game.loop.stop());await p.locator('#title .go').click({timeout:60000});
 await p.evaluate(async()=>{game.loop.stop();game.dialogue.close();game.brief.hide();game.landOnPlanet();game.dialogue.close();game.enterShrine(game.shrines.shrines[3]);game.dialogue.close();game.brief.hide();await game.room.final.heritagePromise;
  window.fxTest={tick(n=1,intent={},dismiss=true){for(let i=0;i<n;i++){if(dismiss){game.dialogue.close();game.brief.hide();}game.input.setTestIntent(intent);game.step(1/60);}},
   walk(x,z){let n=0,a=game.roomActor;while(Math.hypot(a.position.x-x,a.position.z-z)>.16&&n++<1800){a.camYaw=Math.atan2(-(x-a.position.x),-(z-a.position.z));this.tick(1,{y:1,run:true});}if(n>=1800)throw Error('Walking blocked');this.tick(90);},
   render(){game.roomActor.updateCamera(game.engine.camera,game.input,0);game.engine.render();},
   sample(){const f=game.waterBraceletFx,g=game.room.activeTrial(game.roomActor),b=game.player.body;b.updateWorldMatrix(true,true);const hand=b.userData.navigator.bones.LeftHand.getWorldPosition(f.point.clone()),center=f.cuff.getWorldPosition(f.point.clone());
    const a=f.ribbon.geometry.attributes.position;return {amount:f.amount,pose:f.pose.weight,root:f.root.visible,cuff:f.cuff.visible,sourceError:f.source.distanceTo(f.cuff.userData.emitter.getWorldPosition(f.point.clone())),ribbonError:f.source.distanceTo(f.point.set((a.getX(0)+a.getX(1))/2,(a.getY(0)+a.getY(1))/2,(a.getZ(0)+a.getZ(1))/2)),wristGap:center.distanceTo(hand),targetError:g?f.end.distanceTo(g.braceletPoint(game.roomActor)):null,phase:g?.state.phase,color:f.ribbon.material.uniforms.color.value.toArray(),particles:f.particles.geometry.drawRange.count,hand:hand.toArray(),center:center.toArray()};}
  };fxTest.tick(1);fxTest.render();
 });
 check('no wrist effect before acquisition',await p.evaluate(()=>!game.waterBraceletFx.cuff.visible&&!game.waterBraceletFx.root.visible));
 await p.screenshot({path:path.join(OUT,'01-pickup.png')});
 await p.evaluate(()=>{const g=game.room.gates[0].gate;fxTest.walk(0,g.braceletPos.z+.8);fxTest.tick(1,{action:true});fxTest.tick(90);});
 if(broken)await p.evaluate(()=>{const f=game.waterBraceletFx;game.player.body.attach(f.cuff);f.cuff.position.x+=.5;});
 const fitted=await p.evaluate(()=>fxTest.sample());check('bracelet is fitted to animated left wrist',fitted.cuff&&fitted.wristGap<.055,fitted);
 const radius=await p.evaluate(()=>{const f=game.waterBraceletFx,s=f.cuff.getWorldScale(f.point.clone());return {outerRadius:.065*s.x,width:.086*s.y};});check('cuff dimensions fit wrist rather than float around it',radius.outerRadius>.032&&radius.outerRadius<.042&&radius.width<.055,radius);
 report.wristSurface=await p.evaluate(()=>{const f=game.waterBraceletFx,body=game.player.body,v=f.point.clone(),radii=[];body.updateWorldMatrix(true,true);body.traverse(m=>{if(!m.isSkinnedMesh)return;for(let i=0;i<m.geometry.attributes.position.count;i++){m.getVertexPosition(i,v);m.localToWorld(v);f.cuff.worldToLocal(v);const r=Math.hypot(v.x,v.z);if(Math.abs(v.y)<.009&&r<.10)radii.push(r);}});radii.sort((a,b)=>a-b);return {count:radii.length,max:radii.at(-1),p95:radii[Math.floor(radii.length*.95)],p50:radii[Math.floor(radii.length*.5)]};});
 check('actual skinned wrist clears bracelet inner lining',report.wristSurface.count>0&&report.wristSurface.p95<.059&&(.059-report.wristSurface.p95)*.58<.012,report.wristSurface);
 await p.evaluate(()=>{const f=game.waterBraceletFx,c=game.engine.camera,at=f.cuff.getWorldPosition(f.point.clone());c.position.copy(at).add({x:-.30,y:.13,z:.45});c.near=.02;c.lookAt(at);c.updateProjectionMatrix();game.engine.render();});await p.screenshot({path:path.join(OUT,'07-wrist-fit.png')});await p.evaluate(()=>{game.engine.camera.near=.3;game.engine.camera.updateProjectionMatrix();game.roomActor._camPlaced=false;fxTest.tick(1);});
 await p.evaluate(()=>{const g=game.room.gates[0].gate;fxTest.walk(-1.7,g.seg.z1-4);game.roomActor.camYaw=Math.PI/2;fxTest.tick(8,{y:1});game.roomActor.camYaw=1.2;game.input.camPitch=.28;game.input.camDist=5;fxTest.tick(60);fxTest.render();});
 check('wrist attachment follows walking and turning',await p.evaluate(()=>fxTest.sample().wristGap<.055));
 await p.screenshot({path:path.join(OUT,'02-equipped.png')});
 await p.evaluate(()=>fxTest.tick(1,{waterPower:'cool'}));
 const samples=[];
 for(let i=0;i<70;i++){
  const s=await p.evaluate(()=>{fxTest.tick(1);fxTest.render();return fxTest.sample();});samples.push(s);
  if([1,9,23,39,54,67].includes(i))await p.screenshot({path:path.join(OUT,`cool-${String(i).padStart(2,'0')}.png`)});
 }
 report.coolSamples=samples;
 check('soft attack, sustained casting and complete fade',samples[0].amount<.2&&samples[15].amount>.85&&samples.at(-1).amount===0,{first:samples[0].amount,peak:Math.max(...samples.map(s=>s.amount)),last:samples.at(-1).amount});
 check('beam begins exactly at wrist gem through cast pose',samples.filter(s=>s.amount>.1).every(s=>s.sourceError<.0001&&s.ribbonError<.0001&&s.wristGap<.055));
 check('beam endpoint follows selected water',samples.filter(s=>s.amount>.1).every(s=>s.targetError<.16));
 check('cool effect remains blue and freezes water',samples[20].color[2]>samples[20].color[0]&&samples.at(-1).phase==='ice');
 check('no opacity pop between adjacent frames',Math.max(...samples.slice(1).map((s,i)=>Math.abs(s.amount-samples[i].amount)))<.20);
 await p.evaluate(()=>fxTest.tick(100));check('casting arm returns to locomotion',await p.evaluate(()=>fxTest.sample().pose<.001));
 await p.evaluate(()=>fxTest.tick(1,{waterPower:'heat'}));await p.evaluate(()=>{fxTest.tick(22);fxTest.render();});
 const heated=await p.evaluate(()=>fxTest.sample());check('heating has warm golden light',heated.amount>.8&&heated.color[0]>heated.color[2],heated);
 await p.screenshot({path:path.join(OUT,'03-heating.png')});
 await p.evaluate(()=>fxTest.tick(90));check('heating retains original melting logic',await p.evaluate(()=>game.room.gates[0].gate.state.phase==='liquid'));
 const moving=await p.evaluate(()=>{fxTest.tick(1,{waterPower:'cool'});const start=game.roomActor.position.clone(),samples=[];for(let i=0;i<20;i++){fxTest.tick(1,{y:-1});samples.push(fxTest.sample());}return {distance:start.distanceTo(game.roomActor.position),samples};});
 check('casting stays attached while actually moving and turning',moving.distance>.8&&moving.samples.every(s=>s.sourceError<.0001&&s.ribbonError<.0001&&s.wristGap<.055));
 check('turning away releases light smoothly',Math.max(...moving.samples.slice(1).map((s,i)=>Math.abs(s.amount-moving.samples[i].amount)))<.20);
 await p.evaluate(()=>{fxTest.tick(90);const g=game.room.gates[0].gate;fxTest.walk(-1.7,g.seg.z1-4);game.roomActor.camYaw=Math.PI/2;fxTest.tick(8,{y:1});game.roomActor.camYaw=1.2;fxTest.tick(90);fxTest.tick(1,{waterPower:'heat'});fxTest.tick(90);});
 await p.evaluate(()=>{fxTest.tick(1,{waterPower:'cool'});fxTest.tick(12);game.settings.setOpen(true);fxTest.tick(1,{},false);});
 check('overlay hides beam and clears casting pose',await p.evaluate(()=>!game.waterBraceletFx.root.visible&&game.waterBraceletFx.pose.weight===0));
 await p.evaluate(()=>{game.settings.setOpen(false);fxTest.tick(100);fxTest.tick(1,{waterPower:'heat'});fxTest.tick(12);fxTest.tick(1,{waterTool:'recover'});});
 check('recovery cancels beam without targeting stale water',await p.evaluate(()=>game.waterBraceletFx.amount===0&&game.room.gates[0].gate.state.phase==='liquid'));
 const save=await p.evaluate(()=>{const r=game.room,before=JSON.stringify(r.exportState());for(let i=0;i<25;i++)game.waterBraceletFx.update(1/60,r,game.roomActor,game.engine.camera);return {unchanged:before===JSON.stringify(r.exportState()),data:JSON.parse(before)};});
 check('visual updates do not change save data',save.unchanged&&!JSON.stringify(save.data).includes('castSerial'));
 await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>{fxTest.tick(1,{waterPower:'cool'});fxTest.tick(20);fxTest.render();});
 check('reduced motion removes drifting particles',await p.evaluate(()=>game.waterBraceletFx.particles.geometry.drawRange.count===0));
 await p.emulateMedia({reducedMotion:'no-preference'});await p.evaluate(async()=>{fxTest.tick(90);const {quality}=await import('./src/render/Quality.js');quality.set('min');fxTest.tick(1,{waterPower:'heat'});fxTest.tick(20);fxTest.render();});
 check('lowest quality limits particle budget',await p.evaluate(()=>game.waterBraceletFx.particles.geometry.drawRange.count<=12));
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>fxTest.render());await p.screenshot({path:path.join(OUT,'04-mobile.png')});
 await p.evaluate(()=>{fxTest.tick(90);fxTest.walk(3,game.room.gates[0].gate.seg.z1-2);fxTest.tick(1,{waterPower:'cool'});fxTest.tick(20);});
 check('invalid distant cast emits no beam',await p.evaluate(()=>game.waterBraceletFx.amount===0&&game.room.gates[0].gate.state.phase==='liquid'));
 await p.evaluate(()=>{game.exitShrine();fxTest.tick(1);});check('leaving temple removes wrist and beam',await p.evaluate(()=>!game.waterBraceletFx.cuff.visible&&!game.waterBraceletFx.root.visible&&game.waterBraceletFx.pose.weight===0));
 check('no JavaScript or shader errors',report.errors.length===0,report.errors);report.pass=true;
 }catch(error){report.failure=error.message;throw error;}finally{fs.writeFileSync(path.join(OUT,broken?'failure-injection.json':'report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
