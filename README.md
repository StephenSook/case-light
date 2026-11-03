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
3. Check the tests: 35 LEAF scenarios, one per done criterion plus 30 extras, all passing in the last full run
   (v0.6, 21:50 to 22:10 ET on 2026-11-02, `devpost/evidence/leaf-full-35-run-v06-final.log`), every run under LEAF's
   fail-fast policy so no input could be simulated (earlier evidence logs used LEAF's default, "fallback"). The Lens was
   broken on purpose 118 times; each break turned its test red with the message shown in
   `devpost/evidence/break-proofs.log`, and every file was restored byte for byte. One more planted break (the demo
   replay switched on by default in code) slipped past LEAF and is caught by `tools/check_repo.py` instead.

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
| Reach with a real arm | Preview hands grab the letters; a real arm is untested. LEAF's fail-fast policy is used so no reach is simulated (see below). |
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
| "Add an onboarding" | start hint: "Pinch Start practice" / "Practice, then the case goes dark." | LEAF check |
| "a beginning, middle and end, and a way to repeat" | practice, recall, score, Again / Done | LEAF check |
| "Guide Users for Out-of-View Elements" | edge arrow, hides once the whole cell is in view | head-turn captures |
| Targets "at least 2 degrees in angular size" | one-inch cells = 2.54 cm at 55 cm (2.0 cm minimum) + a snap outline while dragging | layout |
| Preview image, custom icon, release notes | `devpost/media/lens-icon.png`, film still `devpost/media/film/02-practice-letter-in-hand-slot-glowing.png`; release notes in BUILD_LOG | files |
| On-device testing | Not possible: built and tested in the Lens Studio preview only | stated |

## What I learned


The biggest thing I learned is that "done" has to be something you can check. The plan-lens interview set
five done criteria before any code existed, and those five became the first tests. Then we broke
the Lens on purpose 118 times to make sure each test actually catches the bug it's meant to.

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
