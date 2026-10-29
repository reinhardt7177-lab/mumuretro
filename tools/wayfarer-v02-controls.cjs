const fs=require('node:fs'),path=require('node:path'),{prepare,A,B}=require('./wayfarer-v02-fixture.cjs');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright')),fault=process.argv.includes('--fault-contact');
const report={previewOnly:true,preparedTestSegments:true,wholeJourney:false,fault: fault?'contact':'',checks:[],errors:[]};
function check(name,pass,details){report.checks.push({name,pass:!!pass,details});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(e.message));await prepare(page,'goal');
 await page.evaluate(()=>{game.input.setTestIntent(null);game.input.reset();game.dialogue.close();game.brief.hide();for(let i=0;i<10;i++)game.step(1/60);});
 await page.locator('canvas').first().click({position:{x:1050,y:450},force:true});
 const original=await page.evaluate(()=>({position:game.player.position.toArray(),support:game.planet.arrivalSupport.height,scene:game.mode}));
 await page.keyboard.down('KeyW');await page.evaluate(()=>{for(let i=0;i<90;i++)game.step(1/60)});await page.keyboard.up('KeyW');
 const walk=await page.evaluate(original=>{for(let i=0;i<12;i++)game.step(1/60);return{moved:game.player.position.distanceTo(new T.Vector3().fromArray(original.position)),grounded:game.player.grounded,near:game.landing.near(game.player.position),support:game.planet.arrivalSupport.height};},original);
 check('native W walks off preserved 0.16m arrival mesh toward trail',walk.moved>3&&walk.grounded&&!walk.near&&walk.support===.16,walk);
 const baseline=JSON.parse(fs.readFileSync(B+'/before-geometry.json'));
 const protection=await page.evaluate(baseline=>{
  const p=game.planet,dirs=game.firstTrail.plan.samples,protectedSamples=dirs.map(d=>({delta:p.terraces.delta(d,p.baseHeightAt(d)+p.landscape.delta(d)),height:p.heightAt(d)}));
  const sameDirections=baseline.colliders.length===game.scatter.colliders.length&&game.scatter.colliders.every((c,i)=>new T.Vector3().fromArray(baseline.colliders[i].dir).distanceTo(c.dir)<1e-12&&c.r===baseline.colliders[i].r&&c.kind===baseline.colliders[i].kind);
  return{maxPathChange:Math.max(...protectedSamples.map(s=>Math.abs(s.delta))),sameDirections,counts:game.scatter.counts,support:p.arrivalSupport.height,sites:p.levelSites.map(s=>({id:s.id,height:s.height})),routes:game.worldTrails.routes.filter(r=>r.reachable).length};
 },baseline);
 check('original scatter unit directions, radii, counts and main path heights survive',protection.sameDirections&&protection.maxPathChange<1e-12&&protection.routes===6,protection);
 const candidate=await page.evaluate(()=>{
  const p=game.planet,centre=p.latLonToPos(21,-3).normalize(),e=new T.Vector3(0,1,0).cross(centre).normalize(),n=centre.clone().cross(e).normalize();const choices=[];
  const clear=d=>!game.scatter.colliders.some(c=>c.dir.dot(d)>Math.cos((c.r+1)/p.R));
  for(let x=-16;x<=16;x+=.75)for(let z=-16;z<=16;z+=.75){const a=centre.clone().addScaledVector(e,x/p.R).addScaledVector(n,z/p.R).normalize();if(p.terraces.influence(a)<.85||!clear(a))continue;
   for(let angle=0;angle<Math.PI*2;angle+=Math.PI/4){const tangent=e.clone().multiplyScalar(Math.cos(angle)).addScaledVector(n,Math.sin(angle)),b=a.clone().addScaledVector(tangent,2.8/p.R).normalize();if(p.terraces.influence(b)<.85||!clear(b))continue;const rise=p.heightAt(b)-p.heightAt(a);if(rise<.62||rise>1.18||p.slopeDegAt(a)>29||p.slopeDegAt(b)>29)continue;choices.push({start:a.toArray(),end:b.toArray(),rise,startSlope:p.slopeDegAt(a),endSlope:p.slopeDegAt(b),score:Math.abs(rise-1.05)+a.angleTo(game.landing.dir)});}
  }
  return choices.sort((a,b)=>a.score-b.score)[0]||null;
 });
 check('a clear optional low bench has two walkable ends and a short jump rise',!!candidate,candidate);
 await page.evaluate(c=>{fieldProbe.stage(c.start,c.end,0);game.input.setTestIntent(null);game.input.reset();game.dialogue.close();game.brief.hide();window.jumpEvidence={start:game.player.position.toArray(),startHeight:game.player.position.length(),peak:0,samples:[],steps:0};},candidate);
 if(fault)await page.evaluate(()=>{const original=game.planet.heightAt.bind(game.planet);game.planet.heightAt=d=>original(d)+.35;});
 const contact=await page.evaluate(()=>{const p=game.planet,d=game.player.up,ray=new T.Raycaster(d.clone().multiplyScalar(p.R+p.heightAt(d)+3),d.clone().negate(),0,8),hit=ray.intersectObject(p.mesh,false)[0];return{gap:hit?hit.point.length()-p.R-p.heightAt(d):null};});
 check('rendered triangle and physical bench contact agree within 0.10m',contact.gap!==null&&Math.abs(contact.gap)<=.1,contact);
 await page.screenshot({path:B+'/side-bench-before-jump.png'});
 await page.keyboard.down('KeyW');await page.keyboard.down('Space');
 await page.evaluate(()=>game.step(1/60));await page.keyboard.up('Space');
 const travelled=await page.evaluate(c=>{const a=game.player;let frames=0;for(;frames<100;frames++){const target=new T.Vector3().fromArray(c.end),distance=a.position.angleTo(target)*game.planet.R;if(distance<.25)break;const f=target.addScaledVector(a.up,-target.dot(a.up)).normalize();game.engine.camFwd.copy(f);game.engine.camRight.crossVectors(a.up,f).normalize();game.step(1/60);jumpEvidence.peak=Math.max(jumpEvidence.peak,a.jumpH);jumpEvidence.samples.push({foot:a.getFootPosition(new T.Vector3()).toArray(),jumpH:a.jumpH,grounded:a.grounded});}jumpEvidence.steps=frames;return{frames,distance:a.position.distanceTo(new T.Vector3().fromArray(jumpEvidence.start)),heightGain:a.position.length()-jumpEvidence.startHeight,peak:jumpEvidence.peak};},candidate);
 await page.keyboard.up('KeyW');const landed=await page.evaluate(()=>{for(let i=0;i<110;i++)game.step(1/60);return{...jumpEvidence,end:game.player.position.toArray(),heightGain:game.player.position.length()-jumpEvidence.startHeight,grounded:game.player.grounded,jumpH:game.player.jumpH,blocked:game.player.blockedByProp};});
 check('native W plus Space crosses and lands on the higher optional bench',travelled.frames<100&&travelled.distance>1.9&&travelled.peak>.65&&landed.grounded&&landed.jumpH===0&&landed.heightGain>.55,{travelled,landed});
 await page.screenshot({path:B+'/side-bench-after-jump.png'});
 report.candidate=candidate;
 const restored=await page.evaluate(()=>{const dir=game.landing.dir;fieldProbe.stage(dir.toArray(),game.firstTrail.plan.overlook.toArray(),0);game.input.setTestIntent(null);game.input.reset();game.save(true);return{saved:localStorage.getItem('mumuplanet.progress.v1'),before:game.firstTrail.exportState()};});
 await page.reload();await page.waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',null,{timeout:120000});await page.evaluate(()=>game.loop.stop());await page.locator('#title .go').click({force:true});
 const after=await page.evaluate(()=>{game.loop.stop();game.dialogue.close();game.brief.hide();return{mode:game.mode,expedition:game.firstTrail.exportState(),support:game.planet.arrivalSupport.height,position:game.player.position.toArray()};});
 check('isolated saved expedition restores with unchanged arrival support',restored.saved&&JSON.stringify(restored.before)===JSON.stringify(after.expedition)&&after.support===.16&&after.mode==='planet',after);
 check('no browser exceptions',!report.errors.length,report.errors);report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;console.error(e);process.exitCode=1;}finally{fs.writeFileSync(B+'/'+(fault?'fault-contact':'controls')+'.json',JSON.stringify(report,null,2));await browser.close();}})();
