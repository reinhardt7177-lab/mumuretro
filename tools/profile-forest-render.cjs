// Read-only submission census of the currently installed renderer.
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(path.join(process.env.AUDIT_NODE_MODULES, 'playwright'));
const fixture = require('./world-horizon-fixture.cjs');
const B = 'reports/2026-10-26/evidence/forest-render';
fs.mkdirSync(B, { recursive: true });
const report = { startedUtc: new Date().toISOString(), scope: 'Actual submitted draws by render pass in isolated prepared views. Instrumented CPU time is not GPU time or a performance benchmark.', rows: [], errors: [] };
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', error => report.errors.push(error.message));
    await fixture.prepare(page, 'after', 'mid');
    const sites = JSON.parse(fs.readFileSync(fixture.B + '/sites.json'));
    for (const id of ['landing', 'woodland', 'portal-shadow', 'portal-fire']) {
      const site = sites.find(row => row.id === id);
      for (const quality of process.argv.includes('--owners') ? ['mid'] : ['mid', 'low']) {
        await page.evaluate(async ({ site, quality }) => {
          (await import('/src/render/Quality.js')).quality.pin(quality);
          fieldProbe.stage(site.dir, site.target);
        }, { site, quality });
        const row = await page.evaluate(() => {
          const engine = game.engine, renderer = engine.renderer, mainCamera = engine.camera;
          const original = renderer.renderBufferDirect, originalOutline = engine.outline.renderOutline;
          const groups = {}, objects = {}, snapshots = [], counts = {};
          let outlining = false;
          engine.scene.traverse(object => { if (object.isMesh) snapshots.push([object, object.material]); });
          renderer.info.autoReset = false;
          renderer.info.reset();
          engine.outline.renderOutline = function (...args) {
            outlining = true;
            try { return originalOutline.apply(this, args); } finally { outlining = false; }
          };
          renderer.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
            const pass = scene === null ? 'shadow' : outlining ? 'outline' : camera === mainCamera ? 'colour' : 'post';
            const kind = object.userData.natureKind || (game.scatter.meshes.includes(object) ? 'scatter-other' : object.name || object.type);
            const beforeCalls = renderer.info.render.calls, beforeTris = renderer.info.render.triangles;
            const result = original.apply(this, arguments);
            const calls = renderer.info.render.calls - beforeCalls;
            const triangles = renderer.info.render.triangles - beforeTris;
            const key = pass + ':' + kind;
            const entry = groups[key] ??= { pass, kind, calls: 0, triangles: 0, meshes: 0, instances: 0 };
            entry.calls += calls; entry.triangles += triangles; entry.meshes++;
            if (object.isInstancedMesh) entry.instances += object.count;
            counts[pass] = (counts[pass] || 0) + calls;
            if (calls) {
              const under = root => { for (let p = object; p; p = p.parent) if (p === root) return true; return false; };
              const owner = game.forage.sites.find(site => under(site.group));
              const area = owner ? 'forage:' + owner.kind : under(game.player.mesh) ? 'player'
                : under(game.adventure.group) ? 'adventure' : under(game.landing.group) ? 'landing'
                : game.shrines.shrines.some(shrine => under(shrine.group)) ? 'shrine' : 'other';
              objects[pass + ':' + object.uuid] = { pass, name: object.name, kind, area, calls, triangles,
                geometry: geometry.type, material: material.type, instances: object.count ?? null };
            }
            return result;
          };
          try {
            engine.render();
            return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, counts,
              groups: Object.values(groups).sort((a, b) => b.calls - a.calls),
              objects: Object.values(objects), actor: game.player.position.toArray(), camera: mainCamera.position.toArray(),
              instancedMeshes: game.scatter.meshes.length };
          } finally {
            renderer.renderBufferDirect = original; engine.outline.renderOutline = originalOutline;
            renderer.info.autoReset = true;
            if (snapshots.some(([object, material]) => object.material !== material)) throw Error('Material was not restored by outline pass');
          }
        });
        report.rows.push({ id, quality, ...row });
        console.log(JSON.stringify({ id, quality, calls: row.calls, triangles: row.triangles, passes: row.counts,
          leaders: row.groups.slice(0, 6).map(({ pass, kind, calls, triangles }) => ({ pass, kind, calls, triangles })) }));
      }
    }
    report.pass = report.rows.length === (process.argv.includes('--owners') ? 4 : 8) && !report.errors.length && report.rows.every(row =>
      row.calls === Object.values(row.counts).reduce((sum, count) => sum + count, 0));
  } catch (error) { report.pass = false; report.failure = error.stack; console.error(error); }
  finally {
    report.finishedUtc = new Date().toISOString();
    fs.writeFileSync(B + (process.argv.includes('--owners') ? '/owner-profile.json' : '/initial-profile.json'), JSON.stringify(report, null, 2));
    await browser.close();
    if (!report.pass) process.exitCode = 1;
  }
})();
