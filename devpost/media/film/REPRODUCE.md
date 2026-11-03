# CaseLight film stills: how each one was made

Captured 2026-11-02 between 22:18 and 22:26 (local time), on Lens v0.6, in Lens Studio 5.23.2. Preview panel "Preview 3": Interactive input, the built-in Plane scene, device SPECS 27, camera view Front, upscale 1280. Output size 1400 x 1590 for every still: that is the panel's current size (the v0.5 stills were 1392 x 1910; the panel size cannot be set from the tools used here). The Plane scene was in use the whole time and the preview was left on it.

The letters are practice mail. Their house numbers and streets are real, from OpenStreetMap, on streets of two routes near Kennesaw State University; this is not a USPS route and no resident information is used. The case caption says so: "Practice mail, real house numbers", with "Not a USPS route. Address data (c) OpenStreetMap contributors" under it. Each route's hold letter (Route 1: 3553 FREY LAKE RD; Route 2: 3053 SHIRLEY DR) uses a number that does not exist on that street. Data and its license: `data/case_light_route_osm.json`, `data/case_light_route_osm_b.json` and `data/ATTRIBUTION.md`.

The two white vertical lines stay at the same place on screen in every still, whatever way the camera turns, so they mark the view frame (about plus or minus 11.8 degrees), not the case.

## How the states were reached (read this before any single still)

- **Still 01 has no probe at all.** It is the Lens exactly as it opens after a preview refresh, with the product scripts as shipped.
- **Stills 02 to 09 and 11 to 14 were reached by a temporary probe that called the product's own handlers, not by hand input in the preview.** The probe was a block of code added for this capture only inside `CaseLightMain.onStart` (after the "ready" line), compiled, run once per still from a fresh preview refresh, and then removed: `Assets/Scripts/CaseLightMain.ts` was restored byte for byte (SHA-256 `35cddb90081b26bbf234ee73c5b7a326029a719985edd358a08bd79459f4f415` before and after), recompiled and refreshed clean. No component was added to the scene and the scene was not saved.
- The handlers the probe called are the ones real input reaches:
  - Start practice, Start recall, Again and Case check: the button's own event (the same event the UIKit button fires on a release that began on it).
  - Picking up the top letter: `grabTopPiece()`, which runs the grab handler a SIK pinch on the letter runs.
  - Letting go over a cell: `dropHeldPieceAtSlot(cell)`, which runs the release handler at a point on the eye ray to that cell, just in front of the case.
  - Holding a letter in front of the case (stills 02 and 13): the probe set the letter's position and called the drag handler with it, the way the product's own demo replay carries a letter.
  - Route 2: the route picker's own event. Veteran mode: the toggle's own event and the reminder chooser's own pick event. Slot pinches (Veteran note, Case check): the shared slot-pinch target's own event, the one its collider fires on a pinch that starts and ends on it.
- The probe never set drill state directly (no score, glow, card or note was written by the probe).
- **The camera was not moved for any still.** The camera tool used for the v0.5 stills (`MovePreviewCamera`) and the agent hand (`PreviewInteractTool`) were not available in this session. Every still is at the preview's default pose: the probe printed the camera at world (0, 0, 0) in every run, and the framing matches still 01. Where a v0.5 still turned toward a cell, the v0.6 still uses a letter whose cell is in view instead, or shows the edge arrow; each still says which.
- **No still uses the demo replay except still 15, which shows the "Demo replay" label.** For still 15 the `demoReplay` input was turned on in memory only, then back to false; it was never saved (it is false in the saved scene and in memory).
- No LEAF scenario ran in this session, so no LEAF overlay or log strip is on screen. No collider is drawn (the debug collider option is off).

Human steps assume Interactive Preview with the mouse standing in for the hand. The exact mouse controls were not re-checked in this session.

Bundle and right places on Route 1 (from the route table in `CaseLightRoute.ts`; the case is 57 cm in front of the eye at the default pose):

