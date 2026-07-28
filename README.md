# ZepTrack

> A personal health tracker built for Zepbound (tirzepatide) and GLP-1 medication users. Tracks weight, nutrition, water, exercise, injections, and wellness — installable as a mobile PWA, runs entirely in your browser with no server or account required.

**Live app:** `https://spencer-thompson-2-vu.github.io/ZepTrack`  
**Current version:** v4.6  
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
- **Water buttons** — four one-tap buttons (30 / 24 / 12 / 8 oz) at the top of the food log; log instantly with no form
- **Quick-pick grid** — hardcoded items with confirmed nutrition data (Coffee, Iced Tea, SK Protein Shake, Hard Boiled Egg, Cheese Stick, Nuts, Trail Mix, Banana, Apple, Yogurt)
- **Gram/OZ dual input** — enter portion in either unit; fields sync automatically
- **Coffee + milk option** — checkbox adds 1oz whole milk (19 cal, 1g fat, 1.5g carb, 1g protein)
- **Food search** — USDA FoodData Central database lookup with common serving sizes
- **Barcode scan** — Open Food Facts API via device camera (Android Chrome BarcodeDetector API)
- **Other / custom items** — three-tier lookup: Recipe Library → Custom Items Library → USDA → manual entry
- **Drink presets** — saved drinks with volume, additions, nutrition, optional water-goal contribution

### Recipe System
- **Per-ingredient builder** — type ingredient name, USDA auto-fetches nutrition per 100g, scales to entered quantity
- **Bulk entry mode** — enter total recipe nutrition directly with paste-and-parse support
- **Paste parser** — paste free-form text from another AI assistant; app extracts name and all five macros automatically
- **Recipe library** — saved recipes with total weight in grams; log any portion by weight for auto-scaled nutrition
- **Weight unit selector** — enter recipe total weight in g, oz, or ml; stored internally in grams

### Injection Tracker
- Log dose (2.5mg–15mg), date, injection site
- Body diagram with 8 zones: abdomen (UL/UR/LL/LR), thigh (L/R), arm (L/R)
- Color-coded rotation history on diagram (red = most recent, fading blue = older)
- Auto-suggests next site in rotation sequence
- Weekly push notification reminder (day + time configurable)

### Progress
- **Nutrition tab** (default): 7-day averages vs goals, plus 30-day individual bar charts per macro (Water, Calories, Protein, Fiber) — all synced to 0–120% Y-axis with dashed 100% target line
- **Weight tab**: chart with actual + 7-day rolling average trend line; stats including % total loss, % change last 7d and 30d, per-week average
- **Wellness tab**: energy and mood 14-day line chart, side effect frequency table

### History
- Full log filterable by type (All / Weight / Meals / Exercise / Injection / Daily)
- Tap any entry to edit — all fields including Grams/OZ volume for meal entries
- Delete from within edit modal

### Settings
- Imperial / Metric unit toggle (lbs↔kg, oz↔ml)
- Customizable daily goals (Calories, Protein, Fiber, Water, Steps)
- Custom Items Library (add/edit/delete saved foods for the lookup chain)
- Quick-Pick list manager (add/remove items from the intake grid)
- Injection reminder (day of week + time, push notification)
- **Check for Update** — fetches `version.json` from GitHub, compares to local version, clears cache and reloads if different
- Export data as JSON backup
- Import from JSON backup (with overwrite warning)
- Copy to clipboard — Summary or Full Log (for Google Docs / provider sharing)

---

## Architecture

