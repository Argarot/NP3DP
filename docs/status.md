# Implementation status

Updated: 2026-09-12 after the A/B physical feedback. Engineering preview remains 0.3. [Latest session record](sessions/004-retry-feedback.md) · [Session 003 implementation](sessions/003-attachment-retry.md) · [Decisions](decisions.md) · [PRD](PRD.md).

## Visible result

[Open NP3DP](https://argarot.github.io/NP3DP/). A/B are the current working wave references; their editable projects are in [examples/retries](../examples/retries/) and their procedure is in the [retry guide](guides/retry-print.md). The calibration command generates G-code and checksum-linked reports in artifacts/session-003. **Revised miniature and held-span files have not been delivered:** original 03/04 retain their original geometry. New exports receive the shared export fixes; previously saved G-code does not change.

The new test bench highlights the failed original wave, A/B retries and nominal per-turn gap estimates. Complete jobs have mandatory mesh leveling, a longer two-part purge, MINI LCD thumbnails, progress/remaining-time commands, and editable first-layer elephant-foot compensation. Old project/setup v1 files migrate to v2 with zero compensation, preserving their footprint. Wall recipes remain at v1.

**Physical evidence:** the product manager reports original 01 control worked and original 02 wave failed attachment; both original files were unchanged. [Original observations](evidence/session-003-observations.json) retain that evidence. The latest report says **A and B work well, and preview and time estimate work**; see the separate [follow-up observation](evidence/session-004-observations.json). Exact A/B file identity/settings and run counts were not separately confirmed. Actual timing accuracy, dimensions, purge/fan execution and repeatability were not measured or explicitly reported. No result was reported for 03/04. Neither a command audit nor nominal contact percentage establishes physical prediction accuracy.

## Task and gate evidence

| Tasks | Implemented / observed | Remaining gate work |
|---|---|---|
| T00–T03 / G0 | Approved scope, independent-code route and notices | Distribution license undecided; future reuse reviewed separately |
| T10, T16 | Recipe/event/unit contracts; project/setup v2 and v1 migration | Anchored-region and solver contracts |
| T11, T18 | Recorded MINI-family setup; reviewed Buddy 5.1.2 adapter | Variant uncertain; measured printhead envelope and executed-motion evidence absent |
| T12, T20, T21 | Foundation/transition/rim mathematics; first-layer inset and explicit connectors | Dimensional accuracy, compensation tuning and non-circular print evidence |
| T13, T23, T31 | Resource/quantization/bed/flow/axis checks; restricted wave-gap estimator | General time-ordered collision, physical contact and firmware dynamics |
| T14, T42 | Worker cancellation/freshness, event cap, selective geometry and bounded raster work | Agreed latency targets and broader workloads |
| T15, T25 | Reviewed flat config import, compensation, provenance and override tracking | Actual user's export fixture, more adapters/formats, dataset license review |
| T22 | Full MINI thermal/mesh/purge/shutdown audit; preview and time display now reported working on the printer | Purge/fan observations, explicit progress-percentage confirmation and actual timing accuracy |
| T24 | Original control reported successful; original wave failed; A and B now reported successful | Revised miniature and method-specific coupons; dimensions, repeatability and actual timing |
| T30, T36, T37 | Waves, triangles, quadratic arches, anchor/deposit/dwell/rise/span/fall events | Method-specific print evidence and process/cooling calibration |
| T17, T38, T41 | Form/path/nominal-volume views, flattened base beads, playback, gap estimate and LCD raster | Filament solver, executed motion, accuracy targets and held-out measurements |
| T40, T43, T51 | Editor/test bench, portable projects, complete and draft exports | Full experimental-alpha acceptance, including physical prediction |
| T52, T53 | Locked dependencies/notices, build and GitHub Pages workflow | Release license and physical release evidence |

**G0 has passed for the selected implementation route. G1–G5 remain open.** The reported control and A/B successes are useful recipe evidence; they do not close numerical, repeatability, clearance or predictive-accuracy gates. **M6–M9 remain required:** sagging/free-space loops, accurate filament simulation, integrated lamp brackets/socket interfaces and additional printers.

## Verification

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

New retries: 34 mm diameter × 12 mm wall; A pitch/amplitude 0.30/0.08 mm, B 0.40/0.12 mm; nominal strand 0.45 mm, wall speed 6 mm/s. Foundation: three 0.2 mm layers, 0.45 mm width at 20 mm/s, 4 mm lead-in, one rim, 0.15 mm first-layer inset. Nozzle 215 → 210 °C, bed 60 °C, fan off through foundation then 100%. Limits remain flow 5 mm³/s, XY/Z 100/8 mm/s, acceleration 500 mm/s². These are explicit editable defaults, not validated material limits.

The original wave's 0.60 mm rise per turn exceeded its nominal 0.45 mm strand during the amplitude lead-in, leaving the second turn without nominal matched-angle contact. A reduces that separation; B then explores longer gaps. Temperatures and commanded cooling remain unchanged. The longer purge uses 18 mm filament along 130 mm of front-bed travel, with flow-capped feeds.

## Next session

1. Create a new miniature-vase project from successful B's wave/process baseline, introducing modest taper/curvature without the original 03's jump from 0.12 to 0.60 mm amplitude. Review changing-radius attachment geometry; the current circular-wave estimator does not cover taper/belly.
2. Create a separate short anchored-arch/held-span comparison. Validate contact transitions, dwell/extrusion sequencing and preview/export agreement before asking for that distinct physical test.
3. Deliver new numbered projects, audited G-code, thumbnails, estimates and an ordered print guide. Preserve original 01–06 and historical observations. Review code and run the relevant mathematical/export, type/build and browser checks.
4. Record each next physical run with file/settings identity, opening/shape observations and elapsed time; use measurements to tune compensation and timing. A/B are reported successes, not a fitted or independently validated physics dataset.
5. Continue printhead-envelope and span/sag-model work, real slicer profile fixtures and the required later capabilities. Hardware/fitting choices and predictive-accuracy commitments still need product input when applicable.
