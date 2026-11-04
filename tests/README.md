# Unit tests for the Lens's pure modules

These run in plain Node, outside Lens Studio. They cover the rules that have no scene code:

| Test file | Module under test | What it checks |
|---|---|---|
| `pass-logic.test.mjs` | `Assets/Scripts/CaseLightPassLogic.ts` | come-back queue (2 letters later), helped for the rest of the pass, the answer light after a pick-up, retirement after 2 passes from memory, the session score and card wording |
| `notes.test.mjs` | `Assets/Scripts/CaseLightNotes.ts` | the three fixed sorting reminders, one note per slot, the chooser's options, when a note shows, notes kept per route |
| `mastery.test.mjs` | `Assets/Scripts/CaseLightMastery.ts` | each letter's state from its latest recall event (unseen, weak, learned), practice ignored, row state priority with the hold letter in row 0, per-route isolation, the row label wording |
| `log.test.mjs` | `Assets/Scripts/CaseLightLog.ts` | the `CASELIGHT_LOG v1` line format and quoting, cell tokens, the saved-progress, pinch hint and stand-in event lines, the session id, the capped buffer |
| `progress.test.mjs` | `Assets/Scripts/CaseLightProgress.ts` | saved progress: the storage keys (the learning curve's keys included, so Reset progress removes them) and their JSON round trip, every branch of the row merge, the last score kept unless a letter was placed, bad and other-version data read as no progress, per-route keys, the welcome wording and when the welcome shows (hidden by the opening Start, Reset, the map, Veteran mode and a placement of the case) |
| `history.test.mjs` | `Assets/Scripts/CaseLightHistory.ts` | the learning curve: one point per completed recall pass (that pass's score from the session score's change), the newest five kept, per-route keys, bad data read as no history, the `x/y` labels and the caption, points oldest left, shown only with history and the pace caption down |
| `pinch-hint.test.mjs` | `Assets/Scripts/CaseLightPinchHintRule.ts` | the opening pinch hint: shown only with no saved progress and no demo replay, up through a Start press, ended only by a grab, never back |
| `control-scale.test.mjs` | `Assets/Scripts/CaseLightControlScale.ts` | the controls' scale with eye distance: the design eye (the world origin) and the design distance from it, exactly 1 at the design distance, eye distance over design distance, clamped to 0.5 .. 6, 1 for unusable input, held while the group is not in front of the eye, the 0.5 percent rescale tolerance, points scaled about the anchor |
| `note-share.test.mjs` | `Assets/Scripts/CaseLightNoteShare.ts` (+ the note lines of `CaseLightLog.ts`) | shared Veteran notes: nothing shared without Share notes on, a ready session and more than one player; a shared note is exactly a slot and a reminder text (or an empty text for a removal); free text, house numbers, names, routes and slots off the case refused; a received note pins, replaces and removes like a local pick; every held note in slot order; the note-sent and note-received log lines |
| `target-spacing.test.mjs` | `Assets/Scripts/CaseLightTargetSpacing.ts` | the spacing rule for pinch targets: the angular gap between two angle boxes (apart on one axis, apart on both, touching, overlapping, a box against itself), every pair smallest to largest, the pairs under 1 deg, the smallest target |
| `route.test.mjs` | `Assets/Scripts/CaseLightRoute.ts` | the route choice rule, the recall pass order, both routes' bundles, one-number cells |
| `next-step.test.mjs` | `Assets/Scripts/CaseLightNextStep.ts` | which Start button is drawn as the next step: Start practice before a practice pass on the route, Start recall after one, neither during a pass |
| `reference.test.mjs` | `Assets/Scripts/CaseLightRoute.ts` against `fixtures/route<N>_reference_order.json` | both routes' cells, read left then right in slot order, give exactly the delivery order the Python reference (`research/proto_case_layout/case_layout.py`, USPS M-41 loop per street) computes from the same house numbers |

The two fixtures are written by `python3 tools/export_reference_fixtures.py` (`--check` to compare), which imports the Python reference from the research folder beside the lens folder; that folder is not in this repository, so CI checks the TypeScript against the committed fixtures and does not regenerate them.

Run from `lens/CaseLight` with Node 22.18 or later (or 22.7 and later with the flag):

```
node --experimental-strip-types --test tests/*.test.mjs
```

Node strips the TypeScript types on load. `tests/register-ts.mjs` lets `CaseLightRoute.ts` import `./CaseLightGeometry` (and `CaseLightNoteShare.ts` import `./CaseLightNotes`, `CaseLightHistory.ts` import `./CaseLightProgress`) without a file extension, as Lens Studio allows. No packages are installed.

The LEAF scenarios in `Assets/Scripts/Leaf/` test the same rules again inside the Lens, through real input.
