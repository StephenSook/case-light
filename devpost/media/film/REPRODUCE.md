# CaseLight film stills: how each one was made

Captured 2026-11-02 between 10:09 and 10:14, on Lens v0.4, in Lens Studio 5.23.2 Preview (device SPECS 27, Interactive input, panel at its current size, 1516 x 1590 output). All nine stills come from one continuous session: a plain preview refresh, one practice pass, one recall pass. No LEAF scenario ran in that session, so no LEAF overlay or log strip is on screen (checked: no `LeafDiagnosticReportCamera` and no `LeafDebugUICamera` in the scene). All letters and addresses are labelled sample data ("Preview: sample letters").

The two white vertical lines stay at the same place on screen in every still, whatever way the camera turns, so they mark the view frame, not the case.

Human steps assume Interactive Preview with the mouse standing in for the hand. The exact mouse controls were not re-checked in this session; the agent commands under each still are the ones that produced it. Agent commands use the Lens Studio MCP tools `PreviewInteractTool` (left hand for letters, right hand for buttons), `MovePreviewCamera` and `PreviewPanelTool` (screenshot with `outputPath`). Letters are addressed by `name` (Piece_0 to Piece_7) with `parentName: "BundleTray"`, because their ids change after a recompile.

Sample bundle and right places (from the sample route in `CaseLightRoute.ts`):

| Letter | Address | Right place | Opening centre (world cm) |
|---|---|---|---|
| Piece_0 | 1482 MAIN ST | slot 9 | (-26.67, -19, -57) |
| Piece_1 | 327 ELM AVE | slot 46 | (-34.29, -4, -57) |
| Piece_2 | 128 BIRCH LN | slot 56 | (-8.89, -4, -57) |
| Piece_3 | 1514 MAIN ST | slot 17 | (-6.35, -19, -57) |
| Piece_4 | 649 OAK CT | slot 76 | (41.91, -4, -57) |
| Piece_5 | 238 ELM AVE (hold) | HOLD block, slots 36 to 39 | (45.72, -19, -57) |
| Piece_6 | 207 ELM AVE | slot 23 | (8.89, -19, -57) |
| Piece_7 | 1450 MAIN ST | slot 1 | (-46.99, -19, -57) |

Drops aim 1 cm in front of the opening (z -56). To carry a letter, use `Drag` with `hold: true`, then `Release`; use about 1.4 s for the far slots (1 and the HOLD block). Practice order is Piece_0 to Piece_7. The recall pass here is recall pass 0, order 4, 3, 2, 6, 1, 7, 5, 0.

## 01 Opening view with hint (`01-opening-view-hint.png`)

- Human: refresh the preview and leave the camera at its default pose. The hint "Pinch Start practice / Practice, then the case goes dark." sits above the three buttons; the tag reads v0.4.
- Agent: `RunAndCollectLogsTool` (refresh), `MovePreviewCamera` reset, screenshot.

## 03 Practice, right slot off to the side, edge arrow (`03-practice-slot-offscreen-edge-arrow.png`)

Taken before 02 in the same session.

- Human: press Start practice, then pinch and hold the top letter (1482 MAIN ST). Its slot is down and to the left, outside the view, so a cyan arrow points to it.
- Agent: `Pinch` name `StartPracticeButton` (right); `Pinch` Piece_0 `hold: true` (left); screenshot.

## 02 Practice, letter in hand, slot glowing (`02-practice-letter-in-hand-slot-glowing.png`)

- Human: carry 1482 MAIN ST toward the case and turn toward the lower left until slot 9 is in view; it glows cyan and the arrow goes away.
- Agent: `Release`; `Drag` Piece_0 to (-21, -9, -49) `hold: true`; `MovePreviewCamera` lookAt (-24, -14, -55); screenshot.
- Then `Release`, and place Piece_0 to Piece_4 in their slots.

## 06 HOLD letter with its note, at the HOLD block (`06-hold-letter-note-hold-block.png`)

- Human: pick up 238 ELM AVE. Its note reads "Hold: set this piece aside" with "HOLD: mail kept at the office" under it, and the HOLD block glows. Hold it in front of the HOLD block.
- Agent: `Drag` Piece_5 to (39, -10, -48) `hold: true`; lookAt (42, -14, -55); screenshot.
- Then `Release`, put Piece_5 in the HOLD block, Piece_6 in slot 23 and Piece_7 in slot 1. Practice ends; practice never counts toward the score.

## 04 Recall, case dark, letter in hand (`04-recall-case-dark-letter-in-hand.png`)

"Dark" means no slot is lit: the case stays drawn in thin light lines with its labels, as the brief says.

- Human: look straight ahead, press Start recall, pinch and hold the top letter (649 OAK CT).
- Agent: `MovePreviewCamera` reset; `Pinch` `StartRecallButton` (right); `Pinch` Piece_4 `hold: true`; screenshot.

## 05 Recall miss: right slot and its label lit (`05-recall-miss-right-slot-and-label-lit.png`)

- Human: drop 649 OAK CT four slots short (slot 72). The letter comes back, slot 76 lights cyan and its label "649 / 651" turns white. Pick the letter up again and hold it above the case, then let go there; a letter let go away from the case goes back to the top of the bundle (checked: it was back at the top spot).
- Agent: `Release`; `Drag` Piece_4 to (31.75, -4, -56) `hold: true`, `Release`; `Drag` Piece_4 to (28, 8, -48) `hold: true`; lookAt (36, -3, -57); screenshot; `Release`.

## 07 Score card (`07-score-card-from-memory.png`)

- Human: place the rest of the bundle, with one more deliberate mistake: put 128 BIRCH LN in the 142 / 144 cell (slot 60) before its own 126 / 128 cell (slot 56). Look straight ahead as the last letter goes in. The card reads "From memory: 6 of 8 this session" beside Again and Done, and the BIRCH LN mix-up marks are already on the case.
- Agent: Piece_4 to slot 76; Piece_3 to slot 17; Piece_2 to slot 60, then slot 56; Piece_6, Piece_1, Piece_7, Piece_5 to their places; camera reset; Piece_0 to slot 9; screenshot right after that `Release` (the card shows for 5 s).

## 09 Again / Done (`09-again-done.png`)

- Human: wait for the card to hide. Again and Done stay, and so do the mix-up marks.
- Agent: wait 5 s; screenshot at the default pose.

## 08 Mix-up line after recall (`08-mix-up-line-after-recall.png`)

- Human: turn a little left and down. "128 BIRCH LN / was put here" sits at the 142 / 144 cell, "goes here" at the 126 / 128 cell, both cells outlined in pink with a pink line between them; Again and Done stay in view. The marks for 649 OAK CT (slot 72 to slot 76) are on the case too, about 30 degrees to the right, out of this view.
- Agent: lookAt (-0.8, -6, -57) (0.8 degrees left, 6 degrees down); screenshot.

## Fixed after the previous set of stills

- One pinch, one press: before v0.4, a preview-hand pinch on Again or Done also pressed the Start button behind it (3 of 3). In v0.4 a button acts only when the same pinch started on it, and a Start press within 0.6 s of Again or Done is ignored. Rechecked in the preview: Again now starts only the next recall pass, and Done leaves every letter in the case.
- Mix-up marks now say which end is which ("was put here", "goes here") and outline both cells.
