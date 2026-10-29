// The old expedition script still expects the removed outdoor thawing puzzle.
// Use the existing current observatory/ridge/glide checks without weakening them.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{B}=require('./landing-arrival-fixture.cjs'),file=path.resolve('tools/check-adventure-landmarks.cjs');
fs.mkdirSync(B+'/expedition-current',{recursive:true});let source=fs.readFileSync(file,'utf8');const marker='reports/2026-10-22/evidence/adventure-landmarks';
if(!source.includes(marker))throw Error('Current expedition output contract changed');source=source.replaceAll(marker,B+'/expedition-current');
fs.writeFileSync(B+'/expedition-current/adapter-source.cjs',source);const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
