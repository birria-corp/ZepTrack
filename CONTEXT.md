# ZepTrack: session context

Paste this file as the first message of a new Claude session to resume work without re-explaining anything.

## Project

| Field | Value |
|---|---|
| Name | ZepTrack |
| Repo | https://github.com/birria-corp/ZepTrack |
| Live | https://birria-corp.github.io/ZepTrack |
| Current version | 9.0 (2026-09-25) |
| Stack | Single-file HTML PWA (vanilla JS, inline CSS), Firebase Auth (Google) and Cloud Firestore through the web SDK 10.12.2 from gstatic, hosted on GitHub Pages |
| Firebase project | `zeptrack-f8720`, shared with the Truthsayer app's `segments` collection |
| Devices | Phone only (Android PWA). Sync is built for one active device plus restore on reinstall. |
| Owner | Doctor |

## File structure

```
index.html      ~7,400 lines. Two script blocks:
                  <script type="module">  Firebase init, window.Cloud, onAuthStateChanged
                  <script>                everything else (DB, sync helpers, UI, seeds, init)
sw.js           Service worker. CACHE = 'zeptrack-v9.0'. Network-first for index.html,
                version.json, and sw.js; cache-first for everything else; deletes old caches
                on activate.
manifest.json   PWA manifest (start_url ./index.html, standalone, portrait)
version.json    {"version":"9.0"}
icon-192.png, icon-512.png
README.md       User-facing overview, update workflow, and version history
CONTEXT.md      This file
.github/workflows/static.yml   Deploys the whole repo to Pages on every push to main
```

## Architecture

### Local storage

All keys use the `zep_` prefix and are accessed through `DB.get`, `DB.set`, and `DB.push`. The module script uses `window._DB_RAW` and `window._DB_SET`.

| Key | Contents |
|---|---|
| `meals`, `exercise`, `injections`, `daily`, `weights` | Entry arrays (`ENTRY_KEYS`). Every entry has `id`, `ts`, and `date`, and gets `updatedAt` when edited. |
| `recipes` | Recipe array (schema below) |
| `quickPicks`, `quickPicksSeeded` | Quick-pick button names, plus the defaults already offered, so removed defaults don't return |
| `customItems`, `drinkPresets`, `goals`, `units` | Profile data |
| `daily_archive` | `{date: {cal, protein, carbs, fat, fiber, water}}` for meals older than 35 days |
| `recipeRatings`, `recipeCooks`, `recipeLastCooked` | Per-recipe maps. **Local only: not synced and not included in backups.** |
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
                                 deletedRecipes: {id: ms}, updatedAt}
