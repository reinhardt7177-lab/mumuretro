// Verify reachable text, every generated leaf, unread highlights, touch/keyboard and resizing.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright'));
const OUT=path.join(__dirname,'../reports/2026-10-21/evidence/app-completion');fs.mkdirSync(OUT,{recursive:true});
const broken=process.argv.includes('--break-next'),report={checks:[],errors:[],failureInjection:broken};
function check(name,pass,details){report.checks.push({name,pass:!!pass,details});assert.ok(pass,name+': '+JSON.stringify(details));console.log('PASS '+name);}
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const c=await b.newContext({viewport:{width:360,height:440},isMobile:true,hasTouch:true}),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(process.env.AUDIT_URL||'http://127.0.0.1:5512/');await p.waitForFunction(()=>window.game,null,{timeout:90000});await p.locator('#title .go').tap();await p.evaluate(()=>{game.loop.stop();game.dialogue.close();game.brief.hide();game.notebook.setHas(true);game.notebook.go('ask');game.notebook.setOpen(true);});
 if(broken)await p.evaluate(()=>document.querySelector('#nbNext').replaceWith(document.querySelector('#nbNext').cloneNode(true)));
 const before=await p.locator('#nbLeaf').textContent();await p.locator('#nbNext').tap();check('touch next changes visible leaf',await p.locator('#nbLeaf').textContent()!==before);
 await p.keyboard.press('PageUp');check('PageUp returns to previous leaf',await p.locator('#nbLeaf').textContent()===before);
 await p.evaluate(()=>{game.notebook.setOpen(false);game.shrines.shrines.forEach(s=>s.cleared=true);game.notebook.setOpen(true);});
 const seen=new Set();let pages=0;
 while(true){const leaf=await p.evaluate(()=>{const body=document.querySelector('#nbBody'),rows=[...body.querySelectorAll('.qrow:not([hidden])')];return {ids:rows.map(r=>r.dataset.k),over:body.scrollHeight-body.clientHeight,font:Math.min(...rows.flatMap(r=>[...r.querySelectorAll('.qq,.qa')].map(n=>parseFloat(getComputedStyle(n).fontSize))))};});leaf.ids.forEach(id=>seen.add(id));check(`leaf ${++pages} is readable and fits`,leaf.ids.length>0&&leaf.over<=2&&leaf.font>=15,leaf);if(await p.locator('#nbNext').isDisabled())break;await p.locator('#nbNext').tap();if(pages>12)throw Error('leaf navigation did not end');}
 check('all six temple records reachable by actual page buttons',seen.size===6,[...seen]);
 await p.waitForFunction(()=>{const a=document.querySelector('#nb .notebook-art');return !a||a.style.zIndex==='0';});await p.screenshot({path:path.join(OUT,'notebook-360x440.png')});
 // A new record on an unseen page must not consume its highlight.
 await p.evaluate(()=>{game.notebook.setOpen(false);game.notebook._restore({lit:[],seen:{}});game.notebook.setOpen(true);});
 const unseen=await p.evaluate(()=>{const rows=[...document.querySelectorAll('#nbBody .qrow[hidden][data-k]')],lit=game.notebook.exportState().lit;return rows.length>0&&rows.every(r=>!lit.includes(r.dataset.k));});check('unseen leaves retain unread highlights',unseen);
 for(const [width,height]of [[844,390],[390,844],[1024,768]]){await p.setViewportSize({width,height});await p.waitForFunction(()=>{const body=document.querySelector('#nbBody');return body.clientWidth>0&&body.scrollHeight-body.clientHeight<=2;});for(const tab of ['ask','field','kitchen']){await p.evaluate(tab=>game.notebook.go(tab),tab);const count=await p.locator('#nbBody > :not([hidden])').count();check(`${tab} remains readable after resize ${width}x${height}`,count>0&&await p.evaluate(()=>document.querySelector('#nbBody').scrollHeight<=document.querySelector('#nbBody').clientHeight+2));}await p.waitForFunction(()=>{const a=document.querySelector('#nb .notebook-art');return !a||a.style.zIndex==='0';});await p.screenshot({path:path.join(OUT,`notebook-${width}x${height}.png`)});}
 const raw=await p.evaluate(()=>JSON.stringify(game.notebook.exportState()));await p.evaluate(()=>game.notebook.pageMetrics(440,360));check('measuring every leaf preserves record state',await p.evaluate(()=>JSON.stringify(game.notebook.exportState()))===raw);
 check('no JavaScript errors',report.errors.length===0,report.errors);report.pass=true;
 }catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync(path.join(OUT,broken?'notebook-pages-failure.json':'notebook-pages.json'),JSON.stringify(report,null,2));await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