| Letter | Address | Right place |
|---|---|---|
| Piece_0 | 2195 FAIRWAYS CT | slot 9 |
| Piece_1 | 3498 LEE CT | slot 46 |
| Piece_2 | 3581 FREY LAKE RD | slot 56 (the 3571 / 3581 cell, in view at the default pose) |
| Piece_3 | 2355 FAIRWAYS CT | slot 17 |
| Piece_4 | 1460 TRIBUTARY CT | slot 76 |
| Piece_5 | 3553 FREY LAKE RD (hold) | HOLD block, slots 36 to 39 |
| Piece_6 | 2200 FAIRWAYS CT | slot 23 |
| Piece_7 | 2035 FAIRWAYS CT | slot 1 |

Practice order is Piece_0 to Piece_7. The opening recall pass order is 4, 3, 2, 6, 1, 7, 5, 0; a missed letter comes back behind two others.

## 01 Opening view with hint (`01-opening-view-hint.png`)

- Shows: the hint "Pinch Start practice / Practice, then the case goes dark." above Start practice, Start recall and Drill pace; the Route 1 / Route 2 picker at the right with Route 1 chosen; the bundle tray; the caption and its small print; the v0.6 tag.
- Human: refresh the preview and leave the camera at its default pose.
- Agent: no probe. `RunAndCollectLogsTool` (refresh) with the shipped scripts, then `PreviewPanelTool` screenshot. The camera was not reset by a tool (none was available); it was at the default pose, the same pose the probe measured in the runs that followed.

## 02 Practice, letter in hand, slot glowing (`02-practice-letter-in-hand-slot-glowing.png`)

- Shows: 3581 FREY LAKE RD in hand in front of the tray; its cell (3571 / 3581, slot 56) glows cyan and its label turns white. No arrow (the cell is in view).
- Human: press Start practice, put 2195 FAIRWAYS CT and 3498 LEE CT in their cells, pick up 3581 FREY LAKE RD and hold it up in front of you.
- Agent (probe): Start practice event; `grabTopPiece()` + `dropHeldPieceAtSlot(9)`; the same with 46; `grabTopPiece()` on Piece_2, then letter held at world (1.05, 5.6, -40) through the drag handler. Differs from v0.5, which turned the camera toward 2195 FAIRWAYS CT's cell.

## 03 Practice, right slot off to the side, edge arrow (`03-practice-slot-offscreen-edge-arrow.png`)

- Shows: 2195 FAIRWAYS CT in hand; its cell (slot 9) is down and to the left, outside the view, so a cyan arrow points to it.
- Human: press Start practice, pinch and hold the top letter.
- Agent (probe): Start practice event; `grabTopPiece()`.

## 04 Recall, case dark, letter in hand (`04-recall-case-dark-letter-in-hand.png`)

"Dark" means no slot is lit: the case stays drawn in thin light lines with its labels.

- Shows: 1460 TRIBUTARY CT in hand, nothing lit.
- Human: press Start recall, pinch and hold the top letter.
- Agent (probe): Start recall event; `grabTopPiece()`.

## 05 Recall miss: right slot and its label lit (`05-recall-miss-right-slot-and-label-lit.png`)

- Shows: after 3581 FREY LAKE RD was dropped in the 3661 / 3671 cell (slot 60), its right cell (3571 / 3581, slot 56) glows cyan and its label turns white; the letter has gone back to the bundle. 2355 FAIRWAYS CT stands in its cell at the lower edge.
- Human: press Start recall, put 1460 TRIBUTARY CT and 2355 FAIRWAYS CT in their cells, then drop 3581 FREY LAKE RD one cell group to the right (slot 60) and wait.
- Agent (probe): Start recall event; right drops for Piece_4 (76) and Piece_3 (17); `grabTopPiece()` + `dropHeldPieceAtSlot(60)`; screenshot 2.4 s later. Differs from v0.5, which missed with 1460 TRIBUTARY CT and turned the camera to slot 76.

## 06 HOLD letter with its note (`06-hold-letter-note-hold-block.png`)

