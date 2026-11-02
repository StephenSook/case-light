# CaseLight build log

How the Lens was built from `devpost/design-brief.md` (approved by Stephen after the plan-lens interview), using CLAD in Lens Studio 5.23.2. All runs happened in Lens Studio's preview on a laptop; no SPECS device was used. Times are local, on 2026-11-02.

## At a glance (v0.5)

- v0.5 uses real house numbers from OpenStreetMap on four streets near Kennesaw State University (practice mail, not a USPS route, no resident information). Data, license and changes: `data/case_light_route_osm.json` and `data/ATTRIBUTION.md`.
- 17 LEAF scenarios. Latest full run: all 17 passed, 0 failed (14:04 to 14:11, run by the coordinating agent). One run was cut off with no verdict and passed when rerun; details under the run.
- 67 deliberate breaks of the Lens code or scene, each caught by a failing scenario, each file restored byte-identical afterwards (56 up to v0.4, 11 for v0.5).
- 18 product scripts and 19 test files (17 scenarios, a shared support file and the scenario index).
- 15 CLAD agent sessions (2,074 tool calls, about 433 minutes) plus the coordinating agent's v0.5 round (row 16).
- 9 film stills of v0.5 in the preview, each with steps to reproduce it (`devpost/media/film/`).

## CLAD sessions

| # | Agent | Asked | Did | Tool calls | Minutes |
|---|---|---|---|---|---|
| 1 | specs-experience-builder | Build the brief for SPECS. Basic flow, then detail. | Built the case (one MeshBuilder mesh, 6 shelves, 2 playable shelves of 40 one-inch cells), 76 street-coloured cell labels plus the HOLD label, the HOLD block, an 8-letter sample bundle, grab and snap, practice and recall passes, the display rectangle and the edge arrow. Installed Leaf 2.0.2 and AiPreviewAgent 2.0.1 (newer Asset Library versions broke compile). | 180 | 49.6 |
| 2 | live-lens-tester | Write and run a LEAF scenario for each done criterion, with real input. | Wrote 6 scenarios. Buttons pressed with LEAF `trigger()`, letters grabbed and dropped by a LEAF SIK interactor. All 6 passed. | 150 | 20.5 |
| 3 | specs-experience-builder | Move the score, buttons, tray and caption into the start view; readable text at 720p; arrow waits for the whole cell; ripples; a one-time start hint; a 3-line header on every script. | Did all six. The arrow hides only when all four corners of the lit cell are inside the display rectangle. | 128 | 24.3 |
| 4 | live-lens-tester | Positive controls, an explicit "one miss gives X = Y - 1" check, and proof that each test fails when the Lens is broken. | 8 deliberate breaks, 8 caught, every file restored byte-identical. | 143 | 19.6 |
| 5 | live-lens-tester | Turn the real preview camera for criterion 2, and audit the test tooling in the scene. | Head-turn check (below). Tooling audit (below). | 75 | 9.1 |
| 6 | specs-experience-builder | Glow, sound, font, and why the right hand could not grab. | Shader-graph glow (one lit cell, the rear layer removed), chime and miss sounds played spatially. Font unchanged (the font tool was not available to the agent). Right-hand grab: not a collider problem, most likely the preview hand's reach. | 116 | 15.6 |
| 7 | specs-experience-builder | Drill pace. | A "Drill pace" toggle, off by default: a light steps along the separations at 18 pieces a minute, the minimum office casing standard in USPS handbook M-41 (Exhibit 121.12). | 62 | 12.4 |
| 8 | specs-experience-builder | Readability and wording pass. | Start hint, score card wording, HOLD gloss, white held card, neutral snap outline, street names repeated every 8 cells, Again and Done buttons, version tag v0.3, arrow inset 3.5 cm from the display edge, light backing panels. | 115 | 20.8 |
| 9 | live-lens-tester | Answer every point of an independent test review, with independent answers and break proofs. | 9 scenarios. Expected answers now read from the printed address and the case labels. 15 deliberate breaks, 15 caught. | 359 | 53.7 |
| 10 | specs-experience-builder | Practice ladder and mix-up lines. | Ladder (off by default) and mix-up lines (on by default, shown only after a recall pass). | 30 | 5.7 |
| 11 | live-lens-tester | Test the ladder and mix-up lines, close the remaining review points, prove each with a break. | 13 scenarios. 16 deliberate breaks, 16 caught. 13 passed in its closing run. | 254 | 59.5 |
| 12 | specs-experience-builder | Fix three known issues: every address inside the print area, the whole top letter in view when the Lens opens, the tray within comfortable reach. | Letter 13.2 x 5.4 cm with a 12.0 cm print width and 1.25 cm capitals. Tray centred under the view; the top letter sits 43.3 cm from the eye. Start practice, Start recall and Drill pace in one row above it, the hint above them, the score card and Again / Done side by side lower down. | 45 | 15.6 |
| 13 | live-lens-tester | Bring the 13 scenarios to the new layout; add checks for print fit, display fit and reach; hide the LEAF report panel after every scenario; prove each with a break. | 16 scenarios. 5 deliberate breaks, 5 caught. Both preview hands now grab the top letter. 16 passed in its closing run. | 170 | 58.3 |
| 14 | specs-experience-builder | Make each mix-up line say which end is which; keep the score card, Again and Done inside the display; make one pinch press only one button; version v0.4. | End labels ("<address>" / "was put here", "goes here") and pink outlines on both end cells. Score card, Again and Done measured inside the display with at least 1.47 degrees to spare (no move needed). Buttons act only when the same pinch started on them, and a Start press within 0.6 s of Again or Done is ignored. Found and fixed outlines that drew white instead of pink. | 77 | 20.8 |
| 15 | live-lens-tester | Bring the suite to v0.4 and test the labels, the exit fit and the one-pinch rule, each with a break. | 17 scenarios (new: `extra-one-pinch-one-press`). 9 deliberate breaks, 9 caught. 17 passed in its closing run, one of them on a rerun after a stall. | 170 | 47.2 |
| 16 | coordinating agent (no subagent) | v0.5: replace the invented route with real OpenStreetMap house numbers, credit the data, keep every test honest. | Route table from the OpenStreetMap JSON, caption and credit line, address capitals 0.85 cm after `extra-print-fit` failed at 1.25 cm, C1, C4 and layout checks updated or added. 11 deliberate breaks, 11 caught. 17 of 17 passed. 9 new stills. Before any of that, Lens Studio had to be made to compile again after the 13:10 crash (see Test tooling left in the scene). | 278 (to 14:18) | 35.4 |

