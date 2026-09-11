# NP3DP

A browser workbench for experimental non-planar 3D printing. Design a vessel, combine deposition methods, and inspect commanded motion and nominal material geometry.

**Engineering preview 0.1.** The editor works; complete printer jobs and physical simulation are still under development. [Open the workbench](https://argarot.github.io/NP3DP/) · [Current status](docs/status.md) · [Using the editor](docs/getting-started.md)

## What works

- Parametric taper, belly, circle/ellipse/rounded-square sections and true twist.
- Distinct waves, triangular spans, quadratic arches and pause-and-move bridges.
- Up to eight height bands, with Z/radial/speed/flow controls.
- Interactive form, commanded-path and nominal-strand views.
- Timeline playback with partial segments, stationary extrusion and non-extruding holds.
- Versioned recipe files, five [example studies](examples/), and undo/redo.
- Background generation/export, cancellation, bounded work and strict validation.
- Inspection-only G-code drafts and experiment reports, checked by a separate modal parser.

The draft is a wall experiment, **not a complete print job**. It lacks a base and machine start/end setup. The strand model does not simulate sag, cooling, contact or printer dynamics. Some experiments command below the reference plane and are explicitly diagnosed. No physical printability has been established.

## Run locally

Use Node 22.12 or later:

```sh
npm ci
npm run dev
```

Open the local URL printed in the terminal. Save recipes before closing or reloading; there is no automatic browser/cloud save.

```sh
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
npm run licenses:check
```

Pushes to main run verification and deploy the static build to GitHub Pages. Pull requests run the same software checks without deployment. No backend, account or printer connection is required.

## Product direction

The first physical reference is a woven-looking decorative vase with visible gaps on a Prusa MINI+, 0.4 mm nozzle, and white/black eSUN PLA. Installed firmware, modifications and exact PLA grade remain to be recorded.

Sagging/free-space loops, accurately calibrated filament simulation, integrated lamp brackets/socket interfaces, and multi-printer compatibility are **required later milestones**. Creative freedom takes priority over guaranteed print success; command correctness and claims about physical accuracy are separate gates.

## Project documents

- [Approved PRD](docs/PRD.md)
- [Milestones and task gates](docs/milestones.md)
- [Current implementation status and next session](docs/status.md)
- [Decisions and logged engineering defaults](docs/decisions.md)
- [Implementation architecture and path mathematics](docs/architecture.md)
- [Session 001 record](docs/sessions/001-workbench.md)
- [Research and discovery](docs/discovery.md)
- [Existing projects](docs/research/project-inventory.md), [toolpath feasibility](docs/research/toolpath-feasibility.md), [profile reuse](docs/research/profile-reuse.md), [filament simulation](docs/research/filament-simulation.md)

## Licensing

The product distribution license is undecided. Original NP3DP algorithms were written independently; no slicer code or printer profiles were copied. Package metadata is private/UNLICENSED rather than selecting an open-source license on the product manager's behalf.

Runtime dependencies and font notices are included in [THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt). The [complete resolved inventory](docs/dependency-inventory.json) and [licensing policy](docs/third-party-policy.md) distinguish runtime dependencies from build tools, including Lightning CSS's MPL license.
