# ROB RUN Tools

Calculators, an unlock tree and quick answers for ROB RUN. Fan-made, not affiliated with ROB RUN or Kefir.

**Site:** https://robruntools.github.io

| Page | What it does | Data |
|---|---|---|
| [Home](https://robruntools.github.io/) | Live wipe clock for your server (set from Server lifetime, the Federal raid in countdown, or the daily opening it joined), next fresh EU and East US servers, your cut and cash pile | Kefir's Nov 4 schedule: EU 5 PM UTC, East US 8 PM New York time, wipe 7 days after opening |
| [Split calculator](https://robruntools.github.io/split/) | Splits each run, tracks your cut, averages, best run, cash per hour, session length and past wipes. Stamps milestones and offers to file old runs when your server wipes | Saved in your browser |
| [Unlock tree](https://robruntools.github.io/upgrades/) | Larry's Shipments laid out like the game, with plan totals | [robrungame.com planner](https://robrungame.com/planner/) (171 unlocks; Smoke Grenade removed Nov 17), rechecked Nov 22, 2026 |
| [Price check](https://robruntools.github.io/items/) | Fence prices for 373 items, haul builder, logs a haul as a run | [ROB RUN Wiki open data](https://robrunwiki.com/en/data/), game version 0.7.0 |
| [FAQ](https://robruntools.github.io/faq/) | Wipes, cash, dying, selling, unlocks, cops, patch log | Kefir's Steam and Discord posts, checked Nov 22, 2026 |

Plain HTML, CSS and JavaScript with no build step.

## How it's put together

- `assets/site.css`: colors (taken from the crew logo: navy, orange, mint), type, nav, panels, buttons, motion. Every page uses it.
- `assets/logo.png` and sizes: the crew logo, with `favicon-32.png`, `apple-touch-icon.png` and `og.png` for link previews in Discord.
- `assets/site.js`: shared behaviour (`window.RR`): the wipe clock (`RR.wipe`, `RR.wipeClock`), milestone stamps, the laundering-desk cash pile, the sliding nav highlight, the section jump bar, animated collapsibles, back-to-top, toasts and the money count-up. Respects reduced motion.
- `assets/fonts/`: self-hosted Big Shoulders Display and Instrument Sans (SIL OFL) and Permanent Marker (Apache 2.0).
- Icons and the Larry card on the unlock tree are drawn from scratch. No game art is used: Kefir's EULA doesn't allow copying it without written permission.

## Data

`data/shipments.json`, one entry per unlock:

```json
{ "id": "longhorn_wild", "name": "Longhorn Wild", "branch": "Vehicles", "tier": "III", "settlement": 3,
  "unlock": 500000, "buy": 4500000, "city": null, "jail": 0, "after": "royal_e", "url": "https://robrungame.com/items/longhorn-wild/" }
```

`after` is the id of the unlock that has to come first (`null` for the first one in a branch). `jail` is years of accumulated jail time.

`data/items.json`, one entry per item with a fence price:

```json
{ "name": "Gold Bar", "category": "Valuables", "rarity": "Legendary", "min": 52000, "max": 78000, "id": "gold_bar_1" }
```

Saved in the browser (same site, so the pages share them): `robrun-split-v1` (runs and goal), `robrun-unlocks-v2` (plan and owned), `robrun-haul-v1` (haul), `robrun-wipe-v1` (wipe clock: `{at, how, region}`; after the raid it asks you to set it for your new server).
