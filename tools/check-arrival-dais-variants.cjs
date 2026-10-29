const fs=require('node:fs'),path=require('node:path'),fixture=require('./arrival-dais-fixture.cjs'),{B}=fixture;
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright')),phase=process.argv[2]||'goal',report={phase,checks:[],errors:[]};
function check(name,pass,details){report.checks.push({name,pass:!!pass,details});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>report.errors.push(e.message));await fixture.prepare(p,phase);
 const tiers=[];
 for(const tier of ['high','mid','low','min'])tiers.push(await p.evaluate(async tier=>{const {quality}=await import('/src/render/Quality.js');const accepted=quality.pin(tier);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));game.engine.render();game.engine.render();const m=game.landing.group.getObjectByName('Mumu authored arrival dais');return{tier,accepted,actualTier:quality.name,parts:m.children.length,triangles:m.children.reduce((n,o)=>n+(o.geometry.index?.count||o.geometry.attributes.position.count)/3,0),field:game.meadowField.loaded,canvas:[game.engine.renderer.domElement.width,game.engine.renderer.domElement.height]};},tier));
 check('all four quality tiers keep the authored floor and matching surface',tiers.every(t=>t.accepted&&t.actualTier===t.tier&&t.parts===4&&t.triangles===16688&&t.field&&t.canvas.every(v=>v>0)),tiers);
 const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),phone=await touch.newPage();phone.on('pageerror',e=>report.errors.push(e.message));await fixture.prepare(phone,phase);
 await phone.evaluate(()=>{game.engine.render();game.engine.render();});await phone.screenshot({path:B+'/'+phase+'-portrait.png'});
 check('portrait touch viewport retains model and readable notebook control',await phone.evaluate(()=>!!game.landing.group.getObjectByName('Mumu authored arrival dais')&&document.getElementById('tcNote').getBoundingClientRect().width>=36&&!document.querySelector('#load:not([style*="none"])')));
 if(phase==='goal'){
  const fallback=await browser.newPage();fallback.on('pageerror',e=>report.errors.push(e.message));await fixture.prepare(fallback,'goal','mid',{missing:true});
  const state=await fallback.evaluate(()=>{const start=game.player.position.clone();game.input.setTestIntent({y:1});for(let i=0;i<60;i++)game.step(1/60);game.input.setTestIntent({});game.engine.render();return{model:!!game.landing.group.getObjectByName('Mumu authored arrival dais'),walked:game.player.position.distanceTo(start),floorParts:game.landing.group.children.filter(o=>o.isMesh).length,field:game.meadowField.loaded};});
  check('missing optional GLB keeps original visible pad and controller walking',!state.model&&state.walked>1&&state.floorParts>10,state);
 }
 check('no browser exceptions',!report.errors.length,report.errors);report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;console.error(e);process.exitCode=1;}finally{fs.writeFileSync(B+'/variants-'+phase+'.json',JSON.stringify(report,null,2));await browser.close();}})();
