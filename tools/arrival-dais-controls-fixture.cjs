const fs=require('node:fs'),fixture=require('./arrival-dais-fixture.cjs'),phase=process.argv[2]||'goal';
exports.B=fixture.B+'/'+phase+'-input';fs.mkdirSync(exports.B,{recursive:true});
exports.prepare=async p=>{await fixture.prepare(p,phase,'mid');await p.evaluate(()=>{window.arrival={T:window.T};game.landing.arrive();});};
