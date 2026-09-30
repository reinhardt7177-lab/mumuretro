const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.AUDIT_NODE_MODULES, 'playwright'));
const out = 'reports/2026-09-20/asset-details';
fs.mkdirSync(out, { recursive: true });
function inspect(file) {
  const b = fs.readFileSync(file);
  assert.equal(b.readUInt32LE(0), 0x46546c67);
  const gltf = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  return { file, bytes: b.length, meshes: gltf.meshes.length, materials: gltf.materials.length,
    triangles: gltf.meshes.reduce((n,m) => n + m.primitives.reduce((s,p) => s + (p.indices === undefined ? gltf.accessors[p.attributes.POSITION].count : gltf.accessors[p.indices].count)/3,0),0),
    names: gltf.nodes.map(n => n.name), gltf };
}
(async () => {
  const stats = ['assets/models/starsail-v01.glb','assets/models/starsail-v02.glb',
    'assets/models/balance-temple-v03.glb','assets/models/balance-temple-v04.glb',
    'assets/characters/sky-navigator/props-v01.glb','assets/characters/sky-navigator/props-v02.glb'].map(inspect);
  const temple = stats[3], props = stats[5];
  for (const name of ['hall_order','hall_twin','hall_lever','hall_entry','hall_corridor','scale','scale_beam','pan_left','pan_right','crate','plinth','lever','fulcrum','door_leaf','guardian',...['water','shadow','sift','fire','strata'].map(n=>'waymark_'+n)]) assert(temple.names.includes(name),name);
  for (const name of ['notebook','telescope','Cover']) assert(props.names.includes(name),name);
  assert(props.gltf.nodes.find(n=>n.name==='Cover').children.length > 0, 'cover ornaments stay attached');
  assert.equal(stats[1].meshes,stats[0].meshes,'ship remains material-batched');
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const report = { assets: stats.map(({gltf,names,...s})=>s), scenes:[], errors:[], externalRequests:[], cancelledRequests:[] };
  try {
    const p = await b.newPage({ viewport:{ width:1440,height:900 } });
    p.on('pageerror',e=>report.errors.push(e.message));
    p.on('console',m=>{ if(m.type()==='error' && /THREE|shader|WebGL/i.test(m.text())) report.errors.push(m.text()); });
    p.on('response',r=>{if(r.status()>=400 && r.url().startsWith('http://127.0.0.1:5512/'))report.errors.push(`${r.status()} ${r.url()}`);});
    p.on('requestfailed',r=>{const item={url:r.url(),error:r.failure()?.errorText};if(item.error==='net::ERR_ABORTED')report.cancelledRequests.push(item);else if(r.url().startsWith('http://127.0.0.1:5512/'))report.errors.push(item);else report.externalRequests.push(item);});
    await p.goto('http://127.0.0.1:5512/?q=high');
    await p.waitForFunction(()=>window.game,null,{timeout:90000});
    await p.locator('#title .go').click();
    await p.evaluate(()=>{game.loop.stop();game.dialogue.close();game.brief.hide();game.engine.render();});
    await p.screenshot({path:`${out}/ship-game.png`});
    await p.evaluate(()=>{const c=game.engine.camera;c.position.set(2.6,3.4,-3.7);c.lookAt(-3.7,1.4,-9.6);game.engine.render();});
    await p.screenshot({path:`${out}/cabin-game.png`});
    await p.evaluate(()=>{const c=game.engine.camera;c.position.set(-2.2,2.15,1.4);c.lookAt(-4.7,.62,-.8);game.engine.render();});
    await p.screenshot({path:`${out}/barrel-game.png`});
    for (const id of ['balance','water','shadow','sift','fire','strata']) {
      const info = await p.evaluate(id=>{
        game.enterShrine(game.shrines.shrines[game.SHRINES.findIndex(s=>s.id===id)]);
        game.dialogue.close();game.brief.hide();game.roomActor.setAt(0,10);
        const markers=game.room.scene.children.filter(o=>o.name.startsWith('Entrance marker '));
        const entry=game.room.spec?.rooms?.find(r=>r.id==='entry');
        game.roomActor.camYaw=0;
        const zEnd=game.SHRINES.find(s=>s.id===id).rooms.find(r=>r.id==='entry').to+.5;
        let ticks=0;
        while(game.roomActor.position.z>zEnd && ticks++<300){game.input.setTestIntent({y:1});game.step(1/60);}
        game.input.setTestIntent({});
        const crossed=game.roomActor.position.z<=zEnd+.1;
        const z=markers[0]?.position.z;
        const c=game.engine.camera;
        if(id==='balance'){c.position.set(5,5,5);c.lookAt(-1,2,-4);}
        else{c.position.set(0,3.8,z+8);c.lookAt(0,1.6,z-1);}
        game.engine.render();
        const result={id,markers:markers.length,crossed,finite:markers.every(m=>m.position.toArray().every(Number.isFinite)),profile:game.engine.post.lookKey};
        return result;
      },id);
      assert.equal(info.markers,id==='balance'?0:2);
      assert(info.crossed,`${id} entrance traversal`);
      assert(info.finite);
      assert.equal(info.profile,id);
      report.scenes.push(info);
      await p.screenshot({path:`${out}/${id}-game.png`});
      await p.evaluate(()=>game.exitShrine());
      console.log('PASS integrated geometry and entrance traversal',id);
    }
    await p.goto('http://127.0.0.1:5512/art/asset-upgrade/preview.html');
    await p.waitForFunction(()=>window.assetPreview,null,{timeout:30000});
    for(const view of ['ship','props','temple','markers']) {
      await p.locator(`[data-view="${view}"]`).click();
      await p.waitForFunction(v=>window.assetPreview?.view===v,view);
      await p.evaluate(()=>{assetPreview.controls.update();assetPreview.renderer.render(assetPreview.scene,assetPreview.camera);});
      await p.screenshot({path:`${out}/${view}-workshop.png`});
    }
    fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
    assert.deepEqual(report.errors,[]);
    console.log('PASS all asset roots, cover hierarchy, six shrine entrances, four workshop views and no browser errors');
  } finally { await b.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
