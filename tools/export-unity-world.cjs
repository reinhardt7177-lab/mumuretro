// Snapshot the authored web world without touching its source assets or save data.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const p=await browser.newPage();
  await p.goto('http://127.0.0.1:5512/?q=high');
  await p.waitForFunction(()=>window.game,null,{timeout:90000});
  const data=await p.evaluate(async()=>{
   const T=await import('/vendor/three/build/three.module.js');
   game.loop.stop();
   const geometry=g=>({positions:Array.from(g.attributes.position.array),normals:Array.from(g.attributes.normal.array),colors:g.attributes.color?Array.from(g.attributes.color.array):[],indices:g.index?Array.from(g.index.array):Array.from({length:g.attributes.position.count},(_,i)=>i)});
   const spawn=game.planet.latLonToPos(6,-18),groups=[],byKind=new Map(),matrix=new T.Matrix4(),v=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3(),tint=new T.Color();
   for(const m of game.scatter.meshes){
    const kind=m.userData.natureKind;
    if(!byKind.has(kind)){const group={name:kind,geometry:geometry(m.geometry),tint:m.material.color.toArray(),instances:[]};byKind.set(kind,group);groups.push(group);}
    for(let i=0;i<m.count;i++){
     m.getMatrixAt(i,matrix);matrix.decompose(v,q,s);
     if(v.angleTo(spawn)>.68)continue;
     tint.setRGB(1,1,1);if(m.instanceColor)m.getColorAt(i,tint);
     byKind.get(kind).instances.push({position:v.toArray(),rotation:q.toArray(),scale:s.toArray(),tint:tint.toArray()});
    }
   }
   return {version:1,radius:game.planet.R,spawn:spawn.toArray(),target:game.planet.latLonToPos(22,0).toArray(),terrain:geometry(game.planet.mesh.geometry),grass:geometry(game.carpet.mesh.geometry),groups,
    colliders:game.scatter.colliders.filter(c=>c.dir.angleTo(spawn)<.70).map(c=>({position:game.planet.surfaceAt(c.dir).toArray(),radius:c.r,height:c.height}))};
  });
  const out='art/engine-transfer/logic-reference/Source';fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(`${out}/world.json`,JSON.stringify(data));
  console.log(JSON.stringify({vertices:data.terrain.positions.length/3,groups:data.groups.map(g=>[g.name,g.instances.length]),colliders:data.colliders.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
