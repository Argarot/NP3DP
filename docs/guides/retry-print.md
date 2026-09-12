# Attachment retry — A/B reference procedure

**Follow-up, 12 September 2026:** the product manager reports A and B work well, and preview/time estimate work. [Recorded feedback](../evidence/session-004-observations.json). The sequence below remains the procedure for reproducing those references. A revised miniature and separate arch/held-span comparison are next build work; original 03/04 have not been reworked. Actual estimate accuracy and dimensional compensation remain unmeasured.

The product manager printed the original session-002 files unchanged: **01 control worked; 02 wave detached**. Later files were not printed at that point. The photo shows an intact base with loose coils; it does not provide measured temperatures, dimensions or an executed-motion trace.

The original wave had 0.60 mm rise per revolution and a nominal 0.45 mm strand. Its 4 mm amplitude lead-in left the second revolution entirely above nominal attachment range. Slower motion or more fan cannot repair that missing geometric contact by themselves. [Diagnosis and primary research](../research/wave-attachment.md).

## New files

Open [NP3DP](https://argarot.github.io/NP3DP/), then **Prepare print → Load retry A → Export print**. Alternatively, `npm run calibration` generates these files locally in `artifacts/session-003/`:

| File | Rise/turn | Wave amplitude | Wall speed | Use |
|---|---:|---:|---:|---|
| `05-retry-a-attachment.gcode` | 0.30 mm | 0.08 mm | 6 mm/s | Reported successful; first reference for reproducing the comparison |
| `06-retry-b-openings.gcode` | 0.40 mm | 0.12 mm | 6 mm/s | Reported successful; wider unsupported windows, compare after A |

Both have a 34 mm circular wall, 12 mm wall height, nominal 0.45 mm strand, three 0.2 mm foundation layers, 4 mm lead-in and one rim. The new files use **0.15 mm first-layer inset**, 215 → 210 °C nozzle, 60 °C bed, and fan off for the foundation then 100%. The app preserves current material/printer settings when loading a study, so review them before exporting. Loading an old project preserves its **zero** compensation until changed explicitly.

A has about **17m 37s** of commanded motion/dwell; B about **14m 40s**. Actual printing also includes heating, homing, probing and firmware dynamics. The LCD estimate is useful but has not been calibrated to elapsed printer time.

## Before and during the print

1. Use the same calibrated sheet and recorded PLA as the successful control. Record the sheet and actual spool colour. Remove the failed print and old purge material.
2. Select **05 Retry A** from USB. The MINI should show the generated object thumbnail and a time estimate. Photograph the display if either is absent.
3. Watch the usual heating, homing and **G29 mesh leveling**. Mesh probing remains mandatory before any extrusion.
4. Expect a two-part purge at **Y6**, from X5 to X65 and then X135, at Z0.20 mm. It uses 18 mm of filament in total and adapts its feed to the selected flow ceiling. **The second segment should be visibly continuous.** If it remains dry/broken, stop and record it before judging the wall experiment.
5. Watch the foundation and first wall turns. Confirm the part-cooling fan starts after the foundation. Note the first height/turn where any strand detaches or the nozzle drags material. Stop a failing study before a loose strand accumulates.
6. After cooling, photograph the side and base against a ruler. Measure the base flare if possible and record actual total print time. Keep the `.gcode`, project and checksum-linked report with those observations.
7. Advance to **06 Retry B** only if A's turns attach. Do not resume the original failed 02 file or jump directly to the miniature vase for this comparison.

The original file already commanded full fan after the foundation and a smaller E6 purge. The new purge is longer and has explicit ordered audit checks; software cannot establish whether the earlier physical purge or fan actually occurred. No arbitrary deep Z plunge was added: positive path separation is retained while reducing rise per turn.

## What the preview and reports mean

The LCD and app depict nominal commanded deposition. The circular-wave panel samples matched-angle Z gaps, with analytic full-amplitude ranges where applicable. It does **not** predict weld strength, sag, flattened bead contact, mesh corrections or printhead collision. A's early nominal contact is a reason to test it, not proof that it will print successfully.

Record LCD preview, live progress/remaining time, purge continuity, fan operation, first attachment failure, base flare, actual time and photographs. If A fails, diagnose that observation before increasing unsupported length. If A succeeds, compare B and then introduce arches/held spans as separate process studies.
