// Reuse actual movement/carry/save probes, preserving the earlier phase output.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const file=path.join(__dirname,'check-strata-portal.cjs');let code=fs.readFileSync(file,'utf8');
code=code.replace("B='reports/2026-10-24/evidence/chronicle-portal'","B='reports/2026-10-24/evidence/strata-inlays/gameplay'").replace('physical.camera===18','physical.camera===36');
const read="fs.readFileSync('src/shrine/Room.js','utf8')";assert(code.includes(read));code=code.replace(read,read+`.replace("import { registerStrataInlays } from './StrataInlays.js';",'').replace('registerStrataInlays(', '(').replace("import { registerStrataRecords } from './StrataRecords.js';",'').replace('registerStrataRecords(', '(')`);
const marker=" if(fault)await p.evaluate(fault=>";assert(code.includes(marker));
code=code.replace(marker,`
 if(fault==='lines')await p.evaluate(()=>game.room.strataInlays.hidden.find(o=>o.userData.openFieldFloorMark==='r1').geometry.setDrawRange(0,Infinity));
 if(fault==='number')await p.evaluate(()=>{const r=game.room.strataInlays,a=[],b=[];r.markers[0].traverse(o=>{if(o.isMesh&&o.material.name==='Inlay glyph')a.push(o);});r.markers[1].traverse(o=>{if(o.isMesh&&o.material.name==='Inlay glyph')b.push(o);});a[0].geometry=b[0].geometry;});
 const visual=await p.evaluate(()=>{const r=game.room.strataInlays,g=game.room.gates[0].gate;game.room.scene.updateMatrixWorld(true);const signature=root=>{let values=[];root.traverse(o=>{if(o.isMesh&&o.material.name==='Inlay glyph'){let h=2166136261;for(const v of o.geometry.attributes.position.array)h=Math.imul(h^Math.round(v*100000),16777619)>>>0;values.push(h);}});return values.join(',');};return{loaded:r.loaded,roots:r.roots.length,hidden:r.hidden.length,allHidden:r.hidden.every(o=>o.geometry.drawRange.count===0),nativeFloorMarks:roomMarks=game.room.scene.children.filter(o=>o.userData.openFieldFloorMark==='r1').map(o=>o.geometry.drawRange.count),numbers:r.markers.map(signature),partNames:r.markers.map(o=>o.userData.inlayPart),badgeNames:r.badges.map(o=>o.userData.inlayPart),ground:r.markers.map(o=>new T.Box3().setFromObject(o,true).min.y),floors:g.marks.map(m=>game.room.dungeon.rects.floorAt(m.x,m.z,0)),materials:(()=>{const names=[];r.wall.traverse(o=>{if(o.isMesh)names.push(o.material.name);});return names;})()};});
 check('all old rings air links dots and floor stripes stay hidden',visual.loaded&&visual.roots===14&&visual.hidden===39&&visual.allHidden&&visual.nativeFloorMarks.length===5&&visual.nativeFloorMarks.every(n=>n===0),visual);
 check('four distinct raised numbers match numbered floor and wall parts',new Set(visual.numbers).size===4&&visual.numbers.every(Boolean)&&visual.partNames.every((n,i)=>n==='FloorMarker'+(i+1))&&visual.badgeNames.every((n,i)=>n==='WallBadge'+(i+1)),visual);
 check('low markers meet the actual walking floor',visual.ground.every(y=>Math.abs(y)<.001)&&visual.floors.every(y=>Math.abs(y-.061)<.001),visual);
 check('moving stone wall uses only replacement inlay materials',visual.materials.every(n=>n.startsWith('Inlay '))&&visual.materials.length===26,visual.materials);
`+marker);
code=code.replace('nativeFloorMarks:roomMarks=','nativeFloorMarks:');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(code,file);
