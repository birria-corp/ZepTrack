# ZepTrack: session context

Paste this file as the first message of a new Claude session to resume work without re-explaining anything.

## Project

| Field | Value |
|---|---|
| Name | ZepTrack |
| Repo | https://github.com/birria-corp/ZepTrack |
| Live | https://birria-corp.github.io/ZepTrack |
| Current version | 9.2 (2026-09-26) |
| Stack | Single-file HTML PWA (vanilla JS, inline CSS), Firebase Auth (Google) and Cloud Firestore through the web SDK 10.12.2 from gstatic, hosted on GitHub Pages |
| Firebase project | `zeptrack-f8720`, shared with the Truthsayer app's `segments` collection |
| Devices | Phone only (Android PWA). Sync is built for one active device plus restore on reinstall. |
| Owner | Doctor |

## File structure

```
index.html      ~6,900 lines. Two script blocks:
                  <script type="module">  Firebase init, window.Cloud, onAuthStateChanged
                  <script>                everything else (DB, sync helpers, UI, seeds, init)
sw.js           Service worker. CACHE = 'zeptrack-v9.2'. Network-first for index.html,
                version.json, and sw.js; cache-first for everything else; deletes old caches
                on activate.
manifest.json   PWA manifest (start_url ./index.html, standalone, portrait)
version.json    {"version":"9.2"}
icon-192.png, icon-512.png
README.md       User-facing overview, update workflow, and version history
CONTEXT.md      This file
package.json    Test tooling only: Playwright 1.63.0 (dev dependency). `npm test` runs the suite.
tests/
  harness.js    Static server + Chromium with Firebase routed to tests/fakefb and USDA /
                Open Food Facts routed to tests/fixtures
  fakefb/       In-memory fake of the Firebase app, auth, and Firestore modules (stored in
                localStorage under FAKE_FS; FAKE_SIGNED signs in; FAKE_OFFLINE makes calls fail)
  fixtures/     Canned USDA search and Open Food Facts product responses
  sync.test.js  Sync and data-integrity cases ("new device" = wipe zep_* keys, keep FAKE_FS)
  ui.test.js    Screen tour plus v9.1 feature and bug-fix cases
  run.js        Runs both suites; exits 1 on any failure or uncaught page error
tools/deploy.py One-commit deploy through the Git Data API (no git push needed)
.github/workflows/static.yml   test job (npm test) → deploy job (Pages). Deploy runs only if tests
                pass; manual run has a skip_tests input for emergencies.
```

## Architecture

### Local storage

All keys use the `zep_` prefix and are accessed through `DB.get`, `DB.set`, and `DB.push`. The module script uses `window._DB_RAW` and `window._DB_SET`.

| Key | Contents |
|---|---|
| `meals`, `exercise`, `injections`, `daily`, `weights` | Entry arrays (`ENTRY_KEYS`). Every entry has `id`, `ts`, and `date`, and gets `updatedAt` when edited. `daily` (check-ins) has no UI since v9.1; existing records still sync and back up. |
| `recipes` | Recipe array (schema below) |
| `quickPicks`, `quickPicksSeeded` | Quick-pick button names, plus the defaults already offered, so removed defaults don't return |
| `customItems`, `goals` (includes `goalWeight` in lbs, default 200), `units` | Profile data. `drinkPresets` is legacy data kept in backups; the feature was removed in v9.1. |
| `daily_archive` | `{date: {cal, protein, carbs, fat, fiber, water}}` for meals older than 35 days |
| `recipeRatings`, `recipeCooks`, `recipeLastCooked` | Per-recipe maps. Synced with the profile (last-writer-wins) and included in backups. |
| `tombstones` | `{"<key>:<id>@<date>": deletedAtMs}` for deleted or moved entries (pruned after 120 days) |
| `recipeTombstones` | `{recipeId: deletedAtMs}` |
| `syncDirty` | `{days:{date:n}, profile:n, recipes:{id:n}, recipeDeletes:{id:n}}`, the retry queue |
| `profileUpdatedAt` | Profile last-writer-wins clock |
| `lastSyncDate`, `lastBackupDate`, `reminder`, `reminderLastFired`, `cloud_uid` | Bookkeeping |

### Firestore schema

