// UI suite: click through every screen, quick pick and recipe, then check
// v9.1 features. Any uncaught error on the page fails the run.
module.exports = async ({ ctx, url, ok, pageErrors }) => {
  const p = await ctx.newPage();
  p.on('pageerror', e => pageErrors.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(url);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('FAKE_SIGNED', '1'); });
  await p.goto(url);
  await p.waitForTimeout(1200);
  const E = f => p.evaluate(f);

  const tour = await E(async () => {
    const log = [];
    for (const v of ['v-today', 'v-log', 'v-progress', 'v-history', 'v-settings']) showView(v);
    for (const t of ['intake', 'recipes', 'exercise', 'injection']) showLogTab(t);
    for (const t of ['nutrition', 'weight']) showProgressTab(t);
    for (const t of ['today', 'yesterday', 'week', 'month']) showSummaryTab(t);
    showLogTab('intake');
    for (const name of getQuickPicks().filter(n => n !== 'Other')) {
      const btn = [...document.querySelectorAll('.qp-btn')].find(x => x.textContent === name);
      await selectQuickItem(name, btn);
      if (/NaN/.test(document.getElementById('quick-nutrition-preview').innerText)) log.push('NaN preview ' + name);
      saveQuickLog();
    }
    showLogTab('recipes');
    for (const r of DB.get('recipes')) {
      openRecipeCardNew(r.id);
      const txt = document.getElementById('recipe-card-content').innerText;
      if (/undefined|NaN/.test(txt)) log.push('card ' + r.id);
      renderRecipeCardContentNew(r, 'log');
      openRecipeModal(r.id); closeRecipeModal(); closeRecipeCard();
    }
    showView('v-history');
    return { logged: DB.get('meals').length, log };
  });
  ok('Tour: every quick pick logs, no NaN or undefined on cards', tour.logged >= 10 && tour.log.length === 0, JSON.stringify(tour));

  // ── v9.1 features ─────────────────────────────────────
  let r;
  r = await E(() => ({ daily: !!document.getElementById('tab-daily'), wellness: !!document.getElementById('ptab-wellness'),
    drink: !!document.getElementById('drink-preset-modal'), other: getQuickPicks().includes('Other'), search: !!document.getElementById('tab-search') }));
  ok('Removed: Daily Check-In, Wellness, Drink Presets, Other; Search tab present', !r.daily && !r.wellness && !r.drink && !r.other && r.search, JSON.stringify(r));

  r = await E(() => { localStorage.setItem('zep_quickPicks', JSON.stringify(['Coffee','Other','Banana'])); migrateQuickPicks(); return getQuickPicks().includes('Other'); });
  ok('Saved quick picks lose "Other" on upgrade', r === false);

  r = await E(() => { const el = document.getElementById('ex-duration'); el.value = 30; step('ex-duration', 5); return el.value; });
  ok('Bug 18: stepper works without errors', r === '35', r);

  // Search tab: library + USDA (fixture), escaping, log, add to recipes
  await E(() => { showView('v-log'); showLogTab('search'); const i = document.getElementById('search-input'); i.value = 'pizza'; onSearchInput(); });
  await p.waitForTimeout(900);
  r = await E(() => ({ usda: searchUsdaResults.length, bold: document.querySelectorAll('#search-usda-list b').length,
    first: searchUsdaResults[0]?.name, serving: searchUsdaResults[0]?.servingG }));
  ok('Search: USDA results render (all data types)', r.usda === 3 && r.serving === 125, JSON.stringify(r));
  ok('Search: USDA text is escaped', r.bold === 0);
  r = await E(() => { selectSearchItem('usda', 0); const g = document.getElementById('search-qty-g').value;
    const before = DB.get('meals').length; logSearchItem(); const m = DB.get('meals').slice(-1)[0];
    addSearchItemToRecipes(); const rec = DB.get('recipes').find(x => x.id === 'usda-1001');
    document.getElementById('search-input').value = 'digiorno'; renderSearchLibrary();
    return { g, logged: DB.get('meals').length - before, cal: m.cal, rec: rec && rec.totalWeight, lib: searchLibResults.map(x => x.name) }; });
  ok('Search: Log Item uses package serving', r.g === '125' && r.logged === 1 && r.cal === 335, JSON.stringify(r));
  ok('Search: Add to Recipes saves the portion as a recipe and it shows in library', r.rec === 125 && r.lib.length === 1, JSON.stringify(r));

  r = await E(() => { showManualEntry(); document.getElementById('man-name').value = 'Work Snack';
    document.getElementById('man-serving').value = 40; document.getElementById('man-cal').value = 150; document.getElementById('man-pro').value = 12;
    logManualItem(); saveManualToLibrary(); return { meal: DB.get('meals').slice(-1)[0].cal, custom: (DB.get('customItems')||[]).some(c => c.name === 'Work Snack') }; });
  ok('Search: manual entry logs and saves to Custom Items', r.meal === 150 && r.custom, JSON.stringify(r));

  // Protein gap finder
  r = await E(() => { showView('v-today'); toggleProteinGap(); const rows = window._gapRows || [];
    return { open: document.getElementById('protein-gap').style.display, n: rows.length, left: todayLeft,
      sorted: rows.every((x, i) => i === 0 || rows[i-1].ratio <= x.ratio), txt: document.getElementById('left-today').innerText }; });
  ok('Protein finder: ranked options shown', r.open === 'block' && r.n === 5 && r.sorted, JSON.stringify({ n: r.n, open: r.open, sorted: r.sorted }));
  ok('Left today strip renders', /Left today/.test(r.txt) && !/NaN/.test(r.txt), r.txt);
  r = await E(() => { logGapRow(0); return { tab: document.getElementById('tab-search').style.display, g: document.getElementById('search-qty-g').value, g0: String(window._gapRows[0].grams) }; });
  ok('Protein finder: Log opens Search pane with grams pre-filled', r.tab === 'block' && r.g === r.g0, JSON.stringify(r));

  // Barcode: carbs/fat, escaping, save as recipe
  r = await E(async () => { document.getElementById('barcode-modal').classList.add('open'); await lookupBarcode('123');
    const imgs = document.querySelectorAll('#barcode-result img').length; addScannedItem(); const m = DB.get('meals').slice(-1)[0];
    document.getElementById('barcode-modal').classList.add('open'); await lookupBarcode('123'); saveScannedAsRecipe();
    const rec = DB.get('recipes').find(x => x.id === 'bc-123');
    return { imgs, carbs: m.carbs, fat: m.fat, rec: rec && { w: rec.totalWeight, tags: rec.tags } }; });
  ok('Barcode: carbs and fat logged', r.carbs === 3.9 && r.fat === 1.4, JSON.stringify(r));
  ok('Barcode: product text escaped', r.imgs === 0);
  ok('Barcode: Save to Recipe Library (tagged protein-boost)', r.rec && r.rec.w === 28 && r.rec.tags.includes('protein-boost'), JSON.stringify(r.rec));
  await E(() => closeBarcodeScanner());

  // Goal weight + weights by date + chart
  r = await E(() => { showView('v-settings'); const gw = document.getElementById('goal-weight').value;
    document.getElementById('goal-weight').value = 195; saveGoals();
    DB.set('weights', []); DB.push('weights', { date: '2026-09-20', weight: 210 }); DB.push('weights', { date: '2026-09-10', weight: 215 });
    showView('v-progress'); showProgressTab('weight'); renderToday();
    return { gw, goal: GOALS.goalWeight, hero: document.getElementById('weight-hero').innerText }; });
  await p.waitForTimeout(200);
  ok('Goal weight defaults to 200 and saves', r.gw === '200' && r.goal === 195, JSON.stringify(r));
  ok('Current weight uses latest date, not entry order', /210/.test(r.hero) && !/^215/.test(r.hero), r.hero);

  // Injection dose default
  r = await E(() => { DB.set('injections', [{ date: '2026-09-01', dose: '2.5mg', site: 'abd-ul', ts: 1 }, { date: '2026-09-15', dose: '5mg', site: 'abd-ur', ts: 2 }]);
    showView('v-log'); showLogTab('injection'); showLogTab('intake'); showLogTab('injection'); return document.getElementById('inj-dose').value; });
  ok('Injection dose defaults to the last dose', r === '5mg', r);

  // Backup, CSV, AI prompt, paste mode switch
  r = await E(() => { DB.set('daily_archive', { '2026-07-01': { cal: 500, protein: 20, carbs: 1, fat: 1, fiber: 1, water: 10 } });
    const b = buildBackup(); const d = buildDailyCsv().trim().split('\n'); const rc = buildRecipesCsv().trim().split('\n');
    return { arch: !!b.daily_archive, ratings: 'recipeRatings' in b || true, header: d[0], hasArch: d.some(l => l.startsWith('2026-07-01,500')),
      rcRows: rc.length - 1, recipes: DB.get('recipes').length }; });
  ok('Backup includes archive', r.arch, JSON.stringify(r));
  ok('Daily CSV: stable header and archived days', r.header === 'date,cal,protein,carbs,fat,fiber,water_oz,weight_lb,exercise_min,steps,injection_dose,injection_site' && r.hasArch, r.header);
  ok('Recipes CSV: one row per recipe', r.rcRows === r.recipes, JSON.stringify(r));
  r = await E(() => ({ m: buildAiPrompt('macros'), f: buildAiPrompt('full') }));
  ok('AI prompt: macros mode + adversarial review + rounding + brand rule', /"isBulk": true/.test(r.m) && /adversarial review/.test(r.m) && /0\.1/.test(r.m) && /brand/.test(r.m) && /"ingredients": \[\],/.test(r.m));
  ok('AI prompt: full mode includes ingredient template', /"isBulk": false/.test(r.f) && /"qty": <grams>/.test(r.f));
  r = await E(() => { openRecipeModal(); document.getElementById('recipe-paste-input').value = JSON.stringify({ name: 'Paste T', totalWeight: 300, totalCal: 600, totalProtein: 30 });
    parseRecipePaste(); return { bulk: document.getElementById('recipe-bulk-mode').checked, cal: document.getElementById('bulk-cal').value }; });
  ok('Paste: macros-only JSON switches to bulk mode automatically', r.bulk && r.cal === '600', JSON.stringify(r));
  await E(() => closeRecipeModal());

  // NaN preview for a user quick pick resolved through USDA
  r = await E(async () => { localStorage.setItem('zep_quickPicks', JSON.stringify(['Zucchini Bread Thing'])); showLogTab('intake'); renderQuickPickGrid();
    await selectQuickItem('Zucchini Bread Thing', document.querySelector('.qp-btn')); syncQtyFromGrams(); return document.getElementById('quick-nutrition-preview').innerText; });
  ok('Bug 20: no NaN in USDA quick-pick preview', !/NaN/.test(r), r);

  // Bug 17: local dates after 7 pm Central
  const p2 = await ctx.newPage();
  p2.on('pageerror', e => pageErrors.push(e.message));
  await p2.clock.install({ time: new Date('2026-09-25T20:30:00-05:00') });
  await p2.goto(url); await p2.waitForTimeout(800);
  r = await p2.evaluate(() => { const y = new Date(); y.setDate(y.getDate() - 1); return { today: today(), yday: localDateStr(y) }; });
  ok('Bug 17: dates stay local after 7 pm Central', r.today === '2026-09-25' && r.yday === '2026-09-24', JSON.stringify(r));
  await p2.close();

  await p.close();
};
