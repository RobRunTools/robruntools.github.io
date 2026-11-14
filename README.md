# ROB RUN Tools

Calculators, an unlock tree and quick answers for ROB RUN. Fan-made, not affiliated with ROB RUN or Kefir.

**Site:** https://robruntools.github.io

| Page | Status |
|---|---|
| [Split calculator](https://robruntools.github.io/split/) | Live |
| [Unlock tree](https://robruntools.github.io/upgrades/) | Waiting on data |
| [Price check](https://robruntools.github.io/items/) | Waiting on data |
| [FAQ](https://robruntools.github.io/faq/) | Live |

Plain HTML and CSS, no build step. Shared styles live in `assets/site.css`.

## Data

The unlock tree and price check read from `data/`. Once a file has items in it, the page switches from "under construction" to the real tool.

`data/shipments.json`, one entry per unlock:

```json
{ "id": "longhorn-wild", "name": "Longhorn Wild", "branch": "Vehicles", "tier": "III",
  "unlock": 500000, "buy": 4500000, "after": "royal-e", "settlement": 3, "jail": 0 }
```

`after` is the id of the unlock that has to come first (`null` for the first one in a branch). `jail` is years of accumulated jail time.

`data/items.json`, one entry per item:

```json
{ "name": "AIR-P Laptop", "category": "Electronics", "price": 1200 }
```
