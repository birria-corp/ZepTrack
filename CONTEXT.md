# ZepTrack — Session Context

## Project
- **Name:** ZepTrack
- **Repo:** https://github.com/birria-corp/ZepTrack
- **Live:** https://birria-corp.github.io/ZepTrack
- **Version:** 7.9
- **Stack:** Single-file HTML PWA (all CSS + JS inline), Firebase Firestore cloud sync, Google sign-in, GitHub Pages

## File Structure
```
index.html      Single-file app — all CSS + JS inline (~7000 lines)
sw.js           Service worker; CACHE_VERSION must match APP_VERSION
manifest.json   PWA manifest
version.json    {"version":"7.9"}
icon-192.png    PWA icon
icon-512.png    PWA icon
```

## Architecture

### Storage
- **localStorage** prefix: `zep_`; accessed via `DB.get/set/push`
- `_DB_RAW(key)` / `_DB_SET(key, val)` — direct localStorage access inside Cloud module
- Key stores: `meals`, `exercise`, `injections`, `daily`, `weights`, `recipes`, `quickPicks`, `customItems`, `drinkPresets`, `goals`, `units`

### Firestore Schema
```
users/{uid}/days/{date}       — meals/exercise/injections/daily/weights (merged by ts)
users/{uid}/data/profile      — goals/units/quickPicks/customItems/drinkPresets
users/{uid}/recipes/{id}      — one doc per recipe (subcollection)
users/{uid}/archive/{date}    — archived day docs
```

### Sync Strategy
- On sign-in: `pullAndMerge()` then conditional `pushAllDays()` (if never synced)
- Sync Now: `pullAndMerge()` then `pushAllDays()`
- Recipe save: `pushRecipes()` (all recipes — ensures Firestore has complete set)
- Profile mutations (quickPicks, goals, units, drinkPresets, customItems): `pushProfile()` on every change
- Pull merge: local-wins strategy — cloud fills gaps, never clobbers local

### Quick Picks
- Stored as string array in `quickPicks` localStorage key
- `DEFAULT_QUICK_PICKS` = `['7-Vanilla','Coffee','Iced Tea','Hard Boiled Egg','Cheese Stick','Nuts','Trail Mix','SK Protein Shake','Banana','Apple','Yogurt','Other']`
- `HARDCODED_NUTRITION` — per-item macro object keyed by lowercase item name
- Add/remove/reorder all call `pushProfile()` immediately

### Recipes
- Stored as array in `recipes` localStorage key + Firestore subcollection (one doc per recipe)
- Seed sets: `GLP1_SEED_RECIPES` (42 items, IDs `glp1-r*`), `QP_SEED_RECIPES` (11 items, IDs `qp-*`)
- Seeding: `seedGLP1Recipes()` and `seedQuickPickRecipes()` — add-if-absent by ID, called on startup
- User recipes get timestamp-based IDs

## Active Features (complete)
- Daily intake logging (meals, drinks, water) with quick-pick grid
- Recipe library with portion logging and per-serving macros
- Food search: local recipes + quick-picks → USDA fallback
- Injection site tracker with anatomical diagram and LRU rotation
- Weight, exercise, and daily wellness check-in logging
- Progress charts (7-day + 30-day nutrition; time-scaled weight chart 35d/1yr)
- Dose-change injection markers on weight chart
- Barcode scanner (Open Food Facts)
- Google sign-in with Firestore cloud sync (bidirectional Sync Now in Settings)
- Auto cloud sync every 3 days
- Offline-first PWA with service worker cache
- Auto-backup (local JSON export every 3 days)
- Settings sign-out button (`settings-auth-btn`) — separate from auth-banner

## Key Technical Decisions
- Single-file app; no build step; deploy via GitHub API (mobile-friendly)
- `pushRecipes()` (all) on save — prevents Firestore from having partial recipe set
- Profile merge: local-wins union (not cloud-overwrite) — safe across devices
- No `isFirstLogin` heuristic — always pull on auth state change
- QP seed recipes use `qp-*` stable IDs, re-seeded on startup if deleted (same as GLP-1)

## Version History
| Version | Changes |
|---------|---------|
| v7.9 | Fix recipe save wiping others (push all); fix quickpick revert (push profile on mutate); seed 11 QP recipes |
| v7.8 | Fix recipe sync loss; fix profile merge clobber; Settings sign-out; bidirectional Sync Now |
| v7.7 | (baseline for this work) |

## Deploy Workflow (mobile / no GitHub Desktop)
```bash
# Push any file via GitHub API (--noproxy required)
python3 - << PYEOF
import json, base64, subprocess
TOKEN = '<token>'
SHA   = '<current sha from GET /contents/filename>'
with open('filename','rb') as f:
    b64 = base64.b64encode(f.read()).decode()
payload = json.dumps({'message':'...','content':b64,'sha':SHA})
with open('/tmp/p.json','w') as f: f.write(payload)
subprocess.run(['curl','-s','--noproxy','api.github.com','-X','PUT',
    '-H',f'Authorization: token {TOKEN}',
    '-d','@/tmp/p.json',
    'https://api.github.com/repos/birria-corp/ZepTrack/contents/filename'],
    capture_output=True, text=True)
PYEOF
```
