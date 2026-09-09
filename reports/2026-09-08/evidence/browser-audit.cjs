// Read-only application audit. Run against a disposable local browser context.
const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(process.env.AUDIT_NODE_MODULES, 'playwright'));
const out = __dirname;
const base = process.env.AUDIT_URL || 'http://127.0.0.1:5500/';
async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const page = await context.newPage();
  const result = { date: new Date().toISOString(), base, browser: browser.version(), console: [], errors: [], responses: [], failures: [] };
  page.on('console', m => result.console.push({type:m.type(),text:m.text()}));
  page.on('pageerror', e => result.errors.push(String(e)));
  page.on('response', r => result.responses.push({url:r.url(),status:r.status()}));
  page.on('requestfailed', r => result.failures.push({url:r.url(),error:r.failure()}));
  const started = Date.now();
  try {
    await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction(() => !!window.game, {timeout:120000});
    result.loadMs = Date.now() - started;
    await page.screenshot({path:path.join(out,'01-title-desktop.png')});
    result.initial = await page.evaluate(() => ({mode:game.mode, title:document.title, memory:game.engine.renderer.info.memory, render:game.engine.renderer.info.render, shrines:game.SHRINES.map(s=>({id:s.id,name:s.name,unit:s.unit,gates:s.rooms.filter(r=>r.gate).map(r=>({id:r.gate,name:r.name})),final:s.final})), storage:{local:Object.keys(localStorage),session:Object.keys(sessionStorage)}, graphics:game.engine.renderer.getContext().getParameter(game.engine.renderer.getContext().RENDERER)}));
    await page.locator('#title').click({position:{x:900,y:300}});
    await page.waitForTimeout(1000);
    await page.screenshot({path:path.join(out,'02-lab-desktop.png')});
    result.lab = await page.evaluate(() => ({mode:game.mode,state:game.lab.state, text:document.body.innerText}));
    console.log('Loaded title and lab. Running built-in selftest.');
    result.selftest = await page.evaluate(() => { game.loop.stop(); const t=performance.now(); const ok=__selftest(); return {ok,ms:performance.now()-t}; });
    console.log('Selftest: '+JSON.stringify(result.selftest));
    result.afterSelftest = await page.evaluate(() => ({mode:game.mode,memory:game.engine.renderer.info.memory}));
    await page.evaluate(() => { game.landOnPlanet(); game.dialogue.close?.(); game.loop.start(); });
    await page.waitForTimeout(700);
    await page.screenshot({path:path.join(out,'03-planet-desktop.png')});
    result.rooms = [];
    for (let i=0;i<6;i++) {
      result.rooms.push(await page.evaluate(i => {game.enterShrine(game.shrines.shrines[i]); return {id:game.room.spec.id,open:game.room.dungeon.open,gates:game.room.gates.map(g=>g.gate.constructor.name),final:game.room.final.constructor.name};}, i));
      await page.waitForTimeout(350);
      await page.screenshot({path:path.join(out,`shrine-${i+1}.png`)});
      await page.evaluate(() => game.exitShrine());
    }
    result.progressBeforeReload = await page.evaluate(() => { game.notebook.setHas(true);game.shrines.markCleared(game.shrines.shrines[0]);return {notebook:game.notebook.has,cleared:game.shrines.clearedCount()}; });
    await page.reload({waitUntil:'networkidle'});
    result.progressAfterReload = await page.evaluate(() => ({mode:game.mode,notebook:game.notebook.has,cleared:game.shrines.clearedCount(),storage:{local:Object.keys(localStorage),session:Object.keys(sessionStorage)}}));
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(out,'04-title-narrow.png')});
    result.selftestLog = result.console.filter(x=>x.text.includes('[selftest]'));
  } catch (e) { result.auditError = e.stack; }
  finally { fs.writeFileSync(path.join(out,'browser-audit.json'),JSON.stringify(result,null,2)); await browser.close(); }
  console.log(JSON.stringify({loadMs:result.loadMs,selftest:result.selftest,errors:result.errors,failedResponses:result.responses.filter(x=>x.status>=400),progressBeforeReload:result.progressBeforeReload,progressAfterReload:result.progressAfterReload,auditError:result.auditError},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
