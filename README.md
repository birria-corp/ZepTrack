# ZepTrack

> A personal health tracker built for Zepbound (tirzepatide) and GLP-1 medication users. Tracks weight, nutrition, water, exercise, injections, and wellness — installable as a mobile PWA, runs entirely in your browser with no server or account required.

**Live app:** `https://spencer-thompson-2-vu.github.io/ZepTrack`  
**Current version:** v5.8  
**Platform:** Android Chrome (PWA), any modern browser

---

## Version History

| Version | Key changes |
|---------|-------------|
| v5.8 | Remove meal type completely, iced tea counts at 90% toward water, 7-day averages exclude today, 7-Vanilla quick pick, Eggs in Purgatory + Edamame Corn Chicken Salad recipes |
| v5.7 | Lookup top 5 results in labeled sections, recipe card Cooked This / Log Portion split, injection diagram anatomical view, smart LRU injection suggestion |
| v5.6 | 35-day rolling meal history archive, Progress chart fix |
| v5.5 | Major nav restructure: Intake/Recipes/Exercise/Injection tabs, recipe browser with sort/filter/tag search |
| v5.4 | Recipe seeding fix, Restore Default Recipes, new icon |
| v5.3 | 11 new GLP-1 recipes, cuisine/protein/diet tags |
| v5.2 | Recipe portion macro fix, Share Backup button |
| v5.1 | Recipe app folded in, 5 GLP-1 seed recipes, auto-backup |

---

## Developer Notes

### Version bump (3 places)
1. Header string in `renderToday()` — `'v5.8'`
2. `checkForUpdate()` — `const localVersion = '5.8'`
3. `version.json` — `{ "version": "5.8" }`

### Service worker
Cache: `zeptrack-v6` in `sw.js`. Bump only for new icon/asset changes.

### localStorage prefix
Always `zep_` — never change, existing user data depends on it.
