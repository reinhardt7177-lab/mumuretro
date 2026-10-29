const fs=require('node:fs'),assert=require('node:assert/strict'),{B}=require('./landing-arrival-fixture.cjs'),phase=process.argv[2]||'after';
const r=JSON.parse(fs.readFileSync(B+'/'+phase+'.json')),before=JSON.parse(fs.readFileSync(B+'/before.json')),report={phase,checks:[],errors:r.errors||[]};
function check(name,pass,details){report.checks.push({name,pass:!!pass,details});console.log((pass?'PASS ':'FAIL ')+name);}
check('ten staged views render without browser or shader errors',r.pass&&r.shots.length===10&&!r.errors.length);
check('all nine close body masks retain clothing within the ten-level RGB budget',r.shots.slice(0,9).every(s=>s.body.samples>100&&s.body.meanAbs.every(v=>Number.isFinite(v)&&v<=10)),r.shots.slice(0,9).map(s=>({id:s.id,...s.body})));
const roads=r.shots.filter(s=>s.id.startsWith('front-'));
check('three forward trail views retain every sampled patch within the ten-level RGB budget',roads.length===3&&roads.every(s=>s.road.samples===147&&s.road.meanAbs.every(v=>Number.isFinite(v)&&v<=10)),roads.map(s=>({id:s.id,...s.road})));
check('the distant return beacon remains visible in its independent 4379-pixel core',r.shots.at(-1).effect.samples===4379&&r.shots.at(-1).effect.meanAbs[2]>=4,r.shots.at(-1));
let same=true;for(let i=0;i<10;i++)for(const key of['id','camera','target','up','quaternion','fov','aspect','actor','elapsed'])try{assert.deepEqual(r.shots[i][key],before.shots[i][key]);}catch{same=false;}
check('before and candidate use the same ten poses and world times',same);
report.pass=report.checks.every(c=>c.pass);fs.writeFileSync(B+'/'+phase+'-check.json',JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
