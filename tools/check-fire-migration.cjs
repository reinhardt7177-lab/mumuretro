const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright'));
const OUT=path.join(__dirname,'../reports/2026-10-21/evidence/fire-adventure');fs.mkdirSync(OUT,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage();await p.goto(new URL('fire-trial.html',process.env.AUDIT_URL||'http://127.0.0.1:5512/').href);await p.waitForFunction(()=>window.fireTrial,null,{timeout:90000});await p.evaluate(()=>fireTrial.loop.stop());
 const result=await p.evaluate(async()=>{
  const {buildRoom,buildLegacyFireRoom}=await import('./src/shrine/Room.js'),{SHRINES}=await import('./src/shrine/layouts.js'),spec=SHRINES.find(s=>s.id==='fire'),checks=[];
  for(const done of [0,1,2,3,4]){
   const old=buildLegacyFireRoom(spec,121),r=buildRoom(spec,121);old.applyTier(4);old.hasProgress=true;
   if(done===4)old.finishLegacy();else for(let i=0;i<done;i++){old.gates[i].solved=true;old.gates[i].gate.restoreSolved?.(true);}
   const source=old.exportState(null),raw=JSON.stringify(source),accepted=r.importState(source);await r.ready;
   const s=r.exportState(null),t=s.trial;
   checks.push({name:`legacy ${done} stages validates and preserves original`,pass:accepted&&!r.error&&JSON.stringify(source)===raw&&JSON.stringify(s.legacyFire)===raw&&s.tier===4});
   checks.push({name:`legacy ${done} stages maps to earned safe progress`,pass:t.fracture.returned===(done>=1)&&t.foundry.returned===(done>=2)&&t.steam.upperReached===(done>=3)&&s.prize.taken===(done===4)&&t.sanctum.awards===(done===4?1:0)});
   const before=JSON.stringify(s),bad=structuredClone(source);bad.devices[0].fields={notValid:true};checks.push({name:`legacy ${done} malformed data rejected atomically`,pass:!r.importState(bad)&&before===JSON.stringify(r.exportState(null))});
   checks.push({name:`migrated ${done} native round trip`,pass:r.importState(s)&&before===JSON.stringify(r.exportState(null))});
  }
  const {createFireTrialStore,FIRE_TRIAL_STEAM_KEY,FIRE_TRIAL_SAVE_KEY,FIRE_TRIAL_BEFORE_STEAM_KEY}=await import('./src/shrine/FireTrialState.js');
  const v2=fireTrial.room.snapshot(fireTrial.actor);v2.version=2;delete v2.sanctum;const raw=JSON.stringify(v2),m=new Map([[FIRE_TRIAL_STEAM_KEY,raw]]),st={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};
  const store=createFireTrialStore(()=>st),v3=store.read();checks.push({name:'prototype v2 upgrades with original and backup intact',pass:v3.version===3&&v3.sanctum.phase==='ready'&&store.write(v3)&&m.get(FIRE_TRIAL_STEAM_KEY)===raw&&m.get(FIRE_TRIAL_BEFORE_STEAM_KEY)===raw&&JSON.parse(m.get(FIRE_TRIAL_SAVE_KEY)).version===3});
  return checks;
 });
 fs.writeFileSync(path.join(OUT,'migration.json'),JSON.stringify(result,null,2));for(const c of result){assert.ok(c.pass,c.name);console.log('PASS '+c.name);}
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
