// Run against the built static output or public URL, always in an isolated browser.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright'));
const base=(process.env.AUDIT_URL||'https://mumuretro.vercel.app').replace(/\/$/,''),broken=process.argv.includes('--break-guardian');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.RELEASE_EVIDENCE||path.join(root,'reports/2026-10-22/evidence/deployment'));fs.mkdirSync(out,{recursive:true});
const report={url:base,date:new Date().toISOString(),checks:[],errors:[],failureInjection:broken};
function check(name,ok,details){report.checks.push({name,pass:!!ok,details});assert.ok(ok,name+': '+JSON.stringify(details));console.log('PASS '+name);}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{let browser;try{
 const response=await fetch(base+'/assets/release.json',{cache:'no-store'});check('release manifest is available',response.status===200,{status:response.status});const manifest=await response.json();report.revision=manifest.sourceRevision;
 check('release identifies the intended web build',manifest.release==='2026-10-22-web'&&Object.keys(manifest.files||{}).length>250,{release:manifest.release,files:Object.keys(manifest.files||{}).length});
 const files=['src/boot.js','src/ui/Notebook.js','src/ui/Coop.js','src/shrine/ChronicleArt.js','src/shrine/FireAdventure.js','src/shrine/WaterAdventure.js','assets/models/chronicle-temple/guardian-v01.glb'];
 const diffs=[];for(const file of files){const input=fs.readFileSync(path.join(root,file)),expected=hash(file.endsWith('.js')?Buffer.from(input.toString('utf8').replace(/\r\n/g,'\n')):input),r=await fetch(base+'/'+file,{cache:'no-store'});if(r.status!==200||manifest.files[file]!==expected||hash(Buffer.from(await r.arrayBuffer()))!==expected)diffs.push(file);}
 check('served gameplay, notebook and guardian exactly match the release source',!diffs.length,diffs);
 const leaked=[];for(const file of ['AGENTS.md','server/app.cjs','tools/build-web.cjs','reports/2026-10-21/APP_COMPLETION_AUDIT.md','.git/config']){const r=await fetch(base+'/'+file);if(r.status!==404)leaked.push({file,status:r.status});}
 check('static output excludes authoring files and classroom server',!leaked.length,leaked);
 browser=await chromium.launch({channel:'msedge',headless:true});const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))report.errors.push(m.text());});
 if(broken)await p.route('**/assets/models/chronicle-temple/guardian-v01.glb',route=>route.fulfill({status:404,body:'Injected missing model'}));
 await p.goto(base);await p.waitForFunction(()=>window.game,null,{timeout:90000});await p.locator('#title .go').click();
 const loaded=await p.evaluate(async()=>{game.loop.stop();game.dialogue.close();game.brief.hide();const fire=game.roomFor(game.shrines.shrines[4]),strata=game.roomFor(game.shrines.shrines[5]);await fire.ready;await strata.final.heritagePromise;game.engine.render();return{fire:!!fire.fireAdventure,guardian:strata.final.artReady===true,seals:strata.final.memorySeals?.length||0,webgl:!!game.engine.renderer.getContext(),canvas:game.engine.renderer.domElement.width};});
 check('real WebGL loads new fire rooms and decoded guardian with five seals',loaded.webgl&&loaded.fire&&loaded.guardian&&loaded.seals===5&&loaded.canvas>0,loaded);
 await p.screenshot({path:path.join(out,'published-title.png')});
 check('no browser or shader errors',!report.errors.length,report.errors);report.pass=true;
 }catch(e){report.failure=e.message;throw e;}finally{if(browser)await browser.close();fs.writeFileSync(path.join(out,broken?'published-failure.json':'published-web.json'),JSON.stringify(report,null,2));}})().catch(e=>{console.error(e);process.exitCode=1;});
