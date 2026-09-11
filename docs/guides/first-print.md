# First supervised print on the Prusa MINI family

This guide covers NP3DP's first physical experiments on a stock-hotend Prusa MINI or MINI+ with a 0.4 mm nozzle, Buddy firmware `5.1.2+13478`, and eSUN PLA Basic. The exact MINI-family variant is still unknown. Leave it as **MINI / MINI+ — uncertain** in the app until the printer label or purchase record resolves it; the reviewed 5.1.2 command adapter is shared by both variants.

The files pass software checks for the narrow command dialect, coordinates, modes, temperature waits, extrusion totals, flow ceiling and shutdown sequence. No NP3DP object has yet been shown to adhere, avoid printhead contact, or form the previewed strands on this printer. Read the [adapter and manufacturer research](../research/mini-5.1.2-adapter.md) and [toolpath limits](../research/toolpath-feasibility.md) before treating the output as more than a supervised experiment.

## Prepare the known setup

1. Open the [NP3DP workbench](https://argarot.github.io/NP3DP/) and select **Prepare print**.
2. In **Printer**, keep firmware `5.1.2+13478`, **Stock** hotend and the displayed 0.4 mm nozzle. Select **Original MINI** or **MINI+** only when you can confirm it.
3. Set the material name to **eSUN PLA Basic** and record the actual spool colour. White and black remain separate evidence until prints show that they behave the same. Record the lot and storage or drying history in [observation-template.json](observation-template.json) when available.
4. Review every material and machine value. The manual starting setup is 215 → 210 °C nozzle, 60 → 60 °C bed, 100% fan after the foundation, a 5 mm³/s flow ceiling and 500 mm/s² commanded acceleration. These are editable starting values within the software envelope, not measured limits or a validated material profile.
5. If you have a flattened PrusaSlicer configuration, choose **Import PrusaSlicer config**, select the `.ini`, inspect every proposed mapping and import note, then choose **Apply imported settings**. Imported custom G-code is never executed. Importing is optional for this first run.
6. On the printer, select the sheet you will use and complete Prusa's normal sheet-specific first-layer calibration. Clean and install that sheet as you ordinarily would. Clear the whole bed and the front purge area. Do not use NP3DP output to replace printer calibration.

Loading a Test bench study enables a three-layer, 0.2 mm-high, 0.45 mm-wide foundation at 20 mm/s, a 4 mm pattern lead-in and one finish rim. It replaces shape and deposition settings while retaining the current printer, material, filament diameter and flow multiplier. Check the retained filament diameter and flow multiplier before every export.

## Run the studies in order

Start with **Test bench → Load control cup**. The control is a 30 mm source contour and 10 mm wall with a conventional continuous spiral. It tests purge, foundation adhesion, line contact, extrusion continuity and basic dimensional recording before unsupported motion is added.

Advance only after the control remains attached and continuous without repeated nozzle contact. Load **Wave coupon** next. It uses a 34 mm source contour, 14 mm wall, 0.3 mm vertical wave and slower 12 mm/s wall command. Compare it directly with the control and record detached strands, nozzle drag and a side photograph against a millimetre scale.

Load **Mini woven vase** only after the control and wave coupon provide acceptable evidence. Its commanded shape grows from a 40 mm base contour to a 52 mm top contour over a 45 mm wall, with a 4 mm belly and 0.6 mm wave. Record opening sizes, loose strands, nozzle contact and the difference between the physical silhouette and the commanded preview.

The **Held-span coupon** is a separate optional study after the control. It starts with a conventional collar band, then introduces the timed-span band at 6 mm/s with explicit stationary deposits and 0.15 s holds. Do not treat a successful wave coupon as evidence that the held spans will work; record attachment at both ends and centre sag separately.

The shape diameter shown in a recipe is the source contour followed by the nozzle centre. A measured outside diameter also includes deposited bead width and real material deformation. Record the source contour diameter and measured outside diameter as different quantities rather than calling their difference dimensional error.

## Review and save each job

Wait for **Ready for export review**, then choose **Export print**. Resolve every red error. Warnings about untested physical behavior remain expected at this stage.

In **Review the experimental print**:

1. Confirm the recipe, material, temperatures, nozzle and hotend summary.
2. Require **Command audit passed**. Open **Inspect startup and initial commands** if you want to examine the beginning of the file.
3. Choose **Save project** to download `<recipe>.np3dp-project.json`. This is the editable recipe and print setup that the app can reopen through **Open recipe**.
4. Choose **Download print report** for `<recipe>.print-report.json`. Keep it beside the project and G-code; it records settings, diagnostics, event statistics and the command audit as generated.
5. Choose **Download .gcode** only after the review passes. NP3DP creates a local file and has no direct printer connection. Transfer it to the printer by your normal USB workflow.
6. Copy [observation-template.json](observation-template.json) for the run and fill it after, or during, the supervised print. The app does not import this companion observation log.

The displayed commanded time sums feed-based moves, stationary extrusion and dwell. It excludes heater waits, homing, mesh probing, acceleration and firmware planning, so wall-clock print time will differ.

## What the generated startup and finish do

The adapter checks the MINI model and 0.4 mm nozzle, establishes millimetres, absolute XYZ and relative linear E, resets speed and flow scaling, disables pressure advance for this experiment, applies the selected acceleration and keeps the fan off. It sets the first-layer bed target and a 170 °C probing nozzle target, waits for both, runs `G28` and `G29`, then makes a Z-only lift to 2 mm before moving in XY.

After probing it waits for the selected first-layer nozzle target, purges from X5 to X65 at Y6 and Z0.2 with 6 mm of filament, lifts to 2 mm, approaches the checked part start and descends there. The first foundation layer uses the first-layer temperatures. Later extrusion uses the body targets: increases wait for the new temperature, while reductions begin cooling without pausing. The fan stays off through the foundation and changes to the selected PWM at the rising transition. Firmware input-shaper settings are left in firmware; NP3DP does not emit an uncalibrated `M593` value.

At completion the adapter retracts 0.8 mm, lifts at least 5 mm above the greatest parsed body Z, parks at X10 Y170, waits for motion to finish, turns the nozzle, bed and fan off, resets pressure advance and flow scaling, then disables the motors.

## Observe the start and stop when evidence turns bad

Watch the purge and the entire foundation. Stop the run if the purge does not form a continuous line; the foundation detaches, folds over or moves on the sheet; filament repeatedly collects on the nozzle; the nozzle or printhead strikes or drags the part; motion is visibly obstructed; or the printer reports a thermal, probing, homing or motion fault. Also stop if a growing loose strand could be caught by the printhead. Record the first failing stage and visible symptom rather than continuing only to obtain a completed object.

For the control, an advance decision needs a continuous purge, an attached foundation, a stable wall, no repeated nozzle contact and measurements recorded. For the wave coupon, also require that the modulation remains attached closely enough to inspect and that contact or detachment does not worsen as height increases. The miniature vase remains a new experiment even after both coupons succeed.

Use the observation log to record failures as useful evidence. A stopped or misshapen print does not show that the G-code was malformed, and a completed print does not validate the unmodelled physics outside that exact printer, sheet, material colour, settings and geometry.

See [using the editor](../getting-started.md), [current implementation status](../status.md), and the [session 002 record](../sessions/002-printer-workflow.md) for the software scope and remaining gates.

An explicitly selected 0 °C bed target means heater off. The adapter does not wait for the bed to cool to zero; positive targets retain the described wait behavior. This does not establish that a cold-bed print will adhere.
