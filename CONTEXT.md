# Claude Session Context — ZepTrack
> Paste as first message in a new chat to resume immediately.

---

## Project Identity
- **App:** ZepTrack — GLP-1 / Zepbound personal health tracker PWA
- **Live:** `https://birria-corp.github.io/ZepTrack`
- **Repo:** `birria-corp/ZepTrack`
- **Current version:** v7.6
- **Platform:** Android Chrome PWA (primary) + desktop Chrome
- **User:** Grandmaster (Spencer Thompson) · **Assistant:** Fez
- **GitHub account:** `birria-corp` (org) / `spencer-thompson-2-vu` (personal)

---

## Stack
Single-file PWA — `index.html` (all CSS + JS inline), `manifest.json`, `sw.js` (cache `zeptrack-v7.6`), `version.json`, `icon-192.png`, `icon-512.png`. No framework, no build step. GitHub Pages hosted. localStorage with `zep_` prefix + Firebase Firestore cloud sync.

---

## Firebase
- **Project:** `zeptrack-f8720` (renamed to Birria Corp Apps in console — same project)
- **Auth domain:** `zeptrack-f8720.firebaseapp.com`
- **Authorized domain:** `birria-corp.github.io`
- **Auth:** Google sign-in via `signInWithPopup` + `signInWithRedirect` fallback
- **Button wiring:** `onclick="window._signIn && window._signIn()"` direct in HTML — avoids module race condition on Android PWA
- **Firestore schema:**
  - `users/{uid}/days/{YYYY-MM-DD}` — meals, exercise, injections, daily, weights
  - `users/{uid}/data/profile` — goals, units, recipes, quickPicks, customItems, drinkPresets
  - `users/{uid}/archive/{YYYY-MM-DD}` — daily summaries older than 35 days
- **Auto-sync:** fires on startup if 3+ days since `zep_lastSyncDate`
- **Manual sync:** Settings → Cloud Sync → Sync Now

---

## Delivery Convention
- **Always generate full download package** — zip named `ZepTrack-vX.X.zip` containing all 8 files
- **Always include:** `index.html`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `version.json`, `README.md`, `CONTEXT.md`
- **Always update:** README version history, CONTEXT.md current version, sw.js cache key, version.json
- **Always provide GH Desktop deploy notes** at end of build — format: `vX.X — Brief description of changes`
- **Always run adversarial review** before packaging — check that fixes actually landed in the file being packaged, not a stale copy
- **JS verified with acorn** before every package
- **Version bump: 3 places** — header string in `renderToday()`, `localVersion` in `checkForUpdate()`, `version.json`

---

## Adversarial Review Checklist (run before every package)
1. Verify fix is in the file being packaged (grep for the changed line) — not a stale copy
2. Check for `<\/script>` escape artifact in Firebase module block
3. Confirm version strings updated in all 3 locations
4. Confirm sw.js cache key matches version
5. Confirm README and CONTEXT.md version history updated
6. Run acorn JS validation on main script block

---

## Current Feature Set (v7.6)

### Navigation
5 bottom tabs: **Today · Log · Progress · History · Settings**
Log tab has 4 top tabs: **Intake · Recipes · Exercise · Injection**

### Intake Tab
- Unified single form — no meal type
- 4 water quick-buttons: 💧 30 oz · 24 oz · 12 oz · 8 oz
- Quick-pick grid (custom ordered via ↑↓ in Settings)
- Coffee + milk option (adds MILK_SHOT macros)
- Gram/OZ dual input with sync
- Food lookup: local recipes + quick-picks first ("Your Items"), then USDA
- Barcode scanner (Open Food Facts, Chrome Android only)

### Quick-Pick Hardcoded Items
```
7-Vanilla: 946g, 510cal, 17.6pro, 71carb, 17fat, 0fib (7Brew Large Iced Vanilla Latte, half ice/half sweet)
Coffee: 237g, 2cal
Iced Tea: 355g, 0cal (counts 90% toward water)
SK Protein Shake: 360g, 400cal, 31pro, 46carb, 13fat, 11.9fib
Hard Boiled Egg: 79g, 122cal
Cheese Stick: 28g, 80cal
Nuts: 71g, 422cal
Trail Mix: 71g, 280cal
Banana: 118g, 105cal
Apple: 172g, 98cal
Yogurt: 170g, 100cal
```

### Key Bug Fixes (v7.x history)
- `getHardcodedNutrition` sanitizer must use `[^a-z0-9 -]` (preserve hyphens) — `7-vanilla` key breaks without it
- `signInWithPopup` race condition on Android PWA: button onclick must be wired directly in HTML via `window._signIn`
- Firebase module `<\/script>` escape artifact silently kills auth
- `migrateQuickPicks` must use `zep_quickPicksSeeded` to avoid re-adding removed items
- Barcode `addScannedItem` meal-type null ref: use `?.value || 'intake'`

