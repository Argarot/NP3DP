# Using the workbench

Open the [hosted workbench](https://argarot.github.io/NP3DP/) or start the local app with `npm ci` and `npm run dev` using Node 22.12 or later.

## Design and inspect

1. In **Design**, load **Ripple study** for waves or **Method sampler** for the four deposition families.
2. Use **Form** controls for height, taper, belly, section and twist. Dimensions describe the nominal contour; bead width and pattern excursions can extend beyond it.
3. Use **Deposition** for named methods, Z/radial effects, timing and height bands. Height share is a relative weight. **Process** edits pitch, strand/filament diameter, feed and flow.
4. Compare **Form**, **Nozzle path** and **Strand model**. Drag to orbit, scroll to zoom, use Front/Top/Fit, and colour by method or commanded speed.
5. Play or scrub the timeline, including stationary extrusion and holds. Commanded time excludes heater waits, probing, homing, acceleration and material behavior.
6. Save before closing or refreshing. **Save recipe** keeps wall design only; **Save project** or **Save project + print setup** retains recipe, foundation, printer, material and profile provenance. **Open recipe** accepts both file types. There is no automatic browser/cloud save.

The geometric strand view does not predict sag, cooling, attachment, collision or actual printer motion. Foundation/transition/rim sections are flattened volume equivalents; walls are circular and stationary deposits spherical. This is a useful geometry baseline, not completion of the required filament simulation.

## Prepare a complete experiment

Choose **Prepare print → Test bench → Load retry A** for the next physical test. The original control succeeded in one reported print; the original wave failed attachment. Tests retain your current printer, material, filament diameter and flow multiplier; review them in **Printer** and **Design → Process**. **Foundation** controls layers, bead dimensions, speed, pattern lead-in, rim turns and first-layer compensation. New setups use 0.15 mm inset; old v1 projects migrate with zero inset.

Use **Printer → Import PrusaSlicer config** for an optional supported flat `.ini` file. Read the proposed changes and notes before applying them. The [import guide](guides/profile-import.md) describes supported fields and omissions. Undo/redo restores the entire project together.

When the current plan is ready, **Export print** regenerates it and independently audits the final MINI job in a worker. Red errors block the G-code download; settings and the report remain available. The report records assumptions, final command checks and a checksum of the exact G-code. Save all three files together, then follow the [first-print guide](guides/first-print.md).

Complete output targets MINI-family Buddy firmware 5.1.2 with stock hotend, 0.4 mm nozzle and 1.75 mm filament. MINI versus MINI+ may remain unknown. The recorded material is eSUN PLA Basic. New retries remain unprinted; the original control observation does not establish repeatability or physical prediction accuracy. Follow the [retry guide](guides/retry-print.md).

If **Include foundation and finish** is off, the top action remains **Motion draft**. This `.gcode.txt` inspection export contains walls without temperatures, homing, purge or shutdown; it is not a complete job. Original wall studies retain their Z=0.4 mm reference and can intentionally extend below it, with diagnostics. Complete builds use explicit foundation placement and checks.

## Recovery and limits

- Invalid files, unknown versions/fields and invalid geometry leave the current project intact. Values are never silently clamped.
- A plan above 100,000 events reports a resource error. Reduce height/repeats/amplitude or increase pitch, or load a smaller study. Previous output stays labelled and export waits for a matching result.
- Tiny positive motion, extrusion or dwell erased by decimal formatting fails export instead of being silently dropped.
- A full-job limit error identifies its category. Lowering speed/flow or changing geometry is explicit; importing a higher machine limit does not prove physical capability.
- Profile proposals become stale after another project edit; reimport to review against the current settings.
- Save project before refreshing. Reloading does not restore unsaved edits. Imported observation logs are not supported; keep them beside the project/report as experiment evidence.

## Development checks

```sh
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
npm run licenses:check
npm run calibration
```

`npm run calibration` uses the app's compiler to generate two retry projects, local G-code/reports in `artifacts/session-003/` and a checksum/measurement manifest. Original session-002 calibration files are preserved. `npm run examples` refreshes the five original wall studies. `npm run measure` retains the session-001 wall workload measurement command. Browser tests use the built app on port 4173; development uses 5173.

Free-space loops, accurate filament simulation, integrated lamp hardware and multi-printer compatibility remain required [roadmap](milestones.md) capabilities. See [status](status.md) for the next session and unfinished gates.