```
users/{uid}/days/{YYYY-MM-DD}   {meals[], exercise[], injections[], daily[], weights[],
                                 deleted: {"<key>:<id>@<date>": ms}, updatedAt}
users/{uid}/data/profile        {goals, units, quickPicks[], customItems[], drinkPresets[],
                                 recipeRatings{}, recipeCooks{}, recipeLastCooked{},
                                 deletedRecipes: {id: ms}, updatedAt}
users/{uid}/recipes/{id}        one document per recipe (+ syncedAt)
users/{uid}/archive/{date}      daily summaries for dates older than 35 days
segments/{segmentId}            Truthsayer app (public read, owner-only write). Not ZepTrack data.
```

Security rules, verified 2026-09-25: `users/{userId}/{document=**}` allows read and write only when `request.auth.uid == userId`. There's no catch-all rule.

### Sync design (v9.0, unchanged in v9.1)

- **Entry identity:** `DB.push` assigns `id` and `ts` to entries. `normalizeEntry()` gives legacy entries a deterministic ID (`t<ts>`, or `w-<date>-<weight>` for old weights without `ts`), so local and cloud copies of the same entry match.
- **Edits** keep `id` and `ts` and set `updatedAt`. The newer stamp (`updatedAt` or `ts`) wins merges. When an edit changes the date, the app tombstones the entry on the old date.
- **Deletes** call `addTombstone()`. Merges and pulls drop tombstoned IDs, so deleted entries can't come back.
- **Dirty queue:** every write calls `syncDay(...dates)`, `touchProfile()`, `syncRecipe(id)`, or `syncRecipeDelete(id)`. `flushSync()` pushes the queued items and clears each mark only if it didn't change during the push. It runs after writes, on sign-in, on the `online` event, and on `visibilitychange`.
- **`pushDay`** is a read-merge-write. `buildDayPayload()` unions the local and cloud entries for the day by ID and removes tombstoned ones. It never blindly overwrites the cloud day.
- **Pull** (`pullAndMerge`, on sign-in and **Sync Now**):
  1. Profile, last-writer-wins on `updatedAt`. The `deletedRecipes` map is always unioned.
  1. Recipes, newer `ts` wins. A recipe is alive only while its `ts` is newer than its tombstone (`recipeAlive`).
  1. Archive documents, added if missing.
  1. Day documents, merged by `applyCloudDays()`. Meals older than the 35-day window aren't re-added to the live list; the app recomputes the archive summary for those dates from the cloud day document instead.
- **After a pull**, `afterCloudPull()` reloads the `GOALS` and `UNITS` globals, re-seeds missing recipes, and re-renders.
- **Full push** (`pushAllDays`) runs on sign-in when the last full sync is 3 or more days old, and on **Sync Now**.
- **Upgrade from v8:** `initProfileClock()` stamps `profileUpdatedAt` on existing installs so local data wins the first compare. A fresh install stays at 0, so cloud data wins.

### Recipes

- **Schema:** `{id, name, totalWeight (grams, always), weightUnit:'g', isBulk, totalCal, totalProtein, totalCarbs, totalFat, totalFiber, ingredients[], steps[], notes, tips?, tags?, servingBase?, ts}`.
- **Ingredients** come in two shapes:
  - User or imported: `{name, qty, unit:'Grams'|'OZ'|'ML'|'Count', cal, protein, fiber, carbs, fat, useCustom}`.
  - Seed: `{name, base, unit:'g'|'tbsp'|…, cat}`.
  - `fmtIngQty()` formats both.
- **Seeds:**
  - `GLP1_SEED_RECIPES` has 23 recipes (`glp1-r1`–`glp1-r16`, `custom-r1`–`custom-r7`) with steps, tips, and tags.
  - `QP_SEED_RECIPES` has 11 recipes (`qp-*`), one per non-water quick pick.
  - `PB_SEED_RECIPES` has 4 protein shakes (`pb-*`, tagged `protein-boost`): Core Power 26g, Core Power Elite 42g, Premier Protein 30g, Muscle Milk Pro 40g. Weight is the bottle volume in mL.
  - Other recipe ID prefixes: `usda-<fdcId>` (Search > **Add to Recipes**), `bc-<barcode>` (barcode **Save to Recipe Library**), and timestamps (user recipes).
  - Seeds are added with `ts: 0` when the ID is missing and not tombstoned, so any cloud copy wins.
- **`saveRecipe()`** spreads the existing recipe first, so seed fields survive edits.
  - In bulk mode it keeps the existing ingredient list.
  - The **Steps / Notes** text box round-trips through `composeStepsNotes()` and `parseStepsNotes()`: numbered lines become `steps`, and other lines become `notes`.
