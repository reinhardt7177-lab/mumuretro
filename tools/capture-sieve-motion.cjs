const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'','playwright'));
const base=(process.env.AUDIT_URL||'http://127.0.0.1:5512').replace(/\/$/,''),evidence=path.resolve(__dirname,'../reports/2026-09-08/evidence/sieve-court'),out=path.resolve(__dirname,'../reports/2026-09-09/evidence/sieve-motion');fs.mkdirSync(out,{recursive:true});
const legacy=fs.readFileSync(path.join(evidence,'legacy-save.json'),'utf8'),heldLegacy=fs.readFileSync(path.join(evidence,'legacy-held.json'),'utf8'),baseline=JSON.parse(fs.readFileSync(path.join(evidence,'before.json')));
const report={date:new Date().toISOString(),checks:[],errors:[]};
function check(name,pass,details){report.checks.push({name,pass:!!pass,details});assert.ok(pass,name+': '+JSON.stringify(details));console.log('PASS '+name);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
async function fresh(raw=legacy,mobile=false,broken=false){
 const c=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
 await c.addInitScript(raw=>{const raf=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window),q=new Map();let n=0;window.requestAnimationFrame=f=>{q.set(++n,f);return n;};window.cancelAnimationFrame=n=>q.delete(n);window.releaseFrames=()=>{window.requestAnimationFrame=raf;window.cancelAnimationFrame=cancel;for(const f of q.values())raf(f);q.clear();};localStorage.setItem('mumuplanet.progress.v1',raw);},raw);
 await c.route('**/*',async r=>{if(!r.request().url().startsWith(base+'/'))return r.abort();if(broken&&r.request().url().endsWith('/src/shrine/SieveCourt.js')){const response=await r.fetch(),s=await response.text();assert(s.includes('s.spec.mm * D.mmScale'));return r.fulfill({response,body:s.replace('s.spec.mm * D.mmScale','s.spec.mm * D.mmScale * 0.5')});}return r.continue();});
 const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|THREE/.test(m.text()))report.errors.push(m.text());});
 await p.goto(base);await p.waitForFunction(()=>window.game,null,{polling:50,timeout:45000});await p.locator('#title .go').click({force:true});await p.waitForFunction(()=>game.mode!=='title',null,{polling:50});
 await p.evaluate(()=>{game.loop.stop();releaseFrames();game.dialogue.close();game.brief.hide();if(!game.room?.sieveCourt)throw Error('Sieve save did not restore');
 window.st={tick(n=1,intent={}){for(let i=0;i<n;i++){game.dialogue.close();game.brief.hide();game.input.setTestIntent(intent);game.step(1/60);}},act(){this.tick(1,{action:true});this.tick();},
 walk(x,z){let n=0;while(Math.hypot(x-game.roomActor.position.x,z-game.roomActor.position.z)>.08&&n++<1500){const p=game.roomActor.position;game.roomActor.camYaw=Math.atan2(-(x-p.x),-(z-p.z));this.tick(1,{y:1});}if(n>=1500)throw Error('Walk blocked '+[x,z,...game.roomActor.position.toArray()]);this.tick();return n;},
 render(){game.dialogue.close();game.brief.hide();const a=game.roomActor;a.camYaw=0;game.input.camDist=6.5;game.input.camPitch=.4;a.heading.set(0,0,-1);a.syncMesh();a._camPlaced=false;a.updateCamera(game.engine.camera,game.input,0);game.engine.render();},
 pick(mm){const g=game.room.gates[0].gate,s=g.sieves.find(s=>s.spec.mm===mm);this.walk(2.8,2);this.walk(-2.85,2);this.walk(-2.85,s.z);this.act();if(g.held!==s)throw Error('Wrong sieve picked');this.walk(-2.85,2);this.walk(2.8,2);this.walk(2.35,g.frame.z);this.act();},
 };});await p.waitForTimeout(900);return{c,p};}


const {c,p}=await fresh();
const bytes=await p.evaluate(async()=>{
 const g=game.room.gates[0].gate,m=g.workshop.motion,e=game.engine;
 g.restart();g.orders.sort((a,b)=>a.keep[0]===1?-1:b.keep[0]===1?1:0);
 const s=g.sieves.find(s=>s.spec.mm===4);g.interact(s);g.interact(g.frame);
 e.camera.position.set(g.frame.x+4,5.6,g.frame.z+6);e.camera.lookAt(g.frame.x,.7,g.frame.z+1.1);
 const stream=e.renderer.domElement.captureStream(0),track=stream.getVideoTracks()[0],chunks=[];
 const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 const stopped=new Promise(resolve=>{recorder.onstop=resolve;});recorder.start();
 for(let i=0;i<49;i++){if(i)g.update(1/30,game.roomActor);e.render();track.requestFrame();await new Promise(resolve=>setTimeout(resolve,1000/30));}
 recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());return Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()));
});fs.writeFileSync(path.join(out,'sieve-motion.webm'),Buffer.from(bytes));console.log('Captured '+bytes.length+' bytes');await c.close();
}catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();}})();
