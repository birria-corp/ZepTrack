// Sync and data-integrity suite. Each "new device" wipes zep_* keys but keeps
// FAKE_FS (the fake Firestore), which simulates a reinstall or a second phone.
module.exports = async ({ ctx, url, ok, pageErrors }) => {
  const p = await ctx.newPage();
  p.on('pageerror', e => pageErrors.push(e.message));
  p.on('dialog', d => d.accept());
  const URL = url;
  const load = async () => { await p.goto(URL); await p.waitForTimeout(900); };
  const settle = () => p.waitForTimeout(500);
  const newDevice = () => p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('zep_')).forEach(k => localStorage.removeItem(k)));
  const E = f => p.evaluate(f);
  let r;

  // fresh install, signed in
  await p.goto(URL); await E(() => { localStorage.clear(); localStorage.setItem('FAKE_SIGNED','1'); }); await load();

  // T1 edit -> no duplicate after re-pull
  await E(() => { document.getElementById('meal-date').value = today();
    DB.push('meals', { date: today(), type:'food', mealType:'intake', items:[{name:'Test Meal'}], cal:100, protein:5, fiber:1, carbs:1, fat:1 }); syncDay(today()); });
  await settle();
  await E(() => { const i = DB.get('meals').findIndex(m => m.items[0].name==='Test Meal'); openEntryEdit('meal', i);
    document.getElementById('ee-cal').value = 150; saveEntryEdit(); });
  await settle(); await load();
  r = await E(() => DB.get('meals').filter(m => m.items[0].name==='Test Meal').map(m=>m.cal));
  ok('T1 edit syncs, no duplicate after pull', JSON.stringify(r)==='[150]', JSON.stringify(r));

  // T2 delete -> no resurrection
  await E(() => { const i = DB.get('meals').findIndex(m => m.items[0].name==='Test Meal'); openEntryEdit('meal', i); deleteEntryFromModal(); });
  await settle(); await load();
  r = await E(() => DB.get('meals').filter(m => m.items[0].name==='Test Meal').length);
  ok('T2 delete stays deleted after pull', r===0, 'count '+r);
  await newDevice(); await load();
  r = await E(() => DB.get('meals')?.filter(m => m.items[0].name==='Test Meal').length ?? 0);
  ok('T2b delete stays deleted on new device', r===0, 'count '+r);

  // T3 archive stable across launches
  await E(() => { const d = new Date(); d.setDate(d.getDate()-40); const ds = d.toISOString().slice(0,10); window.__old = ds;
    DB.push('meals', { date: ds, type:'food', items:[{name:'Old'}], cal:500, protein:20, fiber:5, carbs:10, fat:5 }); syncDay(ds); });
  await settle(); await load(); await load(); await load();
  r = await E(() => { const d = new Date(); d.setDate(d.getDate()-40); const ds = d.toISOString().slice(0,10);
    return { arch: DB.get('daily_archive')[ds]?.cal, live: DB.get('meals').filter(m=>m.date===ds).length }; });
  ok('T3 archive not inflated across 3 launches', r.arch===500 && r.live===0, JSON.stringify(r));

  // T4 weights restore on new device
  await E(() => { openWeightModal(); document.getElementById('wt-val').value = 212.4; saveWeight(); });
  await settle(); await newDevice(); await load();
  r = await E(() => (DB.get('weights')||[]).map(w=>w.weight));
  ok('T4 weight restores on new device', JSON.stringify(r)==='[212.4]', JSON.stringify(r));

  // T5 SK shake edit survives new device; T13 oz no compounding
  await E(() => { openRecipeModal('qp-shake'); document.getElementById('recipe-total-weight').value = 16;
    document.getElementById('recipe-weight-unit').value = 'oz'; saveRecipe(); });
  await settle();
  r = await E(() => { openRecipeModal('qp-shake'); const shown = document.getElementById('recipe-total-weight').value + ' ' + document.getElementById('recipe-weight-unit').value; saveRecipe(); return { shown, after: DB.get('recipes').find(x=>x.id==='qp-shake').totalWeight }; });
  ok('T13 oz weight does not compound', r.shown==='454 g' && r.after===454, JSON.stringify(r));
  await settle(); await newDevice(); await load();
  r = await E(() => DB.get('recipes').find(x=>x.id==='qp-shake').totalWeight);
  ok('T5 SK Shake edit survives new device', r===454, 'totalWeight '+r);
  r = await E(() => { selectQuickItem('SK Protein Shake', document.querySelector('.qp-btn')); return document.getElementById('item-qty-grams').value; });
  ok('T5b Quick Choice uses edited weight', r==='454', 'grams '+r);

  // T6 seed delete persists
  await E(() => deleteRecipe('glp1-r2')); await settle(); await load();
  r = await E(() => !!DB.get('recipes').find(x=>x.id==='glp1-r2'));
  ok('T6 deleted seed not re-seeded', r===false);
  await newDevice(); await load();
  r = await E(() => !!DB.get('recipes').find(x=>x.id==='glp1-r2'));
  ok('T6b deleted seed stays gone on new device', r===false);
  await E(() => forceSeedRecipes()); await settle(); await newDevice(); await load();
  r = await E(() => !!DB.get('recipes').find(x=>x.id==='glp1-r2'));
  ok('T6c restore brings seed back across devices', r===true);

  // T7 offline log then online
  await E(() => localStorage.setItem('FAKE_OFFLINE','1'));
  await E(() => { DB.push('meals', { date: today(), type:'food', items:[{name:'Offline'}], cal:50 }); syncDay(today()); });
  await settle();
  r = await E(() => Object.keys(getDirty().days).length);
  ok('T7 offline write stays queued', r>0, 'dirty '+r);
  await E(() => { localStorage.removeItem('FAKE_OFFLINE'); window.dispatchEvent(new Event('online')); });
  await settle(); await newDevice(); await load();
  r = await E(() => DB.get('meals').some(m=>m.items[0].name==='Offline'));
  ok('T7b queued write flushed when online', r===true);

  // T8 seed edit preserves steps/tags; custom-r1 ingredients preserved
  await E(() => { openRecipeModal('glp1-r1'); saveRecipe(); openRecipeModal('custom-r1'); saveRecipe(); });
  r = await E(() => { const a = DB.get('recipes').find(x=>x.id==='glp1-r1'), c = DB.get('recipes').find(x=>x.id==='custom-r1');
    return { steps: a.steps?.length, tags: a.tags?.length, tips: !!a.tips, cIng: c.ingredients[0], cSteps: c.steps.length }; });
  ok('T11 seed edit keeps steps/tags/tips', r.steps>0 && r.tags>0 && r.tips, JSON.stringify({s:r.steps,t:r.tags,tips:r.tips}));
  ok('T12 bulk edit keeps ingredient list', r.cIng.base===4 && r.cIng.unit==='tbsp', JSON.stringify(r.cIng));

  // T14 JSON import steps + qty on card
  r = await E(() => { openRecipeModal();
    document.getElementById('recipe-paste-input').value = JSON.stringify({name:'ImportT',totalWeight:500,ingredients:[{name:'Ing A',qty:100,unit:'Grams',cal:100,protein:1,carbs:1,fat:1,fiber:1}],steps:['Do the thing'],tags:['soup']});
    parseRecipePaste(); saveRecipe(); const t = DB.get('recipes').find(x=>x.name==='ImportT');
    showView('v-log'); showLogTab('recipes'); openRecipeCardNew(t.id); const txt = document.getElementById('recipe-card-content').innerText;
    return { steps: t.steps, tags: t.tags, hasStep: txt.includes('Do the thing'), undef: /undefined/.test(txt), qty: txt.includes('3.5oz') }; });
  ok('T14 import steps saved + shown, qty formatted', r.hasStep && !r.undef && r.qty && r.tags?.[0]==='soup', JSON.stringify(r));

  // T9 profile: cloud units win on new device, not clobbered
  await E(() => setUnits('metric')); await settle(); await newDevice(); await load();
  r = await E(() => ({ units: DB.get('units'), UNITS, cloud: JSON.parse(localStorage.FAKE_FS)['users/u1/data/profile'].units }));
  ok('T8/T9 units restore on new device, cloud not clobbered', r.units==='metric' && r.UNITS==='metric' && r.cloud==='metric', JSON.stringify(r));
  await E(() => setUnits('imperial')); await settle();

  // T10 quick pick removal persists across devices
  await E(() => { const i = getQuickPicks().indexOf('Banana'); removeQuickPickItem(i); }); await settle(); await newDevice(); await load();
  r = await E(() => getQuickPicks().includes('Banana'));
  ok('T10 quick pick removal persists on new device', r===false);

  // T15 custom item syncs
  await E(() => { openCustomItemModal(); document.getElementById('ci-modal-name').value='Custom X'; saveCustomItemFromModal(); }); await settle(); await newDevice(); await load();
  r = await E(() => (DB.get('customItems')||[]).map(c=>c.name));
  ok('T7c custom item syncs', r.includes('Custom X'), JSON.stringify(r));

  // T16 date move: no dup at old date
  await E(() => { DB.push('meals', { date: today(), type:'food', items:[{name:'Mover'}], cal:10 }); syncDay(today()); }); await settle();
  await E(() => { const i = DB.get('meals').findIndex(m=>m.items[0].name==='Mover'); openEntryEdit('meal', i);
    const d = new Date(); d.setDate(d.getDate()-2); document.getElementById('ee-date').value = getLastNDays(3)[0]; saveEntryEdit(); });
  await settle(); await newDevice(); await load();
  r = await E(() => ({dates: DB.get('meals').filter(m=>m.items[0].name==='Mover').map(m=>m.date), t: today()}));
  ok('T16 moved entry exists once on new date', r.dates.length===1 && r.dates[0]!==r.t, JSON.stringify(r));

  // Ratings and cook counts sync with the profile (v9.1)
  await E(() => { setRecipeRatingNew('glp1-r1', 4); cookedThisRecipeCard('glp1-r1'); }); await settle(); await newDevice(); await load();
  r = await E(() => ({ rating: (DB.get('recipeRatings')||{})['glp1-r1'], cooks: (DB.get('recipeCooks')||{})['glp1-r1'] }));
  ok('v9.1 ratings + cook counts restore on new device', r.rating===4 && r.cooks===1, JSON.stringify(r));

  // Built-in shakes seeded
  r = await E(() => DB.get('recipes').filter(x=>String(x.id).startsWith('pb-')).map(x=>x.name));
  ok('v9.1 four protein shakes are built in', r.length===4, JSON.stringify(r));

  // version + header
  r = await E(() => ({ v: APP_VERSION, hdr: document.getElementById('hdrDate').innerText }));
  const fileVer = require('../version.json').version;
  ok('Version single source (APP_VERSION = version.json)', r.v===fileVer && r.hdr.includes('v'+fileVer), JSON.stringify(r)+' file '+fileVer);

  // pre-v9 upgrade: legacy entries without id/ts
  await E(() => { localStorage.clear(); localStorage.setItem('zep_weights', JSON.stringify([{date:'2026-09-01',weight:220}]));
    localStorage.setItem('zep_meals', JSON.stringify([{date:today(),items:[{name:'Legacy'}],cal:10,ts:12345}])); localStorage.setItem('zep_goals', JSON.stringify({calories:1500})); });
  await load();
  r = await E(() => ({ w: DB.get('weights')[0], m: DB.get('meals')[0].id, pua: !!DB.get('profileUpdatedAt') }));
  ok('Legacy upgrade: ids assigned, profile clock set', r.w.id==='w-2026-09-01-220' && r.m==='t12345' && r.pua, JSON.stringify(r));

  await p.close();
};
