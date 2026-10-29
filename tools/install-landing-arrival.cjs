const fs=require('node:fs'),crypto=require('node:crypto'),{A,B}=require('./landing-arrival-fixture.cjs'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseline=JSON.parse(fs.readFileSync(B+'/baseline.json')),check=JSON.parse(fs.readFileSync(B+'/goal-check.json'));
if(!check.pass)throw Error('Review the landing preview before installation');
for(const[file,sha]of Object.entries(baseline.inventory))if(hash(fs.readFileSync(file))!==sha)throw Error('Current source changed; preserve and review: '+file);
for(const[file,name]of[['src/world/Landing.js','Landing'],['src/boot.js','boot']])fs.copyFileSync(A+'/'+name+'-preview.js',file);
fs.writeFileSync(B+'/installed.json',JSON.stringify({at:new Date().toISOString(),files:baseline.files,hashes:Object.fromEntries(baseline.files.map(f=>[f,hash(fs.readFileSync(f))])),scope:'Only reviewed landing VFX and its two positional update calls; all existing assets retained'},null,2));
console.log('Installed two reviewed landing sources; no model, save, terrain or vendor change.');
