# Session 003 wave-contact diagnosis

## Physical observation and emitted job

The supplied photograph is consistent with an intact planar foundation and a
wall emitted as loose, nearly horizontal coils. It does not by itself identify
the instant or mechanism of detachment. The operator's report that the control
cup worked well makes a gross startup/extrusion failure less likely for this
run, while leaving material, sheet, and dimensional measurements uncalibrated.

The saved wave job changes the fan to `M106 S255` at G-code line 10901, before
the rising transition. The wall starts at line 11081 and the rim at line 16496.
Thus the file already requested 100% part cooling through transition and wall.
This confirms commanded state; actual fan operation was not observed by the software.

The 5,414 emitted wall moves unwrap to 23.333335 turns, matching `14 / 0.6`.
Their first point is radius 17 mm, Z 0.803 mm, and their last point is Z 14.800
mm. This agrees with the source planner after 0.001 mm G-code quantisation.

## Why the original wall has no reliable geometric support

For a constant-radius circular wall after its envelopes reach one, write the
matched-angle centreline path as:

`z(t) = zBase + p*t + A*sin(2*pi*k*t)`

where `t` is revolutions, `p=0.6 mm`, `A=0.3 mm`, and
`k=14+180/360=14.5` motifs/revolution. Because `k=N+0.5`, advancing one
revolution reverses the sine exactly. The gap from the preceding revolution is:

`g(t) = z(t)-z(t-1) = p + 2*A*sin(2*pi*k*t)`

Its exact full-blend range is 0.000 to 1.200 mm. Using the nominal 0.45 mm
strand diameter as a centreline-distance contact threshold, contact occupies
41.9569% of full-blend phase and 58.0431% exceeds the threshold. At a 17 mm
radius, one motif is about 7.37 mm around the contour, so a full-blend
unsupported window is about 4.28 mm of circumferential arc. These are nominal
path calculations, not the dimensions of a physical opening.

The 4 mm cubic start blend makes the start worse rather than safer for this
pitch. It suppresses the wave amplitude while the baseline pitch remains 0.6
mm, which is already greater than the 0.45 mm strand diameter. Dense sampled
matched-angle estimates from the exact generator equations are:

| Wall turn | Compared with | Minimum gap (mm) | Maximum gap (mm) | Nominal contact |
|---:|---|---:|---:|---:|
| 1 | rising transition | 0.200 | 0.611 | 62.2% |
| 2 | wall turn 1 | 0.519 | 0.678 | 0.0% |
| 3 | wall turn 2 | 0.414 | 0.790 | 5.0% |
| 4 | wall turn 3 | 0.280 | 0.915 | 30.4% |

The first wall turn rises over a transition that itself rises only 0.2 mm in
one revolution. Ignoring its very small initial modulation, their centreline
gap grows from 0.2 to 0.6 mm. The second wall turn has no sampled matched-angle
contact at all. The intended anti-phase crossings therefore appear only after
the wall has already been asked to form an unsupported helix.

The final rim also deserves explicit review. For the original coupon, its first
turn versus the final wall revolution has a sampled gap range of about -0.070
to 0.875 mm, with about 57.6% nominal contact. A negative nominal gap means the
rim command passes below the prior wall centreline at some matched angles. It
does not prove a collision, but it is a clear nozzle-interaction warning.

## Bounded retries

Both proposed retries use a 34 mm constant circle, 12 mm wall, one wave band,
14 repeats plus 180 degrees phase advance, zero radial/speed/flow variation,
the existing three-layer 0.2 mm foundation, 4 mm start blend, one rim, 6 mm/s
wall speed, and 100% fan. Holding the fan fixed makes the geometry change
interpretable.

| Retry | Pitch / strand / amplitude (mm) | Exact full-blend gap (mm) | Full-blend nominal contact | Start behaviour | First-rim estimate |
|---|---|---|---:|---|---|
| A | 0.30 / 0.45 / 0.08 | 0.14 to 0.46 | 88.6866% | Turns 1–11 fully within the nominal threshold; openings begin near the end of the 4 mm blend | 0.132–0.378 mm, 100% nominal contact |
| B | 0.40 / 0.45 / 0.12 | 0.16 to 0.64 | 56.6804% | Turns 1–3 fully within the nominal threshold; turn 4 is about 90.8% | 0.104–0.517 mm, about 91.2% nominal contact |