- **JSON paste** (`parseRecipePaste`, paste box at the top of the editor) switches to ingredient mode when `ingredients[]` has entries and to bulk mode otherwise. It recognizes `name`, `totalWeight`, `weightUnit`, `total*` macros, `ingredients[]`, `steps[]`, `notes`, `tips`, `tags`, and `servingBase`. Extra fields are held in `pendingRecipeExtras` until you save.
- **Bulk macro fields** are whole-recipe totals, not per-100 g values.
- **AI prompt** (`buildAiPrompt(mode)`): `macros` (default, `isBulk: true`, empty ingredients and steps) or `full`. The prompt asks for per-100 g and full-recipe macros, an adversarial review, rounding to 0.1 g, and the brand's label when a brand is named.

### Quick picks

- `DEFAULT_QUICK_PICKS`: 7-Vanilla, Coffee, Iced Tea, Hard Boiled Egg, Cheese Stick, Nuts, Trail Mix, SK Protein Shake, Banana, Apple, Yogurt. `migrateQuickPicks()` removes a saved "Other" (moved to the Search tab in v9.1).
- `selectQuickItem()` resolves in this order:
  1. A recipe with an exact name match, then a `qp-*` recipe with a substring match, then any recipe with a substring match. The recipe's `totalWeight` sets the default portion.
  1. The `HARDCODED_NUTRITION` table.
  1. Water.
  1. The lookup chain: recipes, then custom items, then USDA.

### USDA

- `USDA_API_KEY` is a personal api.data.gov key (1,000 requests an hour). It's visible in the page source by design.
- `usdaSearch(query, {pageSize, types, signal})` returns normalized items via `usdaItem()`: `{name, fdcId, dataType, servingG, per100}`.
  - The Search tab uses `Branded,Foundation,SR Legacy` with 25 results, debounced 400 ms, and aborts stale requests.
  - **Don't add `Survey (FNDDS)`:** the GET `/foods/search` endpoint returns HTTP 400 for it (verified 2026-09-26). The test harness rejects any other data type with a 400, so a regression fails CI.
  - Ingredient auto-lookup (`lookupUSDANutrition`) uses reference foods only (`Foundation,SR Legacy`).

### Shared helpers (v9.1)

- `esc()` escapes any external or user text that goes into `innerHTML`.
- `localDateStr()` gives the local calendar date. Never use `toISOString()` for dates.
- `weightsByDate()` and `injectionsByDate()` return those entries sorted by date.
- `buildBackup()` and `BACKUP_KEYS` are the single backup builder for export, share, auto-backup, and import.
- `shareOrDownload()` opens the share sheet, or downloads when sharing isn't available.
- `copyText()` copies to the clipboard with a fallback.

## Active features

**Today**

- Rings and bars for water, calories, protein, and fiber.
- **Left today** line (`renderLeftToday`).
- **Close the gap** protein finder (`rankProteinGap`):
  - Candidates are recipes and custom items with protein.
  - Ranked by calories per gram of protein, with no portion cap.
  - Shows grams, a serving count for single-serving items, calories, and fits or over budget. The top 5 are shown.
  - **Log** opens the Search log pane with the grams pre-filled.
- **Try something new** list (`PROTEIN_IDEAS`, typical values). An idea hides once a library item matches its keywords. **Scan to add** opens the barcode scanner.
- **Goals vs Actuals** table for Today, Yesterday, Week, and Month (local dates).
- Weight hero (by date), today's intake list, exercise summary, and the last-injection card.

**Log > Intake**

- Date picker and water buttons (30, 24, 12, and 8 oz).
- Quick-pick grid. The Coffee pick has an optional milk shot.
- Gram and ounce portion fields with a live macro preview.
- **Scan** button: barcode scanner (`BarcodeDetector` plus Open Food Facts) with manual barcode entry.
  - Logs carbs and fat.
  - **Save to Recipe Library** saves one serving as a `bc-<code>` recipe, tagged `scanned`, plus `protein-boost` at 10 g or more protein.
- Today's food list with delete.

**Log > Search** (between Intake and Recipes)

