# Reusing slicer printer and filament profiles

## Confirmed direction

The product manager requested reuse of existing PrusaSlicer/SuperSlicer profiles. The first physical target is MINI+, a 0.4 mm nozzle, and white or black eSUN PLA. Reusing baseline configuration is appropriate; developing a replacement catalog of ordinary printer settings would add unnecessary work.

The recommended approach is an explicit compatibility adapter plus separate non-planar/process and material-simulation extensions. Multi-printer support is required under M9, with the adapter contract starting at M1. The first supported format and bundled profile dataset remain implementation/licensing decisions.

## Primary source findings

Prusa's old settings repository says it is no longer used by PrusaSlicer 2.8.0 and newer and links to separate printer-family repositories. Its actual [License file](https://github.com/prusa3d/PrusaSlicer-settings/blob/master/License) is AGPL-3.0. Do not choose the old repository simply because it is the first search result. [Repository notice](https://github.com/prusa3d/PrusaSlicer-settings)

The current Prusa FFF repository contains versioned bundles. The inspected index lists bundle 2.5.9 under a minimum slicer version of 2.9.6. That bundle contains MINI/MINIIS and Esun PLA entries; this is evidence of relevant baseline coverage, not confirmation that a selected entry matches the actual firmware or exact spool. The inspected file commit was `46064d500118cfe605986beafd1b72bbdb1f6fb8`. [Index](https://github.com/prusa3d/PrusaSlicer-settings-prusa-fff/blob/main/PrusaResearch/index.idx), [pinned bundle](https://github.com/prusa3d/PrusaSlicer-settings-prusa-fff/blob/46064d500118cfe605986beafd1b72bbdb1f6fb8/PrusaResearch/2.5.9.ini)

No LICENSE, COPYING, or README file was found in the inspected current repository tree, and the inspected bundle header did not state a license. This leaves redistribution terms for that exact dataset unresolved in this review. It does not establish that the dataset has no license elsewhere. The license on PrusaSlicer's code or its historical settings repository should not silently be assigned to a newer separate repository. [Current tree](https://api.github.com/repos/prusa3d/PrusaSlicer-settings-prusa-fff/git/trees/main?recursive=1)

PrusaSlicer and SuperSlicer's inspected source license files are AGPL-3.0. Their names being open source does not make every possible bundled resource permissively licensed. Direct reuse remains possible with an appropriate license/integration plan; profile import and data redistribution are distinct design questions. [PrusaSlicer license](https://github.com/prusa3d/PrusaSlicer/blob/master/LICENSE), [SuperSlicer license](https://github.com/supermerill/SuperSlicer/blob/master/LICENSE)

Prusa's vendor format supports inheritance, printer compatibility conditions, arrays, aliases, slicer-version indexes, and custom G-code with placeholders/expressions. A profile is therefore more than a dictionary of temperatures and speeds. Prusa also documents exporting configuration from the installed slicer. [Vendor bundle specification](https://github.com/prusa3d/PrusaSlicer/wiki/Vendor-bundles-and-updating-process), [Import/export instructions](https://help.prusa3d.com/article/how-to-import-and-export-custom-profiles-in-prusaslicer_382766)

## Proposed import contract

Start with a supported exported configuration for the actual MINI+ rather than promising every vendor bundle immediately. Record the originating slicer/version, selected print/printer/material names, vendor revision where available, content digest, and local overrides. Verify whether inheritance has already been resolved; reject a partial export with missing required ancestors instead of guessing defaults.

| Data | Proposed treatment |
|---|---|
| Nozzle/filament dimensions, bed shape, height, offsets | Normalize explicit units; compare with the actual machine record. |
| Temperatures, cooling, extrusion multiplier, retraction | Import reviewed fields as baseline values; flag behavior dependent on layer timing or other slicer logic. |
| Motion and volumetric-flow settings | Preserve meaning and units; distinguish configured ceilings, estimates, and measured limits. |
| Start/end and filament G-code | Parse and review the selected subset; resolve supported variables against explicit context or reject. Do not execute embedded postprocessing scripts. |
| Infill, supports, layer-change effects, conventional wall logic | Report as inapplicable or unsupported where the dedicated vase engine does not use them. |
| Print-server addresses, API keys, local paths | Exclude from project recipes and shared examples. They are unnecessary for file generation. |

Do not evaluate arbitrary imported expressions as JavaScript. Implement a bounded expression grammar only if the chosen import scope needs it; otherwise report unsupported syntax and request a supported resolved export. Unknown optional fields can be reported; unknown fields required for a correct job must prevent export.

Do not automatically absorb future upstream profile updates into existing projects. Pin the resolved values; offer an explicit migration/diff so a previously validated recipe remains reproducible.

## Non-planar extensions

Add the printhead envelope, motion model, process-method capability mapping, material/pressure/cooling parameters, contact assumptions, calibration evidence and tested domains. These extend ordinary slicer settings. Keep tested wave/span ranges as evidence rather than compulsory creativity limits; the user can design experiments beyond them. Map each operation to the target printer explicitly and report unsupported execution capabilities.

Store filament color and exact product name with physical results; “eSUN PLA” does not resolve whether the spool is a different PLA formulation. White and black are recorded alternatives, not automatically one validated process.

## Decision recommendation

Approve profile reuse as a requirement, a narrow import adapter as the initial implementation, and a license review before bundling upstream data. Broad printer/filament support can grow through adapters and datasets while validated non-planar support remains explicitly scoped to tested combinations.

Accessed 11 September 2026. Profiles were inspected remotely for research; none was installed, copied into the application, or executed.