```
Single HTML file (index.html)
├── CSS — custom properties (design tokens), mobile-first layout
├── HTML — all views rendered at once, toggled via display:none
└── JavaScript — vanilla ES2020, no frameworks
    ├── Storage layer (DB object → localStorage with zep_ prefix)
    ├── Navigation (showView, showLogTab, showIntakeSubtab, showProgressTab)
    ├── Today dashboard (renderToday, renderSummaryTable, updateWaterDisplay)
    ├── Intake (saveQuickLog, addWater, logDrink, logRecipePortion)
    ├── Lookup chain (resolveItemNutrition → Recipe Library → Custom Items → USDA)
    ├── Recipe builder (addRecipeIngredientRow, autoLookupIngredient, saveRecipe, parseRecipePaste)
    ├── Injection tracker (initRotationDiagram, saveInjection, scheduleReminders)
    ├── Progress charts (drawLineChart, drawBarChart, drawWeightChart, renderNutritionProgress)
    ├── History (renderHistory, openEntryEdit, saveEntryEdit)
    └── Settings (initSettings, setUnits, saveGoals, exportData, importFromJSON, checkForUpdate)

Supporting files
├── sw.js         — Service worker (network-first for index.html + version.json, cache-first otherwise)
├── manifest.json — PWA manifest (name, icons, theme, display mode)
├── version.json  — { "version": "4.6" } — read by checkForUpdate to detect new releases
├── icon-192.png  — PWA icon (192×192)
└── icon-512.png  — PWA icon (512×512)
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

All data lives in `localStorage` under the prefix `zep_`. Keys:

| Key | Type | Contents |
|-----|------|---------|
| `zep_meals` | Array | Food and drink entries (see schema below) |
| `zep_weights` | Array | `{ date, weight, notes, ts }` — weight always in lbs |
| `zep_exercise` | Array | `{ date, type, duration, steps, notes, ts }` |
| `zep_daily` | Array | `{ date, water, energy, mood, sideEffects, notes, ts }` |
| `zep_injections` | Array | `{ date, dose, site, notes, ts }` |
| `zep_recipes` | Array | Full recipe objects (see Recipe schema) |
| `zep_drinkPresets` | Array | Saved drink presets |
| `zep_customItems` | Array | Custom food items library |
| `zep_quickPicks` | Array | Quick-pick grid item names |
| `zep_goals` | Object | `{ calories, protein, fiber, water, steps }` |
| `zep_units` | String | `'imperial'` or `'metric'` |
| `zep_reminder` | Object | `{ enabled, day, time }` |
| `zep_reminderLastFired` | String | Date of last notification |

### Meal entry schema
```json
{
  "date": "2026-07-25",
  "mealType": "breakfast",
  "type": "food",
  "items": [{ "name": "Apple (172 Grams)", "cal": 98, "protein": 0.43, "carbs": 23.5, "fat": 0, "fiber": 4 }],
  "cal": 98,
  "protein": 0.43,
  "carbs": 23.5,
  "fat": 0,
  "fiber": 4,
  "quantity": 172,
  "unit": "Grams",
  "ts": 1753401600000
}
```

Drink entries additionally carry `drinkName` and `drinkVolume`. Water entries always have `cal: 0` regardless of USDA data.

### Recipe schema
```json
{
  "id": "1753401600000",
  "name": "Curry Green Lentils",
  "totalWeight": 3397,
  "weightUnit": "g",
  "totalCal": 1597,
  "totalProtein": 79,
  "totalCarbs": 218,
  "totalFat": 58,
  "totalFiber": 70,
  "ingredients": [],
  "notes": "",
  "isBulk": true,
  "ts": 1753401600000
}
```

`totalWeight` is **always stored in grams** regardless of input unit. `isBulk: true` means nutrition was entered as a total rather than per-ingredient.

---

## External APIs

| API | Purpose | Auth | Rate limit |
|-----|---------|------|-----------|
| USDA FoodData Central | Food search + ingredient lookup | `DEMO_KEY` (no registration) | 30 req/hour/IP |
| Open Food Facts | Barcode lookup | None | Fair use |
| Google Fonts | Typography (Inter, DM Mono) | None | None |

> **Note:** The USDA `DEMO_KEY` is rate-limited to 30 requests per hour per IP. For higher usage, register for a free API key at [api.data.gov/signup](https://api.data.gov/signup) and replace `DEMO_KEY` in the `lookupUSDANutrition()` function.

The barcode scanner uses the browser-native `BarcodeDetector` API (Chrome on Android only). Falls back to manual barcode entry in other browsers.

---

## Installing on Android

1. Open **Chrome** on your Android phone
2. Navigate to `https://spencer-thompson-2-vu.github.io/ZepTrack`
3. Tap ⋮ menu → **Add to Home screen**
4. Tap **Add** — the ZepTrack icon appears on your home screen

The app works offline after the first load. All data is stored locally on the device.

---

## Updating the App

### For users
1. Open the app → **Settings** → **App Update** → tap **Update**
2. The app fetches `version.json` from GitHub (bypasses cache)
3. If a new version is found, all caches are cleared and the app reloads automatically

### For developers (pushing a new release)
1. Make changes to `index.html`
2. Bump the version in two places:
   - The header display string: `'v4.6'` in the `renderToday()` function
   - The `localVersion` constant in `checkForUpdate()`
3. Update `version.json`: `{ "version": "4.7" }`
4. Commit and push both `index.html` and `version.json` to GitHub
5. GitHub Pages redeploys in ~60 seconds
6. Users tap **Update** in Settings to get the new version

---

## Configuration & Goals

Default daily goals (configurable in Settings):

| Metric | Default | Notes |
|--------|---------|-------|
| Calories | 1,600 | Adjust per provider guidance |
| Protein | 120g | Recommend 1–1.6g × goal body weight in lbs for GLP-1 |
| Fiber | 25g | Higher fiber helps with GLP-1 GI side effects |
| Water | 64 oz | Adjust per body weight |
| Steps | 8,000 | — |

---

## Nutrition Tracking Logic

### Water
Water is stored exclusively as drink meal entries (`type: 'drink'`, `mealType: 'drink'`, `cal: 0`). The `daily` record is used only for explicit Daily Check-In submissions (energy, mood, side effects). Water totals are computed by summing `quantity` across meal entries whose item name includes "water".

### Unit conversions
All weights stored in grams. All water volumes stored in oz. Display converts on the fly based on `UNITS` setting.

```
1 oz = 28.3495 g
1 kg = 2.20462 lbs
1 ml ≈ 1 g (for liquids)
```

### USDA nutrition scaling
Nutrition from USDA is returned per 100g. Scaling:
```
factor = portionGrams / 100
nutrientAmount = per100gValue × factor
```

