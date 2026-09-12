# Implementation status

Updated: 2026-09-12. Session 003 delivers engineering preview 0.3: attachment retries and MINI export usability. [Session record](sessions/003-attachment-retry.md) · [Decisions](decisions.md) · [PRD](PRD.md).

## Visible result

[Open NP3DP](https://argarot.github.io/NP3DP/). Choose **Prepare print → Load retry A → Export print**, following the [retry guide](guides/retry-print.md). Editable projects are in [examples/retries](../examples/retries/). The calibration command generates G-code and checksum-linked reports in artifacts/session-003.

The new test bench highlights the failed original wave, A/B retries and nominal per-turn gap estimates. Complete jobs have mandatory mesh leveling, a longer two-part purge, MINI LCD thumbnails, progress/remaining-time commands, and editable first-layer elephant-foot compensation. Old project/setup v1 files migrate to v2 with zero compensation, preserving their footprint. Wall recipes remain at v1.

**Physical evidence:** the product manager reports original 01 control worked and original 02 wave failed attachment; both files were unchanged. Later studies were not printed. [Recorded observations](evidence/session-003-observations.json) retain original delivered hashes and missing measurements. **New A/B retries have not been printed.** Neither a command audit nor nominal contact percentage establishes bonding, sag, clearance or repeatability.

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
| T22 | Full MINI thermal/mesh/purge/shutdown audit; LCD metadata and independently timed progress | LCD/purge/retry execution on the physical printer |
| T24 | Original control: one reported success. Original wave: failed. New A/B jobs and guide | Successful retry, dimensions, repeatability and actual timing |
| T30, T36, T37 | Waves, triangles, quadratic arches, anchor/deposit/dwell/rise/span/fall events | Method-specific print evidence and process/cooling calibration |
| T17, T38, T41 | Form/path/nominal-volume views, flattened base beads, playback, gap estimate and LCD raster | Filament solver, executed motion, accuracy targets and held-out measurements |
| T40, T43, T51 | Editor/test bench, portable projects, complete and draft exports | Full experimental-alpha acceptance, including physical prediction |
| T52, T53 | Locked dependencies/notices, build and GitHub Pages workflow | Release license and physical release evidence |

**G0 has passed for the selected implementation route. G1–G5 remain open.** The reported control is useful evidence; it does not close numerical, repeatability, clearance or predictive-accuracy gates. **M6–M9 remain required:** sagging/free-space loops, accurate filament simulation, integrated lamp brackets/socket interfaces and additional printers.

## Verification

- Final TypeScript check and **168 unit/integration/geometry tests pass** across 14 files (19.15 s for the final local run).
- **Eight Chromium workflows pass** (37.8 s), including retry loading/export, thumbnail/progress-bearing downloads, readable startup review, compensation and v1 migration, profile undo/redo, stale-worker recovery and responsive controls.
- Production build and unchanged dependency/license checks passed: 105 locked packages, six runtime notices, no new dependencies.
- Both retry jobs compile with zero independent-audit errors. [Generated evidence](evidence/session-003-calibration.json) records exact checksums, sizes, command metrics, audit results and one local compile timing per specimen.
- Tests cover generated turn gaps, v1 migration, first-layer geometry/continuity, QOI decoding/framing, purge omissions, wrong/missing metadata and progress ordering/timing. These are software checks.
- [Display research](research/mini-display-metadata.md), [attachment research](research/wave-attachment.md) and [purge review](research/mini-purge.md) record primary sources and transfer limits.
- [Independent review](evidence/session-003-review.md) checks the actual delivered payloads and command timeline. All 103 local Markdown links checked resolve. The failure photo remains in ignored local artifacts.

## Setup and defaults

Confirmed: MINI family, firmware 5.1.2+13478, stock hotend, 0.4 mm nozzle, eSUN PLA Basic. MINI versus MINI+ remains unknown. Record the sheet and actual spool colour at print time. No measured nozzle-envelope or mesh-correction geometry is inferred.

New retries: 34 mm diameter × 12 mm wall; A pitch/amplitude 0.30/0.08 mm, B 0.40/0.12 mm; nominal strand 0.45 mm, wall speed 6 mm/s. Foundation: three 0.2 mm layers, 0.45 mm width at 20 mm/s, 4 mm lead-in, one rim, 0.15 mm first-layer inset. Nozzle 215 → 210 °C, bed 60 °C, fan off through foundation then 100%. Limits remain flow 5 mm³/s, XY/Z 100/8 mm/s, acceleration 500 mm/s². These are explicit editable defaults, not validated material limits.

The original wave's 0.60 mm rise per turn exceeded its nominal 0.45 mm strand during the amplitude lead-in, leaving the second turn without nominal matched-angle contact. A reduces that separation; B then explores longer gaps. Temperatures and commanded cooling remain unchanged. The longer purge uses 18 mm filament along 130 mm of front-bed travel, with flow-capped feeds.

## Next session

1. Review retry A's actual attachment, LCD preview/progress, purge, fan, first-layer flare and elapsed time against its report/hash.
2. Advance to B if A attaches; otherwise isolate the failed mechanism before increasing unsupported length.
3. Tune compensation and timing from measurements; preserve original and new evidence separately.
4. Prepare an anchored arch/held-span comparison, then the miniature vase when attachment supports it. Continue printhead-envelope and span/sag-model work with explicit accuracy scope.
5. Broaden profile fixtures with the user's real slicer export. Select additional hardware/fittings when that milestone's inputs are supplied; keep all committed later capabilities in scope.
