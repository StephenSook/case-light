# Case Light

Practice a sample mail case, then place the same letters from memory. A miss lights the right slot, and your score only counts the letters you placed from memory.

A Lens for SPECS: planned with the plan-lens interview from Devpost's Learn AR with SPECS skill pack, built with CLAD and the Lens Studio MCP in Lens Studio 5.23.2, and tested in the Lens Studio preview (no SPECS device).
The letters are practice mail. The case uses real house numbers from OpenStreetMap on two routes near KSU
(4 and 8 streets, see `data/`); it is not a USPS route, and no resident information is used. Each hold letter uses a
house number that does not exist on its street.

## Judge it in 90 seconds

1. Watch the demo video (link added when it is published, before Nov 9).
2. Read `devpost/design-brief.md` (the plan-lens brief), `devpost/PROMPTS.md` (every prompt that started a build
   round) and `devpost/BUILD_LOG.md` (every CLAD session, tool-call counts, the raw LEAF runs).
3. Check the tests: 45 LEAF scenarios, one per done criterion plus 40 extras, all passing in the last full run
   (16:07 to 16:47 ET on 2026-11-03, `devpost/evidence/leaf-full-45-run-v07.log`), every run under LEAF's
   fail-fast policy so no input could be simulated (earlier evidence logs used LEAF's default, "fallback"). The numbers
   the tests measured in that run are in `devpost/evidence/leaf-measurements-v07.log`. The Lens was broken on purpose
   144 times; each break turned a test red with the message shown in `devpost/evidence/break-proofs.log` (one break,
   Options pressed at the score card, turned two tests red), and every file was restored byte for byte. One more
   planted break (the demo replay switched on by default in code) slipped past LEAF and is caught by
   `tools/check_repo.py` instead.

## What it does

- A real-size letter case: 6 shelves of 40 one-inch cells, 2 of them playable, handbook-style labels with real
  house numbers in M-41 line-of-travel order (each street's odd side going up, then its even side coming back).
  The slots are real size, 1 inch apart as the carrier handbook specifies (M-41 221.2), with 40 to a shelf. The frame
  around them is about 10 cm wider than one vendor's 44-inch case (a reported vendor figure, not verified).
- Practice pass: pick up a letter (pinch), the right cell glows, and an edge arrow shows when the cell is outside
  the display. It hides once all four corners of the cell are in view.
- Recall pass: the case stays dark. A miss lights the right cell (and plays a low tone from it), that letter counts
  as helped, and it comes back 2 letters later, dark, for a fresh try. A letter placed from memory in 2 recall passes
  in a row is retired for the session.
- A hold letter is accepted only in the HOLD block.
- At the end: "From memory: X of Y this session" and "Came back: N". A helped letter does not count in that pass.
- Today's route: pick Route 1 or Route 2 before practice; the case and the letters relabel.
- Optional: put the case on a real wall; a Veteran mode that pins one of three sorting reminders to a cell (shown in
  recall only after a miss there); a Case check after recall (two letters sit in wrong cells, find both).
- Show my case: a map on the case from this session's recall, per row "Learned", "Review N" or "Not tried N"
  (hidden during a pass, so it never gives answers away).
- Progress is saved on the device between sessions: the next start says, for example, "Welcome back. Last time: 7 of 8
  from memory" and "Route 1: 1 of 2 rows learned", with a Reset progress button.
- With nothing saved, an animated hand shows the pinch at the top letter until the letter is grabbed.
- Options holds Drill pace and Hide stand-in case (hides the drawn case lines and printed labels, for use at a real
  case). Every button is at least 1 degree from the next and at least 2 degrees each way in every view the tests reach.
- On a wall the controls grow with their distance from the eye (2.70 times at 154 cm), so they keep the same
  angular size.
- Every placement is logged; `devpost/tools/summarize_session.py` recomputes the score from the log.
- A demo replay (off by default, an Inspector setting) plays back one recorded test run, labelled "Demo replay" on
  every frame.

## Why it belongs on glasses

A carrier cases mail standing at the case with both hands busy: USPS casing guidance (M-39 121.14 and the city
carrier training guide) describes picking up "2 or more inches of mail with the left hand", and the other hand places
each letter. A hint has to appear where
the letter goes, at the real cell, without a screen to look away to and without touching anything. On SPECS the cell
itself lights, at one-inch scale, at arm's length, in the same place a real case would put it.

## Who it's for

New city carriers. The M-41 handbook (June 2019) tells a carrier to "Memorize the line of travel for the first two
rows" (224.12) and, when casing, to "Recall the correct separation" (224.24). At the end of fiscal 2025 the Postal Service had 178,026
career city carriers and 23,921 city carrier assistants (FY2025 Annual Report to Congress), and in FY2024 only 40.8%
of new city carrier assistants were still on the job after one year (USPS OIG 24-131-R25, preliminary).

## What is simulated, what is not proven

| Item | Status |
|---|---|
| Sample mail | The letters are practice mail with labelled sample addresses: real house numbers from OpenStreetMap, no names, no resident information, not a USPS route. |
| Head turn with a real head | LEAF cannot turn the head; checked separately with the preview camera. |
| Reach with a real arm | LEAF's IK body (two IK-solved arms, no fallback to simulated input) carries letters into the real slots in `extra-ik-loop`: let-go points 48.5 to 55.8 cm from the shoulder, letters landing 0.16 to 0.45 cm from the aim. Start buttons sit 75.0 and 75.8 cm from the shoulder of the IK hand that presses them, past LEAF's 67.5 cm direct reach; on device they are ray targets; LEAF's ray strategy did not converge at that distance, so the IK hand presses them directly (PRESS_HOW switch reproduces the failure). A real arm is untested. |
| A real wall | Wall placement is tested against Lens Studio's "Sunlit Room" preview scene, not a real wall. |
| Demo replay | A playback of one recorded LEAF test run (real SIK input in the preview), labelled "Demo replay" on every frame; not a person wearing SPECS. |
| Feel: one-inch precision, comfort over time | Needs SPECS glasses and real hand tracking. |

## How it was built

plan-lens interview, then CLAD agents (specs-experience-builder, live-lens-tester) and a coordinating agent, all
working in Lens Studio through the Lens Studio MCP; every session, its tool calls and minutes are in
`devpost/BUILD_LOG.md`. Test tooling in the scene: LeafIndex, LEAF Plugin Bridge, AiPreviewAgent Handler (they act only
when a test tool or the preview agent calls them).

| Skill (invoked, per `devpost/BUILD_LOG.md`) | What it shaped |
|---|---|
| `plan-lens` (Devpost skill pack) | `devpost/design-brief.md` |
| `specs-project-init`, `specs-leaf-install-packages` | the SIK, UI Kit and LEAF packages in `Packages/` |
| `scene-construction`, `editor-api` | `Assets/Scene.scene` |
| `mesh-builder-scripting` | `CaseLightCaseMesh.ts`, `CaseLightMeshUtil.ts`, `Assets/SimpleVertexBaseColor.lspkg` |
| `specs-interaction-recipes` | grab and snap in `CaseLightBundle.ts` |
| `specs-build-ui` | `CaseLightControlsUI.ts`, `CaseLightExitUI.ts`, `CaseLightPlacementUI.ts` |
| `specs-world-query` | wall placement in `CaseLightPlacement.ts` |
| `shader-graph` | `Assets/Materials/CaseLightGlow.graphShader` |
| `specs-audio`, `build-sfx` (its engine did not start; the tones were synthesised by a short script) | `CaseLightAudio.ts`, `Assets/GeneratedSFX/` |
| `specs-leaf-write-scenarios`, `specs-leaf-run-in-preview` | `Assets/Scripts/Leaf/` |
| `specs-capture-perf-trace`, `perfetto-trace-analysis`, `specs-lens-perf-attribution` | `devpost/evidence/perf-preview-traces.md` |

## Snap's Spectacles guidance (Snap's own words; developers.snap.com: Publishing Your Spectacles Lens, Design Best Practices, Positioning & Sizing Content)

| Snap asks for | Case Light | Evidence |
|---|---|---|
| "Target 60 FPS at all times" | Laptop preview only, not SPECS, traced before the session 12 layout change: frame time p50 4.14 ms, p90 6.03 ms, p99 7.62 ms when driven by hand | BUILD_LOG "Performance (Preview only)" |
| "Show the version number visibly on Lens launch" and log "Lens Opened: vX.X.X" | visible v0.6 label + "Lens Opened: v0.6" log line | `CaseLightVersion.ts`, `CaseLightMain.ts` |
| "Provide a debug menu and in-lens tests" | LEAF scenarios, each proven to fail when the Lens is broken | devpost/BUILD_LOG.md |
| "Add an onboarding" | start hint: "Pinch Start practice" / "Practice, then the case goes dark."; with nothing saved, an animated hand shows the pinch at the top letter until that letter is grabbed | `extra-pinch-hint` |
| "a beginning, middle and end, and a way to repeat" | practice, recall, score, Again / Done | LEAF check |
| "Guide Users for Out-of-View Elements" | edge arrow, hides once the whole cell is in view | head-turn captures |
| Targets "at least 2 degrees in angular size" | one-inch cells, measured pitch 2.54 cm, at 55 cm (2.0 cm minimum) + a snap outline while dragging; buttons: smallest 2.19 x 2.07 deg (Route 1) at the opening view | `extra-case-real-scale`, `extra-button-spacing`; `devpost/evidence/leaf-measurements-v07.log` |
| "Targetable elements should be spaced at least 1 degree apart" | Buttons: smallest target 2.19 x 2.07 deg, smallest gap 1.06 deg (Options to Start practice) at the opening view (LEAF check fails under 1.0 deg); the smallest gap is also 1.06 deg with Options open (smallest target there 2.36 x 2.05 deg), at the score card and with the welcome up; Veteran reminder options 1.27 deg apart. On a wall: smallest gap 1.02 deg and smallest target 2.12 x 2.11 deg, measured at the scenario's one aim, with the case about 6 deg off axis. Cells touch on purpose, like a real case. | `extra-button-spacing`, `extra-button-spacing-exit`, `extra-button-spacing-veteran`, `extra-wall-placement`; `devpost/evidence/leaf-measurements-v07.log` |
| "about 0.5 to 3 m, never head-locked" (Devpost FAQ) | The case and its controls at 57.13 cm; the top letter at 43.3 cm, inside arm's reach on purpose (closer than 0.5 m). On a wall the case sits on the wall (154 cm in the test room) and its controls scale with it. Only the edge arrow is head-locked, on purpose: it points to cells outside the display. | `extra-layout-fit-and-reach`, `extra-wall-placement`; `devpost/evidence/leaf-measurements-v07.log` |
| "Consider User Breaks ... content that allows for pausing or saving progress" | Rows learned per route and the last score are saved in the Lens's local storage; the next start shows "Welcome back. Last time: 7 of 8 from memory" / "Route 1: 1 of 2 rows learned" and a Reset progress button (5.60 x 2.12 deg). Tested across Lens restarts. | `extra-progress-save`, `extra-progress-welcome`, `extra-progress-reset` |
| "Recognition Over Recall" | Recall is the point, on purpose: a carrier has to "Recall the correct separation" (M-41 224.24). The practice pass, where the slot glows, is the recognition step before it. | design brief |
| "Leverage sounds as well as visuals" | A chime from the cell on a right drop (0.36 s) and a low tone from the answer cell on a miss (0.30 s), spatial, volume 0.5; LEAF checks playback, track, volume and the spatial settings (hearing them is manual) | `extra-sound-cues`; `devpost/evidence/leaf-measurements-v07.log` |
| "Align on if there should be a demo mode for events" | A demo replay (off by default, an Inspector setting) plays one recorded test run, labelled "Demo replay" on every frame; `tools/check_repo.py` fails if it is on by default | `extra-demo-replay`, `tools/check_repo.py` |
| "Final published Lens must be <= 25 MB" | Not measured: the Lens was not published (no publishing account) | stated |
| Preview image, custom icon, release notes | `devpost/media/lens-icon.png`, film still `devpost/media/film/02-practice-letter-in-hand-slot-glowing.png`; release notes in BUILD_LOG | files |
| On-device testing | Not possible: built and tested in the Lens Studio preview only | stated |

## What I learned


The biggest thing I learned is that "done" has to be something you can check. The plan-lens interview set
five done criteria before any code existed, and those five became the earliest tests. Then we broke
the Lens on purpose 144 times to make sure each test actually catches the bug it's meant to.

I also learned the glasses can't show a whole mail case at arm's length. The display is about 23 by 38 cm at 55 cm,
and a full-size letter is 29.2 cm wide. So we added an edge arrow, and the agents shrank the print until the whole address fits in view. LEAF can press buttons and drag letters, but it can't turn your head, so we checked the arrow by
turning the preview camera instead.

The design changed too. After two outside reviews I made the recall pass the point of the drill, because getting a letter right
while the slot glows doesn't prove you remember it. New carriers have a whole route to memorize, and I want them to know
what they actually remember before they're out there on their own.

## Data

`data/case_light_route_osm.json` (Route 1) and `data/case_light_route_osm_b.json` (Route 2): house numbers and street
names from OpenStreetMap, (c) OpenStreetMap contributors, available under the Open Database License (ODbL 1.0,
https://www.openstreetmap.org/copyright). See `data/ATTRIBUTION.md` for what was changed. Only residential buildings
were used. Everything else that is not original work is listed, with its source and terms, in `THIRD_PARTY_NOTICES.md`,
which also has a provenance table (new work, generated, pre-existing).

## Checks that run on every push

`.github/workflows/checks.yml`: a gitleaks scan of the full history, and `tools/check_repo.py`, which counts the LEAF
scenarios, fails if this README's count disagrees with the code, checks both routes' street data (no number twice, the
HOLD block empty, each hold letter on a number that is not on the case, the attribution present, the Lens's tables and
the tests' copies matching the data files), checks that the demo replay is off in the shipped code and scene, checks
`THIRD_PARTY_NOTICES.md`, and fails on tracked local-only files, saved tokens in the scene, or em dashes in the docs.
`tests/` holds plain-Node unit tests for the scene-free rules (`tests/README.md`); the Python reference for the case
order is checked against the Lens's tables there.

## License

Our code and docs: MIT (see LICENSE). The street data in `data/` is under ODbL 1.0. Packages under `Packages/` keep
their own terms; see `THIRD_PARTY_NOTICES.md`.