### Recipe portion scaling
Recipe `totalWeight` is always in grams. Portion entered in display unit (oz for imperial):
```
portionGrams = portionOz × 28.3495   (imperial)
portionGrams = portionG               (metric)
factor = portionGrams / recipe.totalWeight
nutrientAmount = recipeTotalNutrient × factor
```

### Hardcoded quick-pick nutrition
These items bypass USDA entirely and use confirmed values:

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
| Whole milk (shot) | 29.5g (1oz) | 19 | 1g | 1.5g | 1g | 0 |

---

## Recipe System

### Entering a recipe

**Option A — Per-ingredient (USDA auto-lookup)**
1. Type ingredient name → tab away → app fetches USDA nutrition per 100g
2. Enter quantity and unit (g, oz, ml, count)
3. App scales nutrition automatically
4. Check **Use Custom** on any ingredient to override with manual values

**Option B — Bulk entry with paste parser**
1. Check "Enter total nutrition directly"
2. Paste text from another AI assistant — app extracts name and macros automatically
3. Expected format for clean parsing:
```
Recipe Name: [name]
Per 100g:
Calories: [number]
Protein: [number]g
Carbs: [number]g
Fat: [number]g
Fiber: [number]g
```

### Logging a portion
Select recipe → enter portion weight in oz (imperial) or g (metric) → nutrition scales automatically. Stores as a standard meal entry.

---

## Unit Conversion Reference

| Input | Stored as | Display (Imperial) | Display (Metric) |
|-------|-----------|-------------------|-----------------|
| Weight | lbs | lbs | kg |
| Water | oz | oz | ml |
| Food portions | grams | oz or g | g |
| Recipe weight | grams | oz or g | g |

---

## Version History

| Version | Key changes |
|---------|-------------|
| v1.0 | Initial PWA — weight, meals, exercise, injection, daily check-in |
| v2.0 | Barcode scan, food search, recipe builder, Imperial/Metric toggle |
| v3.0 | Intake system redesign, drink presets, quick-pick list, USDA recipe builder, JSON export/import |
| v3.5 | Network-first service worker, Check for Update button |
| v3.7 | Water tracking unified to meal entries, UTC date bug fix |
| v3.8 | 30-day bar charts, weight % stats, recipe bulk entry, gram/oz dual input |
| v4.0 | Major rebuild — hardcoded quick-pick nutrition, Coffee+milk option, paste parser, recipe unit fix |
| v4.1 | Critical fix: `today()` function now uses local date not UTC |
| v4.2 | Water no longer creates Wellness check-in entries in History |
| v4.3 | `version.json` update system — reliable Check for Update |
| v4.5 | Confirmed nutrition data for all quick-pick items |
| v4.7 | Four water quick-buttons (30/24/12/8 oz), Water removed from quick-pick grid |
| v4.6 | History edit volume fields, weight display size, recipe paste parser |

---

## Known Limitations

- **No cross-device sync** — localStorage is per-device; phone and desktop are independent
- **No automatic backup** — user must manually export JSON periodically
- **USDA rate limit** — food search may fail for heavy users on shared IP addresses (30 req/hour with DEMO_KEY)
- **BarcodeDetector** — only available in Chrome on Android; not supported in Safari or Firefox
- **Push notifications** — require PWA install and notification permission; do not work in a browser tab on some devices
- **Service worker update** — first update after a long gap may require one manual cache clear

---

## Roadmap

Items discussed but not yet built:

- [ ] Data import restore UI (currently export works, import overwrites)
- [ ] BMI tracker (auto-calculated from weight + height in Settings)
- [ ] Body measurements (waist, hips, arms, chest) with trend chart
- [ ] Progress photos with date stamps
- [ ] Calendar view (visual log completeness by day)
- [ ] Provider export (formatted one-page summary for appointments)
- [ ] USDA API key setting (remove rate limit for food search)
- [ ] Estimated medication level curve between injections (tirzepatide half-life visualization)
- [ ] Multi-device sync via optional cloud backup

---

## Developer Notes

### Adding a new quick-pick item
Add an entry to the `HARDCODED_NUTRITION` object in `index.html`:
```javascript
'item name': {
  label: 'Display Name',
  servingG: 100,           // default serving in grams
  defaultQtyOz: 3.5,       // default oz shown in oz field
  defaultQtyG: 100,        // default g shown in g field
  cal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
  type: 'food'             // or 'drink'
},
```
Key must be lowercase, no special characters.

### Bumping the version
Three places to update per release:
1. `renderToday()` header string — `'v4.6'`
2. `checkForUpdate()` — `const localVersion = '4.6'`
3. `version.json` — `{ "version": "4.6" }`

### Service worker cache
Cache name is `zeptrack-v5` in `sw.js`. Bump this only when you need to force all users to re-fetch assets (e.g. new icon files). Normal `index.html` updates are picked up via the network-first fetch strategy without bumping the cache name.

### Data migrations
On-startup migration functions in the init block:
- `migrateWaterEntries()` — zeroes cal/protein/fiber on any water meal entries with non-zero nutrition
- `migrateRecipeWeights()` — normalizes `weightUnit` to `'g'` on all recipes
