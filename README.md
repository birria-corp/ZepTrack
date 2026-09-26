# ZepTrack

Personal Zepbound (GLP-1) health tracker. It's an offline-first PWA that syncs to Firestore.

**Live:** https://birria-corp.github.io/ZepTrack

## Features

### Today

- Progress rings and goal bars for water, calories, protein, and fiber.
- **Left today** line: calories, protein, fiber, and water still to go. It turns green when you meet a goal and red when you go over on calories.
- **Close the gap:** ranks your recipes, quick picks, and custom items by how cheaply (in calories) they cover your remaining protein. It shows the portion and calories for each, and **Log** opens that portion ready to log.
  - A **Try something new** list suggests typical high-protein foods that aren't in your library yet, with **Scan to add**.
- **Goals vs Actuals** table for today, yesterday, this week, and this month.
- Latest weight (by date) with change from start, today's intake and exercise, and the last injection with days since.

### Log

- **Intake:** quick-log water buttons (30, 24, 12, and 8 oz) and a configurable quick-pick grid.
  - Quick picks read their default portion from the matching recipe, so editing that recipe's weight changes the button's default.
- **Search:** type to search your recipes, custom items, and USDA FoodData Central at the same time. USDA results include brand-name packaged foods (Branded, Foundation, and SR Legacy data types). Both lists update as you refine the search.
  - Select any result to log it by grams or ounces for any date.
  - USDA results also offer **Add to Recipes**, which saves the item with the portion you entered.
  - **Enter manually** logs an item that no search finds, or saves it to Custom Items.
- **Barcode scan:** scan with the camera or type a barcode. Nutrition comes from Open Food Facts.
  - **Add to Meal** logs it now.
  - **Save to Recipe Library** stores one serving for later. Items with 10 g or more protein per serving are tagged `protein-boost`.
- **Recipes:** sort, filter by diet, and search by name or tag.
  - Recipe cards show full-recipe and per-100 g macros, ratings, cook counts, an ingredient checklist you can copy to a grocery list, steps, notes, and tips.
  - **Log Portion** records a gram or ounce portion for any date.
- **Recipe editor:**
  - Paste a recipe JSON blob or labeled text at the top to fill every field. The editor switches between ingredient and bulk mode to match what you paste.
  - **Copy AI prompt** copies a ready-made prompt for Claude or another assistant. Choose **Macros only** or **Full card**.
  - Enter per-ingredient macros (looked up from USDA or entered by hand), or whole-recipe totals in bulk mode.
- **Exercise:** type, duration, steps, and notes.
- **Injection:** dose (2.5–15 mg) and site, picked on a body diagram.
  - The dose defaults to your last injection's dose.
  - The app suggests the site you used least recently.

### Progress

- 7-day nutrition averages against your goals, and 30-day daily bars for each macro.
- Weight chart on a true date scale (35 days or 1 year) with a 7-day average, dose-change markers, and a dashed goal-weight line.
- Weight stats: total change, percent loss, 7-day and 30-day change, and weekly average.

### History

- Every entry, filterable by type. Tap an entry to edit or delete it.
- Daily summaries for dates older than the 35-day live window.

### Settings

- Units (imperial or metric), daily goals, goal weight, and a weekly injection reminder.
- Quick-pick management (add, remove, and reorder) and a custom items library.
- Built-in recipe tools: reset all built-in recipes to defaults, or restore only the ones you deleted.
- Google sign-in, sign-out, and **Sync Now**.
- Data:
  - JSON backup: export, share, and import.
  - **Export daily CSV:** one row per day for your full history.
  - **Export recipes CSV.**
  - Plain-text copy of a summary or the full log.

### Data and sync

- Works offline. Every change goes into a sync queue that retries when the app regains a connection or returns to the foreground.
- Edits and deletes sync reliably: entries have stable IDs, and deletes leave tombstones.
- Ratings, cook counts, and last-cooked dates sync with your profile.
- A new device or reinstall restores everything from the cloud after sign-in.
- Meals older than 35 days roll into daily summaries.
- The app downloads a full JSON backup every 3 days.
- The recipe library includes 23 built-in recipes, 11 quick-pick recipes, and 4 protein shakes. Your edits to them sync, and deleted ones stay deleted.

## File structure