### Recipes Tab
- 42+ recipes (16 GLP-1 seeds + custom + user-entered)
- Sort: Most Cooked · Highest Rated · Not Cooked Recently
- Diet filter: Vegetarian / Carnivore
- Log Portion button with gram/oz input

### Weight Chart
- Time-scaled x-axis (true calendar positions)
- 35 Days / 1 Year toggle
- Dose-change injection markers (dashed green vertical lines)

### Progress Tab
- Nutrition: 7-day averages (excludes today) + 30-day bar charts
- Weight: time-scaled chart + % total loss, % 7d, % 30d
- Wellness: energy/mood chart, side effect frequency

### Settings
- Goals, Units, Quick-Pick ordering, Custom Items, Injection reminder
- Data: Export / Share / Import / Check for Update
- Cloud Sync: Sync Now button (updates `zep_lastSyncDate`)

---

## Key Architecture

### localStorage Keys
`zep_meals`, `zep_weights`, `zep_exercise`, `zep_daily`, `zep_daily_archive`, `zep_injections`, `zep_recipes`, `zep_drinkPresets`, `zep_customItems`, `zep_quickPicks`, `zep_quickPicksSeeded`, `zep_goals`, `zep_units`, `zep_reminder`, `zep_recipeRatings`, `zep_recipeCooks`, `zep_recipeLastCooked`, `zep_lastBackupDate`, `zep_lastSyncDate`, `zep_cloud_uid`

### Startup Sequence
```javascript
initSettings();
initReminders();
migrateWaterEntries();
migrateRecipeWeights();
migrateQuickPicks();       // uses zep_quickPicksSeeded to avoid re-adding removed items
archiveAndPruneMeals();    // 35-day rolling archive
seedGLP1Recipes();
renderQuickPickGrid();
renderToday();
checkAutoBackup();         // fires if 3+ days since last export
checkAutoSync();           // fires if 3+ days since last Firestore sync
```

### Water Tracking
- Stored as meal entries (type:'drink', cal:0)
- All water calcs use `drinkToOz(m)` helper
- Iced tea counts at 90% of oz value
- `drinkVolume` stores oz; `quantity`/`unit` store what was entered

### 35-Day Rolling Archive
- `archiveAndPruneMeals()` runs on startup
- Meals older than 35 days → summed into `zep_daily_archive`, deleted from `zep_meals`
- Archive synced to Firestore under `users/{uid}/archive/{date}`

---

## Macro Format (for recipe conversations)
```
Recipe Name: [name]
Per 100g:
Calories: [number]
Protein: [number]g
Carbs: [number]g
Fat: [number]g
Fiber: [number]g
```
Paste into Recipe bulk paste field. Log at total weight in grams.

---

## Pending Punch List
- [ ] Cap injection + exercise history at reasonable limits
- [ ] Move GLP-1 seed recipes to GitHub-hosted JSON fetch

---

## Version History
| Version | Changes |
|---------|---------|
| v7.6 | Fix 7-Vanilla key lookup (hyphen sanitizer); local items in food search; barcode fix; auto-sync |
| v7.5 | Fix barcode Add to Meal button; auto cloud sync every 3 days |
| v7.4 | Dose-change injection markers on weight chart |
| v7.3 | Fix quick-pick removals persisting; time-scaled weight chart with 35d/1yr toggle |
| v7.2 | Full history cloud sync (35-day archive), Sync Now button |
| v7.1 | Fix Google sign-in on Android PWA, Firebase module syntax error |
| v7.0 | Firebase Firestore cloud sync, Google sign-in, offline-first merge |
| v6.1 | Fix 7-Vanilla quick-pick hitting USDA (hyphen in key sanitizer) |
| v6.0 | Quick pick ↑↓ ordering in Settings, migrateQuickPicks auto-sync |
| v5.9 | drinkToOz helper, auto-backup guard, iced tea unit fix |
| v5.8 | Remove meal type, iced tea 90% water, 7-day excludes today, 7-Vanilla |
| v5.7 | Top-5 lookup UI, split Cooked This/Log Portion, anatomical injection diagram |
| v5.6 | 35-day archive, Progress chart fix |
| v5.5 | Nav restructure: Intake/Recipes/Exercise/Injection tabs |

---

## Communication Style
- Grandmaster = terse/direct. Fez = assistant.
- Terse caveman mode. Technical substance stays. Fluff dies.
- No sycophancy, no hedging, no unsolicited next steps.
- Clarifying questions: use visualize:show_widget sequential pill UI.
- Before building ambiguous requirements: proposal with Approve/Reject.
- **Every build:** JS verified with acorn, README + CONTEXT updated, full zip packaged, GH Desktop deploy notes provided.
- **Adversarial review** before every package — verify fixes landed in the correct file.
