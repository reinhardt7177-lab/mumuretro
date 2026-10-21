// Explicit static output for Vercel: authoring sources and the classroom server stay private.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
if(path.dirname(out)!==root||path.basename(out)!=='dist'||(fs.existsSync(out)&&fs.lstatSync(out).isSymbolicLink()))throw Error('Unexpected build output path');
const entries=['index.html','fire-trial.html','src','assets','vendor'];
for(const entry of entries)if(!fs.existsSync(path.join(root,entry)))throw Error('Missing runtime input: '+entry);
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const entry of entries)fs.cpSync(path.join(root,entry),path.join(out,entry),{recursive:true});
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else files.push(p);}}
walk(out);files.sort();
// Windows working copies may contain CRLF; Git checkouts on Vercel use LF.
// Canonicalize our text output while leaving pinned vendor bytes untouched.
for(const file of files){const rel=path.relative(out,file).replaceAll('\\','/');if(!rel.startsWith('vendor/')&&/\.(?:html|js|css|json|svg|txt|md)$/.test(file))fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'));}
const hashes=Object.fromEntries(files.map(file=>[path.relative(out,file).replaceAll('\\','/'),crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const manifest={release:'2026-10-22-web',generatedAt:new Date().toISOString(),sourceRevision:process.env.VERCEL_GIT_COMMIT_SHA||null,files:hashes};
fs.writeFileSync(path.join(out,'assets/release.json'),JSON.stringify(manifest,null,2));
console.log(`Built ${files.length} runtime files into dist; source, reports, Blender originals and classroom server excluded.`);
