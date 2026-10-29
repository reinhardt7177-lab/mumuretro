// Deployment audit only: fresh Edge context; no personal profile, save, or downloaded asset files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),entries=['index.html','fire-trial.html','src','assets','vendor'];
const broken=process.argv.includes('--break-guardian'),revision=(process.env.EXPECTED_REVISION||'').trim();
const base=(process.env.AUDIT_URL||'https://mumuretro.vercel.app').replace(/\/$/,'');
assert(/^[a-f0-9]{40}$/.test(revision),'EXPECTED_REVISION must be the full intended Git commit');
assert(process.env.RELEASE_EVIDENCE,'RELEASE_EVIDENCE must name a new evidence directory');
const target=new URL(base);assert(['http:','https:'].includes(target.protocol)&&!target.username&&!target.password&&!target.search&&!target.hash,'Use an HTTP(S) deployment URL without credentials/query/fragment');
const out=path.resolve(process.env.RELEASE_EVIDENCE);
for(const entry of [...entries,'tools','.git']){const input=path.join(root,entry);assert(out!==input&&!out.startsWith(input+path.sep),'Evidence must stay outside runtime, tools and Git inputs');}
assert(!fs.existsSync(out),'Preserve existing evidence directories');
fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(out);
const receipt=path.join(out,broken?'published-optimization-fault.json':'published-optimization.json');
const report={url:base,date:new Date().toISOString(),expectedRevision:revision,mode:broken?'guardian-404-fault':'normal',pass:false,checks:[],errors:[],files:[],blocked:[],
 scope:broken?'Local/manifest 476-file identity, exclusions and isolated WebGL; skips 476 public asset GETs. Expected guardian failure must exit 1.':'Local/manifest identity and actual public bytes for all 476 runtime files, exclusions and isolated desktop WebGL smoke. Not gameplay completion, responsive UI, performance or real school-device validation.'};