- Shows: 3553 FREY LAKE RD in hand with "Hold: set this piece aside" and "HOLD: mail kept at the office"; the HOLD block glows off to the right, out of view at the default pose, so the cyan arrow points to it. 3581 FREY LAKE RD stands in its cell.
- Human: press Start practice, put the opening five letters in their cells, pick up 3553 FREY LAKE RD.
- Agent (probe): Start practice event; right drops for Piece_0 to Piece_4; `grabTopPiece()` on Piece_5. Differs from v0.5, which held the letter in front of the HOLD block with the camera turned to it; the block itself is not in this still.

## 07 Score card (`07-score-card-from-memory.png`)

- Shows: "From memory: 6 of 8 this session" with "Came back: 2" under it, Again and Done, the Case check button above them, and the FREY LAKE RD mix-up marks on the case ("3581 FREY LAKE RD / was put here" at the 3661 / 3671 cell, "goes here" at the 3571 / 3581 cell).
- Human: press Start recall; drop 1460 TRIBUTARY CT four cells short (slot 72) and 3581 FREY LAKE RD in slot 60; place everything else right, including the two missed letters when they come back. Look straight ahead as the last letter goes in.
- Agent (probe): Start recall event; drops through the release handler: Piece_4 at 72 (miss), Piece_3 at 17, Piece_2 at 60 (miss), then every top letter at its own cell; screenshot within the card's 5 s.

## 08 Mix-up line after recall (`08-mix-up-line-after-recall.png`)

- Shows: after the card has hidden, the pink mix-up marks for 3581 FREY LAKE RD: both cells outlined, a line between them, "was put here" and "goes here" labels; Again, Done and Case check stay.
- Human: press Start recall; drop 3581 FREY LAKE RD in slot 60, place everything else right; wait for the card to hide.
- Agent (probe): Start recall event; Piece_2 at 60 (miss), every other drop right; screenshot 6.5 s after the pass ended. At the default pose (v0.5 turned the camera 6 degrees down).

## 09 Again / Done (`09-again-done.png`)

- Shows: Again and Done with the Case check button above them, after the card has hidden. This pass's only mistake (1460 TRIBUTARY CT, slot 72 to slot 76) has its marks on the case about 30 degrees to the right, out of view.
- Human: press Start recall; drop 1460 TRIBUTARY CT in slot 72, place everything else right; wait for the card to hide.
- Agent (probe): Start recall event; Piece_4 at 72 (miss), every other drop right; screenshot 6.5 s after the pass ended.

## 10 The case on a wall: not taken

The plan was the Sunlit Room preview scene with the camera at (0, 0, -350), so the preview room's wall is in reach. It was not taken: no camera tool was available in this session, and at the default pose the Sunlit Room wall is about 5 m away (measured earlier: a vertical plane at z = -503.3 cm), beyond the product's 3 m limit, so "Place on wall" correctly refuses there ("Walls within 3 m"). The still was not faked by changing that limit. It still needs a session with a camera tool. When it is taken, it must say it is the preview room, not a real wall.

Afterwards (22:28 to 22:32) the coordinating agent, which has the camera tool, tried it by running the LEAF scenario `extra-replace-mid-pass` in the Sunlit Room (camera walked to (0, 0, -350)) and capturing the state it left. Both captures were rejected: LEAF's green result line ("[...][extra-replace-mid-pass] PASSED") was drawn in the frame even with its report time set to 0, and the scenario ends with the case back in front of the user, so the frame did not show the case on the wall. Wall placement is shown by the tests instead: `extra-wall-placement` and `extra-replace-mid-pass` both passed in the closing run (`devpost/evidence/leaf-full-35-run-v06-final.log`).

## 11 Score card with "Came back: N" (`11-score-card-came-back.png`)

- Shows: after a second recall pass, "From memory: 15 of 16 this session" with "Came back: 1"; the FREY LAKE RD mix-up marks of that pass; Again, Done, Case check.
- Human: press Start recall and place every letter right; press Again; in the second pass drop 3581 FREY LAKE RD in slot 60, place it right when it comes back, place everything else right.
- Agent (probe): Start recall event; every drop right; Again event; Piece_2 at 60 (miss), every other drop right; screenshot within the card's 5 s.

