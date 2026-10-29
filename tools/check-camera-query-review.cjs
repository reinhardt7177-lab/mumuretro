const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright'));
const BASE='reports/2026-10-23/evidence/camera-query/';
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true}),report={pass:false,rows:[],errors:[]};try{
  const p=await b.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  for(const width of [1440,390]){await p.setViewportSize({width,height:900});await p.goto('http://127.0.0.1:5512/art/camera-query/v01/review.html');await p.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode()));});
    const row=await p.evaluate(()=>({width:innerWidth,images:[...document.images].filter(i=>i.naturalWidth>0).length,noOverflow:document.documentElement.scrollWidth<=innerWidth,links:[...document.querySelectorAll('a')].map(a=>a.href)}));assert(row.images===29&&row.noOverflow,JSON.stringify(row));
    await p.locator('[data-show="after"]').click();row.filtered=await p.locator('.compare figure:visible').count();assert.equal(row.filtered,9);await p.locator('[data-show="all"]').click();assert.equal(await p.locator('.compare figure:visible').count(),27);
    for(const url of row.links)assert((await p.request.get(url)).ok(),url);report.rows.push(row);await p.screenshot({path:BASE+'review-'+width+'.png'});
  }assert.equal(report.errors.length,0);report.pass=true;console.log('PASS29 images,PC/phone layout,comparison filters and links');
}catch(e){report.failure=e.stack;console.error(e.message);process.exitCode=1;}finally{fs.writeFileSync(BASE+'review-ui.json',JSON.stringify(report,null,2));await b.close();}})();
