const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5512');await p.waitForFunction(()=>window.game,null,{timeout:90000});await p.locator('#title .go').click();
 await p.evaluate(()=>{game.dialogue.close();game.brief.hide();game.loop.stop();game.roomActor.setAt(0,7);});
 const stages={};const dir='reports/2026-09-10/evidence/navigator-game';
 for(const stage of ['idle','rise','fall','land','rest']){
  stages[stage]=await p.evaluate(stage=>{
   const a=game.roomActor,n=a.body.userData.navigator;
   game.input.setTestIntent(stage==='rise'?{jump:true}:{});
   if(stage==='rise'){game.step(1/60);game.input.setTestIntent({});for(let i=0;i<9;i++)game.step(1/60);}
   else if(stage==='fall'){for(let i=0;i<120&&a.vy>=-2.5;i++)game.step(1/60);}
   else if(stage==='land'){for(let i=0;i<120&&!a.grounded;i++)game.step(1/60);}
   else for(let i=0;i<60;i++)game.step(1/60);
   game.engine.renderer.render(game.engine.scene,game.engine.camera);
   return {vy:a.vy,grounded:a.grounded,leg:n.bones.LeftUpLeg.quaternion.toArray(),knee:n.bones.LeftLeg.quaternion.toArray(),bodyY:n.mixer.getRoot().position.y};
  },stage);
  await p.screenshot({path:`${dir}/jump-${stage}.png`});
  await p.evaluate(async()=>{const T=await import('three'),a=game.roomActor,c=game.engine.camera;c.position.copy(a.position).add(a.heading.clone().cross(new T.Vector3(0,1,0)).multiplyScalar(3.2).addScaledVector(a.heading,.8).add(new T.Vector3(0,1.4,0)));c.lookAt(a.position.clone().add(new T.Vector3(0,.8,0)));game.engine.renderer.render(game.engine.scene,c);});
  await p.screenshot({path:`${dir}/jump-${stage}-close.png`});
 }
 fs.writeFileSync(`${dir}/jump.json`,JSON.stringify(stages,null,2));
 assert(stages.rise.vy>0&&!stages.rise.grounded);assert(stages.fall.vy<0&&!stages.fall.grounded);assert(stages.land.grounded);
 const delta=(a,b)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
 assert(delta(stages.idle.leg,stages.rise.leg)>.05);assert(delta(stages.rise.knee,stages.fall.knee)>.02);
 assert(stages.land.bodyY<stages.rest.bodyY-.04);assert(delta(stages.idle.leg,stages.rest.leg)<.001);
 const travel=await p.evaluate(async()=>{
  const T=await import('three'),a=game.roomActor,n=a.body.userData.navigator;a.setAt(0,7);
  game.input.setTestIntent({x:1,y:0,run:true});for(let i=0;i<8;i++)game.step(1/60);
  game.input.setTestIntent({x:1,y:0,run:true,jump:true});game.step(1/60);
  game.input.setTestIntent({x:1,y:0,run:true});for(let i=0;i<9;i++)game.step(1/60);
  const c=game.engine.camera;c.position.copy(a.position).add(a.heading.clone().cross(new T.Vector3(0,1,0)).multiplyScalar(3.2).addScaledVector(a.heading,.8).add(new T.Vector3(0,1.4,0)));c.lookAt(a.position.clone().add(new T.Vector3(0,.8,0)));game.engine.renderer.render(game.engine.scene,c);
  const local=b=>a.body.worldToLocal(b.getWorldPosition(new T.Vector3()));
  return {airborne:!a.grounded,leg:n.bones.LeftUpLeg.quaternion.toArray(),headAboveHip:local(n.bones.Head).y-local(n.bones.Hips).y};
 });
 assert(travel.airborne);assert(delta(travel.leg,stages.rise.leg)>.03);assert(travel.headAboveHip>.35,'Torso must stay upright during travel jump');
 await p.screenshot({path:`${dir}/jump-travel-close.png`});
 assert.deepEqual(errors,[]);fs.writeFileSync(`${dir}/jump.json`,JSON.stringify(stages,null,2));console.log('PASS actual jump ascent/descent, bent knees, landing compression, idle recovery, no errors');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
