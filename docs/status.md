# Implementation status

Updated: 2026-09-12. Session 005 delivers engineering preview 0.4 and the next physical test batch. [Latest session record](sessions/005-next-print-batch.md) · [A/B feedback](sessions/004-retry-feedback.md) · [Decisions](decisions.md) · [PRD](PRD.md).

## Visible result

[Open NP3DP](https://argarot.github.io/NP3DP/), choose **Prepare print**, then download **07 Mini vase B → 08 Arch coupon → 09 Held span V2**, one at a time, following the [new print guide](guides/next-prints.md). Prepared G-code, projects and reports are downloadable directly from each card. [Editable source projects](../examples/next-prints/) and [software/checksum evidence](evidence/session-005-calibration.json) accompany the files. Original 01–06 remain unchanged historical experiments.

The test bench separates the new batch, successful A/B references and original studies. A bounded XYZ separation inspector compares actual emitted segments one revolution apart, including taper/curvature and method transitions, with a per-turn plot/table. Complete jobs retain mandatory mesh leveling, two-part purge, MINI LCD thumbnails, progress/time and first-layer compensation. 08 explicitly has no finish rim. A core phase-boundary correction removes a ghost deposit/hold from 09; lifted-bridge retracing/interactions now have diagnostics. Recipe schema stays 1 and project/setup stays 2; prepared engine is 0.4.0 and wall engine 0.2.0.

**Physical evidence:** the product manager reports original 01 control worked and original 02 wave failed attachment; both original files were unchanged. [Original observations](evidence/session-003-observations.json) retain that evidence. The latest report says **A and B work well, and preview and time estimate work**; see the separate [follow-up observation](evidence/session-004-observations.json). Exact A/B file identity/settings and run counts were not separately confirmed. Actual timing accuracy, dimensions, purge/fan execution and repeatability were not measured or explicitly reported. No result was reported for 03/04. Neither a command audit nor nominal contact percentage establishes physical prediction accuracy.

## Task and gate evidence

| Tasks | Implemented / observed | Remaining gate work |
|---|---|---|
| T00–T03 / G0 | Approved scope, independent-code route and notices | Distribution license undecided; future reuse reviewed separately |
| T10, T16 | Recipe/event/unit contracts; project/setup v2 and v1 migration | Anchored-region and solver contracts |
| T11, T18 | Recorded MINI-family setup; reviewed Buddy 5.1.2 adapter | Variant uncertain; measured printhead envelope and executed-motion evidence absent |
| T12, T20, T21 | Foundation/transition/rim mathematics; first-layer inset; study-specific rim choice; phase-boundary correction | Dimensional accuracy, compensation tuning and non-circular print evidence |
| T13, T23, T31 | Resource/quantization/bed/flow/axis checks; actual-chord XYZ separation and lifted-post diagnostics | General time-ordered collision, physical contact and firmware dynamics |
| T14, T42 | Worker cancellation/freshness, event cap, selective geometry and bounded raster work | Agreed latency targets and broader workloads |
| T15, T25 | Reviewed flat config import, compensation, provenance and override tracking | Actual user's export fixture, more adapters/formats, dataset license review |
| T22 | Full MINI thermal/mesh/purge/shutdown audit; preview and time display now reported working on the printer | Purge/fan observations, explicit progress-percentage confirmation and actual timing accuracy |
| T24 | Original control and A/B reported successful; original wave failed; new 07–09 jobs delivered | Actual 07–09 results, dimensions, repeatability and timing |
| T30, T36, T37 | Waves, triangles, quadratic arches, anchor/deposit/dwell/rise/span/fall events | Method-specific print evidence and process/cooling calibration |
| T17, T38, T41 | Form/path/nominal-volume views, playback, per-turn XYZ comparison, method profile figure and LCD raster | Filament solver, executed motion, accuracy targets and held-out measurements |
| T40, T43, T51 | Editor/test bench, portable projects, complete and draft exports | Full experimental-alpha acceptance, including physical prediction |
| T52, T53 | Locked dependencies/notices, build and GitHub Pages workflow | Release license and physical release evidence |

**G0 has passed for the selected implementation route. G1–G5 remain open.** The reported control and A/B successes are useful recipe evidence; they do not close numerical, repeatability, clearance or predictive-accuracy gates. **M6–M9 remain required:** sagging/free-space loops, accurate filament simulation, integrated lamp brackets/socket interfaces and additional printers.

## Verification

Session 005 final local checks pass: **186 tests across 16 files** (31.17 s), TypeScript, production build, **nine Chromium workflows** (1.1 min) and unchanged 105-package/six-runtime-notice license checks. These include the final 08 rim omission. New delivery tests compare committed G-code to fresh compilation and exact hashes, assert positive separation for the three reference studies, preserve old recipes, verify true partial motifs and prove exactly 480 timed sequences with no ghost endpoint action. Local Markdown links resolve. The miniature/arch workbench and corrected method-profile figure were visually inspected. [Independent method review](evidence/session-005-method-review.md) and [emitted method profiles](evidence/session-005-methods.svg) distinguish numerical evidence from physical validation.

Implementation commit [be0609e](https://github.com/Argarot/NP3DP/commit/be0609ecf46674b2d5480f811dd8ce1ffe251a74) passed GitHub CI and Pages deployment in [run 34696255162](https://github.com/Argarot/NP3DP/actions/runs/34696255162). All 16 live entry/JS/CSS/worker/prepared-file checks returned HTTP 200 with bytes matching the validated local production build, including all three G-code hashes, projects, reports and manifest. [Deployment evidence](evidence/session-005-deployment.json). The task-owned development server was stopped after verification.

Previous session 003 evidence, retained historically:

- Final TypeScript check and **168 unit/integration/geometry tests pass** across 14 files (19.15 s for the final local run).
- **Eight Chromium workflows pass** (37.8 s), including retry loading/export, thumbnail/progress-bearing downloads, readable startup review, compensation and v1 migration, profile undo/redo, stale-worker recovery and responsive controls.
- Production build and unchanged dependency/license checks passed: 105 locked packages, six runtime notices, no new dependencies.
- Both retry jobs compile with zero independent-audit errors. [Generated evidence](evidence/session-003-calibration.json) records exact checksums, sizes, command metrics, audit results and one local compile timing per specimen.
- Tests cover generated turn gaps, v1 migration, first-layer geometry/continuity, QOI decoding/framing, purge omissions, wrong/missing metadata and progress ordering/timing. These are software checks.
- [Display research](research/mini-display-metadata.md), [attachment research](research/wave-attachment.md) and [purge review](research/mini-purge.md) record primary sources and transfer limits.
- [Independent review](evidence/session-003-review.md) checks the actual delivered payloads and command timeline. All 103 local Markdown links checked resolve. The failure photo remains in ignored local artifacts.
- Implementation commit [f76cfa4](https://github.com/Argarot/NP3DP/commit/f76cfa4ae95260b82f3d7b21a6fb78e863b34808) passed CI and deployed through [GitHub Actions](https://github.com/Argarot/NP3DP/actions/runs/34687857110). The live entry point, main JS/CSS, viewport and both workers return HTTP 200; their deployed bytes match the validated local production build.

## Setup and defaults

Confirmed: MINI family, firmware 5.1.2+13478, stock hotend, 0.4 mm nozzle, eSUN PLA Basic. MINI versus MINI+ remains unknown. Record the sheet and actual spool colour at print time. No measured nozzle-envelope or mesh-correction geometry is inferred.

07: 34 → 38 mm diameter, 24 mm wall, 1 mm belly; B's 0.40 mm pitch / 0.12 mm wave / 6 mm/s. 08/09: 32 mm diameter, 10.2 mm wall, 4.2 mm collar, 0.30 mm pitch, 6 mm/s. 08 adds 0.20 mm arches, 24 repeats + 180° phase, no rim. 09 adds 480 zero-lift chords with 0.02 mm³ endpoint deposits and 0.10 s holds, one rim. All use 0.45 mm nominal strands, three 0.2 mm base layers, 0.45 mm lines at 20 mm/s, 4 mm lead-in, 0.15 mm inset, nozzle 215 → 210 °C, bed 60 °C and full fan after foundation. Limits remain flow 5 mm³/s, XY/Z 100/8 mm/s and acceleration 500 mm/s². These are editable experiment settings, not measured material limits.

The original wave's 0.60 mm rise per turn exceeded its nominal 0.45 mm strand during the amplitude lead-in, leaving the second turn without nominal matched-angle contact. A reduces that separation; B then explores longer gaps. Temperatures and commanded cooling remain unchanged. The longer purge uses 18 mm filament along 130 mm of front-bed travel, with flow-capped feeds.

## Next session

1. Record 07–09 print results with file/settings identity, opening/shape/endpoint observations and actual elapsed time. Refine marginal or failing transitions independently.
2. Design an explicit versioned lifted-span sequence with separate deposition and return/travel phases, then prepare an unsupported-span/loop coupon. The supported timed chords in 09 do not validate free-space sag.
3. Continue measured nozzle-envelope work and agree the first filament-solver calibration/validation targets. Keep calibration and held-out observations separate.
4. Broaden real slicer profile fixtures and progress required later capabilities; ask for hardware/fitting choices when those milestones need them.
