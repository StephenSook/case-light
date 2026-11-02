# Case Light

Practice a sample mail case, then place the same letters from memory. A miss lights the right slot, and your score only counts the letters you placed from memory.

A Lens for SPECS, built with CLAD in Lens Studio 5.23.2 and tested in the Lens Studio preview (no SPECS device).
The letters are practice mail. The case uses real house numbers from OpenStreetMap on four streets near KSU
(see `data/`); it is not a USPS route, and no resident information is used. The hold letter uses a house number
that does not exist on its street.

## Judge it in 90 seconds

1. Watch the demo video (link added when it is published, before Nov 9).
2. Read `devpost/design-brief.md` (the plan-lens brief) and `devpost/BUILD_LOG.md` (every CLAD session, tool-call
   counts, the raw LEAF run).
3. Check the tests: 17 LEAF scenarios, one per done criterion plus 12 extras, all passing in the last full run
   (v0.5, 14:04 to 14:11 ET on 2026-11-02, `devpost/evidence/leaf-full-17-run-v05-1404.log`). The Lens was broken on
   purpose 67 times; each break turned its test red with the message shown in the build log, and every file was restored
   byte for byte.

## What it does

- A real-size letter case: 6 shelves of 40 one-inch cells, 2 of them playable, handbook-style labels with real
  house numbers in M-41 line-of-travel order (each street's odd side going up, then its even side coming back).
- Practice pass: pick up a letter (pinch), the right cell glows, and an edge arrow shows when the cell is outside
  the display. It hides once all four corners of the cell are in view.
- Recall pass: the case stays dark. A miss lights the right cell and that letter counts as helped.
- A hold letter is accepted only in the HOLD block.
- At the end: "From memory: X of Y this session". A helped letter does not count in that pass.

## Who it's for

New city carriers. The M-41 handbook (June 2019) tells a carrier to "Memorize the line of travel for the first two
rows" (224.12) and, when casing, to "Recall the correct separation" (224.24). At the end of fiscal 2025 the Postal Service had 178,026
career city carriers and 23,921 city carrier assistants (FY2025 Annual Report to Congress), and in FY2024 only 40.8%
of new city carrier assistants were still employed after their first year (USPS OIG 24-131-R25, preliminary).

## What the preview cannot prove

| Not proven | Why |
|---|---|
| Head turn with a real head | LEAF cannot turn the head; checked separately with the preview camera |
| Reach with a real arm | Both preview hands grab the letters; a real arm is untested |
| Feel: one-inch precision, comfort over time | Needs SPECS glasses and real hand tracking |

## How it was built

plan-lens interview, then CLAD agents (specs-experience-builder, live-lens-tester) in 15 sessions, 2,074 tool calls,
about 433 minutes (per `devpost/BUILD_LOG.md`). Test tooling in the scene: LeafIndex, LEAF Plugin Bridge, AiPreviewAgent Handler (they act only when a test tool or the preview agent calls them).

## Snap's Spectacles guidance (Snap's own words; developers.snap.com: Publishing Your Spectacles Lens, Design Best Practices, Positioning & Sizing Content)

| Snap asks for | Case Light | Evidence |
|---|---|---|
| "Target 60 FPS at all times" | Laptop preview only, not SPECS, traced before the session 12 layout change: frame time p50 4.14 ms, p90 6.03 ms, p99 7.62 ms when driven by hand | BUILD_LOG "Performance (Preview only)" |
| "Show the version number visibly on Lens launch" and log "Lens Opened: vX.X.X" | visible v0.5 label + "Lens Opened: v0.5" log line | `CaseLightVersion.ts`, `CaseLightMain.ts` |
| "Provide a debug menu and in-lens tests" | LEAF scenarios, each proven to fail when the Lens is broken | devpost/BUILD_LOG.md |
| "Add an onboarding" | start hint: "Pinch Start practice" / "Practice, then the case goes dark." | LEAF check |
| "a beginning, middle and end, and a way to repeat" | practice, recall, score, Again / Done | LEAF check |
| "Guide Users for Out-of-View Elements" | edge arrow, hides once the whole cell is in view | head-turn captures |
| Targets "at least 2 degrees in angular size" | one-inch cells = 2.54 cm at 55 cm (2.0 cm minimum) + a snap outline while dragging | layout |
| Preview image, custom icon, release notes | `devpost/media/lens-icon.png`, film still `devpost/media/film/02-practice-letter-in-hand-slot-glowing.png`; release notes in BUILD_LOG | files |
| On-device testing | Not possible: built and tested in the Lens Studio preview only | stated |

## What I learned


The biggest thing I learned is that "done" has to be something you can check. The plan-lens interview made me
write five done criteria before any code existed, and those five became the first tests. Then we broke
the Lens on purpose 67 times to make sure each test actually catches the bug it's meant to.

I also learned the glasses can't show a whole mail case at arm's length. The display is about 23 by 38 cm at 55 cm,
and a full-size letter is 29.2 cm wide. So we added an edge arrow, and the agents shrank the print until the whole address fits in view. LEAF can press buttons and drag letters, but it can't turn your head, so we checked the arrow by
turning the preview camera instead.

The design changed too. After two outside reviews I made the recall pass the point of the drill, because getting a letter right
while the slot glows doesn't prove you remember it. New carriers have a whole route to memorize, and I want them to know
what they actually remember before they're out there on their own.

## Data

`data/case_light_route_osm.json`: house numbers and street names from OpenStreetMap, (c) OpenStreetMap contributors,
available under the Open Database License (ODbL 1.0, https://www.openstreetmap.org/copyright). See
`data/ATTRIBUTION.md` for what was changed. Only residential buildings were used; a park was dropped.

## Checks that run on every push

`.github/workflows/checks.yml`: a gitleaks scan of the full history, and `tools/check_repo.py`, which counts the LEAF
scenarios, fails if this README's count disagrees with the code, checks the street data's rules (no number twice, the
HOLD block empty, the hold letter on a number that is not on the case, the attribution present), and fails on tracked
local-only files, saved tokens in the scene, or em dashes in the docs.

## License

Our code and docs: MIT (see LICENSE). The street data in `data/` is under ODbL 1.0. Packages under `Packages/` keep
their own licenses.
