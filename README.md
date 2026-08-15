# ZepTrack

> A personal health tracker built for Zepbound (tirzepatide) and GLP-1 medication users. Tracks weight, nutrition, water, exercise, injections, and wellness — installable as a mobile PWA, runs entirely in your browser with no server or account required.

**Live app:** `https://spencer-thompson-2-vu.github.io/ZepTrack`  
**Current version:** v6.0  
**Platform:** Android Chrome (PWA), any modern browser

---

## Version History

| Version | Key changes |
|---------|-------------|
| v6.0 | Quick pick custom ordering via ↑↓ arrows in Settings, auto-sync new default items to saved list |
| v5.9 | Unit-aware water tracking (drinkToOz), auto-backup guard, food items fix in Today view, iced tea unit fix |
| v5.8 | Remove meal type, iced tea 90% water credit, 7-day averages exclude today, 7-Vanilla quick pick, 2 new recipes |
| v5.7 | Lookup top 5 results, recipe card Cooked This / Log Portion split, injection diagram anatomical view, smart LRU rotation |
| v5.6 | 35-day rolling meal history archive, Progress chart fix |
| v5.5 | Major nav restructure: Intake/Recipes/Exercise/Injection tabs, recipe browser |
| v5.4 | Recipe seeding fix, Restore Default Recipes, new icon |
| v5.3 | 11 new GLP-1 recipes, cuisine/protein/diet tags |
| v5.2 | Recipe portion macro fix, Share Backup button |
| v5.1 | Recipe app folded in, 5 GLP-1 seed recipes, auto-backup |

---

## Developer Notes

### Version bump (3 places)
1. Header string in `renderToday()` — `'v6.0'`
2. `checkForUpdate()` — `const localVersion = '6.0'`
3. `version.json` — `{ "version": "6.0" }`

### Service worker
Cache: `zeptrack-v6` in `sw.js`. Bump only for new icon/asset changes.

### localStorage prefix
Always `zep_` — never change, existing user data depends on it.

### Water tracking
All drink quantities converted to oz via `drinkToOz(m)` before accumulation. Supports OZ, Grams, and ML. Iced tea counts at 90%.

### Quick picks
`DEFAULT_QUICK_PICKS` defines the canonical list. `migrateQuickPicks()` runs on startup and adds any missing defaults to the saved list. User can reorder via ↑↓ arrows in Settings.
