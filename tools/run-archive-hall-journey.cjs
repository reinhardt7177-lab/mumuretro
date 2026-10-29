const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const file=path.resolve('tools/check-strata-journey.cjs'),B='reports/2026-10-24/evidence/archive-hall/regressions/journey';fs.mkdirSync(B,{recursive:true});let source=fs.readFileSync(file,'utf8');
source=source.replace(/const OUT=path\.join\([^;]+\)/,'const OUT='+JSON.stringify(path.resolve(B)));
source=source.replace('await game.room.final.heritagePromise;','await game.room.final.heritagePromise;await game.room.ready;');
assert(source.includes('st.walk(l.x,l.z+.7);'));source=source.replace('st.walk(l.x,l.z+.7);','st.walk(l.x,l.z+1.2);');
source=source.replace('st.walk(a.x,a.z+1.1);','st.walk(a.x,a.z+1.55);');
assert(source.includes('st.walk(0,approach);st.walk(0,game.room.shrineSeg.z1-1);'));source=source.replace('st.walk(0,approach);st.walk(0,game.room.shrineSeg.z1-1);','st.walk(1.1,approach);st.walk(1.1,approach-3);st.walk(0,approach-3);st.walk(0,game.room.shrineSeg.z1-1);');
// The return trip also goes between the now-solid stations rather than through the centre console.
assert(source.includes('st.walk(0,17);'));source=source.replace('st.walk(0,17);','st.walk(0,-52.5);st.walk(1.1,-52.5);st.walk(1.1,-49.2);st.walk(0,-49.2);st.walk(0,17);');
fs.writeFileSync(B+'/adaptations.json',JSON.stringify({assertions:14,adaptations:['Await authored room; approach actual crank 1.2m in front','Walk through gap x1.1 on outward and return journeys; no teleports','Retain established altar approach1.55m outside solid plinth']},null,2));
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