```
index.html            Single-file app: all CSS and JS inline, including the Firebase module
sw.js                 Service worker: network-first for index.html and version.json, cache-first otherwise
manifest.json         PWA manifest
version.json          {"version": "9.2"}; the Update button in Settings compares it with APP_VERSION
icon-192.png          PWA icon
icon-512.png          PWA icon
README.md             This file
CONTEXT.md            Session context for resuming work in Claude
package.json          Test tooling only (Playwright); the app has no build step
tests/                Automated tests: fake Firebase, sync suite, UI suite, runner
tools/deploy.py       One-commit deploy through the GitHub API (for sessions without git push)
.github/workflows/static.yml   Runs the tests on every push to main, then deploys to Pages only if they pass
```

## Update workflow

1. In GitHub Desktop, click **Pull origin**.
1. Make your changes. If you fix a bug, add a test for it in `tests/`.
1. Bump the version in all three places:
   - `APP_VERSION` in `index.html`
   - `version.json`
   - `CACHE` in `sw.js` (for example, `zeptrack-v9.2`)
1. Optional: to run the tests locally, run `npm install`, then `npx playwright install chromium`, then `npm test`.
1. Commit with the version and a short description, for example `v9.1: search tab`.
1. Click **Push origin**.
1. Open the repo's **Actions** tab:
   - A green check means the tests passed and the site deployed, about 3 minutes after the push.
   - A red X means a test failed, and the previous version stays live.
1. On the phone, open **Settings > App Update > Update**, or reload the app.

**Emergency deploy:** if a broken *test* (not the app) is blocking a release, open **Actions > Test and deploy to Pages > Run workflow**, select **skip_tests**, and run it.

## Version history

| Version | Changes |
|---------|---------|
| v9.2 | Fix USDA search returning "USDA search failed" for every query. The API rejects the `Survey (FNDDS)` data type in search requests, so the app now searches Branded, Foundation, and SR Legacy foods. The search error message now includes the HTTP status. The test fixture now rejects invalid data types the same way the real API does. |
| v9.1 | **Search** tab (library and all USDA data types, live refine, log pane, **Add to Recipes**, manual entry). **Left today** line and protein gap finder. Four built-in protein shakes. **Save to Recipe Library** from barcode scans. Goal weight with a chart line. **Copy AI prompt** and an always-visible paste box in the recipe editor. Daily and recipes CSV exports. Injection dose defaults to the last dose. Personal USDA API key. Tests run in CI and gate deploys. Fixes: steppers, local dates after 7 PM, NaN preview, complete backups, rating and cook-count sync, Android reminders, scanned carbs and fat, escaped external text, and weights and injections ordered by date. Removes Daily Check-In, the Wellness tab, Drink Presets, the Other quick pick, and dead code. |
| v9.0 | Sync rework: stable entry IDs, delete tombstones, read-merge-write day pushes, a durable retry queue, and last-writer-wins profile sync. Fixes edits duplicating and deletes reappearing after sync, archive totals doubling, weights not restoring, seed recipes overwriting cloud edits, and deleted seeds reappearing. Recipe edits keep steps, tags, tips, and ingredient lists. Ounce weights no longer compound. Imported steps show on the recipe card. A single `APP_VERSION` drives the header and update check. |
| v8.2 | Quick picks read their default portion from the recipe library before the hardcoded table. |
| v8.1 | Delete button in the recipe editor. JSON paste now fills ingredients and steps. |
| v8.0 | JSON blob paste in recipe bulk mode. |
| v7.9 | Fix recipe save wiping other recipes and quick-pick edits reverting. Seed 11 quick-pick recipes. |
| v7.8 | Fix recipe sync loss and profile merge clobbering. Add sign-out in Settings and bidirectional **Sync Now**. |
| v7.6 | Fix 7-Vanilla quick-pick lookup. Food search returns local recipes and quick picks. |
| v7.5 | Fix barcode **Add to Meal**. |
| v7.4 | Dose-change injection markers on the weight chart. |
| v7.3 | Fix quick-pick removals persisting. Time-scaled weight chart with a 35-day and 1-year toggle. |
| v7.2 | Full-history cloud sync (35-day archive). **Sync Now** in Settings. |
| v7.1 | Fix Google sign-in in the Android PWA and a Firebase module syntax error. |
| v7.0 | Firestore cloud sync, Google sign-in, and offline-first merge. |
| v6.0 | Quick-pick ordering in Settings. |
| v5.7 | Top-5 lookup UI, separate **Cooked This** and **Log Portion** actions, and the anatomical injection diagram. |
| v5.5 | Navigation restructured into Intake, Recipes, Exercise, and Injection tabs. |
