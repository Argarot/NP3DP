# Implementation status

Updated: 2026-09-11. Session 002 delivers engineering preview 0.2: complete MINI experiment files and the first-print preparation workflow. [Session record](sessions/002-printer-workflow.md) · [Decisions](decisions.md) · [PRD](PRD.md).

## Visible result

[Open NP3DP](https://argarot.github.io/NP3DP/). Choose **Prepare print → Load control cup → Export print**. Read the [first-print guide](guides/first-print.md) before transferring the file to the printer.

The existing geometry editor, four deposition methods, height bands, path/strand/form views and timeline now connect to printer/material setup, reviewed flat PrusaSlicer config import, a planar foundation, rising transition, rim and complete startup/finish. Whole-project save/load and undo retain both the design and print setup. An independent interpreter checks the emitted job; reports include the resolved project, diagnostics and G-code checksum.

**No physical print has been performed.** A passing command audit is not evidence of adhesion, nozzle clearance, a woven result or calibrated filament physics. The first user test remains pending.

## Task evidence

| Tasks | Implemented software | Remaining gate work |
|---|---|---|
| T00–T03 / G0 | Discovery, approved scope, independent-code route and dependency notices | Product distribution license undecided; future reuse reviewed separately |
| T10, T16 | Recipe/event/unit and band contracts; versioned project/setup wrapper | Future anchored regions and solver contracts |
| T11, T18 | Recorded firmware/stock hotend/nozzle/material; MINI-family command adapter traced to pinned firmware | Physical variant uncertain; measured printhead envelope and executed-motion evidence absent |
| T12 | Geometry/phase/join/volume/corner/quantization fixtures; foundation/transition mathematics | General adaptive geometric-error bounds and agreed machine tolerances |
| T13, T23, T31 | Strict input/resource/quantization errors; bed/deposited-width/purge strip, headroom, XY/Z speed and flow checks | Time-ordered printhead collision, deposited contact and firmware dynamics |
| T14, T42 | Worker cancellation/freshness, event cap, selective geometry allocation, local measurements | Agreed latency targets and broader workload/browser measurements |
| T15, T25 | Flat PrusaSlicer-style import with review, digest, mappings, ignored fields and current override tracking | User's real export fixture, additional formats/adapters, upstream dataset license review |
| T20, T21 | Circle/ellipse/squircle foundation, gap-aware transition, continuous body and optional rim | Physical foundation adhesion, transition bonding and finish evidence |
| T22 | Full MINI startup/body/finish and independent final-text interpreter; old draft mode preserved | Actual printer execution and further adapter coverage |
| T24 | Four compiled calibration candidates, full reports and observation guide | **Control print not performed** |
| T30, T36, T37 | Waves, triangles, quadratic arches and timed anchor/deposit/dwell/rise/span/fall events | Method-specific print tests and calibrated process/cooling controls |
| T17, T38, T41 | Form/path/nominal-volume views, flattened base beads, partial-event playback and observation template | Executed-motion model, material solver, agreed accuracy targets and held-out calibration data |
| T40, T43, T51 | Editor, setup/test bench, portable projects, print/draft exports and guides | Full experimental-alpha acceptance, including physical prediction |
| T52, T53 | Exact unchanged dependency inventory, notices, local build and GitHub Pages workflow | Release license decision and physical release evidence |

**G0 has passed for the selected implementation route. G1–G5 have not passed.** Software portions have advanced; numerical/physical acceptance and the first control print remain outstanding. **M6–M9 remain required:** sagging/free-space loops, accurate filament simulation, integrated lamp brackets/socket interfaces and additional printers.

## Verification

- Strict TypeScript and **133 unit/integration/geometry tests** passed locally after integration.
- Seven Chromium journeys cover the original editor and draft workflows plus full-job/project/checksum round trips, reviewed profile application with undo/redo, unsupported-firmware rejection and responsive layout.
- Production build succeeds. No runtime or development dependencies were added; dependency/license drift checks are required before deployment.
- All four calibration projects compile with zero independent-audit errors. [Measured evidence and checksums](evidence/session-002-calibration.json) records 14,987–68,480 events and roughly 0.45–2.05 seconds per complete local compile in one observation. These are not browser acceptance targets or physical timing measurements.
- [Independent adapter review](evidence/session-002-audit-review.md) records the mutation checks and remaining physical assumptions. [Firmware research](research/mini-5.1.2-adapter.md) records primary sources and exact revisions.
- Delivery verification is recorded in the session record once the Pages workflow completes.

## Known setup and defaults

Confirmed: MINI family, firmware `5.1.2+13478`, stock hotend, 0.4 mm nozzle, eSUN PLA Basic. MINI versus MINI+ is unknown. Record the installed sheet and loaded white/black spool at print time. No probe geometry or measured printhead clearance is inferred.

Logged starting values: nozzle 215 °C first layer / 210 °C body, bed 60 °C, fan off during the foundation then 100%, flow ceiling 5 mm³/s, XY/Z ceilings 100/8 mm/s, acceleration 500 mm/s². Test foundations use three 0.2 mm layers, 0.45 mm lines, 20 mm/s, 4 mm lead-in and one rim. These remain editable, unvalidated defaults.

Flat config import reuses explicit baseline values; it never executes embedded G-code or scripts. No slicer source or upstream profile dataset was copied. Complete output targets the recorded adapter only; multi-printer compatibility remains a required extension.

## Next session

1. Review the control cup's project/report, actual colour/sheet, photos and measurements. Record failures as well as successful regions; adjust foundation/flow/startup using evidence.
2. Prepare controlled comparisons and advance through the modest wave coupon to the miniature vase when the control is useful. Keep held spans as a separate process experiment.
3. Add time-ordered contact/clearance diagnostics using an explicit measured or user-reviewed printhead envelope. Do not treat missing geometry as clearance.
4. Start a calibrated span/sag preview baseline and free-space-loop process specification, with explicit physics scope and independent validation measurements. Agree accuracy targets before claiming predictive fidelity.
5. Expand supported profile fixtures using an actual PrusaSlicer export. Keep documentation, test evidence and project migration behavior current; choose a second printer only when the user identifies available hardware.

Independent software work can continue while awaiting a print. Physical gates remain open until real observations arrive. No higher-fidelity solver, integrated fitting or multi-printer milestone has been removed from scope.
