const fs=require('node:fs'),fixture=require('./arrival-coherence-fixture.cjs'),phase=process.argv[2]||'goal';
exports.B=fixture.B+'/'+phase+'-input';fs.mkdirSync(exports.B,{recursive:true});
exports.prepare=async page=>{await fixture.prepare(page,phase,'mid');await page.evaluate(()=>{window.arrival={T:window.T};game.landing.arrive();});};