users/{uid}/recipes/{id}        one document per recipe (+ syncedAt)
users/{uid}/archive/{date}      daily summaries for dates older than 35 days
segments/{segmentId}            Truthsayer app (public read, owner-only write). Not ZepTrack data.
```

Security rules, verified 2026-09-25: `users/{userId}/{document=**}` allows read and write only when `request.auth.uid == userId`. There's no catch-all rule.

### Sync design (v9.0)

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
  - Seeds are added with `ts: 0` when the ID is missing and not tombstoned, so any cloud copy wins.
- **`saveRecipe()`** spreads the existing recipe first, so seed fields survive edits.
  - In bulk mode it keeps the existing ingredient list.
  - The **Steps / Notes** text box round-trips through `composeStepsNotes()` and `parseStepsNotes()`: numbered lines become `steps`, and other lines become `notes`.
- **JSON paste** (`parseRecipePaste`) recognizes `name`, `totalWeight`, `weightUnit`, `total*` macros, `ingredients[]`, `steps[]`, `notes`, `tips`, `tags`, and `servingBase`. Extra fields are held in `pendingRecipeExtras` until you save.
- **Bulk macro fields** are whole-recipe totals, not per-100 g values.

### Quick picks

- `DEFAULT_QUICK_PICKS`: 7-Vanilla, Coffee, Iced Tea, Hard Boiled Egg, Cheese Stick, Nuts, Trail Mix, SK Protein Shake, Banana, Apple, Yogurt, Other.
- `selectQuickItem()` resolves in this order:
  1. A recipe with an exact name match, then a `qp-*` recipe with a substring match, then any recipe with a substring match. The recipe's `totalWeight` sets the default portion.
  1. The `HARDCODED_NUTRITION` table.
  1. Water.
  1. The lookup chain: recipes, then custom items, then USDA.

## Active features

**Today**

- Rings and bars for water, calories, protein, and fiber.
- **Goals vs Actuals** table for Today, Yesterday, Week, and Month.
- Weight hero, today's intake list, exercise summary, and the last-injection card.

**Log > Intake**

- Date picker and water buttons (30, 24, 12, and 8 oz).
- Quick-pick grid. The Coffee pick has an optional milk shot.
- Custom item lookup: the top five matches from recipes, custom items, and USDA, or manual entry with **Save to Library**.
- Gram and ounce portion fields with a live macro preview.
- USDA food search with serving picker.
- Barcode scanner (`BarcodeDetector` plus Open Food Facts) with manual barcode entry.
- Today's food list with delete.

**Log > Recipes**

- Sort by Most Cooked, Highest Rated, or Not Cooked Recently; filter by Vegetarian or Carnivore; search by name or tag with a tag dropdown and tag pills.
- Featured grid and full list.
- Recipe card: tags, full and per-100 g macros, rating, **Cooked This**, and **Log Portion** (grams or ounces, any date).
- Card sections: ingredient checklist with **Copy to grocery list**, steps, notes, tips, and a copyable macro block.

**Recipe editor**

- Name, total weight (g or oz input, stored as g).
- Per-ingredient rows with USDA auto-lookup or custom macros.
- Bulk mode with a paste parser (JSON or free text).
- **Steps / Notes** box and a delete button.

**Log > Exercise**

- Type, duration, steps, and notes; today's log.

**Log > Injection**

- Date and dose (2.5–15 mg).
- SVG site diagram with recency coloring and a suggestion for the least recently used site.
- Injection history.

**Progress**

- 7-day averages against goals, and 30-day percent-of-goal bars for water, calories, protein, and fiber.
- Weight chart (35 days or 1 year, date-scaled, 7-day average, dose-change markers) and weight stats.
- Wellness chart (energy and mood) and side-effect frequency.

**History**

- All entries with type filters, an edit and delete modal, and archived daily summaries.

**Settings**

- Units, weekly injection reminder, and daily goals (calories, protein, fiber, water, and steps).
- **Reset Built-in Recipes**, a custom items library (add, edit, delete), and quick-pick management (add, remove, reorder).
- **Update** check, Cloud Sync (account, sign-out, **Sync Now**), **Restore Seed Recipes**.
- **Export**, **Share**, and **Import** JSON, and a clipboard copy of the summary or full log.

**Background**

- Migrations for water entries, recipe weights, quick picks, entry IDs, and the profile clock.
- 35-day meal archive.
- Auto-backup download every 3 days.
- Service worker, sync queue, and auto full sync.

## Known issues (v9.1 backlog)

**Bugs**

- 17: The **Yesterday** and **Week** summary tabs use UTC dates (`toISOString`). After 7 PM Central, **Yesterday** shows today.
- 18: `step()` calls an undefined `updateMealTotals()`. The +/− steppers throw, and the food search quantity stepper logs stale macros.
- 19: Auto-backup leaves out `daily_archive`. No backup or sync includes ratings, cook counts, or last-cooked dates.
- 20: `applyLookupResult()` drops `servingG`, so user-added quick picks that resolve through USDA show `NaN` in the preview.
- 21: `new Notification()` fails on Android (it needs `registration.showNotification`). Reminders only fire while the app is open.
- 22: The Daily Check-In (`tab-daily`) and Drink Presets UIs have no entry point, so the Wellness data is always empty.

**Risks**

- USDA lookups use `DEMO_KEY`, which is rate-limited to about 30 requests an hour.
- External text from USDA and Open Food Facts is inserted as raw HTML (`innerHTML`).
- Import doesn't push to the cloud and isn't a true overwrite once the app syncs.

**Smells**

- Dead code: the old recipe list and card (`renderRecipesList`, `openRecipeCard`, `renderRecipeSelect`, `logRecipePortion`, `logCardPortion`, `cookedThisRecipe`).
- "Latest weight" and "last injection" use insertion order instead of date.
- `initRotationDiagram()` adds a new click listener each time the Injection tab opens.

**Data left over from v8**

- Duplicate entries created by past edit and pull cycles remain. Delete them once in History.
- Archive days that were never pushed while signed in can't be repaired from the cloud.

## Key technical decisions

- Single file with no build step, deployed through the GitHub contents API so a phone-only session can ship.
- Phone-only sync model: entry-level merges by ID with tombstones, and the profile is last-writer-wins as one unit.
- Merge rules live in the classic script (`buildDayPayload`, `applyCloudDays`, `mergeEntryLists`, `recipeAlive`) so they can be tested without Firestore. `window.Cloud` only does I/O and throws on failure so the queue can retry.
- Recipe weight is always stored in grams. The unit picker is only an input convenience.
- Seeds use `ts: 0` so cloud edits always win over a freshly seeded copy.
- Tested with Playwright by routing the gstatic Firebase URLs to an in-memory fake Firestore stored in `localStorage` under `FAKE_FS`. The v9.0 suite covers 22 cases: edit, delete, archive, weight restore, recipe edits, offline queue, profile, date move, and legacy upgrade. The suite isn't in the repo yet.

## Version history

| Version | Changes |
|---------|---------|
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
- **Deploy from a Claude session:** git push is blocked by the session proxy, so use the contents API. The fine-grained token is scoped to ZepTrack (Contents read and write) and expires 2026-12-24. Don't store the token in this file; paste it into the session when needed.

  ```bash
  python3 - <<'PYEOF'
  import json, base64, subprocess
  TOKEN = '<FINE_GRAINED_PAT>'
  API = 'https://api.github.com/repos/birria-corp/ZepTrack/contents/'
  def sha(f):
      r = subprocess.run(['curl','-s','--noproxy','api.github.com','-H',f'Authorization: Bearer {TOKEN}',API+f],
                         capture_output=True, text=True)
      return json.loads(r.stdout)['sha']
  for f in ['index.html', 'sw.js', 'version.json']:
      body = {'message': 'vX.X: <description>', 'sha': sha(f),
              'content': base64.b64encode(open(f,'rb').read()).decode()}
      open('/tmp/p.json','w').write(json.dumps(body))
      out = subprocess.run(['curl','-s','--noproxy','api.github.com','-X','PUT',
            '-H',f'Authorization: Bearer {TOKEN}','--data-binary','@/tmp/p.json',API+f],
            capture_output=True, text=True).stdout
      print(f, json.loads(out).get('commit',{}).get('sha','ERROR')[:10])
  PYEOF
  ```

- Before an upload, confirm that the remote file matches your base version, so you don't overwrite changes made outside the session.
- Pages deploys through `static.yml`. Check **Actions** for a green run.
- **Package:** `ZepTrack-vX.X.zip` containing all repo files, including the updated `CONTEXT.md`. Deliver it at the end of every version-bump session.

## Standing preferences

- Address the owner as "Doctor".
- Chat replies are terse ("caveman" style). Developer docs, including this file and the README, follow the Google Developer Documentation Style Guide.
- Frame review findings as Bugs / Risks / Smells / Nits. Ask what breaks at the edges and whether you'd approve the change in someone else's PR.
- The owner often asks for recipe macro JSON to import. Default output: full-recipe and per-100 g macros, then an import JSON with `isBulk: true` and empty `ingredients` and `steps` unless the owner asks for them.
- Every repo must contain `index.html`, `version.json`, `README.md`, `CONTEXT.md`, `sw.js`, and `manifest.json`.
- Toasts give feedback for every save, copy, and export action. The update checker compares `APP_VERSION` with `version.json`.
