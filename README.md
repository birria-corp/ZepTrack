# ZepTrack

Personal Zepbound (GLP-1) health tracker. It's an offline-first PWA that syncs to Firestore.

**Live:** https://birria-corp.github.io/ZepTrack

## Features

### Today

- Progress rings and goal bars for water, calories, protein, and fiber.
- **Goals vs Actuals** table for today, yesterday, this week, and this month.
- Latest weight with change from start, today's intake and exercise, and the last injection with days since.

### Log

- **Intake:** quick-log water buttons (30, 24, 12, and 8 oz) and a configurable quick-pick grid.
  - Quick picks read their default portion from the matching recipe, so editing that recipe's weight changes the button's default.
  - Custom items resolve from the recipe library first, then the custom items library, then USDA FoodData Central.
- **Food search:** search USDA FoodData Central and choose a serving size.
- **Barcode scan:** scan with the camera or type a barcode. Nutrition comes from Open Food Facts.
- **Recipes:** sort, filter by diet, and search by name or tag.
  - Recipe cards show full-recipe and per-100 g macros, ratings, cook counts, an ingredient checklist you can copy to a grocery list, steps, notes, and tips.
  - **Log Portion** records a gram or ounce portion for any date.
- **Recipe editor:** enter per-ingredient macros (looked up from USDA or entered by hand), or enter whole-recipe totals in bulk mode.
  - In bulk mode you can paste a ZepTrack recipe JSON blob to fill every field, including ingredients, steps, tags, and tips.
- **Exercise:** type, duration, steps, and notes.
- **Injection:** dose (2.5–15 mg) and site, picked on a body diagram. The app suggests the site you used least recently.

### Progress

- 7-day nutrition averages against your goals, and 30-day daily bars for each macro.
- Weight chart on a true date scale (35 days or 1 year) with a 7-day average and dose-change markers.
- Weight stats: total change, percent loss, 7-day and 30-day change, and weekly average.

### History

- Every entry, filterable by type. Tap an entry to edit or delete it.
- Daily summaries for dates older than the 35-day live window.

### Settings

- Units (imperial or metric), daily goals, and a weekly injection reminder.
- Quick-pick management (add, remove, and reorder) and a custom items library.
- Built-in recipe tools: reset all built-in recipes to defaults, or restore only the ones you deleted.
- Google sign-in, sign-out, and **Sync Now**.
- JSON export, share, and import, plus a plain-text copy of a summary or the full log.

### Data and sync

- Works offline. Every change goes into a sync queue that retries when the app regains a connection or returns to the foreground.
- Edits and deletes sync reliably: entries have stable IDs, and deletes leave tombstones.
- A new device or reinstall restores everything from the cloud after sign-in.
- Meals older than 35 days roll into daily summaries.
- The app downloads a JSON backup every 3 days.
- The recipe library includes 23 built-in recipes and 11 quick-pick recipes. Your edits to them sync, and deleted ones stay deleted.

## File structure

```
index.html      Single-file app: all CSS and JS inline, including the Firebase module
sw.js           Service worker: network-first for index.html and version.json, cache-first otherwise
manifest.json   PWA manifest
version.json    {"version": "9.0"}; the Update button in Settings compares it with APP_VERSION
icon-192.png    PWA icon
icon-512.png    PWA icon
README.md       This file
CONTEXT.md      Session context for resuming work in Claude
.github/workflows/static.yml   GitHub Pages deploy on every push to main
```

## Update workflow

1. In GitHub Desktop, click **Pull origin**.
1. Bump the version in all three places:
   - `APP_VERSION` in `index.html`
   - `version.json`
   - `CACHE` in `sw.js` (for example, `zeptrack-v9.0`)
1. Replace the changed files in the local repo folder.
1. Commit with the version and a short description, for example `v9.0: fix sync data integrity`.
1. Click **Push origin**. GitHub Pages redeploys in about a minute.
1. On the phone, open **Settings > App Update > Update**, or reload the app.

## Version history

| Version | Changes |
|---------|---------|
| v9.0 | Sync rework: stable entry IDs, delete tombstones, read-merge-write day pushes, a durable retry queue, and last-writer-wins profile sync. Fixes edits duplicating and deletes reappearing after sync, archive totals doubling, weights not restoring, seed recipes overwriting cloud edits, and deleted seeds reappearing. Recipe edits keep steps, tags, tips, and ingredient lists. Ounce weights no longer compound. Imported steps show on the recipe card. A single `APP_VERSION` drives the header and update check. |
| v8.2 | Quick picks read their default portion from the recipe library before the hardcoded table. |
| v8.1 | Delete button in the recipe editor. JSON paste now fills ingredients and steps. |
| v8.0 | JSON blob paste in recipe bulk mode. |
| v7.9 | Fix recipe save wiping other recipes and quick-pick edits reverting. Seed 11 quick-pick recipes. |
| v7.8 | Fix recipe sync loss and profile merge clobbering. Add sign-out in Settings and bidirectional Sync Now. |
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
