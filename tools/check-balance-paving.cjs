// Prepared architecture measurements are separate from the actual input journey.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright'));
const B='reports/2026-10-24/evidence/balance-paving',fault=process.argv.includes('--fault=old'),report={checks:[],errors:[],fault};
const check=(name,pass,details)=>{report.checks.push({name,pass:!!pass,details});console.log((pass?'PASS ':'FAIL ')+name);};
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 if(fault)await p.route('**/balance-temple-v05.glb',r=>r.fulfill({contentType:'model/gltf-binary',body:fs.readFileSync('assets/models/balance-temple-v04.glb')}));
 await p.goto('http://127.0.0.1:5512/?q=mid');await p.waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',null,{timeout:120000});await p.evaluate(()=>game.loop.stop());await p.locator('#title .go').click({noWaitAfter:true});
 report.measurements=await p.evaluate(async()=>{game.loop.stop();game.enterShrine(game.shrines.shrines[0]);await game.room.ready;await game.engine.interiorArt?.ready;const T=await import('three'),{quality}=await import('/src/render/Quality.js'),r=game.room,a=game.roomActor,e=game.engine;r.scene.updateMatrixWorld(true);
  const meshes=[];for(const root of r.dungeon.architectureParts)root.traverse(m=>{if(m.isMesh)meshes.push(m);});
  const ray=new T.Raycaster(),sample=(x,z)=>{ray.set(new T.Vector3(x,.2,z),new T.Vector3(0,-1,0));ray.far=.5;return{x,z,top:ray.intersectObjects(meshes,false)[0]?.point.y,collision:a.floorAt(x,z,0)};};
  const circles=[];for(const z of [-3,-24,-50])for(const radius of [2.4,2.7])for(let i=0;i<16;i++){const t=(i+.17)*Math.PI*2/16;circles.push(sample(Math.cos(t)*radius,z+Math.sin(t)*radius));}
  const paths=[];for(const [w,z,length]of [[14,-3,18],[14,-24,16],[18,-50,28],[6,12,12],[5,-14,4],[5,-34,4]])for(const side of [-1,1])for(const f of [-.31,0,.31])paths.push(sample(side*(w/2-1.3),z+f*length));
  const corridor=[sample(2,-13.5),sample(2,-14.5),sample(2,-33.5),sample(2,-34.5)];
  const floorMeshes=meshes.filter(m=>m.material.name==='Balance paving limestone'),floorTextures=floorMeshes.map(m=>({name:m.name,size:[m.material.map?.image?.width,m.material.map?.image?.height],roughness:m.material.roughness,castShadow:m.castShadow,receiveShadow:m.receiveShadow}));
  const before=JSON.stringify(r.exportState(a)),settings=[];for(const tier of ['high','low','mid']){quality.set(tier);e.applySceneShadows();const lights=[];r.scene.traverse(o=>{if(o.isDirectionalLight&&o.castShadow)lights.push({bias:o.shadow.bias,normalBias:o.shadow.normalBias,map:o.shadow.mapSize.toArray()});});settings.push({tier,type:e.renderer.shadowMap.type,enabled:e.renderer.shadowMap.enabled,soft:r.scene.userData.softMidShadows,lights});}
  const unchangedBySettings=before===JSON.stringify(r.exportState(a)),roundTrip=r.importState(JSON.parse(before))&&before===JSON.stringify(r.exportState(a));
  const legacyFloorRings=[];r.scene.traverse(o=>{if(o.isMesh&&o.geometry.type==='TorusGeometry'&&Math.abs(o.position.y-.04)<1e-6&&Math.abs(o.position.z+58)<1e-6)legacyFloorRings.push(o.uuid);});
  return{circles,paths,corridor,floorTextures,settings,unchangedBySettings,roundTrip,legacyFloorRings};});
 const d=report.measurements,flat=p=>Number.isFinite(p.top)&&p.top>=-.0501&&p.top<=.002&&p.collision===0;
 check('96 old circle positions have no raised decoration and retain walking zero',d.circles.length===96&&d.circles.every(flat),d.circles);
 check('36 old path positions have only stone or recessed grout',d.paths.length===36&&d.paths.every(flat),d.paths);
 check('both connector right edges have visible support across the full walking width',d.corridor.every(flat),d.corridor);
 // Blender stores this scalar as float32: .93 exports as .9300000071525574.
 check('all six hall instances load the packed256px rough limestone',d.floorTextures.length===6&&d.floorTextures.every(m=>m.size.every(n=>n===256)&&Math.abs(m.roughness-.93)<1e-6),d.floorTextures);
 check('flat paving receives structure shadows without casting onto itself',d.floorTextures.length===6&&d.floorTextures.every(m=>!m.castShadow&&m.receiveShadow),d.floorTextures);
 check('authored shadow bias survives quality changes with soft middle filter',d.settings.every(s=>s.soft&&s.lights.length===1&&s.lights.every(l=>l.bias===-.0004&&l.normalBias===.035))&&d.settings[2].type===2&&d.settings[2].enabled,d.settings);
 check('no legacy guardian floor ring remains',!d.legacyFloorRings.length,d.legacyFloorRings);
 check('quality inspection and exact save round trip preserve personal progress',d.unchangedBySettings&&d.roundTrip,{unchangedBySettings:d.unchangedBySettings,roundTrip:d.roundTrip});
 check('no browser exceptions',!report.errors.length,report.errors);report.pass=report.checks.every(c=>c.pass);if(!report.pass)process.exitCode=1;
 }catch(e){report.pass=false;report.failure=e.stack;process.exitCode=1;console.error(e);}finally{fs.writeFileSync(B+'/'+(fault?'check-old':'check')+'.json',JSON.stringify(report,null,2));await b.close();}})();
