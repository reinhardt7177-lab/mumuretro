// Real RoomActor movement and Input intents. No teleport to devices or completion.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright'));
const OUT=path.join(__dirname,'../reports/2026-10-20/evidence/fire-fracture');fs.mkdirSync(OUT,{recursive:true});
const broken=process.argv.includes('--break-bridge'),smoke=process.argv.includes('--smoke');
const report={date:'2026-10-20',checks:[],errors:[],failureInjection:broken,realInputMovement:true,studentFunVerified:false};
function check(name,condition,details){report.checks.push({name,pass:!!condition,details});assert.ok(condition,`${name}: ${JSON.stringify(details)}`);console.log('PASS '+name);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addInitScript(()=>{if(!localStorage.getItem('mumuplanet.progress.v1'))localStorage.setItem('mumuplanet.progress.v1','MAIN_GAME_SENTINEL_DO_NOT_CHANGE');});
 const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const base=process.env.AUDIT_URL||'http://127.0.0.1:5512/';await p.route('**/*',r=>r.request().url().startsWith(new URL(base).origin+'/')?r.continue():r.abort());
 async function ready(){await p.waitForFunction(()=>window.fireTrial||document.querySelector('#load')?.textContent.startsWith('회랑을 불러오지 못했다'),null,{timeout:90000});assert.ok(await p.evaluate(()=>!!window.fireTrial),'Playable trial loaded: '+report.errors.join('\n'));await p.evaluate(()=>fireTrial.loop.stop());}
 async function helpers(){await p.evaluate(()=>{window.ft={
  tick(n=1,intent={}){for(let i=0;i<n;i++){fireTrial.input.setTestIntent(intent);fireTrial.step(1/60);}},
  walk(x,z){let n=0,a=fireTrial.actor;const falls=fireTrial.room.falls;while(Math.hypot(a.position.x-x,a.position.z-z)>.17&&n++<1400){a.camYaw=Math.atan2(-(x-a.position.x),-(z-a.position.z));this.tick(1,{y:1,run:true});if(fireTrial.room.falls>falls)throw Error(`Fell walking to ${x},${z} at ${a.position.toArray()}`);}if(n>=1400)throw Error(`Blocked walking to ${x},${z} at ${a.position.toArray()}`);this.tick(16);},
  action(){this.tick(1,{action:true});this.tick(1);},
  render(){fireTrial.actor.updateCamera(fireTrial.camera,fireTrial.input,0);fireTrial.render();},
  async shot(){}
 };});}
 await p.goto(new URL('fire-trial.html',base).href);await ready();await p.locator('#begin').click();await helpers();
 check('actual Blender parts loaded independently',await p.evaluate(()=>fireTrial.room.manifest.parts.bridge>0&&fireTrial.room.manifest.parts.brace>0&&fireTrial.room.manifest.parts.static>0));
 await p.evaluate(()=>{ft.walk(0,15);ft.walk(0,8);ft.walk(-8,8);ft.walk(-13,8);ft.walk(-20,8);ft.walk(-28,11.9);fireTrial.actor.camYaw=0;ft.tick(30);ft.render();});
 check('walk from entrance through hub and doorway to test lever',await p.evaluate(()=>fireTrial.room.mechanics.state.visited&&fireTrial.room.prompt(fireTrial.actor).includes('다리 시험')));
 const cameraAudit=await p.evaluate(()=>{const {actor:a,camera:c,input:i,room:r}=fireTrial,yaw=a.camYaw,pitch=i.camPitch;let samples=0,inside=0;for(const p of [.2,.4,.65])for(let k=0;k<12;k++){a.camYaw=k*Math.PI/6;i.camPitch=p;a._camPlaced=false;a.updateCamera(c,i,0);const v=c.position.toArray();inside+=Number(r.manifest.cameraOccluders.some(b=>v.every((n,j)=>n>b.min[j]+.02&&n<b.max[j]-.02)));samples++;}a.camYaw=yaw;i.camPitch=pitch;a._camPlaced=false;a.updateCamera(c,i,0);const target=a.position.clone();target.y+=a.lookHeight();return {samples,inside,forwardDistance:c.position.distanceTo(target)};});
 check('bench camera keeps bridge visible and avoids measured solid walls',cameraAudit.samples===36&&cameraAudit.inside===0&&cameraAudit.forwardDistance>4.5,cameraAudit);
 await p.screenshot({path:path.join(OUT,'01-arrival.png')});if(smoke){check('no browser errors',report.errors.length===0,report.errors);return;}
 await p.evaluate(()=>{ft.action();ft.tick(120);});
 check('testing empty sockets does not create stable bridge',await p.evaluate(()=>!fireTrial.room.mechanics.state.stable&&fireTrial.room.bridge.position.y<-.9));
 await p.evaluate(()=>ft.tick(300));check('waiting never solves first trial',await p.evaluate(()=>!fireTrial.room.mechanics.state.stable&&!fireTrial.room.mechanics.state.latched));
 await p.evaluate(()=>{ft.walk(-31,10);ft.action();ft.tick(20);});check('E picks a physical brace and uses carrying pose',await p.evaluate(()=>fireTrial.room.held===0&&fireTrial.body.userData.carrying));
 await p.evaluate(()=>{fireTrial.actor.camYaw=0;ft.tick(35);ft.render();});await p.screenshot({path:path.join(OUT,'02-carry.png')});
 await p.evaluate(()=>{ft.walk(-29.4,5.7);ft.action();});check('carry and seat first brace',await p.evaluate(()=>fireTrial.room.held===null&&fireTrial.room.mechanics.seated===1));
 await p.evaluate(()=>{ft.walk(-28,8);ft.walk(-28,11.9);ft.action();ft.tick(20);fireTrial.setPaused(true);});
 const beforePause=await p.evaluate(()=>fireTrial.room.mechanics.testT);await p.evaluate(()=>ft.tick(180,{action:true,y:1}));
 check('notebook pauses test clock and movement',await p.evaluate(t=>fireTrial.room.mechanics.testT===t&&fireTrial.paused,beforePause));await p.evaluate(()=>{fireTrial.setPaused(false);ft.tick(100);});
 check('one brace is insufficient and remains seated after failed test',await p.evaluate(()=>!fireTrial.room.mechanics.state.stable&&fireTrial.room.mechanics.seated===1));
 await p.evaluate(()=>{ft.walk(-28,5);fireTrial.actor.camYaw=0;ft.tick(70,{y:1,run:true,jump:true});ft.tick(1);});
 check('attempting unstable crossing recovers nearby and keeps fitted brace',await p.evaluate(()=>fireTrial.room.falls>0&&fireTrial.actor.position.z>3&&fireTrial.room.mechanics.seated===1&&!fireTrial.room.mechanics.state.latched));
 await p.evaluate(()=>{ft.walk(-25,10);ft.action();ft.tick(1);});check('second brace can be carried after recovery',await p.evaluate(()=>fireTrial.room.held===1));
 const heldSave=await p.evaluate(()=>{fireTrial.persist();return JSON.parse(localStorage.getItem('mumuplanet.fire-trial.v3')).fracture;});check('carrying snapshot contains stable safe brace positions',heldSave.braces.filter(b=>b.slot!==null).length===1&&heldSave.braces[1].slot===null&&heldSave.checkpoint==='near');
 await p.reload();await ready();await p.locator('#begin').click();await helpers();
 check('actual reload restores seated brace, safe checkpoint and no held duplicate',await p.evaluate(()=>fireTrial.room.mechanics.seated===1&&fireTrial.room.held===null&&fireTrial.actor.position.x<-18&&fireTrial.actor.position.z>3));
 await p.evaluate(()=>{ft.walk(-25,10);ft.action();ft.walk(-26.6,5.7);ft.action();});check('both sockets filled but bridge still requires test',await p.evaluate(()=>fireTrial.room.mechanics.seated===2&&!fireTrial.room.mechanics.state.stable));
 const invalid=await p.evaluate(async()=>{const {createFractureState,validFractureState}=await import('./src/shrine/FractureState.js'),before=JSON.stringify(fireTrial.room.mechanics.snapshot()),bad=JSON.parse(before);bad.braces[1].slot=bad.braces[0].slot;const rejected=!fireTrial.room.mechanics.restore(bad),unchanged=JSON.stringify(fireTrial.room.mechanics.snapshot())===before;return {rejected,unchanged,emptyValid:validFractureState(createFractureState())};});
 check('invalid duplicate socket save is rejected atomically',invalid.rejected&&invalid.unchanged&&invalid.emptyValid,invalid);
 await p.evaluate(()=>{ft.walk(-28,8);ft.walk(-28,11.9);ft.action();ft.tick(95);});check('both braces and completed test raise bridge exactly to walking floor',await p.evaluate(()=>fireTrial.room.mechanics.state.stable&&Math.abs(fireTrial.room.bridge.position.y)<.0001&&!fireTrial.room.mechanics.state.latched));
 await p.evaluate(()=>{ft.walk(-28,5.7);fireTrial.actor.camYaw=0;fireTrial.input.camPitch=.40;ft.tick(40);ft.render();});await p.screenshot({path:path.join(OUT,'03-stable.png')});
 if(broken)await p.evaluate(()=>{const old=fireTrial.room.rects.floorAt;fireTrial.room.rects.floorAt=(x,z)=>x<-18&&z<3&&z>-3?-3:old(x,z);});
 await p.evaluate(()=>{ft.walk(-28,4.2);ft.walk(-28,-4.2);ft.walk(-28,-6.5);ft.action();});
 check('walk over real collision surface and lock far anchor',await p.evaluate(()=>fireTrial.room.mechanics.state.latched&&fireTrial.actor.position.z<-4));await p.evaluate(()=>{ft.render();});await p.screenshot({path:path.join(OUT,'04-far-anchor.png')});
 await p.evaluate(()=>{ft.walk(-28,-4);ft.walk(-28,5.8);ft.walk(-28,8);ft.walk(-20,8);ft.walk(-13,8);ft.walk(-8,8);ft.walk(-5,8);ft.render();});
 check('permanent bridge allows return and hub records first experiment',await p.evaluate(()=>fireTrial.room.mechanics.state.returned&&!document.querySelector('#complete').hidden));
 await p.screenshot({path:path.join(OUT,'05-hub-complete.png')});
 check('main game save never changed',await p.evaluate(()=>localStorage.getItem('mumuplanet.progress.v1')==='MAIN_GAME_SENTINEL_DO_NOT_CHANGE'));
 const malformed=await p.evaluate(async()=>{const {validFractureState}=await import('./src/shrine/FractureState.js'),good=fireTrial.room.mechanics.snapshot(),variants=[];for(const f of [s=>s.braces[0].pos=[null,9],s=>s.version=9,s=>s.stable=false,s=>s.latched=false,s=>s.braces[1].slot=9,s=>s.braces.pop()]){const s=JSON.parse(JSON.stringify(good));f(s);variants.push(!validFractureState(s));}return variants;});check('malformed and contradictory progress rejected',malformed.every(Boolean),malformed);
 await p.reload();await ready();await p.locator('#begin').click();await helpers();check('completed reload keeps bridge and hub progress',await p.evaluate(()=>fireTrial.room.mechanics.state.latched&&fireTrial.room.mechanics.state.returned));
 await p.locator('#keep-playing').click();await p.locator('#quest').click();await p.evaluate(()=>{ft.tick(10);});check('optional golden guide toggles on',await p.evaluate(()=>fireTrial.guide.visible&&fireTrial.guide.geometry.drawRange.count>0));
 for(const [w,h] of [[390,844],[844,390],[1024,768]]){await p.setViewportSize({width:w,height:h});await p.evaluate(()=>{ft.render();});await p.screenshot({path:path.join(OUT,`view-${w}x${h}.png`)});const m=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,objective:document.querySelector('#quest').getBoundingClientRect().bottom,tools:document.querySelector('#tools').getBoundingClientRect().right}));check(`viewport ${w}x${h} has usable HUD`,m.overflow<=1&&m.objective<h&&m.tools<=w,m);}
 const stateChecks=await p.evaluate(async()=>{const m=await import('./src/shrine/FractureState.js'),raw=JSON.stringify(fireTrial.room.mechanics.snapshot()),values=new Map([[m.FRACTURE_SAVE_KEY,raw]]);let removed=false;const storage={getItem:k=>values.get(k)??null,setItem(){throw Error('quota');},removeItem(){removed=true;}};const st=m.createFractureStore(()=>storage);st.read();return {archiveFailed:!st.archive(),untouched:!removed&&values.get(m.FRACTURE_SAVE_KEY)===raw,writeFailed:!st.write(m.createFractureState())};});
 check('backup and quota failures preserve existing trial data',stateChecks.archiveFailed&&stateChecks.untouched&&stateChecks.writeFailed,stateChecks);
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await mobile.addInitScript(s=>{localStorage.setItem('mumuplanet.fire-fracture.v1',JSON.stringify(s));localStorage.setItem('mumuplanet.progress.v1','MOBILE_MAIN_SENTINEL');},heldSave);
 const mp=await mobile.newPage();mp.on('pageerror',e=>report.errors.push(e.message));mp.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});await mp.goto(new URL('fire-trial.html',base).href);await mp.waitForFunction(()=>window.fireTrial||document.querySelector('#load')?.textContent.startsWith('회랑을 불러오지 못했다'),null,{timeout:90000});assert.ok(await mp.evaluate(()=>!!window.fireTrial),'Mobile startup failed: '+report.errors.join('\n'));await mp.evaluate(()=>fireTrial.loop.stop());await mp.locator('#begin').tap();
 const tick=async(n=1)=>mp.evaluate(n=>{for(let i=0;i<n;i++){fireTrial.input.setTestIntent(null);fireTrial.step(1/60);}},n);await tick(1);
 check('touch device exposes context-sensitive E action',await mp.locator('#action').isVisible());await mp.locator('#action').tap();await tick(1);check('actual touch action triggers the same bridge test',await mp.evaluate(()=>fireTrial.room.mechanics.testing));await tick(100);
 await mp.locator('#jump').tap();await tick(5);check('actual touch jump has physical upward movement',await mp.evaluate(()=>fireTrial.actor.position.y>.05));await tick(60);
 const move=await mp.evaluate(()=>{const a=fireTrial.actor,start=a.position.clone(),canvas=document.querySelector('#c');const touch=(y)=>new Touch({identifier:7,target:canvas,clientX:90,clientY:y});canvas.dispatchEvent(new TouchEvent('touchstart',{changedTouches:[touch(600)],touches:[touch(600)],bubbles:true,cancelable:true}));canvas.dispatchEvent(new TouchEvent('touchmove',{changedTouches:[touch(550)],touches:[touch(550)],bubbles:true,cancelable:true}));for(let i=0;i<25;i++)fireTrial.step(1/60);canvas.dispatchEvent(new TouchEvent('touchend',{changedTouches:[touch(550)],touches:[],bubbles:true,cancelable:true}));return start.distanceTo(a.position);});check('touch joystick moves through actual Input path',move>.8,move);
 await mp.locator('#help').tap();const pausePos=await mp.evaluate(()=>fireTrial.actor.position.toArray());await tick(50);check('touch notebook pauses actual controller',await mp.evaluate(p=>fireTrial.paused&&fireTrial.actor.position.toArray().every((n,i)=>n===p[i]),pausePos));await mp.locator('#close-notes').tap();await tick(1);await mp.evaluate(()=>fireTrial.render());await mp.screenshot({path:path.join(OUT,'touch-390x844.png')});
 check('mobile trial leaves main game record intact',await mp.evaluate(()=>localStorage.getItem('mumuplanet.progress.v1')==='MOBILE_MAIN_SENTINEL'));await mobile.close();
 check('no JavaScript or resource errors',report.errors.length===0,report.errors);report.pass=true;
 }catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync(path.join(OUT,broken?'failure-injection.json':'report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
