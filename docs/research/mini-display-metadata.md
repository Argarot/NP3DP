# Prusa MINI 5.1.2 plain-G-code thumbnail and progress contract

Research target: Prusa-Firmware-Buddy commit [`6f686bff4e0bb6660815e0bb944b971f1b7577c5`](https://github.com/prusa3d/Prusa-Firmware-Buddy/tree/6f686bff4e0bb6660815e0bb944b971f1b7577c5), which is the 14 December 2023 version bump to firmware 5.1.2. The compatible slicer reference is PrusaSlicer 2.7.1 commit [`dff602be63fb11bd6f566a4b54bb9423cc324d00`](https://github.com/prusa3d/PrusaSlicer/tree/dff602be63fb11bd6f566a4b54bb9423cc324d00), released two days earlier. Sources are pinned throughout.

## Result to implement

For the MINI's own LCD, emit two QOI blocks at the beginning of the plain `.gcode` file:

1. `220x124/QOI` for the pre-print preview.
2. `200x240/QOI` for the in-print progress screen.

The current progress canvas is 240x240, but the firmware explicitly falls back to the older 200x240 slicer image. The matching PrusaSlicer 2.7.1 MINI profile uses `16x16/QOI, 220x124/QOI, 200x240/QOI, 640x480/PNG`. The firmware's MINI/ST7789 dimensions are defined in [`GuiDefaults.hpp`](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/src/guiconfig/GuiDefaults.hpp#L26-L52), the exact QOI lookup and fallback are in [`window_thumbnail.cpp`](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/src/gui/window_thumbnail.cpp#L25-L82), and the profile values are in [`PrusaResearch.ini`](https://github.com/prusa3d/PrusaSlicer/blob/dff602be63fb11bd6f566a4b54bb9423cc324d00/resources/profiles/PrusaResearch.ini#L20665-L20720).

The 16x16 QOI profile image is not required by either MINI LCD screen at this revision. The embedded web server's small thumbnail endpoint requests an exact 16x16 **PNG**, while its large endpoint and Prusa Connect request PNG at least 17x17; see [`previews.cpp`](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/WUI/link_content/previews.cpp#L19-L72) and [`connect/render.cpp`](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/src/connect/render.cpp#L472-L510). Add PNG only when the network preview is in scope.

## Thumbnail wire format

The exact PrusaSlicer ASCII block is:

```gcode
;
; thumbnail_QOI begin 220x124 <base64-character-count>
; <up to 78 base64 characters>
; <more rows>
; thumbnail_QOI end
;
```

PNG uses `thumbnail` with no suffix. QOI uses `thumbnail_QOI`; matching is case-sensitive. JPG is a PrusaSlicer output option but is absent from the pinned firmware reader's image-type enum, so it is not a supported MINI target. PrusaSlicer's formatter, 78-character rows and encoded-character count are visible in [`Thumbnails.hpp`](https://github.com/prusa3d/PrusaSlicer/blob/dff602be63fb11bd6f566a4b54bb9423cc324d00/src/libslic3r/GCode/Thumbnails.hpp#L49-L78); its PNG/QOI tags and vertical conversion of bottom-up render pixels are in [`Thumbnails.cpp`](https://github.com/prusa3d/PrusaSlicer/blob/dff602be63fb11bd6f566a4b54bb9423cc324d00/src/libslic3r/GCode/Thumbnails.cpp#L20-L104).

Buddy scans only the first 2,048-ish lines for a thumbnail begin marker and then consumes exactly the declared number of non-whitespace, non-comment-prefix base64 characters. This proves that the number in the begin line is the **base64 character count**, not the decoded byte length. Put both blocks before machine commands and reject an oversized prefix. The contribution uses a conservative 1,800-line budget. See [`stream_thumbnail_start` and `stream_getc_thumbnail_impl`](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/src/common/gcode/gcode_reader.cpp#L150-L251) and the exact begin-tag parser in the [same file](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/src/common/gcode/gcode_reader.cpp#L298-L339).

`miniMetadata.ts` contains an independent pure-TypeScript QOI encoder and formatter. It accepts RGB/RGBA byte rasters and makes row origin explicit. A normal CPU/canvas raster should use the default `top-left`; only raw bottom-up WebGL pixels should use `bottom-left`. No upstream implementation or profile data is copied.

## Pre-print estimate metadata

The MINI recognizes this exact, case-sensitive metadata name:

```gcode
; estimated printing time (normal mode) = 9m 11s
```

It is parsed for the file description/pre-print and finished-print views; it does **not** initialize the live remaining-time counter. The local parser's recognized fields are `estimated printing time (normal mode)`, `filament_type`, `extruder_colour`, `filament used [mm]`, `filament used [g]`, and `printer_model`; see [`gcode_info.hpp`](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/src/common/gcode/gcode_info.hpp#L17-L31) and [`gcode_info.cpp`](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/src/common/gcode/gcode_info.cpp#L498-L563). The time value is copied into a 16-byte buffer, so keeping it to 15 visible characters avoids truncation.

Plain-G-code metadata scanning reads leading comments until the first command, then seeks into the final 50,000 bytes for trailing comments. Emit the estimate both before the first command and at the file tail. Do not put the initial M73 ahead of header comments, because it would end the leading metadata scan.

## Live progress and remaining time

The supported command is:

```gcode
M73 P<integer-percent> R<unsigned-integer-minutes>
```

The MINI build enables `M73_PRUSA` in [`Configuration_MINI_adv.h`](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/include/marlin/Configuration_MINI_adv.h#L2455-L2468). The parser reads P as a byte and multiplies R by 60; crucially, only P and R supplied together update the authoritative percentage and time-to-end. P without R writes a separate direct-percentage value, and R without P has no effect. T is time to a pause, not time to print completion. See [`M73_PE.cpp`](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/gcode/lcd/M73_PE.cpp#L68-L101).

MINI M73 values expire after 300 seconds. While P/R is fresh the server uses it for percent and remaining time and adjusts remaining seconds for `M220` speed percentage; when stale, percentage falls back to file-byte progress and remaining time becomes invalid. The 300-second constant is in [`M73_PE.h`](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/gcode/lcd/M73_PE.h#L7-L30), and consumption/fallback is in [`marlin_server.cpp`](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/src/common/marlin_server.cpp#L2484-L2525).

PrusaSlicer uses the printer-profile flag `remaining_times = 1` to insert M73 and describes a one-minute interval in [`PrintConfig.cpp`](https://github.com/prusa3d/PrusaSlicer/blob/dff602be63fb11bd6f566a4b54bb9423cc324d00/src/libslic3r/PrintConfig.cpp#L1773-L1778). Its normal-mode mask is `M73 P%s R%s`, it emits P0/R at the beginning and P100/R0 at the end, and it rounds remaining seconds to the nearest integer minute; see [`GCodeProcessor.cpp`](https://github.com/prusa3d/PrusaSlicer/blob/dff602be63fb11bd6f566a4b54bb9423cc324d00/src/libslic3r/GCode/GCodeProcessor.cpp#L565-L568) and its [post-processing formatter](https://github.com/prusa3d/PrusaSlicer/blob/dff602be63fb11bd6f566a4b54bb9423cc324d00/src/libslic3r/GCode/GCodeProcessor.cpp#L3744-L3792). `remaining_times` is a slicer-generation switch, not required metadata for hand-authored G-code. MINI has `silent_mode = 0`, and the pinned firmware parser does not consume PrusaSlicer's Q/S silent-mode pair; omit it.

NP3DP should calculate P/R from final quantized command text, refresh after potentially long `M109`, `M190`, and `G29` operations, then at about 30 commanded seconds with no supported interval above 60 commanded seconds. Put P100/R0 only after finish `M400`. A single move or dwell longer than 60 seconds must be split deliberately or rejected by this strict annotator; inserting a marker after it cannot meet the interval. Round positive remaining time upward for NP3DP so the display does not show zero before the motion plan ends. This differs from PrusaSlicer's nearest-minute policy but uses the same firmware-supported integer field.

The displayed value remains a **command-based estimate**. Current NP3DP timing covers final-text linear motion, stationary extrusion and explicit dwell. It excludes heating, homing, probing, acceleration/planner behavior and material response, so neither the metadata nor M73 is a printer-physics ETA guarantee.

## Integration notes

- In `src/print/complete.ts`, generate both final-size rasters, encode/frame them, and keep the resulting prefix before the first command. Run progress annotation on final quantized command text so its total agrees with exported commands.
- In `src/print/auditMini.ts`, accept only exact `M73 P<int> R<int>` fields; require P 0..100, nonnegative R, monotonic P, P100/R0 only after finish M400, a post-wait refresh, and bounded commanded-time gaps. Ignore thumbnail/metadata comment lines as before. Independently recompute progress timing rather than trusting the annotation helper.
- Retain the existing duration disclosure in the report and UI. Thumbnail presence and M73 syntax are software checks; only a printer run confirms LCD behavior.

## Mesh-fade context

This is adjacent to progress work, not a metadata requirement. The MINI firmware enables UBL and leveling fade support; `M420 Z<height>` controls fade, and the loaded value is persisted. The current NP3DP startup runs G29 but does not set a fade height, so actual Z correction above the first layer may depend on stored printer state. On a strongly skewed mesh that can make the executed nozzle path diverge materially from the nominal high-Z path. Record or explicitly control the reviewed fade policy before claiming path/clearance accuracy; do not choose a physical fade height without bed measurements. Sources: MINI leveling configuration in [`Configuration_MINI.h`](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/include/marlin/Configuration_MINI.h#L1155-L1185) and `M420 Z` handling in [`M420.cpp`](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/gcode/bedlevel/M420.cpp#L215-L250).

## Verification

- Strict TypeScript passed for `miniMetadata.ts` and `miniProgress.ts` with `noUnusedLocals` and `noUnusedParameters`.
- 16 tests passed: independent QOI decoding, RGB/RGBA and row-origin behavior, exact framing/base64 count, prefix bounds, M73 validation/scheduling/idempotence, and all four session-002 G-code fixtures.
- The final-text timer exactly reproduced the existing independent audit totals for control cup `448.4113092267907 s`, wave coupon `550.8636390476555 s`, miniature vase `2310.8658337507695 s`, and held-span coupon `1115.554903236621 s`.
- No printer or LCD test was performed.
