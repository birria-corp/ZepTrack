// Shared test harness: static server, browser with Firebase routed to an
// in-memory fake (tests/fakefb), and a tiny assertion collector.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png' };

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, () => resolve({ server, url: `http://localhost:${server.address().port}/index.html` }));
  });
}

async function launch() {
  const opts = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
  const browser = await chromium.launch(opts);
  const ctx = await browser.newContext({ timezoneId: 'America/Chicago', viewport: { width: 390, height: 844 } });
  const fake = { app: 'app.js', auth: 'auth.js', firestore: 'firestore.js' };
  await ctx.route(/gstatic\.com\/firebasejs\/.*\/firebase-(app|auth|firestore)\.js/, r => {
    const m = r.request().url().match(/firebase-(app|auth|firestore)\.js/)[1];
    r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, 'fakefb', fake[m]), 'utf8') });
  });
  // No real network in tests: fonts, USDA and Open Food Facts are stubbed or blocked.
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  // Mirror the real API's validation: GET dataType accepts only these values
  // (it returns 400 for "Survey (FNDDS)"). Anything else fails the request.
  const USDA_OK_TYPES = new Set(['Branded', 'Foundation', 'SR Legacy']);
  await ctx.route(/api\.nal\.usda\.gov/, r => {
    const types = new URL(r.request().url()).searchParams.get('dataType');
    if (types && !types.split(',').every(t => USDA_OK_TYPES.has(t))) return r.fulfill({ status: 400, body: 'bad dataType' });
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(require('./fixtures/usda.json')) });
  });
  await ctx.route(/openfoodfacts\.org/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(require('./fixtures/off.json')) }));
  return { browser, ctx };
}

function collector(suite) {
  const results = [];
  return {
    ok(name, cond, detail = '') { results.push({ suite, name, pass: !!cond, detail }); },
    results
  };
}

module.exports = { serve, launch, collector };
