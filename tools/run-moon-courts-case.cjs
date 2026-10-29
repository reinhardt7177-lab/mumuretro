// Preserve originals; the executed source and exact adaptations are retained.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const file=path.join(__dirname,'run-moon-check-case.cjs');let wrapper=fs.readFileSync(file,'utf8');const marker="fs.writeFileSync(path.join(dest,'executed-check.cjs'),source);";assert(wrapper.includes(marker));
const insert=`
if(name==='check-shadow-journey.cjs'){
 const from='g.court.obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+.08)';assert(source.includes(from));
 source=source.replace(from,\"g.court.obstacles.some(o=>o.shape==='box'?Math.hypot(x-Math.max(o.x0,Math.min(o.x1,x)),z-Math.max(o.z0,Math.min(o.z1,z)))<(o.padding??.28)+.08:Math.hypot(x-o.x,z-o.z)<o.r+.08)\");
 adaptations.push('timed route planner uses actual padded boxes plus the same8cm planning margin, rather than a bounding circle around whole walls');
}
if(name==='check-mirror-gallery.cjs'){
 const from='r.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r)';assert(source.includes(from));
 source=source.replace(from,\"r.obstacles.some(o => o.shape==='box'?Math.hypot(x-Math.max(o.x0,Math.min(o.x1,x)),z-Math.max(o.z0,Math.min(o.z1,z)))<(o.padding??.28):Math.hypot(x-o.x,z-o.z)<o.r)\");
 source=source.replace('if (m.isMesh && !m.userData.sky','if (m.isMesh && m.visible && !m.userData.sky');
 adaptations.push('camera fixture overlap uses actual padded boxes; independent rays collect visible construction including the new native court');
}
if(name==='check-shade-court.cjs'){
 const overlap='r.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r)';assert(source.includes(overlap));
 source=source.replace(overlap,\"r.obstacles.some(o => o.shape==='box'?Math.hypot(x-Math.max(o.x0,Math.min(o.x1,x)),z-Math.max(o.z0,Math.min(o.z1,z)))<(o.padding??.28):Math.hypot(x-o.x,z-o.z)<o.r)\");
 const from='if (m.isMesh && materials.some(mat => mat?.isMeshStandardMaterial)) surfaces.push(m)';assert(source.includes(from));
 source=source.replace(from,'if (m.isMesh && m.visible && materials.some(mat => mat?.isMeshStandardMaterial)) surfaces.push(m)');
 adaptations.push('fixture uses actual padded boxes; independent rays exclude hidden replaced construction, retain new native court and all visible optical pillars');
}
`;
wrapper=wrapper.replace(marker,insert+marker);const current=new Module(file,module);current.filename=file;current.paths=Module._nodeModulePaths(path.dirname(file));current._compile(wrapper,file);
