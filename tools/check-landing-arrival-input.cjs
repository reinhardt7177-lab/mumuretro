const fs=require('node:fs'),path=require('node:path'),{prepare,B}=require('./landing-arrival-fixture.cjs'),{chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright'));
const touch=process.argv.includes('--touch'),report={touch,labPrepared:true,checks:[],errors:[]};
function check(name,pass,details){report.checks.push({name,pass:!!pass,details});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1280,height:800},isMobile:touch,hasTouch:touch}),p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await prepare(p);
 await p.evaluate(()=>{window.landingFxState=()=>game.landing.group.children.filter(o=>o.isPoints||o.isPointLight||o.name==='Landing return beacon'||o.name==='Landing arrival ripple').map(o=>({name:o.name,visible:o.visible,intensity:o.intensity,uniforms:o.material?.uniforms?{strength:o.material.uniforms.strength.value,presence:o.material.uniforms.presence.value}:null,positions:o.isPoints?Array.from(o.geometry.attributes.position.array):null}));game.input.setTestIntent(null);game.input.reset();for(let i=0;i<15;i++)game.step(1/60);game.touch.update();});
 if(touch)await p.locator('#tcNote').tap();else{await p.keyboard.press('KeyN');await p.evaluate(()=>game.step(1/60));}
 const paused=await p.evaluate(()=>{const before=JSON.stringify(landingFxState()),position=game.player.position.clone();for(let i=0;i<120;i++)game.step(1/60);return{open:game.notebook.isOpen,unchanged:before===JSON.stringify(landingFxState()),moved:position.distanceTo(game.player.position)};});
 check('native notebook pauses arrival and traveller together',paused.open&&paused.unchanged&&paused.moved===0,paused);
 if(touch)await p.locator('#nbX').tap();else{await p.keyboard.press('KeyN');await p.evaluate(()=>game.step(1/60));}
 await p.evaluate(()=>{game.input.reset();game.step(1/60);game.touch.update();});
 if(!touch){report.focusBeforeCanvas=await p.evaluate(()=>({tag:document.activeElement?.tagName,id:document.activeElement?.id,className:document.activeElement?.className}));await p.locator('canvas').first().click({position:{x:1100,y:450},force:true});report.focusAfterCanvas=await p.evaluate(()=>document.activeElement?.tagName);}
 if(touch)await p.locator('#tcJump').tap();else await p.keyboard.down('Space');
 let jump=await p.evaluate(()=>{game.step(1/60);return game.player.jumpH;});if(!touch)await p.keyboard.up('Space');
 const landed=await p.evaluate(()=>{let peak=game.player.jumpH;for(let i=0;i<100;i++){game.step(1/60);peak=Math.max(peak,game.player.jumpH);}return{peak,grounded:game.player.grounded,h:game.player.jumpH,fx:landingFxState()};});
 check('native jump lands while every temporary arrival effect retires',Math.max(jump,landed.peak)>.6&&landed.grounded&&landed.h===0&&landed.fx.filter(o=>/motes|ripple/.test(o.name)).every(o=>!o.visible),landed);
 const before=await p.evaluate(()=>game.player.position.toArray());let cdp;
 if(touch){cdp=await context.newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:75,y:690,id:62}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:75,y:620,id:62}]});}else await p.keyboard.down('KeyW');
 await p.evaluate(()=>{for(let i=0;i<80;i++)game.step(1/60);});
 if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await p.keyboard.up('KeyW');
 const walked=await p.evaluate(before=>{for(let i=0;i<15;i++)game.step(1/60);return{moved:game.player.position.distanceTo(new arrival.T.Vector3(...before)),near:game.landing.near(game.player.position),grounded:game.player.grounded};},before);
 check('native walking leaves the pad toward the first trail',walked.moved>3&&!walked.near&&walked.grounded,walked);
 const returned=await p.evaluate(()=>{const player=game.player;let frames=0;while(player.position.angleTo(game.landing.dir)*game.planet.R>1&&frames++<900){const forward=game.landing.dir.clone().addScaledVector(player.up,-game.landing.dir.dot(player.up)).normalize();game.engine.camFwd.copy(forward);game.engine.camRight.crossVectors(player.up,forward).normalize();game.input.setTestIntent({y:1});game.step(1/60);}game.input.setTestIntent(null);game.input.reset();for(let i=0;i<10;i++)game.step(1/60);game.touch.update();return{frames,near:game.landing.near(player.position),prompt:document.getElementById('prompt').textContent};});
 check('actual controller walking returns to the unchanged ship prompt',returned.frames<900&&returned.near&&returned.prompt.includes('범선'),returned);
 if(touch){await p.locator('#tcAct').tap();await p.evaluate(()=>game.step(1/60));}else{await p.keyboard.down('KeyE');await p.evaluate(()=>game.step(1/60));await p.keyboard.up('KeyE');await p.evaluate(()=>game.step(1/60));}
 check('native interaction returns to the ship',await p.evaluate(()=>game.mode==='lab'));
 const saved=await p.evaluate(()=>{game.dialogue.close();game.save(true);return{mode:game.mode,lab:game.lab.exportState(),expedition:game.firstTrail.exportState(),key:!!localStorage.getItem('mumuplanet.progress.v1')};});
 await p.reload();await p.waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',null,{timeout:120000,polling:100});await p.evaluate(()=>game.loop.stop());await p.locator('#title .go').click({force:true});await p.evaluate(()=>{game.loop.stop();game.dialogue.close();game.brief.hide();});
 const restored=await p.evaluate(()=>({mode:game.mode,lab:game.lab.exportState(),expedition:game.firstTrail.exportState()}));
 check('isolated reload keeps the ship and personal expedition progress',saved.key&&restored.mode===saved.mode&&JSON.stringify(restored.lab)===JSON.stringify(saved.lab)&&JSON.stringify(restored.expedition)===JSON.stringify(saved.expedition),{saved,restored});
 await p.evaluate(()=>{game.engine.render();game.engine.render();});await p.screenshot({path:B+'/'+(touch?'touch':'pc')+'-ship-return.png',timeout:120000});
 check('no browser exceptions',!report.errors.length,report.errors);report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;console.error(e);process.exitCode=1;}finally{fs.writeFileSync(B+'/'+(touch?'touch':'pc')+'-input.json',JSON.stringify(report,null,2));await browser.close();}})();