function check(name,ok,details){report.checks.push({name,pass:!!ok,details});assert.ok(ok,name+': '+JSON.stringify(details));console.log('PASS '+name);}
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function inventory(rel,result={}){
 const file=path.join(root,rel),stat=fs.lstatSync(file);assert(!stat.isSymbolicLink(),'Runtime symlinks are not allowed: '+rel);
 if(stat.isDirectory())for(const name of fs.readdirSync(file).sort())inventory(rel+'/'+name,result);
 else {assert(stat.isFile(),'Unsupported runtime entry: '+rel);let data=fs.readFileSync(file);if(!rel.startsWith('vendor/')&&/\.(?:html|js|css|json|svg|txt|md)$/.test(rel))data=Buffer.from(data.toString('utf8').replace(/\r\n/g,'\n'));result[rel]=sha(data);}
 return result;
}
async function request(file){return fetch(base+'/'+file,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(120000)});}
async function publicBytes(files,expected){
 let cursor=0,done=0;
 await Promise.all(Array.from({length:6},async()=>{while(cursor<files.length){const file=files[cursor++],item={file};try{
  const response=await request(file);item.status=response.status;
  if(response.status!==200){await response.body?.cancel();item.pass=false;}
  else {const hash=crypto.createHash('sha256');item.bytes=0;for await(const chunk of response.body){hash.update(chunk);item.bytes+=chunk.length;}item.sha256=hash.digest('hex');item.pass=item.sha256===expected[file];}
 }catch(error){item.pass=false;item.error=error.message;}report.files.push(item);done++;if(done%50===0||done===files.length)console.log('Public bytes '+done+'/'+files.length);}}));
 report.files.sort((a,b)=>a.file.localeCompare(b.file));
 check('all 476 public runtime responses are 200 and byte-identical',report.files.length===476&&report.files.every(item=>item.pass),report.files.filter(item=>!item.pass));
}
(async()=>{let browser,context;try{
 const expected={};for(const entry of entries)inventory(entry,expected);const files=Object.keys(expected).sort();report.localFiles=expected;
 check('local runtime has the intended 476 files',files.length===476,{files:files.length});
 const response=await request('assets/release.json');
 check('public release manifest is accessible without authentication bypass',response.status===200,{status:response.status,location:response.headers.get('location')});
 const manifest=await response.json();report.revision=manifest.sourceRevision;report.compatibilityLabel=manifest.release;
 check('public sourceRevision matches the intended commit',manifest.sourceRevision===revision,{actual:manifest.sourceRevision,expected:revision});
 const published=manifest.files&&typeof manifest.files==='object'?Object.keys(manifest.files).sort():[];
 check('manifest runtime file set exactly matches local 476 files',JSON.stringify(published)===JSON.stringify(files),{local:files.length,published:published.length,missing:files.filter(file=>!published.includes(file)),extra:published.filter(file=>!files.includes(file))});
 check('all manifest hashes match canonical local runtime bytes',files.every(file=>manifest.files[file]===expected[file]),files.filter(file=>manifest.files[file]!==expected[file]));
 if(!broken)await publicBytes(files,expected);else report.skipped=['476 public runtime GETs'];
 const exclusions=[];for(const file of ['AGENTS.md','server/app.cjs','tools/build-web.cjs','reports/2026-10-21/APP_COMPLETION_AUDIT.md','.git/config']){const r=await request(file);exclusions.push({file,status:r.status});await r.body?.cancel();}
 check('authoring, classroom server, build tool, report and Git paths return 404',exclusions.every(item=>item.status===404),exclusions);
 const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright'));
 browser=await chromium.launch({channel:'msedge',headless:true});context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});
 const page=await context.newPage();page.setDefaultTimeout(90000);
 page.on('pageerror',error=>report.errors.push({type:'pageerror',message:error.message}));
 page.on('console',message=>{if(message.type()==='error'&&/THREE|shader|WebGL|compil|program.*(?:link|validat)/i.test(message.text()))report.errors.push({type:'shader-console',message:message.text()});});
 if(broken)await page.route('**/assets/models/chronicle-temple/guardian-v0*.glb',route=>{report.blocked.push(route.request().url());return route.fulfill({status:404,body:'Injected missing guardian model'});});
 const navigation=await page.goto(base,{waitUntil:'domcontentloaded',timeout:90000});
 check('browser opens the intended deployment without redirects',navigation?.status()===200&&!navigation.request().redirectedFrom()&&new URL(page.url()).origin===target.origin,{status:navigation?.status(),url:page.url()});
 await page.waitForFunction(()=>window.game,null,{timeout:90000});await page.locator('#title .go').click();
 const loaded=await page.evaluate(async()=>{
  const g=window.game;g.loop.stop();g.dialogue.close();g.brief.hide();
  const fire=g.roomFor(g.shrines.shrines[4]),strata=g.roomFor(g.shrines.shrines[5]);
  await Promise.race([Promise.all([fire.ready,strata.final.heritagePromise]),new Promise((_,reject)=>setTimeout(()=>reject(Error('Model readiness timeout')),90000))]);
  g.engine.render();const renderer=g.engine.renderer,post=g.engine.post;
  return {fire:!!fire.fireAdventure,guardian:strata.final.artReady===true,seals:strata.final.memorySeals?.length||0,webgl:!!renderer.getContext()&&!renderer.getContext().isContextLost(),canvas:renderer.domElement.width,
   postEnabled:post?.enabled===true,passes:post?.composer?.passes.length,rawGrade:post?.grade?.material?.isRawShaderMaterial===true,failedPrograms:(renderer.info.programs||[]).filter(program=>program.diagnostics?.runnable===false).length};
 });report.loaded=loaded;
 fs.writeFileSync(path.join(out,broken?'published-optimization-fault.png':'published-optimization.png'),await page.screenshot(),{flag:'wx'});
 check('isolated browser renders WebGL and loads fire rooms',loaded.webgl&&loaded.canvas>0&&loaded.fire,loaded);
 check('optimized post uses three passes and the RawShaderMaterial grade',loaded.postEnabled&&loaded.passes===3&&loaded.rawGrade,loaded);
 check('no page, WebGL or shader errors',!report.errors.length&&loaded.failedPrograms===0,{errors:report.errors,failedPrograms:loaded.failedPrograms});
 if(broken)report.faultDetected=report.blocked.length>0&&!loaded.guardian&&loaded.seals===0;
 check('decoded guardian has five memory seals',loaded.guardian&&loaded.seals===5,{guardian:loaded.guardian,seals:loaded.seals,blocked:report.blocked});
 check('missing guardian injection cannot silently pass',!broken,{faultDetected:report.faultDetected});report.pass=true;
 }catch(error){report.failure=error.message;process.exitCode=1;console.error(error.message);}
 finally{try{if(context)await context.close();}catch(error){report.closeError=error.message;report.pass=false;process.exitCode=1;}try{if(browser)await browser.close();}catch(error){report.browserCloseError=error.message;report.pass=false;process.exitCode=1;}
  fs.writeFileSync(receipt,JSON.stringify(report,null,2),{flag:'wx'});console.log('Evidence '+receipt);
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
