# Importing a PrusaSlicer configuration

In PrusaSlicer, export a single resolved configuration with **File → Export → Export Config**. In NP3DP choose **Prepare print → Printer → Import PrusaSlicer config**. Import produces a proposal: inspect every change and note, then apply it. The whole recipe/setup update is one undo operation. If the project changes while the proposal is open, import again.

The adapter targets a supported subset of flat PrusaSlicer-style INI, tested with synthetic 2.9-style fixtures. A real export from the user's installation is still needed as compatibility evidence. Vendor configuration bundles, arbitrary inheritance, other printer families and multi-extruder arrays are outside this adapter. SuperSlicer support is not claimed from format resemblance alone.

| Source settings | NP3DP treatment |
|---|---|
| `printer_model`, printer/filament settings identifiers, generated-version comment | Require explicit MINI-family identity where needed; retain source identifiers. `MINIIS` means input shaping, not MINI+. Actual variant and installed firmware stay as recorded. |
| `nozzle_diameter`, `filament_diameter`, `extrusion_multiplier` | Map explicit single values; full-job adapter separately checks supported nozzle/filament hardware. |
| First-layer/body nozzle and bed temperatures | Map to editable material targets. No temperature/speed macro execution. |
| Maximum fan speed | Fixed fan setting after foundation. Slicer automatic layer-time cooling is not reproduced. |
| Print/filament volumetric speed | Propose the minimum positive source cap for review, which can raise or lower the current material cap. When both are zero or absent, retain the selected ceiling. Zero alone does not become unlimited NP3DP flow. |
| XY/Z maximum feed and applicable acceleration limits | Lower the selected command ceiling where applicable. Normal/quiet pairs use the minimum and report that choice. They are machine ceilings, not process wall speed. |
| `layer_height`, explicit numeric `extrusion_width` | Foundation height/width only. Auto-width zero is ignored with a note. These do not overwrite experimental wall pitch/strand diameter. |
| `first_layer_height` | Reported; a separate first-layer-height model is not implemented. Percent-valued known numeric settings are rejected where their meaning cannot be retained. |
| Empty `inherits` | Accepted as no inherited settings. Non-empty inheritance is rejected: export a resolved config. |
| Compatibility selectors | Not evaluated. Non-empty selectors require explicit compatible MINI hardware before they can be ignored with a note. |
| Start/end/filament G-code, macros, postprocessing scripts | Never execute or pass through; retain ignored field names only. NP3DP owns its startup and finish. |
| Other slicer options, host credentials and service settings | Not adopted. Unknown optional field names are reported; their values are not retained in exported projects. |

Import is bounded to 1 MB, 10,000 lines and bounded provenance lists. Duplicate keys, unsupported sections, malformed/non-finite numbers and incompatible hardware fail explicitly. No external files or network credentials are needed.

A project stores the source filename, SHA-256 digest, available source version/profile identifiers, mapped and ignored keys, warnings and the imported value baseline. Subsequent manual changes appear as current overrides. The digest identifies the supplied file; it does not certify its origin or correctness. The source file itself is not embedded in the project.

Imported temperatures and limits are starting values, not proof of non-planar printability. No profile sets the installed firmware or silently grants support for another printer. See [first print](first-print.md), [setup/adapter research](../research/mini-5.1.2-adapter.md), [profile reuse research](../research/profile-reuse.md) and [licensing policy](../third-party-policy.md).

## Session-003 addition

The flat importer now maps `elefant_foot_compensation` to the first-layer inset (0–0.5 mm), with review and source provenance. New project/setup files use schema 2. Version-1 projects migrate with a zero inset, preserving their footprint.
