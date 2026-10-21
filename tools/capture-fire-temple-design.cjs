// Inspect the offline GLB review, not the user's saved game.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright'));
const OUT=path.join(__dirname,'../art/fire-temple/v01');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1700,height:1120}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
 await p.goto('http://127.0.0.1:5512/art/fire-temple/v01/blueprint.svg');await p.screenshot({path:path.join(OUT,'blueprint.png')});
 assert.ok(!fs.readFileSync(path.join(OUT,'blueprint.svg'),'utf8').includes('NaN'),'All diagram coordinates are finite');
 await p.goto('http://127.0.0.1:5512/art/fire-temple/v01/review.html');await p.waitForFunction(()=>window.fireDesignReview?.ready,null,{timeout:120000});
 await p.locator('#model').scrollIntoViewIfNeeded();await p.waitForTimeout(200);await p.locator('.viewer').screenshot({path:path.join(OUT,'webgl-map.png')});
 const metrics=await p.evaluate(()=>{const r=fireDesignReview;let triangles=0,meshes=0;r.model.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;meshes++;}});return {meshes,triangles,status:document.querySelector('#status').textContent};});
 await p.locator('[data-model="portal"]').click();await p.waitForFunction(()=>fireDesignReview.ready&&fireDesignReview.kind==='portal');
 await p.locator('#front').click();await p.waitForTimeout(100);await p.locator('.viewer').screenshot({path:path.join(OUT,'webgl-portal.png')});
 const portal=await p.evaluate(async()=>{const T=await import('/vendor/three/build/three.module.js'),box=new T.Box3().setFromObject(fireDesignReview.model);return {min:box.min.toArray(),max:box.max.toArray()};});
 assert.ok(Math.abs(portal.min[1])<.0001,'Exported portal stands on its own local floor');assert.ok(Math.abs(portal.max[0]-portal.min[0]-9.6)<.01,'Portal width agrees with blueprint');
 assert.ok(Math.abs(portal.max[1]-8.4)<.01,'Portal height agrees with blueprint');
 // Exercise pointer rotation and repeat model changes to inspect selection/reuse.
 await p.locator('#reset').click();const canvas=p.locator('#view'),b=await canvas.boundingBox();await p.mouse.move(b.x+b.width*.5,b.y+b.height*.5);await p.mouse.down();await p.mouse.move(b.x+b.width*.6,b.y+b.height*.55,{steps:4});await p.mouse.up();
 await p.locator('[data-model="map"]').click();await p.waitForFunction(()=>fireDesignReview.ready&&fireDesignReview.kind==='map');
 await p.setViewportSize({width:390,height:844});await p.locator('#model').scrollIntoViewIfNeeded();await p.waitForTimeout(100);await p.locator('.viewer').screenshot({path:path.join(OUT,'webgl-mobile.png')});
 const mobile=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,ready:fireDesignReview.ready}));assert.ok(mobile.overflow<=1&&mobile.ready,'Narrow viewer is usable without horizontal overflow');
 const report={date:'2026-10-20',kind:'offline architecture and review only',map:metrics,portal,mobile,errors,pass:errors.length===0,gameplayTested:false};
 fs.writeFileSync(path.join(OUT,'webgl-review.json'),JSON.stringify(report,null,2));assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify(report));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
