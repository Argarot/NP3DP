# Using the workbench

Open the [hosted workbench](https://argarot.github.io/NP3DP/) or start the local app with `npm ci` and `npm run dev` using Node 22.12 or later. The local URL is printed in the terminal.

1. Load **Ripple study** to start with waves, or **Method sampler** to compare all four methods.
2. Use **Form** to change height, taper, belly, cross-section and twist. These dimensions describe the nominal envelope; motion excursions can extend beyond it.
3. Use **Deposition** to choose a method and change its sliders. Add height bands to combine methods from bottom to top. Height share is a relative weight, not a millimetre measurement.
4. Use **Process** for pitch, nominal strand/filament diameters, feed and flow. These values are editable experiments, not a selected/calibrated printer profile.
5. Compare **Form**, **Nozzle path**, and **Strand model**. Drag to orbit, scroll to zoom, or use Front/Top/Fit. Colour can show method or commanded speed.
6. Play or scrub the timeline. It includes stationary extrusion and non-extruding holds. Time estimates omit firmware acceleration and physical effects.
7. **Save recipe** before closing or refreshing. **Open recipe** restores a `.np3dp.json` file. Files in [examples](../examples/) can be versioned through normal Git.
8. **Motion draft** prepares and audits an inspection file in a background worker. You can inspect its first 100 lines and download the whole `.gcode.txt` or experiment report.

## What the first build does not provide

The draft is **not a complete print job**. It contains walls only and lacks a base, temperatures, homing, purge, firmware-specific setup and end behavior. Some settings—including the current Ripple study—command Z below the reference plane. Those experiments are diagnosed; no coordinates are silently lifted or clamped. Before printer output, the foundation and machine coordinate strategy must be implemented and verified.

The strand model shows nominal volume along the commanded path. It does not predict sag, cooling, attachment, collision, actual machine dynamics, or physical print success. Stationary deposits appear as volume-equivalent spheres. Their true shape is unknown. Multi-printer support, integrated lamp hardware, free-space loops and calibrated physical simulation remain required roadmap work.

## Recovering from input or resource errors

- A file with missing, unknown or unsupported-version fields is rejected and leaves the current recipe intact.
- Invalid numerical/shape settings show an error; values are never silently clamped.
- A job above 100,000 events reports a resource limit. Reduce height/repeats/amplitude or increase pitch, or load another study. The previous generated design remains visible and labelled; draft export waits for a matching result.
- Extremely small positive motion/extrusion/hold events may be unrepresentable at draft precision. Export reports the event instead of silently deleting it.
- Unsaved edits are held in memory. Save a recipe file to keep them across page reloads or sessions. Undo/redo applies within the current page.

## Development checks

```sh
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
npm run licenses:check
```

`npm run examples` refreshes the five versioned example recipes from their source definitions. `npm run measure` records a local single-sample CPU observation; it is not a physical or browser performance guarantee. Browser tests use the built app on port 4173, while development runs on port 5173.
