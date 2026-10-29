require('./world-horizon-output-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),fixture=require('./world-horizon-fixture.cjs'),{chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright')),{B}=fixture,phase=process.argv[2]||'before';
const report={phase,prepared:true,actualTraversal:false,portals:[],errors:[]};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))report.errors.push(m.text());});await fixture.prepare(page,phase);
 report.assets=await page.evaluate(()=>({backdrop:game.sky.backdrop?.contract||null,clearance:game.scatter.approachClearance?.removed||[],routes:game.worldTrails.routes.map(r=>({id:r.id,length:r.length,reachable:r.reachable,dirs:r.dirs.map(d=>d.toArray())})),surface:game.meadowField}));
 await page.addScriptTag({path:'tools/world-horizon-mask.js'});
 const sites=JSON.parse(fs.readFileSync(B+'/sites.json')).filter(s=>s.id.startsWith('portal-'));
 for(let i=0;i<sites.length;i++){
  await page.evaluate(s=>fieldProbe.stage(s.dir,s.target),sites[i]);
  if(phase!=='before')await fixture.lockPose(page,JSON.parse(fs.readFileSync(B+'/before.json')).shots.find(s=>s.id===sites[i].id&&s.view==='front'));
  const result=await page.evaluate(i=>{const s=game.shrines.shrines[i];return{portal:horizonMask(s.portal||s.group),hero:horizonMask(game.player.mesh),pose:fieldProbe.shot(),shrine:{name:game.SHRINES[i].id,position:s.pos.toArray(),facing:s.facing.toArray()},routes:game.worldTrails.stats};},i);
  report.portals.push({id:sites[i].id,...result});console.log('PROBED '+sites[i].id+' '+JSON.stringify(result.portal));
 }
 report.pass=report.portals.length===6&&!report.errors.length&&(phase==='before'||!!report.assets.backdrop);await page.close();
}catch(e){report.pass=false;report.failure=e.stack;console.error(e);}finally{fs.writeFileSync(B+'/visibility-'+phase+'.json',JSON.stringify(report,null,2));await browser.close();if(!report.pass)process.exitCode=1;}})();