Between sessions the coordinating agent recompiled, checked the run logs for errors, captured the preview, checked every product file against its fingerprint, matched every claimed failure line against the Lens Studio log output, and re-ran the full LEAF suite itself.

## Skills used

Only skills that were actually invoked are listed.

- Coordinating agent: `lens-studio-router`, `verify-preview`, `specs-capture-perf-trace`, `perfetto-trace-analysis`, `specs-lens-perf-attribution` (read; a targeted A/B was run instead of the full sweep), plus the project's `plan-lens` skill for the interview.
- Builder, session 1: `lens-studio-field-notes`, `scene-construction`, `mesh-builder-scripting`, `specs-interaction-recipes`, `specs-build-ui`, `specs-project-init`, `specs-leaf-install-packages`, `editor-api`.
- Builder, session 6: `shader-graph`, `build-sfx` (its engine failed to start with NODE_MISSING, so the two sounds were made by a short Python script that synthesises the tones), `specs-audio`, `font-selector` (the tool was not available).
- Builder, session 7: `specs-build-ui`.
- Builder, sessions 3, 8, 10, 12 and 14: none.
- Tester, session 2: `lens-studio-field-notes`, `specs-leaf-install-packages`, `specs-leaf-write-scenarios`, `specs-leaf-run-in-preview`. Later tester sessions: none.

## Done criteria and their tests

