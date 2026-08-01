# ZepTrack

> A personal health tracker built for Zepbound (tirzepatide) and GLP-1 medication users. Tracks weight, nutrition, water, exercise, injections, and wellness — installable as a mobile PWA, runs entirely in your browser with no server or account required.

**Live app:** `https://spencer-thompson-2-vu.github.io/ZepTrack`  
**Current version:** v5.2  
**Platform:** Android Chrome (PWA), any modern browser

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [File Structure](#file-structure)
- [Data Storage](#data-storage)
- [External APIs](#external-apis)
- [Installing on Android](#installing-on-android)
- [Updating the App](#updating-the-app)
- [Configuration & Goals](#configuration--goals)
- [Nutrition Tracking Logic](#nutrition-tracking-logic)
- [Recipe System](#recipe-system)
- [Unit Conversion Reference](#unit-conversion-reference)
- [Version History](#version-history)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Developer Notes](#developer-notes)

---

## Overview

ZepTrack is a single-file Progressive Web App. All application logic, styles, and markup live in `index.html`. There is no build step, no framework, no backend — just HTML, CSS, and vanilla JavaScript served via GitHub Pages.

All user data is stored in the browser's `localStorage` on the device. Nothing leaves the device unless the user explicitly exports a backup JSON file.

---

## Features

### Today Dashboard
- Progress rings and bars for Water, Calories, Protein, and Fiber vs daily goals
- Goals vs Actuals table with Today / Yesterday / Week / Month tabs
- Weight display with delta from starting weight
- Today's Intake grouped by meal type (Drinks, Breakfast, Lunch, Dinner, Snacks)
- Colored nutrition chips per entry (water in sky blue, calories in blue, protein in purple, fiber in green)
- Exercise summary
- Last injection badge with days-since indicator

### Intake Logging
- **Water buttons** — four one-tap buttons (30 / 24 / 12 / 8 oz) at top of food log
- **Quick-pick grid** — hardcoded items with confirmed nutrition (Coffee, Iced Tea, SK Protein Shake, Hard Boiled Egg, Cheese Stick, Nuts, Trail Mix, Banana, Apple, Yogurt)
- **Gram/OZ dual input** — enter portion in either unit; fields sync automatically
- **Coffee + milk option** — checkbox adds 1oz whole milk (19 cal, 1g fat, 1.5g carb, 1g protein)
- **Food search** — USDA FoodData Central database with common serving sizes
- **Barcode scan** — Open Food Facts API via device camera
- **Other / custom items** — three-tier lookup: Recipe Library → Custom Items Library → USDA → manual entry
- **Drink presets** — saved drinks with volume, additions, nutrition, optional water-goal contribution

### Recipe Library (enhanced in v4.8)
- **Recipe cards** — tap any recipe to open a full card: macro pills (per 100g), step-by-step instructions, GLP-1 tips, star rating (1–5), cook count tracker
- **One-tap macro copy** — "📋 Copy for ZepTrack" copies the standard macro block to clipboard
- **Search/filter** — search by name or tag
- **Tags** — glp1-friendly, high-protein, high-fiber, no-cook, meal-prep, quick, one-pan
- **5 GLP-1 seed recipes** pre-loaded: Grilled Salmon + Lentil Tabbouleh, Turkey-Stuffed Bell Peppers, Shrimp + Edamame Stir-Fry, White Bean + Tuna Salad, Spiced Chickpea + Chicken Thigh Skillet
- **Gram/OZ dual input** for portion logging
- **Bulk entry + paste parser** — paste free-form text from another AI; app extracts name and macros automatically
- **Per-ingredient USDA builder** with Use Custom override per ingredient

### Injection Tracker
- Log dose (2.5mg–15mg), date, injection site
- Body diagram with 8 zones: abdomen (UL/UR/LL/LR), thigh (L/R), arm (L/R)
- Color-coded rotation history on diagram
- Auto-suggests next site in rotation sequence
- Weekly push notification reminder

### Progress
- **Nutrition tab** (default): 7-day averages vs goals + 30-day individual bar charts per macro (Water, Calories, Protein, Fiber) synced to 0–120% Y-axis
- **Weight tab**: chart with actual + 7-day rolling average; stats including % total loss, % change last 7d and 30d
- **Wellness tab**: energy/mood 14-day chart, side effect frequency table

### History
- Full log filterable by type
- Tap any entry to edit — includes Grams/OZ volume fields for meals
- Delete from within edit modal

### Settings
- Imperial / Metric toggle
- Customizable daily goals
- Custom Items Library
- Quick-Pick list manager
- Injection reminder (weekly push notification)
- **Check for Update** — fetches `version.json` from GitHub, clears cache and reloads if newer
- **Auto-backup** — downloads JSON automatically if no backup in 3+ days
- Export / Import JSON backup
- Copy to clipboard (Summary or Full Log)

---

## Architecture

```
Single HTML file (index.html)
├── CSS — custom properties, mobile-first layout
├── HTML — all views rendered at once, toggled via display:none
└── JavaScript — vanilla ES2020, no frameworks
    ├── Storage layer (DB object → localStorage with zep_ prefix)
    ├── Navigation (showView, showLogTab, showIntakeSubtab, showProgressTab)
    ├── Today dashboard (renderToday, renderSummaryTable, updateWaterDisplay)
    ├── Intake (saveQuickLog, addWater, logWaterQuick, logDrink, logRecipePortion)
    ├── Lookup chain (resolveItemNutrition → Recipe Library → Custom Items → USDA)
    ├── Recipe system (recipe card view, USDA builder, bulk/paste parser, GLP-1 seeds)
    ├── Injection tracker (initRotationDiagram, saveInjection, scheduleReminders)
    ├── Progress charts (drawLineChart, drawBarChart, drawWeightChart, renderNutritionProgress)
    ├── History (renderHistory, openEntryEdit, saveEntryEdit)
    └── Settings (initSettings, setUnits, saveGoals, exportData, importFromJSON, checkForUpdate, checkAutoBackup)

Supporting files
├── sw.js         — Service worker (network-first for index.html + version.json)
├── manifest.json — PWA manifest
├── version.json  — { "version": "5.1" } — read by checkForUpdate
├── icon-192.png  — PWA icon
└── icon-512.png  — PWA icon
```

---

## File Structure

```
/
├── index.html       ← Entire application
├── manifest.json    ← PWA metadata
├── sw.js            ← Service worker
├── version.json     ← Current version string
├── icon-192.png     ← App icon
└── icon-512.png     ← App icon (large)
```

---

## Data Storage

All data lives in `localStorage` under the prefix `zep_`:

| Key | Type | Contents |
|-----|------|---------|
| `zep_meals` | Array | Food and drink entries |
| `zep_weights` | Array | `{ date, weight, notes, ts }` — weight in lbs |
| `zep_exercise` | Array | `{ date, type, duration, steps, notes, ts }` |
| `zep_daily` | Array | `{ date, water, energy, mood, sideEffects, notes, ts }` |
| `zep_injections` | Array | `{ date, dose, site, notes, ts }` |
| `zep_recipes` | Array | Recipe objects with totalWeight always in grams |
| `zep_drinkPresets` | Array | Saved drink presets |
| `zep_customItems` | Array | Custom food items library |
| `zep_quickPicks` | Array | Quick-pick grid item names |
| `zep_goals` | Object | `{ calories, protein, fiber, water, steps }` |
| `zep_units` | String | `'imperial'` or `'metric'` |
| `zep_reminder` | Object | `{ enabled, day, time }` |
| `zep_recipeRatings` | Object | `{ recipeId: starRating }` |
| `zep_recipeCooks` | Object | `{ recipeId: cookCount }` |
| `zep_lastBackupDate` | String | Date of last JSON export |

### Meal entry schema
```json
{
  "date": "2026-07-30",
  "mealType": "breakfast",
  "type": "food",
  "items": [{ "name": "Apple (172 Grams)", "cal": 98, "protein": 0.43, "carbs": 23.5, "fat": 0, "fiber": 4 }],
  "cal": 98, "protein": 0.43, "carbs": 23.5, "fat": 0, "fiber": 4,
  "quantity": 172, "unit": "Grams",
  "ts": 1753401600000
}
```

### Recipe schema
```json
{
  "id": "glp1-r1",
  "name": "Grilled Salmon with Lentil Tabbouleh",
  "totalWeight": 480,
  "weightUnit": "g",
  "totalCal": 552, "totalProtein": 39.4,
  "totalCarbs": 43.7, "totalFat": 25.4, "totalFiber": 10.1,
  "isBulk": true,
  "steps": ["..."],
  "tips": "...",
  "tags": ["glp1-friendly", "high-protein"],
  "ts": 1753401600000
}
```

`totalWeight` always stored in grams. Recipes entered as per-100g (totalWeight=100) work correctly — portioning math is `factor = portionGrams / totalWeight`.

---

## External APIs

| API | Purpose | Auth | Rate limit |
|-----|---------|------|-----------|
| USDA FoodData Central | Food search + ingredient lookup | `DEMO_KEY` | 30 req/hour/IP |
| Open Food Facts | Barcode lookup | None | Fair use |
| Google Fonts | Typography (Inter, DM Mono) | None | None |

> Register a free USDA API key at [api.data.gov/signup](https://api.data.gov/signup) and replace `DEMO_KEY` in `lookupUSDANutrition()` to remove the rate limit.

---

## Installing on Android

1. Open **Chrome** on your Android phone
2. Navigate to `https://spencer-thompson-2-vu.github.io/ZepTrack`
3. Tap ⋮ → **Add to Home screen** → **Add**

---

## Updating the App

### For users
Settings → **App Update** → tap **Update** — fetches `version.json`, clears cache and reloads if newer version found.

### For developers
1. Edit `index.html`
2. Bump version in three places: header display string, `localVersion` in `checkForUpdate()`, and `version.json`
3. Push `index.html` + `version.json` (+ `README.md`) to GitHub
4. Users tap Update in Settings

---

## Configuration & Goals

| Metric | Default | GLP-1 Notes |
|--------|---------|-------------|
| Calories | 1,600 | Per provider guidance |
| Protein | 130g | 1–1.6g × goal body weight in lbs |
| Fiber | 25g | Higher fiber helps with GI side effects |
| Water | 125 oz | — |
| Steps | 8,000 | — |

---

## Nutrition Tracking Logic

### Water
Water stored exclusively as drink meal entries (`type:'drink'`, `cal:0`). Summed from `quantity` field on entries whose name includes "water". The `daily` record stores only explicit check-in submissions (energy, mood, side effects).

### USDA nutrition scaling
```
factor = portionGrams / 100
nutrientAmount = per100gValue × factor
```

### Recipe portion scaling
`totalWeight` always in grams. Portion entered in display unit:
```
portionGrams = portionOz × 28.3495   (imperial)
factor = portionGrams / recipe.totalWeight
nutrientAmount = recipeTotalNutrient × factor
```

### Hardcoded quick-pick nutrition

| Item | Serving | Cal | Pro | Carb | Fat | Fiber |
|------|---------|-----|-----|------|-----|-------|
| Coffee | 237g (8oz) | 2 | 0.28g | 0 | 0.05g | 0 |
| Iced Tea | 355g (12oz) | 0 | 0 | 0 | 0 | 0 |
| SK Protein Shake | 360g (12oz) | 400 | 31g | 46g | 13g | 11.9g |
| Hard Boiled Egg | 79g | 122 | 9.95g | 0.88g | 8.37g | 0 |
| Cheese Stick | 28g (1oz) | 80 | 6g | 0 | 6g | 0 |
| Nuts | 71g (2.5oz) | 422 | 12.3g | 18g | 36.5g | 5g |
| Trail Mix | 71g (2.5oz) | 280 | 7g | 28g | 4.5g | 3g |
| Banana | 118g | 105 | 1.3g | 27g | 0.4g | 3.1g |
| Apple | 172g | 98 | 0.43g | 23.5g | 0 | 4g |
| Yogurt | 170g (6oz) | 100 | 17g | 6g | 0 | 0 |
| Whole milk shot | 29.5g (1oz) | 19 | 1g | 1.5g | 1g | 0 |

---

## Recipe System

### Entering a recipe

**Option A — Per-ingredient (USDA auto-lookup)**
Type ingredient name → tab away → USDA fetches per-100g → enter quantity/unit → app scales. Check **Use Custom** to override with manual values per ingredient.

**Option B — Bulk entry with paste parser**
Check "Enter total nutrition directly" → paste text → app extracts name and all five macros.

Expected paste format:
```
Recipe Name: [name]
Per 100g:
Calories: [number]
Protein: [number]g
Carbs: [number]g
Fat: [number]g
Fiber: [number]g
```

### Recipe Card view
Tap any recipe in the library to open its card: numbered steps, GLP-1 tip, per-100g macro pills, star rating, cook count, and a one-tap "📋 Copy for ZepTrack" button.

---

## Unit Conversion Reference

| Input | Stored as | Imperial display | Metric display |
|-------|-----------|-----------------|----------------|
| Weight | lbs | lbs | kg |
| Water | oz (in meal entries) | oz | ml |
| Food portions | grams | oz or g | g |
| Recipe weight | grams | oz or g | g |

---

## Version History

| Version | Key changes |
|---------|-------------|
| v5.2 | Fix recipe portion logging bug (grams field sync failure on mobile), Share Backup button |
| v5.1 | Stable release — Recipe app folded in, GLP-1 seed recipes, auto-backup |
| v4.8 | Recipe card view, 5 GLP-1 seed recipes, star ratings, cook count, macro copy, auto-backup |
| v4.7 | Four water quick-buttons (30/24/12/8 oz), Water removed from quick-pick grid |
| v4.6 | History edit volume fields, weight display resized, recipe paste parser |
| v4.5 | Confirmed hardcoded nutrition for all quick-pick items, Coffee+milk, gram/oz dual input |
| v4.3 | version.json update system — reliable Check for Update |
| v4.2 | Water no longer creates Wellness check-in entries in History |
| v4.1 | Critical fix: today() uses local date not UTC |
| v4.0 | Major rebuild — hardcoded quick-pick nutrition, paste parser, recipe unit fix |
| v3.8 | 30-day bar charts, weight % stats, recipe bulk entry, gram/oz dual input |
| v3.5 | Network-first service worker, Check for Update |
| v3.0 | Intake redesign, drink presets, quick-pick list, USDA recipe builder, JSON export/import |
| v2.0 | Barcode scan, food search, recipe builder, Imperial/Metric toggle |
| v1.0 | Initial PWA — weight, meals, exercise, injection, daily check-in |

---

## Known Limitations

- **No cross-device sync** — localStorage is per-device
- **No automatic cloud backup** — export JSON manually or rely on 3-day auto-backup
- **USDA rate limit** — 30 req/hour with DEMO_KEY
- **BarcodeDetector** — Chrome on Android only
- **Push notifications** — require PWA install

---

## Roadmap

- [ ] Import restore UI with merge option (currently overwrites)
- [ ] BMI tracker
- [ ] Body measurements with trend chart
- [ ] Progress photos
- [ ] Calendar view
- [ ] Provider export (one-page formatted summary)
- [ ] USDA API key setting
- [ ] Estimated tirzepatide medication level curve

---

## Developer Notes

### Adding a new quick-pick item
Add to `HARDCODED_NUTRITION` in `index.html`:
```javascript
'item name': {
  label: 'Display Name',
  servingG: 100, defaultQtyOz: 3.5, defaultQtyG: 100,
  cal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
  type: 'food'
},
```

### Bumping the version (3 places)
1. Header string in `renderToday()` — `'v5.1'`
2. `checkForUpdate()` — `const localVersion = '5.1'`
3. `version.json` — `{ "version": "5.1" }`

### Service worker
Cache name `zeptrack-v5` in `sw.js`. Bump only when forcing asset re-fetch (e.g. new icons). Normal `index.html` updates use network-first fetch — no cache bump needed.

### Startup migrations
- `migrateWaterEntries()` — zeroes cal/protein/fiber on water meal entries
- `migrateRecipeWeights()` — normalizes `weightUnit` to `'g'`
- `seedGLP1Recipes()` — inserts 5 GLP-1 recipes if not already present

### Recipe macro format (for AI recipe conversations)
```
Recipe Name: [name]
Per 100g:
Calories: [number]
Protein: [number]g
Carbs: [number]g
Fat: [number]g
Fiber: [number]g
```