- Live search of your library (recipes and custom items, all terms must match the name or tags) and USDA.
- Tap a result to open the log pane: grams and ounces, date, preview, and **Log Item**.
- USDA results add **Add to Recipes**, which saves the portion entered as a `usda-<fdcId>` recipe.
- **Enter manually:** name, serving grams, and macros, with **Log Item** or **Save to Custom Items**.
- Default portion: one serving for single-serving recipes, a per-serving share of batch recipes, the serving size for custom items, the package serving for USDA results, and otherwise 100 g.

**Log > Recipes**

- Sort by Most Cooked, Highest Rated, or Not Cooked Recently; filter by Vegetarian or Carnivore; search by name or tag with a tag dropdown and tag pills.
- Featured grid and full list.
- Recipe card: tags, full and per-100 g macros, rating, **Cooked This**, and **Log Portion** (grams or ounces, any date).
- Card sections: ingredient checklist with **Copy to grocery list**, steps, notes, tips, and a copyable macro block.

**Recipe editor**

- Paste box and **Copy AI prompt** (**Macros only** or **Full card**) at the top.
- Name and total weight (g or oz input, stored as g).
- Per-ingredient rows with USDA auto-lookup or custom macros, or bulk totals.
- **Steps / Notes** box and a delete button.

**Log > Exercise**

- Type, duration (stepper), steps, and notes; today's log.

**Log > Injection**

- Date and dose (2.5–15 mg). The dose defaults to the last injection by date.
- SVG site diagram with recency coloring and a suggestion for the least recently used site. Click listeners are bound once.
- Injection history.

**Progress**

- **Nutrition:** 7-day averages against goals, and 30-day percent-of-goal bars.
- **Weight:** chart (35 days or 1 year, date-scaled, 7-day average, dose-change markers, and a dashed goal line that is always in range) and weight stats by date.

**History**

- All entries with type filters (All, Weight, Meals, Exercise, Injection), an edit and delete modal, and archived daily summaries.

**Settings**

- Units, weekly injection reminder (fires through `registration.showNotification`, only while the app is open or recently used), and daily goals plus goal weight.
- **Reset Built-in Recipes**, a custom items library, and quick-pick management.
- **Update** check, Cloud Sync (account, sign-out, **Sync Now**), and **Restore Seed Recipes** (restores GLP-1, quick-pick, and shake seeds).
- Data:
  - JSON **Export**, **Share**, and **Import**.
  - **Export daily CSV:** `date,cal,protein,carbs,fat,fiber,water_oz|water_ml,weight_lb|weight_kg,exercise_min,steps,injection_dose,injection_site`, full history.
  - **Export recipes CSV:** totals, per-100 g values, servings, tags, and entry mode.
  - Clipboard summary or full log.

**Background**

- Migrations for water entries, recipe weights, quick picks, entry IDs, and the profile clock.
- 35-day meal archive.
- Full auto-backup every 3 days.
- Service worker, sync queue, and auto full sync.

## Known issues and backlog

**Risks**

- Import restores the backup's keys locally and pushes the profile, but day entries already in the cloud and missing from the backup merge back in on the next pull. It isn't a true cloud overwrite.
- Injection reminders can't fire when the app is closed. A real push reminder needs a server or a scheduled job.

**Smells**

- The weight chart's 7-day average is over the last 7 entries, not 7 calendar days.
- Inline `onclick` handlers throughout. Values passed into them are IDs or indexes, never raw names.

**Data left over from v8**

- Duplicate entries created by past edit and pull cycles remain. Delete them once in History.
- Archive days that were never pushed while signed in can't be repaired from the cloud.