| Done criterion (from the brief) | LEAF scenarios | Result |
|---|---|---|
| 1. Pinch picks up the top piece and shows its address in large print; letting go snaps it into the separation | `c1-pickup-and-snap`; `extra-print-fit` checks every sample address, the hold note and its gloss fit inside the 12.0 cm print width | Pass, logic proven. Feel unproven. Print is 0.85 cm capitals since v0.5 (1.25 cm before), not the brief's default of about 3 cm (see Changes). |
| 2. In practice, the right separation glows while held; the edge arrow shows when it is outside the display rectangle and hides once inside | `c2-practice-glow-and-arrow`; `extra-ladder-default-off` checks the exact separation glows on all 16 practice grabs; `extra-layout-fit-and-reach` checks the top letter, hint, Start buttons and caption sit inside the display when the Lens opens; plus the camera head turn below | Pass, logic proven. Feel unproven. |
| 3. In recall, nothing glows before the drop; a wrong drop lights the right separation (with the arrow if needed) and counts as helped | `c3-recall-miss-lights-answer`; `extra-hold-cells` covers a refused hold piece in recall | Pass, logic proven. |
| 4. The hold note shows only while that piece is in hand; it is accepted only in the HOLD block | `c4-hold-note-and-hold-block`; `extra-hold-cells` covers all four HOLD cells, the neighbouring cell 35 and cells 76 to 79 on the upper shelf | Pass, logic proven. |
| 5. After the last piece, the case shows "Unaided: X/Y this session", counting only unaided pieces | `c5-recall-unaided-score`; `extra-result-hides-and-session-total`; `extra-ladder-default-off` checks practice changes no count | Pass, logic proven. The card reads "From memory: X of Y this session", confirmed as the default on 2 November (see Changes). |

Extra scenarios, beyond the five criteria:

- `extra-result-hides-and-session-total`: the score hides after 5 s or on a Start press; totals add up across recall passes.
- `extra-sound-cues`: right drop, miss, refused hold and accepted hold each start the right sound on the right source, at volume 0.5, spatial audio on, with a listener on the camera.
- `extra-drill-pace`: the pace light keeps 18 a minute and sits on each separation's centre, including the jumps from 39 to 40 and from 79 back to 0.
- `extra-exit-again-done`: Again starts a new recall pass; Done ends the session.
- `extra-ladder-default-off` and `extra-ladder-on`: the practice ladder (see Changes).
- `extra-mixup-lines`: the mix-up lines (see Changes), and since v0.4 their ends: both end cells outlined in the line's colour, the label at the wrong cell reading the address printed on that letter plus "was put here", "goes here" at the right cell (the HOLD block for a refused hold letter), labels on their own cells as seen from the eye and over no other label, nothing shown during a pass (44 observations), and everything cleared by Again, Done and a Start press.
- `extra-one-pinch-one-press`: a Start press about 0.4 s after Again, and again after Done, is ignored; the same press after 0.6 s works; and a pinch that ends on a button it did not start on does nothing.
- `extra-hold-cells`: the HOLD block boundaries and how a refusal is counted.
- `extra-print-fit`: each address, the hold note and the gloss, measured by their character boxes on the letter while it is in hand, fit the 12.0 cm print width (v0.5 widest: "1460 TRIBUTARY CT" and "3553 FREY LAKE RD" at 11.18 cm; the hold note and gloss measure 8.97 and 8.08 cm, as in v0.4).
- `extra-layout-fit-and-reach`: when the Lens opens, the top letter's corners, the hint, both Start buttons and the case caption are inside the display rectangle from the brief (plus or minus 11.80 by 19.06 degrees), and none of them overlaps the letter. Reach is checked against a stated test assumption, not a measurement on people: the top letter is 43.3 cm from the eye (allowed 30 to 55), 6.5 cm above eye level (allowed -25 to +10), 1.91 cm above the upper shelf's openings and 13.6 cm in front of the case.
- `extra-leaf-overlay-hidden`: the LEAF report panel is gone after a scenario, so captures are clean.
- Since v0.5, `extra-layout-fit-and-reach` also holds the caption wording ("Practice mail, real house numbers") and its small print ("Not a USPS route. Address data (c) OpenStreetMap contributors") itself, and checks both are inside the display at open, inside their backing, over neither each other, the top letter nor the version label (the caption block has 0.76 degrees to spare at the left edge). `c1` checks piece 0 reads "2195 FAIRWAYS CT" and `c4` that the hold letter reads "3553 FREY LAKE RD"; the independent answers read from the printed labels show the hold number is printed on no label of its street.
- Since v0.4, `extra-layout-fit-and-reach` also runs a recall pass and checks the score card, Again and Done are inside the display with at least 0.5 degrees to spare (measured: 1.47, 6.76 and 1.93) and overlap neither each other, the Start row nor the tray.

How the tests stay honest:

