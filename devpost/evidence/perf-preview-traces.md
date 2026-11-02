# Preview performance traces (2026-11-02)

Captured on a laptop in Lens Studio 5.23.2 Preview with `preview.profiling.startTrace`, analysed with the Lens Studio perfetto analysis script and a small SQL query. These numbers describe the laptop Preview, not SPECS hardware. The analyser guessed the device profile with low confidence and used a 33.3 ms budget.

## Trace A: LEAF scenario `c5-recall-unaided-score` driving a recall pass (19.6 s, 06:27:56 to 06:28:16)

- Frame time on the main track: p50 5.12 ms, p90 8.58 ms, p99 44.79 ms, max 406.15 ms.
- The max is the Lens turning on after the scenario reset it (`LensTurnOnTime` 406.15 ms, inside it `Scene::turnOn` 386.1 ms).
- 12 frames over 33.3 ms. Apart from the turn-on, the worst is 139.35 ms (`Scene::Start` 62.9 ms inside it). Eight more sit about one second apart while the recall pass runs, each dominated by `Scene::Update` (28.1 to 71.2 ms).
- `Scene::Update` after the opening 2 s: p50 1.00 ms, p90 2.15 ms, p99 43.53 ms, max 71.15 ms, 10 frames over 25 ms.

## Trace B: the same drop path driven by hand, no LEAF scenario (19.5 s, 06:30:31 to 06:30:50)

Start practice was pressed, then the top letter was dropped on a wrong cell five times (it bounced back each time) and on its right cell once (it snapped in; checked by reading its position afterwards).

- Frame time on the main track: p50 4.14 ms, p90 6.03 ms, p99 7.62 ms, max 42.98 ms.
- 1 frame over 33.3 ms: 42.98 ms in `ProcessFrame`, where Preview simulates camera tracking and face detection. It is not Lens code.
- Worst `CoreManagerRender` frame: 11.01 ms.
- `Scene::Update` after the opening 2 s: p50 0.62 ms, p90 1.41 ms, p99 2.70 ms, max 4.83 ms, 0 frames over 25 ms.

## Reading

- Likely: the 28 to 71 ms `Scene::Update` frames in trace A come from the LEAF scenario's own per-step work, not from CaseLight's drop code, because the same drops without LEAF never passed 4.83 ms. The trace does not name individual scripts, so this is an A/B result, not a per-script attribution. Trace B ran in practice; recall adds only the answer light, sound and mix-up bookkeeping on a miss.
- No optimisation was made. A full staged attribution sweep was not run.
- Not measured: anything on SPECS hardware.