**Declined ideas (don't re-propose)**

- Injection-cycle insights.
- App-icon shortcuts.
- Portion cap and a fiber version of the gap finder.
- Weight pace, projected date, and milestones.
- Splitting `index.html` into multiple files.

## Key technical decisions

- Single file with no build step, deployed through the GitHub contents API so a phone-only session can ship.
- Phone-only sync model: entry-level merges by ID with tombstones, and the profile is last-writer-wins as one unit.
- Merge rules live in the classic script (`buildDayPayload`, `applyCloudDays`, `mergeEntryLists`, `recipeAlive`) so they can be tested without Firestore. `window.Cloud` only does I/O and throws on failure so the queue can retry.
- Recipe weight is always stored in grams. The unit picker is only an input convenience.
- Seeds use `ts: 0` so cloud edits always win over a freshly seeded copy.
- Tests live in `tests/`. The Firebase gstatic URLs route to an in-memory fake, and USDA and Open Food Facts route to fixtures, so no network is needed. v9.1 has 52 checks across the sync and UI suites.
- CI gates deploys: `static.yml` runs `npm test`, and the Pages deploy needs the test job to pass.
- Every bug fix ships with a test.

## Version history

| Version | Changes |
|---------|---------|
| v9.2 | USDA search fix: drop `Survey (FNDDS)` (the API returns 400 for it); the error message shows the status; the fixture validates data types. |
| v9.1 | Search tab, protein gap finder, built-in shakes, barcode **Save to Recipe Library**, goal-weight line, AI prompt helper, CSV exports, dose default, USDA key, CI test gate. Bug fixes 17–22 plus escaping and date ordering. Removed Daily Check-In, Wellness, Drink Presets, the Other quick pick, and dead code. |
| v9.0 | Sync rework (IDs, tombstones, read-merge-write, retry queue, profile LWW, archive repair, weight restore, seed fixes). Recipe edit data-loss fixes. Single `APP_VERSION`. |
| v8.2 | Quick picks read the default portion from the recipe library first. |
| v8.1 | Delete in the recipe editor. JSON paste fills ingredients and steps. |
| v8.0 | JSON blob paste in recipe bulk mode. |
| v7.9 | Fix recipe save wiping others and quick picks reverting. Seed 11 quick-pick recipes. |
| v7.8 | Fix recipe sync loss and profile merge clobber. Settings sign-out. Bidirectional **Sync Now**. |
| v7.6 | 7-Vanilla lookup fix. Food search includes local recipes. |
| v7.5 | Barcode **Add to Meal** fix. |
| v7.4 | Dose-change markers on the weight chart. |
| v7.3 | Quick-pick removal fix. Time-scaled weight chart. |
| v7.2 | Full-history cloud sync. **Sync Now**. |
| v7.1 | Android PWA sign-in fix. |
| v7.0 | Firestore sync and Google sign-in. |
| v6.0 | Quick-pick ordering. |
| v5.7 | Top-5 lookup, Cooked This and Log Portion, injection diagram. |
| v5.5 | Tab navigation restructure. |

## Packaging and deployment

- **Version bump:** update `APP_VERSION` in `index.html`, `version.json`, and `CACHE` in `sw.js` together. All three must match.
- **Deploy from GitHub Desktop:** click **Pull origin** first, commit, then click **Push origin**.
- **Deploy from a Claude session:** git push is blocked by the session proxy, so use `tools/deploy.py`. It uploads every changed file as **one** commit through the Git Data API, which means one CI run.

  ```bash
  git clone https://github.com/birria-corp/ZepTrack.git && cd ZepTrack   # read-only clone works
  # ...make changes, run tests...
  GITHUB_TOKEN=<FINE_GRAINED_PAT> python3 tools/deploy.py "vX.X: <description>"
  ```

  - The fine-grained token is scoped to ZepTrack: Contents read and write, plus Workflows read and write when `.github/workflows/*` changes. It expires 2026-12-24.
  - Don't store the token in this file or in memory; paste it into the session when needed.
  - `--prune` also deletes remote files that are missing locally. It's off by default.
- **Run tests in a Claude session:** `npm install` (or reuse a cached `playwright`), then `PW_CHROMIUM=/opt/pw-browsers/chromium-*/chrome-linux/chrome node tests/run.js`.
- Before an upload, confirm that the remote file matches your base version, so you don't overwrite changes made outside the session.
- Pages deploys through `static.yml` after the tests pass. Check **Actions** for a green run. The site can't be reached from Claude sessions (network policy), so verify on the phone.
- **Package:** `ZepTrack-vX.X.zip` containing all repo files, including the updated `CONTEXT.md`. Deliver it at the end of every version-bump session.

## Standing preferences

- Address the owner as "Doctor".
- Chat replies are terse ("caveman" style). Developer docs, including this file and the README, follow the Google Developer Documentation Style Guide.
- Frame review findings as Bugs / Risks / Smells / Nits. Ask what breaks at the edges and whether you'd approve the change in someone else's PR.
- The owner often asks for recipe macro JSON to import. Default output: full-recipe and per-100 g macros, then an import JSON with `isBulk: true` and empty `ingredients` and `steps` unless the owner asks for them.
- Every repo must contain `index.html`, `version.json`, `README.md`, `CONTEXT.md`, `sw.js`, and `manifest.json`.
- Toasts give feedback for every save, copy, and export action. The update checker compares `APP_VERSION` with `version.json`.
