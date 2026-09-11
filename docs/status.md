# Implementation status

Updated: 2026-09-11. Session 001 implementation and first hosted delivery are complete.

The product manager approved starting implementation. The agreed PRD scope and required later milestones remain the contract. Low-impact engineering defaults may now proceed when logged; major product decisions still require discussion.

## Visible result

[Open the live NP3DP workbench](https://argarot.github.io/NP3DP/). Local development: `npm ci`, `npm run dev`. [Getting started](getting-started.md) explains the controls and output limits.

The editor has parametric shape/twist controls, four distinct deposition methods, 1–8 height bands, three representation modes, partial-event timeline playback, recipe files/undo, five example studies, and worker-based draft export with an independent numerical audit. This is an engineering preview, not completion of the physically validated alpha.

## Task evidence

| Tasks | Software status | Remaining gate work |
|---|---|---|
| T00–T03 / G0 | Discovery complete; PRD/build authorization and independent-code route recorded | Root product license remains undecided; future reuse gets its own review |
| T10, T16 | First recipe/event/unit and band-composition contracts implemented | Future anchored-region/solver extensions remain |
| T12 | Shapes, phase, joins, volume, corners and quantization have numerical fixtures | Sampling is heuristic; full geometric-error bounds and machine tolerances remain |
| T13, T23 | Strict input/resource/quantization failure classes and explicit unknowns | Complete printer-envelope/clearance/process diagnostics remain |
| T14 | Five workloads measured on the local CPU | Measurements are observations, not agreed latency/accuracy acceptance targets |
| T11, T15, T18 | Profile research and adapter boundary documented | Actual MINI setup and normalized profile/import adapter not implemented |
| T20–T22 | Contour/twist, experimental wall generation and a draft serializer/parser implemented | Planar foundation, controlled finish and complete MINI job remain |
| T25, T24 | Not implemented / no print performed | Supported profile import and physical control sample |
| T30, T36 | Wave/radial/Z/speed/flow, triangular and quadratic-arch generators implemented | Physical characterization and additional composition controls |
| T37 | Anchor, stationary deposit, dwell, rise/span/fall events implemented | Calibrated cooling controls and physical span tests |
| T17, T38, T41 | Separate commanded/form/nominal-volume views and partial-event playback | Executed-motion model and physical material solver/calibration remain |
| T40, T43 | Usable editor, recipe round trip, examples and inspection exports | Full printer workflow and alpha acceptance remain |
| T42 | Debounce, worker termination/stale-result checks, event cap, selected-view allocation and idle rendering | Agreed performance targets and broader workload evidence remain |
| T51–T53 | First user/developer docs, exact dependency inventory, notices and Pages workflow implemented | Release audit, physical evidence and final distribution terms remain |

**G1–G5 are not passed.** No physical prints, filament solver calibration, verified machine profiles or complete printer jobs exist yet. The built geometric strand model does not satisfy the physical-simulation requirements.

**M6–M9 remain required:** sagging/free-space loops, validated physical simulation, integrated lamp brackets/socket interfaces, and additional printers.

## Verification

- Strict TypeScript and 65 unit/integration/geometry tests pass locally.
- Four Chromium browser journeys pass: all examples/draft/playback; file round trip and invalid input; rapid-edit/resource-error recovery; desktop/mobile layout.
- Production build and runtime-notice/dependency drift checks pass locally and in [GitHub Actions](https://github.com/Argarot/NP3DP/actions/runs/34646268100), which deployed implementation commit `775fd96` successfully.
- Hosted inspection verified the `/NP3DP/` entry point, lazy 3D viewport, generation worker, Method sampler, and export worker/audit with enabled report/draft controls and no console errors. Download-file assertions pass in Chromium browser tests locally and in CI; the separate embedded-browser download-event check timed out, so receipt of that manual download is not claimed.
- Optional WebMCP registration, valid recipe update, read-back, invalid-version rejection and unchanged-state behavior were checked through the supported browser interface.
- [Local measurements](evidence/session-001-measurements.json): 2,851–67,774 events; one observed generation pass approximately 7–125 ms and export including audit 35–1,148 ms. Export runs off the UI thread. These are not firmware or physical-accuracy measurements.

## Dependencies on product input

Before a complete MINI+ print job: installed firmware, modifications (or confirmation of stock hotend/fan duct), and exact eSUN PLA grade. This does not block the editor or numerical work.

The root distribution license remains undecided. No upstream printer profiles or slicer algorithms have been copied.

## Next session

1. Record actual MINI firmware, stock/modified hotend details and eSUN grade; settle any consequential machine assumptions with the product manager.
2. Implement a normalized printer/material record and narrow, tested PrusaSlicer exported-config importer with provenance and explicit unresolved-field handling.
3. Add a planar foundation and controlled wall transition/finish, using small calibration specimens first. Keep machine instructions in the adapter.
4. Extend bed/machine-envelope and motion/flow diagnostics; prepare independently audited complete output only for a resolved setup.
5. Deliver the visible printer-setup/export workflow and calibration preview, update evidence/docs, and prepare the first supervised physical test. Begin the material-calibration evidence plan; do not substitute geometry for a solver.

Detailed record: [session 001](sessions/001-workbench.md). Product contract: [PRD](PRD.md). Roadmap: [milestones](milestones.md). Defaults and open choices: [decisions](decisions.md).
