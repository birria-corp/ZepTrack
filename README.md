# ZepTrack
GLP-1 / Zepbound personal health tracker PWA with cloud sync.

**Live:** https://birria-corp.github.io/ZepTrack

## Features
- Daily intake logging (meals, drinks, water) with quick-pick grid
- Recipe library (42 GLP-1 seeds + 11 quick-pick seeds + user recipes) with portion logging
- Food search: local recipes + quick-picks first, then USDA
- Injection site tracker with anatomical diagram and LRU rotation
- Weight, exercise, and daily wellness check-in logging
- Progress charts (7-day + 30-day nutrition, time-scaled weight chart with 35d/1yr toggle)
- Dose-change injection markers on weight chart
- Barcode scanner (Open Food Facts)
- **Google sign-in with Firestore cloud sync** — data syncs across devices
- Quick pick edits (add/remove/reorder) sync to cloud immediately
- **JSON blob paste in recipe bulk mode** — paste a ZepTrack recipe JSON and all fields auto-fill
- Auto cloud sync every 3 days (mirrors auto-backup cadence)
- Offline-first PWA — works without signal, syncs when back online
- Auto-backup (local JSON export every 3 days)

## File Structure
```
index.html      Single-file app — all CSS + JS inline
sw.js           Service worker (network-first for index/version, cache-first otherwise)
manifest.json   PWA manifest
version.json    { "version": "8.0" }
icon-192.png    PWA icon
icon-512.png    PWA icon
README.md       This file
CONTEXT.md      Session context for resuming in Claude
```

## Update Workflow
1. Pull origin in GitHub Desktop
2. Replace changed files in local repo folder
3. Commit with version + description
4. Push origin

## Version History
| Version | Changes |
|---------|---------|
| v8.0 | JSON blob paste in recipe bulk mode — paste recipe JSON, all fields auto-fill (name, weight, macros) |
| v7.9 | Fix recipe save wiping other recipes; fix quick pick edits reverting after sign-out; seed 11 quick pick item recipes |
| v7.8 | Fix recipe sync loss; fix profile merge clobbering on pull; Settings sign-out button; bidirectional Sync Now |
| v7.6 | Fix 7-Vanilla quick-pick lookup; food search returns local recipes + quick-picks; barcode Add to Meal fix |
| v7.5 | Fix barcode Add to Meal button; auto cloud sync every 3 days |
| v7.4 | Dose-change injection markers on weight chart |
| v7.3 | Fix quick-pick removals persisting; time-scaled weight chart with 35d/1yr toggle |
| v7.2 | Full history cloud sync (35-day archive), Sync Now button in Settings |
| v7.1 | Fix Google sign-in on Android PWA, fix Firebase module syntax error |
| v7.0 | Firebase Firestore cloud sync, Google sign-in, offline-first merge |
| v6.0 | Quick pick ↑↓ ordering in Settings, migrateQuickPicks auto-sync |
| v5.7 | Top-5 lookup UI, split Cooked This/Log Portion, anatomical injection diagram |
| v5.5 | Nav restructure: Intake/Recipes/Exercise/Injection tabs |
