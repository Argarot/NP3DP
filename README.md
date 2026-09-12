# NP3DP

A browser workbench for experimental non-planar 3D printing. Design a vessel, combine deposition methods, and inspect commanded motion and nominal material geometry.

**Engineering preview 0.4.** Design experiments and export complete, independently audited jobs for the recorded MINI setup. The original control and A/B retries are reported successful; 07 miniature, 08 arches and 09 timed endpoints are ready for physical testing. Printer preview and time display are reported working. Calibrated filament simulation remains under development. [Open the workbench](https://argarot.github.io/NP3DP/) · [Next-print guide](docs/guides/next-prints.md) · [Current status](docs/status.md)

## What works

- Parametric taper, belly, circle/ellipse/rounded-square sections and true twist.
- Distinct waves, triangular spans, quadratic arches and pause-and-move bridges.
- Up to eight height bands, with Z/radial/speed/flow controls.
- Interactive form, commanded-path and nominal-strand views.
- Timeline playback with partial segments, stationary extrusion and non-extruding holds.
- Versioned recipe files, five [example studies](examples/), and undo/redo.
- Background generation/export, cancellation, bounded work and strict validation.
- Inspection-only G-code drafts and experiment reports, checked by a separate modal parser.
- Printer/material setup and reviewed import of a supported subset of flat PrusaSlicer configuration files.
- Planar foundations, rising transitions, rim turns and full-job startup/finish for MINI firmware 5.1.2.
- Four [calibration projects](examples/calibration/), project/setup round trips, and G-code-linked reports with SHA-256 checksums.
- Two [attachment retries](examples/retries/), nominal per-turn contact estimates, first-layer compensation, MINI LCD thumbnails, progress/ETA and a two-part purge.
- Three [next-print projects](examples/next-prints/) with prepared G-code downloads, a per-turn XYZ separation chart from actual segments, and explicit lifted-post diagnostics.

**Prepare print → Download 07 G-code** starts the new test sequence. Follow the [guide](docs/guides/next-prints.md) through miniature, arches and timed endpoints. Prepared downloads have fixed settings; **Load** lets you customize a study and **Export print** uses those edits. The independent command audit verifies the emitted dialect, state, temperatures, motion, extrusion and finish; it does not establish adhesion or printhead clearance. The strand model displays commanded material volume, without sag, cooling, contact or printer dynamics. Wall-only **Motion draft** remains an inspection file with no machine setup.

## Run locally

Use Node 22.12 or later:

```sh
npm ci
npm run dev
```

Open the local URL printed in the terminal. Save a recipe or complete project before closing or reloading; there is no automatic browser/cloud save.

```sh
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
npm run licenses:check
```

Pushes to main run verification and deploy the static build to GitHub Pages. Pull requests run the same software checks without deployment. No backend, account or printer connection is required.

`npm run calibration` generates 07–09 projects in `examples/next-prints/`, ignored local G-code/reports in `artifacts/session-005/`, and a checksum manifest in `docs/evidence/`. `npm run calibration:publish` also updates the reviewed reference downloads in `public/print-tests/session-005/`; tests recompile them and verify exact bytes. The compiler is shared with the app and all jobs must pass the command audit before outputs are written. `node scripts/calibration.mjs --batch retries` explicitly regenerates the older A/B batch; normal generation preserves it and originals 01–04. Keep each project's report and G-code with its physical observations.

## Product direction

The first physical reference is a woven-looking decorative vase with visible gaps on a Prusa MINI-family printer, stock hotend, 0.4 mm nozzle, firmware `5.1.2+13478`, and white/black eSUN PLA Basic. MINI versus MINI+ remains uncertain. The original control worked, the wave detached, and A/B retries subsequently worked. New 07–09 introduce a shaped miniature and separate arch/timed-endpoint tests; original 03/04 retain their old geometry.

Sagging/free-space loops, accurately calibrated filament simulation, integrated lamp brackets/socket interfaces, and multi-printer compatibility are **required later milestones**. Creative freedom takes priority over guaranteed print success; command correctness and claims about physical accuracy are separate gates.

## Project documents

- [Approved PRD](docs/PRD.md)
- [Milestones and task gates](docs/milestones.md)
- [Current implementation status and next session](docs/status.md)
- [Decisions and logged engineering defaults](docs/decisions.md)
- [Implementation architecture and path mathematics](docs/architecture.md)
- [Session 001 record](docs/sessions/001-workbench.md)
- [Session 002 record and next-session plan](docs/sessions/002-printer-workflow.md)
- [Session 003 attachment retry and next-session plan](docs/sessions/003-attachment-retry.md)
- [Session 004 successful retries and next test plan](docs/sessions/004-retry-feedback.md)
- [Session 005 new test batch and next-session plan](docs/sessions/005-next-print-batch.md)
- [First print and observation log](docs/guides/first-print.md), [profile import](docs/guides/profile-import.md)
- [Research and discovery](docs/discovery.md)
- [Existing projects](docs/research/project-inventory.md), [toolpath feasibility](docs/research/toolpath-feasibility.md), [profile reuse](docs/research/profile-reuse.md), [filament simulation](docs/research/filament-simulation.md)

## Licensing

The product distribution license is undecided. Original NP3DP algorithms were written independently; no slicer code or printer profiles were copied. Package metadata is private/UNLICENSED rather than selecting an open-source license on the product manager's behalf.

Runtime dependencies and font notices are included in [THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt). The [complete resolved inventory](docs/dependency-inventory.json) and [licensing policy](docs/third-party-policy.md) distinguish runtime dependencies from build tools, including Lightning CSS's MPL license.