## 12 Veteran reminder shown after a recall miss (`12-veteran-reminder-after-recall-miss.png`)

- Shows: the reminder "Read the whole number", pinned earlier on the 3571 / 3581 cell, shown beside it because a recall miss lit that cell; the cell glows and its label is white.
- Human: turn Veteran mode on, pinch the 3571 / 3581 cell, pick "Read the whole number", turn Veteran mode off; press Start recall, place 1460 TRIBUTARY CT and 2355 FAIRWAYS CT, drop 3581 FREY LAKE RD in slot 60.
- Agent (probe): Veteran toggle event; slot-pinch event for cell 56; chooser pick event "Read the whole number"; Veteran toggle event (off); Start recall event; right drops for Piece_4 and Piece_3; Piece_2 at 60 (miss); screenshot 2.4 s later.

## 13 Route 2 on the case (`13-route-2-relabelled.png`)

- Shows: Route 2 chosen (gold outline), the cells relabelled with Route 2 house numbers (JEBS CT here), and the same letter position now addressed 2015 JEBS CT, in hand, with its cell (2013 / 2015, slot 56) glowing and its label white.
- Human: pinch Route 2; press Start practice; put the opening two letters (3189 SHIRLEY DR, 3249 MCGARITY LN) in their cells; pick up 2015 JEBS CT and hold it up.
- Agent (probe): route picker event for Route 2; then as still 02.

## 14 Case check (`14-case-check-found-outline.png`)

- Shows: "From memory: 16 of 16 this session" with "Case check: 2 of 2 found"; the green outline on the 3621 / 3631 cell (slot 58), where 3581 FREY LAKE RD was standing as one of the two misplaced letters; the second found outline (slot 25, where 2200 FAIRWAYS CT stood) is at the lower right edge.
- Human: press Start recall and place every letter right; press Again and place every letter right again; press Case check; pinch the cell with 3581 FREY LAKE RD in it, then the cell with 2200 FAIRWAYS CT in it.
- Agent (probe): Start recall event; every drop right; Again event; every drop right; Case check event (the product chose letters 2 and 6, cells 58 and 25, from the pass number); slot-pinch event for 58, then for 25; screenshot within the card's 5 s.

## 15 Demo replay (`15-demo-replay-label.png`)

- Shows: the "Demo replay" label above the Start row, during the replay's practice pass, just after the replay placed 3581 FREY LAKE RD in the 3571 / 3581 cell (the ring is its landing ripple). The replay plays one recorded real run (`data/demo_replay_s1-g3nddr.log`) through the same handlers a hand reaches; its log lines carry an "r" session id, so they never count as live play.
- Human: not a normal session. In the Inspector, turn on CaseLightMain's Demo replay input, refresh the preview, and turn it off again afterwards without saving.
- Agent: no probe. `scene-graphql` set `demoReplay` to true in memory on the CaseLightMain component; `RunAndCollectLogsTool` (refresh); screenshot about 9 s into the replay; `demoReplay` set back to false in memory at once. The scene was never saved; its SHA-256 stayed `0297cce0a1c68dd3117a482b7b51f6d554e6ac808c8509a04b2f43b81c7216a7`.

## Changed since the v0.5 stills

- v0.6: all nine retaken: v0.6 tag, the Start row 1.65 degrees further left, the Route 1 / Route 2 picker in the opening view, "Came back: N" on the card and the Case check button above Again / Done. New stills 11 to 15 (10 still to be taken). States reached by a removed probe calling the product's handlers instead of the agent hand, because the agent hand stopped working at 14:40 (pinch timed out) and was not available here; no camera moves. Output 1400 x 1590 (panel size), was 1392 x 1910.
- v0.5: real house numbers from OpenStreetMap replace the invented sample streets. The held address is printed in 0.85 cm capitals (was 1.25 cm), because the longest real address, 17 characters, did not fit the 12.0 cm print width at 1.25 cm (measured 16.44 cm). The caption and its small print replace "Preview: sample letters".
- v0.4: one pinch presses one button; mix-up marks say which end is which ("was put here", "goes here") and outline both cells.
