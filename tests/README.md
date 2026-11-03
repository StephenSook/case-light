# Unit tests for the Lens's pure modules

These run in plain Node, outside Lens Studio. They cover the rules that have no scene code:

| Test file | Module under test | What it checks |
|---|---|---|
| `pass-logic.test.mjs` | `Assets/Scripts/CaseLightPassLogic.ts` | come-back queue (2 letters later), helped for the rest of the pass, the answer light after a pick-up, retirement after 2 passes from memory, the session score and card wording |
| `notes.test.mjs` | `Assets/Scripts/CaseLightNotes.ts` | the three fixed sorting reminders, one note per slot, the chooser's options, when a note shows, notes kept per route |
| `log.test.mjs` | `Assets/Scripts/CaseLightLog.ts` | the `CASELIGHT_LOG v1` line format and quoting, cell tokens, the session id, the capped buffer |
| `route.test.mjs` | `Assets/Scripts/CaseLightRoute.ts` | the route choice rule, the recall pass order, both routes' bundles, one-number cells |
| `reference.test.mjs` | `Assets/Scripts/CaseLightRoute.ts` against `fixtures/route<N>_reference_order.json` | both routes' cells, read left then right in slot order, give exactly the delivery order the Python reference (`research/proto_case_layout/case_layout.py`, USPS M-41 loop per street) computes from the same house numbers |

The two fixtures are written by `python3 tools/export_reference_fixtures.py` (`--check` to compare), which imports the Python reference from the research folder beside the lens folder; that folder is not in this repository, so CI checks the TypeScript against the committed fixtures and does not regenerate them.

Run from `lens/CaseLight` with Node 22.18 or later (or 22.7 and later with the flag):

```
node --experimental-strip-types --test tests/*.test.mjs
```

Node strips the TypeScript types on load. `tests/register-ts.mjs` lets `CaseLightRoute.ts` import `./CaseLightGeometry` without a file extension, as Lens Studio allows. No packages are installed.

The LEAF scenarios in `Assets/Scripts/Leaf/` test the same rules again inside the Lens, through real input.