Retry A is the useful next geometry test. It preserves a positive 0.14 mm
minimum centreline gap, so the commanded wall does not cross the preceding
centreline, and its only exact full-blend over-threshold region is a small
window near the maximum. Retry B creates much larger windows and leaves a small
nominal gap in the first rim; it is better treated as the next opening-size
step after A rather than a co-equal recovery print.

At full amplitude on a 17 mm radius, estimated one-turn path length and cadence
are 106.94 mm / 17.82 s for A and 107.09 mm / 17.85 s for B at 6 mm/s. Their
maximum path slope magnitudes are about 0.071 and 0.106, giving maximum
commanded Z components around 0.43 and 0.63 mm/s. The original is about 108.54
mm / 9.05 s at 12 mm/s with maximum slope 0.261 and commanded Z component about
3.04 mm/s. Slowing therefore reduces commanded Z dynamics, but doubles the
time before the nozzle returns to the same angular location. It cannot be
claimed to improve thermal bonding without a controlled print.

Reducing fan can keep deposited PLA warmer and can also reduce shape retention
in open or unsupported regions. The present evidence does not select an ideal
fan. First repair commanded contact while holding cooling constant; if A is
stable, a separate fan comparison can measure attachment and geometry rather
than confounding the two.

## Primary-source evidence and limits

- Allum et al., [ZigZagZ: Improving mechanical performance in extrusion
  additive manufacturing by nonplanar toolpaths](https://doi.org/10.1016/j.addma.2020.101715)
  (author PDF: https://fullcontrolgcode.com/wp-content/uploads/2021/07/ZigZagZ-Improving-mechanical-performance-in-extrusion-additive-manufacturing-by-nonplanar-toolpaths.pdf),
  experimentally printed nozzle-scale nonplanar PLA paths with a 0.4 mm nozzle,
  0.2 mm layer height, 210 C, and 25 mm/s. The study used a dedicated support
  structure at the base of every zigzag box, controlled thickness by extrusion,
  documented nozzle ploughing and asymmetric deposited geometry during descent,
  and states that its larger examples used toolpath algorithms designed to
  avoid collision with prior material. This supports explicit anchoring and
  time-ordered interaction analysis; its parameters are not a transferable
  recipe for the MINI or eSUN PLA Basic.
- Kayali et al., [Effect of printing parameters on microscale geometry for 3D
  printed lattice structures](https://doi.org/10.1016/j.matpr.2022.08.487)
  (institutional record: https://irep.ntu.ac.uk/id/eprint/49768/), used
  FullControl-generated square lattices and microscopy/micro-CT. Printing speed
  materially affected microscale defects, and moving crossing extrudates by
  half a layer height improved crossing geometry. This is evidence that
  crossing offset and speed require physical calibration, not evidence that a
  sine path with occasional proximity will self-anchor.
- Gleadall, [FullControl GCode Designer: open-source software for unconstrained
  design in additive manufacturing](https://doi.org/10.1016/j.addma.2021.102109),
  establishes direct control of each path segment and process parameter. That
  capability is the relevant precedent, while it does not turn a commanded tube
  preview into a validated filament or clearance model.
- Keim et al., [Investigating the effect of nonuniform forced convection on
  local polymer properties and geometric fidelity in fused filament
  fabrication](https://www.nature.com/articles/s44334-025-00056-7), varied fan
  activation and fan speed in instrumented PLA experiments on a Prusa MK3S+
  with a 0.4 mm nozzle. It measured significant, spatially nonuniform thermal
  and geometry effects from the print fan. This supports treating fan as a
  controlled experimental variable. The study used planar cubes and a different
  printer/material setup, so it does not determine the fan value for this wave.

No calculation or cited experiment here proves nozzle/fan-duct clearance,
actual bead cross-section, welding, sag, or successful printing on the user's
machine.
