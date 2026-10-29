const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
const output='reports/2026-10-27/evidence/arrival-coherence/review-validation.json';
(async()=>{
 assert(!fs.existsSync(output),'Preserve existing gallery evidence');
 const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.goto('http://127.0.0.1:5512/art/arrival-coherence/v01/combined/review.html');
   for(const view of ['front','side','rear']){
    await page.locator('button[data-view="'+view+'"]').click();
    const data=await page.evaluate(async()=>{
     const images=[...document.images];await Promise.all(images.map(im=>im.decode()));
     return{images:images.map(im=>({src:new URL(im.src).pathname,alt:im.alt,width:im.naturalWidth,height:im.naturalHeight})),overflow:document.documentElement.scrollWidth>innerWidth+1,status:document.querySelector('#status').textContent,actual:document.querySelector('#afterLabel').textContent,links:[...document.querySelectorAll('a[href]')].map(a=>a.href)};
    });
    assert.equal(data.images.length,3);assert(!data.overflow);assert(data.status.includes('Root474'));assert.equal(data.actual,'적용한 실제 게임');
    assert(data.images.every(im=>im.width>0&&im.height>0&&im.alt.includes(view)));
    assert(data.images[0].alt.startsWith('AI'));assert(data.images[2].src.endsWith('/final-after-mid-'+view+'.png'));
    const links=[];for(const url of data.links){const response=await page.request.get(url);assert.equal(response.status(),200,url);links.push({url,status:response.status()});}
    results.push({width,view,images:data.images,status:data.status,overflow:data.overflow,links,pass:true});
   }
   await page.close();
  }
  const result={pass:true,scope:'Comparison gallery images/labels/links at1440 and390 CSS widths; not gameplay or visual equivalence',results};
  fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify({pass:true,widths:2,viewsPerWidth:3,imagesPerView:3,linksPerView:results[0].links.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
