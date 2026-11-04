# Judging Case Light

Case Light v0.7 is a **SPECS Lens**, run in Lens Studio's SPECS preview. It is not a web app, and it has not been tried on SPECS hardware.

Demo video: link added when it is published. Devpost: link added when it is published. [Source](https://github.com/StephenSook/case-light)

## Open it from a fresh clone

1. Clone this repo.
2. Install **Lens Studio 5.23.2**. The event's FAQ points to 5.23.2 when sign-in fails on a newer version.
3. Open `CaseLight.esproj`. Set the Preview to a SPECS device.
4. You don't need an account, an API key or anything else to try it. Solo play creates no session, and Case Light's own scripts make no internet calls. The optional Share notes uses Snap's Connected Lenses service.

## Try it (about 2 minutes, in the preview)

1. Pinch **Route 1**, then **Start practice**. Pick up a letter with a pinch and drag it to the slot that glows. If the slot is off to the side, an arrow at the edge of the view points to it.
2. Pinch **Start recall**. The case goes dark. Place the same letters from memory. A miss lights the right slot and doesn't count.
3. Read the score: "From memory: X of Y this session." A missed letter comes back later.
4. Pinch **Show my case**. Each row says Learned, Review N or Not tried N, with a shape for each, so it doesn't rely on color.
5. Restart the preview. The panel says "Welcome back" with your last score, and a small curve near the route label shows the from-memory score of each completed recall pass on that route (up to 5). **Reset progress** clears only Case Light's own saved keys.
6. With nothing saved, an animated hand shows the pinch at the top letter. In **Options**, "Hide stand-in case" leaves only what the glasses would draw over a real case.
7. Optional: **Veteran mode** pins one of three sorting reminders to a cell. Share notes starts a Connected Lenses session; a note reaching a second person was not shown (see below).

## The five done criteria, as measured in the last full run

From `devpost/evidence/leaf-measurements-46-run-v07.log` (lines starting C1 to C5). The criteria are in `devpost/design-brief.md`.

| Done criterion | Scenario | Measured |
|---|---|---|
| 1. Pinch picks up the top letter, shows its address in large print, and letting go over a slot snaps it in | `c1-pickup-and-snap` | Letter 13.2 x 5.4 cm; the address is drawn in 0.85 cm capitals on a 1.51 cm line (the brief asked for about 3 cm; the print was shrunk so the whole address fits in view). Dropped over slot 9, it snapped into slot 9; a wrong drop over slot 47 snapped into slot 47 and counted as a miss. |
| 2. In practice the right slot glows, and an edge arrow points to it while it is outside the display | `c2-practice-glow-and-arrow` | Slot 46 at yaw -31.03 deg: the arrow hid after a 20.75 deg head turn, with the whole-cell boundary at 20.51 deg. |
| 3. In recall nothing glows before the drop; a wrong drop lights the right slot and counts the letter as helped | `c3-recall-miss-lights-answer` | Two misses: a letter meant for slot 76 dropped in 75 (answer outside the display), and one meant for 56 dropped in 57; each lit the answer slot (outline 2.42 x 11.48 cm). |
| 4. A hold letter shows "Hold: set this piece aside" in hand and is accepted only in the HOLD block | `c4-hold-note-and-hold-block` | Note shown in hand; an ordinary drop was refused (`refused-hold`); placed at x 44.45 cm inside the HOLD block (40.64 to 50.80). |
| 5. After the last letter the case shows the unaided score for the session | `c5-recall-unaided-score` | "From memory: 7 of 8 this session" after pass 1 (7 from memory, 1 helped), "From memory: 15 of 16 this session" after pass 2. The wording changed from the brief's "Unaided: X/Y". |

## Check the tests yourself

- 46 LEAF scenarios live in `Assets/Scripts/Leaf/`. Run them from the LEAF panel, or through the Lens Studio MCP `run_leaf_scenario`, one at a time, under the fail-fast policy (`__leaf__diagnostic_policy: fail-fast`). The wall scenarios run in the "Sunlit Room" preview scene; the run log says where the camera stands for each.
- Unit tests for the pure logic: `node --experimental-strip-types --test tests/*.test.mjs` (they run in CI on every push).
- `python3 tools/check_repo.py` checks:
  - that no secret, private key or local-only file is tracked, and no token is saved in the scene
  - that README.md and this file state the same LEAF count and Lens version as the code
  - no em dashes
  - route data and OpenStreetMap attribution
  - that the demo replay is off by default
  - that `THIRD_PARTY_NOTICES.md` names every package

## Evidence index

| What | Where |
|---|---|
| The plan-lens brief (five done criteria) | `devpost/design-brief.md` |
| Every prompt that started a build round | `devpost/PROMPTS.md` |
| Every CLAD session, with tool-call counts | `devpost/BUILD_LOG.md` |
| Last full LEAF run (46 scenarios, all passed) | `devpost/evidence/leaf-full-46-run-v07.log` |
| Numbers the tests measured in that run | `devpost/evidence/leaf-measurements-46-run-v07.log` |
| Deliberate breaks and the failure each one caused (145 in all) | `devpost/evidence/break-proofs.log` |
| Mastery map: run, plus before and after stills | `devpost/evidence/leaf-a1-mastery.log`, `devpost/evidence/a1-mastery-map-before-recall.png`, `devpost/evidence/a1-mastery-map-after-recall.png` |
| Saved progress: save, welcome, reset chain | `devpost/evidence/leaf-a2-progress.log` |
| Button spacing, wall-scaled controls, IK arms | `devpost/evidence/leaf-a5-spacing.log`, `devpost/evidence/leaf-a6-ik-wall.log` |
| Share notes: solo start, one session started, payload rule | `devpost/evidence/a4-share-notes.log` |
| Performance traces in the preview | `devpost/evidence/perf-preview-traces.md` |
| Route data source and attribution | `data/ATTRIBUTION.md` ((c) OpenStreetMap contributors) |
| Third-party packages and their terms | `THIRD_PARTY_NOTICES.md` |

## What this is not

- Not tested on SPECS glasses. Reach with a real arm, head turns and real walls need the hardware.
- Not a USPS product or a USPS route. The house numbers are real OpenStreetMap addresses on two practice routes near KSU, with no resident information. Exception cards only use house numbers that don't exist on that street.
- Not tried by a carrier yet.
- Share notes: two-pane sync not shown. A note sent from one preview pane arriving in another, or on a second pair of glasses, has not been shown.
- Saved progress lives in the Lens's local storage and was tested across preview resets, not across device sessions.
