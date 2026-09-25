// Runs every suite and exits non-zero on any failure or uncaught page error.
// Usage: node tests/run.js   (set PW_CHROMIUM to use a local Chromium binary)
const { serve, launch, collector } = require('./harness');

(async () => {
  const { server, url } = await serve();
  const { browser, ctx } = await launch();
  const all = [];
  let failed = false;
  for (const suite of ['sync', 'ui']) {
    const c = collector(suite);
    const pageErrors = [];
    try {
      await require(`./${suite}.test.js`)({ ctx, url, ok: c.ok, pageErrors });
    } catch (e) {
      c.ok('suite crashed', false, e.stack.split('\n').slice(0, 3).join(' | '));
    }
    c.ok('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
    all.push(...c.results);
  }
  for (const r of all) {
    if (!r.pass) failed = true;
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  [${r.suite}] ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  }
  console.log(`\n${all.filter(r => r.pass).length}/${all.length} passed`);
  await browser.close();
  server.close();
  process.exit(failed ? 1 : 0);
})();