- Expected answers are read from what is printed in the scene (the letter's address and the case labels), not from the Lens's own answer table. Each scenario then checks the Lens agrees.
- Every "nothing shows" check is preceded, in the same scenario, by a check that the same thing does show.
- Every check group has a deliberate break that turned it red.

## Latest full LEAF run (raw)

Run one scenario at a time in the preview by the coordinating agent, on v0.5, after a recompile and a refresh, with all 37 script files matching their v0.5 fingerprint. Also in `devpost/evidence/leaf-full-17-run-v05-1404.log`.

```
14:04:22.137 PASSED: c1-pickup-and-snap
14:04:26.948 PASSED: c2-practice-glow-and-arrow
14:04:38.406 PASSED: c3-recall-miss-lights-answer
14:04:47.176 PASSED: c4-hold-note-and-hold-block
14:05:01.936 PASSED: c5-recall-unaided-score
14:05:21.500 PASSED: extra-result-hides-and-session-total
14:05:32.127 PASSED: extra-sound-cues
14:06:23.751 PASSED: extra-drill-pace
14:06:43.459 PASSED: extra-exit-again-done
14:07:02.542 PASSED: extra-ladder-default-off
14:07:44.068 PASSED: extra-ladder-on
14:09:25.703 PASSED: extra-hold-cells
14:09:34.168 PASSED: extra-print-fit
14:09:42.228 PASSED: extra-layout-fit-and-reach
14:09:43.646 PASSED: extra-leaf-overlay-hidden
14:09:59.752 PASSED: extra-one-pinch-one-press
14:11:21.454 PASSED: extra-mixup-lines
```

17 of 17 passed, 0 failed. `extra-mixup-lines` started once at 14:07:47 and was cut off at 14:08:46 with no verdict: the tool call that started it timed out (the scenario runs about a minute and a half), and the next scenario was started while it was still running, which reset the Lens after its third recall pass. It was rerun once on its own and passed.

The v0.4 run (09:48 to 10:08, 17 of 17, `devpost/evidence/leaf-full-17-run-0948.log`) had one run cut off when Lens Studio refreshed its sign-in token; it passed when rerun.

Earlier full runs, kept for history: 6 of 6 passed at 02:44 (session 4), 9 of 9 at 04:46, 04:53 and 05:02 (sessions 9 and 10), 13 of 13 at 06:09 (`devpost/evidence/leaf-full-13-run-0609.log`), 16 of 16 at 07:58 on v0.3 (`devpost/evidence/leaf-full-16-run-0758.log`; `c5` failed once there on the test helper's button press timing out and passed on its rerun).

## Each test fails when the Lens is broken

For each break, one or two lines of Lens code were changed on purpose, the scenario was run and failed, the file was restored from a backup, `cmp` and a fingerprint confirmed it was byte-identical, and the scenario passed again. Every failure line is in `devpost/evidence/break-proofs.log`.

| Session | Breaks | Caught |
|---|---|---|
| 4 | 8 | 8 |
| 9 | 15 | 15 |
| 11 | 16 | 16 |
| Coordinating agent, after 11 | 3 | 3 |
| 13 | 5 | 5 |
| 15 | 9 | 9 |
| Coordinating agent, v0.5 | 11 | 11 |

For v0.5, ten breaks changed a script and one changed a scene setting in memory (the caption text), which was set back and saved; `Scene.scene` was checked unchanged by its SHA-256.

Examples:

| Deliberate break | Failure it produced |
|---|---|
| A recall miss never lights the answer | `after the miss: litSlotIndex Expected: "76" - Received: "-1"` |
| The answer lights on every grab, recall included | `in hand before the drop: litSlotIndex Expected: "-1" - Received: "76"` |
| A helped piece counts as unaided | `helped piece 3 is NOT counted as unaided Expected: "0" - Received: "1"` |
| The HOLD check also accepts the upper shelf | `hold piece back on top after cell 76 Expected: "5" - Received: "6"` |
| Practice counts toward the score | `practice changed no unaided count Expected: "0" - Received: "16"` |
| The pace light drops the shelf change at 40 | `PaceLight at separation 40: off by x 0.000 y 15.000 cm` |
| The chime is never played | `chime source reports isPlaying() within 10 frames of the drop Expected: "true"` |
| Mix-up lines ignore their on/off setting | `after recall 4 with mixUpLines off: mixUpLineCount Expected: "0" - Received: "1"` |
| A new pass keeps the old mix-up lines | `after Again: mixUpLineCount Expected: "0" - Received: "3"` |
| A practice miss draws a mix-up line | `no mix-up line after the practice pass with a miss ... Received: "false"` |
| Address text 10% larger | `piece 0 AddressText "1482 MAIN ST" inside the 12 cm print width ... Received: "false"` |
| Tray 10 cm to the left | `all corners of the top letter inside the display (yaw -21.93..-4.37 ...) ... Received: "false"` |
| Tray 2.5 cm higher | `Start practice button does not overlap the top letter ... Received: "true"` |
| The wrong-cell label drops a character | `MixUpLabel_0_dropped text (letter 4 reads "649 OAK CT") Expected: "649 OAK CT was put here" - Received: "49 OAK CT was put here"` |
| Labels survive Again | `after Again: mixUpLabelCount Expected: "0" - Received: "6"` |
| No time guard after Again | `Start press right after Again ignored (count +1) Expected: "1" - Received: "0"` |
| A button acts on a pinch that did not start on it | `stray release ignored (ignoredStrayReleaseCount +1) Expected: "1" - Received: "0"` |
| v0.5: the hold letter moved onto a real number (3561 FREY LAKE RD) with the product's guard removed | `product answer for "3561 FREY LAKE RD" matches the printed case (independent 55) Expected: "55" - Received: "-2"` |
| v0.5: the small print loses the OpenStreetMap credit | `small print: disclaimer and OpenStreetMap credit Expected: "Not a USPS route. Address data (c) OpenStreetMap contributors" - Received: "Not a USPS route."` |
| v0.5: one cell label not printed | `label baseline covers the labelled cells and HOLD Expected: "76" - Received: "75"` |

Two breaks needed a second try. Turning the ladder on by default was caught only by a read-out, so a second break of the behaviour itself was added. Keeping the held look after release needed two lines, because the Lens resets the look in two places.

## A real failure and its fix

At 03:57, after session 8 changed the Lens, the coordinating agent's run had 4 failures. `c2` and `c3` failed with `arrow sits on the display edge (edge ratio 0.803)` because the arrow now sits 3.5 cm inside the edge, and `c5` and `extra-result-hides-and-session-total` failed on the old "Unaided" card text. Both were intended Lens changes, so the tests were updated to the new arrow position and the new wording, and the full suite passed at 04:46 and 04:53. Evidence: `devpost/evidence/leaf-loop-1-failures.log` and `devpost/evidence/leaf-loop-1-arrow-inset.jpg`.

## Independent review of the tests

A second model (OpenAI Codex) read all nine scenarios, their support code and the Lens scripts they exercise. It found no recall answer shown before the drop and no scenario that sets Lens state and then asserts it back. It raised 12 points about checks that could miss a regression. Status in the current tests:

| Point | Status |
|---|---|
| High: recall never dragged across the correct cell before release | Fixed. `c3` drags over a wrong cell, the correct cell and another wrong cell, checking the glow, labels, arrow and snap outline at each one. |
| High: "no label lit" did not read the label text colours | Fixed. Label colours are compared against a baseline taken with nothing lit. |
| High: expected answers came from the Lens's own answer table | Fixed. Answers are read from the printed address and case labels. |
| Medium: the arrow check read its position, not where it points | Fixed. The arrow tip direction is checked, and the real camera turn was repeated (below). |
| Medium: only two cells tested for the HOLD rule | Fixed in `extra-hold-cells`. |
| Medium: the score test took its wording from the Lens | Fixed. The tests hold the wording themselves. |
| Medium: practice not shown to leave the score alone | Fixed in `extra-ladder-default-off`. |
| Medium: the released-letter check could not fail | Fixed. The released letter's own mesh is checked, and the address size is measured as rendered. |
| Medium: the pace test checked a computed number more than the light | Fixed. The light's position is checked on each separation. |
| Medium: sound checks proved bookkeeping, not playback | Fixed as far as the preview allows: playback, track, volume and spatial settings are checked. Hearing it is still manual. |
| Medium: this log overstated its evidence | Fixed in this version. |
| Low: the 5 s timeout followed the Lens's setting | Fixed. The test holds 5 s itself. |

## Head turn (criterion 2)

LEAF cannot turn the head, so the preview camera was turned toward separation 9 while the letter for it was held. The arrow hid between 52% and 53% of the turn; the geometry predicts 52.86%. Captures: `devpost/evidence/headturn-before.jpg` and `headturn-after.jpg`. The "before" capture still shows the earlier two-layer glow, which session 6 removed. Both captures and the 52.86% figure come from the layout before session 12; the arrow's hide rule is rechecked on the current layout by `c2` in every run.

## Test tooling left in the scene

- `LeafIndex`, `LEAF Plugin Bridge` and `AiPreviewAgent Handler` hold only scripts and draw nothing. They stay in the project (confirmed on 2 November, see Changes). Each one acts only when a test tool calls it: `LeafIndex` only lists the scenarios, `LEAF Plugin Bridge` waits for LEAF's messages and runs a scenario only when a LEAF run sends one, and `AiPreviewAgent Handler` answers the preview agent's inspect and hand tools in the editor and returns at once anywhere else.
- After the Mac crashed at 13:10, Lens Studio reopened CaseLight itself and never set up its TypeScript compiler: every recompile reported "TypeScript compiler is not configured" and the preview ran no scripts. Switching Lens Studio to its default project and back fixed it (the project lock file it still held for CaseLight was moved aside beforehand, as Lens Studio refused to reopen the project otherwise). No project file changed.
- When the LEAF panel reopened after the project was reopened (v0.5 round), it created its `LEAF Plugin Bridge` object again: the saved scene shows the same object and script under new ids, nothing else.
- The AiPreviewAgent puppet hand keeps control of the SIK hand until the Lens resets. Reset the preview before recording.
- The preview camera tool's `rotate` flips the view about 89 degrees up when the pitch goes negative; `lookAt` works.
- LEAF's report panel is set to show for 0 ms and is hidden again at the end of every scenario. LEAF's one-line log strip stays after a LEAF run, so the film stills were taken after a plain preview refresh with no scenario run, when neither is in the scene.

## Performance (Preview only)

Two 20 s traces on the laptop preview, taken before session 12's layout change; details in `devpost/evidence/perf-preview-traces.md`. These numbers do not describe SPECS hardware.

- Driving the drops by hand (no LEAF): frame time p50 4.14 ms, p90 6.03 ms, p99 7.62 ms. The one frame over 33.3 ms (42.98 ms) is the preview's own camera and face simulation.
- Under a LEAF scenario, script update frames reached 71.15 ms about once a second. The same drops by hand never passed 4.83 ms, so the spikes are most likely the scenario's own checks, not the Lens.
- No optimisation was needed or made.

## Media

- `devpost/media/lens-icon.png`: generated with Lens Studio's lens icon generator and set as the Lens icon. Lens Studio marks the project as having a generated icon.
- `devpost/media/film/`: 9 numbered stills of v0.5, all from one preview session (14:12 to 14:16) (opening view; practice with the slot lit; practice with the slot off to the side and the arrow; recall with the case dark; a recall miss lighting the right slot and its label; the HOLD letter and its note; the score card; a mix-up line; Again and Done). `REPRODUCE.md` there gives the steps and the exact agent commands for each one.
- `devpost/media/preview-lit-slot-3x4.jpg` (and the full frame): taken before session 12, so it shows the old 29.2 cm letter. Film still 02 replaces it.
- The Lens name is set to CaseLight.

## What the tests do not prove

- **Feel.** One-inch precision with real hands, comfort over time and real hand tracking need SPECS glasses. Feel unproven.
- **Reach.** The reach check uses a stated assumption (30 to 55 cm from the eye, 25 cm below to 10 cm above eye level), not a measurement on people. The top letter sits 6.5 cm (8.6 degrees) above eye level, so the hand is raised to take it. Both preview hands grab it; a real arm is untested.
- **Hearing.** The sounds are shown to play on the right sources; whether they are audible is a manual check.
- **Print size.** Address capitals are requested at 0.85 cm (v0.5) and the rendered line box is 1.52 cm tall. A copy of film still 03 scaled to 720 pixels tall (`devpost/evidence/readability-720p-v05-still03.png`) still reads clearly for the address, the case numbers and the caption; the small print is legible but small. Whether any of it reads comfortably on SPECS is untested.
- **One pinch, one press.** Before v0.4, a pinch by the preview agent's hand on Again or Done also pressed the Start button behind it (3 times out of 3; seen from the order the letters were stacked in afterwards). v0.4 fixes this; the same preview pinches afterwards pressed only Again or only Done, and `extra-one-pinch-one-press` covers both rules. Whether a real hand on SPECS ever triggered it is unknown, and the fix is not checked on hardware.
- **SPECS performance.** Only the laptop preview was traced.

## Changes made after the brief was approved

These were made during the build and are recorded here rather than in the brief.

- The score, the Start buttons, the start hint and the caption were moved into the view you have when the Lens opens. The bundle tray sits centred just above the case, not at waist height, so the whole top letter is inside the display when the Lens opens.
- Letters are 13.2 x 5.4 cm with addresses in 1.25 cm capitals. The brief's "about 3 cm tall text" was a default, not Stephen's choice. At 3 cm the longest sample address is about 29 cm wide, and the display is about 18 cm wide at the letter's 43 cm distance, so 3 cm print and a whole letter in view cannot both hold. Session 12 kept the whole letter in view. 1.25 cm was confirmed on 2 November (see below). One sample street was renamed from CEDAR CT to OAK CT so its longest address fits. In v0.5 the capitals went to 0.85 cm for the real street names (see Changed for v0.5).
- The hold letter is "3553 FREY LAKE RD" (v0.5), a number that does not exist on that street. Before v0.5 it was "238 ELM AVE", a number the invented route did not use.
- Rules the brief left open: a practice miss bounces back to the hand and is not counted; a letter let go away from the case returns to the hand; recall totals add up across passes in one session; delivery order runs along the lower playable shelf, then the upper one.
- Score card wording: "From memory: X of Y this session" instead of the brief's "Unaided: X/Y this session". One setting on the Lens (`resultTemplate`) restores Stephen's wording.
- Sound cues (listed under Later in the brief): a chime for a right drop and a short miss tone for a miss or refused hold, played from the separation.
- Drill pace (not in the brief): off by default, 18 pieces a minute.
- Practice ladder (not in the brief, off by default): a correct placement moves an address up a rung, a miss moves it down. At higher rungs practice shows only the row or the shelf instead of the exact separation. With the ladder on, criterion 2 no longer holds as written, which is why it is off.
- Mix-up lines (close to the brief's Later "confusion-pair drill", on by default): after a recall pass, a thin line joins each missed cell to its right cell on the score view. Since v0.4 both end cells are outlined, the wrong cell is labelled with the address and "was put here", and the right cell with "goes here". The labels sit on a dim plate of the line colour; a lighter plate let the edge of the letter in the cell show through.
- One pinch, one press (v0.4): a button acts only when the same pinch started on it, and a Start press within 0.6 s of Again or Done is ignored (setting `startGuardSeconds`).
- The ladder and the mix-up lines were added by the agents under Stephen's general go-ahead. Their defaults were confirmed on 2 November (see below).

### Confirmed on 2 November

At about 10:35, Stephen asked his orchestrating Claude session to settle the open decisions itself ("do all this yourself please go ahead and get this done"). That session made the six decisions below on his behalf. Stephen did not pick each one himself, and each one can be reversed.

1. Score wording: "From memory: X of Y this session" is the default. The `resultTemplate` setting still restores "Unaided: X/Y this session".
2. Practice ladder stays off by default. Mix-up lines stay on, shown only after a recall pass.
3. Address capitals stay at 1.25 cm, so the whole top letter stays in view. (In v0.5 the size went to 0.85 cm, because the real addresses did not fit at 1.25 cm; the whole letter still stays in view. See Changed for v0.5.)
4. The mix-up labels keep their dim pink plate.
5. The test tooling objects (`LeafIndex`, `LEAF Plugin Bridge`, `AiPreviewAgent Handler`) stay in the project. They draw nothing and act only when a test tool calls them (see Test tooling left in the scene).
6. The Icon Atlas plugin folder and the Bitmoji 3D package stay for now. Removing them later needs a full LEAF re-run afterwards.

No Lens code or scene setting changed with these decisions: each one keeps what v0.4 already does.

### Changed for v0.5: real streets

Shortly after 13:30 on 2 November, Stephen told his orchestrating Claude session "build the real streets, do it all yourself". This carries out his decision from the night before: real OpenStreetMap streets near KSU, the ODbL credit, exception notes only on house numbers that do not exist, and no resident information. The coordinating agent made these changes:

1. Route: the invented streets (MAIN ST, ELM AVE, BIRCH LN, OAK CT) are replaced by 149 real house numbers on FAIRWAYS CT, LEE CT, FREY LAKE RD and TRIBUTARY CT, from an OpenStreetMap download (homes only; a park at 3506 Lee Court was dropped). The case order follows USPS handbook M-41 224.12: on each street, the odd side ascending, then the even side descending, two numbers per separation over slots 0 to 35 and 40 to 78. Slot 79 is empty, so the case has 75 labelled cells instead of 76. The table in `CaseLightRoute.ts` is written from `data/case_light_route_osm.json` by `data/make_route_table.py`, which can also check that the two match.
2. Each practice letter keeps its old slot and side, so the case geometry and every LEAF drop target stayed where they were.
3. Hold letter: 3553 FREY LAKE RD, a number that is on neither OpenStreetMap's list nor the county's active address list for that street. The Lens now refuses to start if a hold letter is ever a number on the route.
4. Address size: at 1.25 cm capitals, `extra-print-fit` failed. The real addresses measured up to 16.44 cm against the 12.0 cm print width, and 7 of 8 did not fit (`devpost/evidence/print-fit-v05-size-change.log`). The capitals went to 0.85 cm, the largest size that keeps the widest address (11.18 cm) inside with more than the v0.4 margin (0.41 cm a side). The letter stays 13.2 x 5.4 cm, so the whole top letter still fits the view, which was the reason for decision 3 above; only the size changed. The hold note and gloss keep their v0.4 sizes.
5. Caption: "Preview: sample letters" became "Practice mail, real house numbers", with small print under it: "Not a USPS route. Address data (c) OpenStreetMap contributors". Both sit on the case under the tray, in view when the Lens opens, left of the version tag.
6. Street names print once per run of a street on a shelf. Their smaller repeats need three free cells, so the longest name (12 characters) is never squeezed. A cell with one delivery (slot 78) shows one number.
7. Version v0.5.

## Release notes: v0.5

- Real house numbers from OpenStreetMap on four streets near KSU, labelled as practice mail and not a USPS route, with the OpenStreetMap credit in view (`data/ATTRIBUTION.md`).
- Hold letter 3553 FREY LAKE RD, a number that does not exist on that street.
- Address capitals 0.85 cm so every real address fits the print width.
- 17 LEAF scenarios, all passing; 11 new break proofs (67 in all).
- New film stills (`devpost/media/film/`).

Known issues:

- The small print is 0.40 cm capitals. It reads in the preview and in a 720-pixel copy, but it is the smallest text in the Lens.
- The caption block has 0.76 degrees to spare at the left edge of the display.
- Four-digit cell labels nearly fill their one-inch cells, so neighbouring numbers sit close together.
- The mix-up label for a 17-character address is wider than its cell and reaches the next cells (it still passes the checks that it covers no other label).
- `extra-print-fit` measures the 8 letters of the default bundle; the other 4 letters a 12-letter bundle can add were not measured (all are 17 characters or shorter).
- The v0.4 known issues below still apply, except the thin print margin (now 0.41 cm a side).

## Release notes: v0.4

What changed since the approved brief:

- Glow drawn with a shader-graph material, one lit cell.
- Sounds, drill pace, practice ladder, mix-up lines, Again and Done buttons.
- Readability pass: white held card, lit labels, street names repeated every 8 cells, light backing panels, HOLD gloss "HOLD: mail kept at the office".
- Version tag v0.4 on the ledge; the Lens prints "Lens Opened: v0.4" when it starts.
- Layout pass (session 12): smaller letter, centred tray, one row of buttons, every address inside the print width, the whole top letter in view when the Lens opens.
- v0.4 (session 14): labelled mix-up ends, one pinch presses one button.
- 17 LEAF scenarios with 56 break proofs.

Known issues:

- The print margin is thin: the widest address leaves 0.22 cm on each side.
- The Start buttons clear the top letter by 0.48 degrees (about 0.4 cm); raising the tray 2.5 cm makes them overlap.
- The hold note's and the gloss's line boxes overlap by 0.05 cm (line boxes, not ink).
- The top of a mix-up label can sit right at the top of its cell opening (0.01 degrees to spare for "649 OAK CT").
- Wide labels leave gaps in the outlines, so a cell next to a label can show only its two side bars.
- The Start guard has about 0.2 s to spare against LEAF's own press timing (its presses land 0.34 to 0.42 s after Again or Done).
- Lens Studio reports wrong world bounds for the meshes built in script, so the tests measure drawn vertices instead, through a deprecated call that logs a warning on each run.
- A sound source that is restarted reports "not playing" on its next query in the same frame, so the sound tests poll for a few frames.
