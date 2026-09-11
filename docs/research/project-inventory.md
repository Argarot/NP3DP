# Project inventory: experimental non-planar decorative FDM

**Research snapshot:** 2026-09-11.  This is a source and precedent inventory, not a
claim that any project is safe for a particular printer. “Reuse” means code reuse;
ideas and independently reproduced behaviour are considered separately.

Subsequent implementation uses independently authored generators and reviewed runtime libraries. No source from this candidate inventory was copied. Historical reuse recommendations below are not a record of installed dependencies; see [current licensing policy](../third-party-policy.md).

## Findings at a glance

| Project | Directly evidenced capability | License evidence | Recommendation |
| --- | --- | --- | --- |
| [gcoordinator](https://github.com/tomohiron907/gcoordinator) | Python library for coordinate-path modeling, preview and G-code generation; extracted from a separate desktop GUI project. | [MIT `LICENSE`](https://github.com/tomohiron907/gcoordinator/blob/main/LICENSE) | **Promising permissive path-engine candidate.** Review reusable algorithms or a documented port for the browser engine; verify extrusion, travel joins and printer behavior. Its Python runtime is not a drop-in GitHub Pages dependency. |
| [AmiSlicer](https://github.com/kasanetarium/AmiSlicer) | STL-to-G-code woven appearance: sinusoidal perimeter displacement, phase alternation between layers, optional Z wave, self-intersection handling and previews. The application itself is currently withheld; the repository has documentation/technical records only. | [MIT `LICENSE`](https://github.com/kasanetarium/AmiSlicer/blob/main/LICENSE) | **Study the woven-wall method; do not depend on it.** No runnable source is presently provided. The broader NP3DP studio additionally needs independent path/anchor primitives, timed deposition and material prediction. |
| [LuminaForge](https://github.com/potalora/luminaforge) | Browser editor for parametric vase **mesh** geometry and STL export: height, diameter, twist, profiles, fins and cross-sections. Its README says the lamp generator is still to come; it does not evidence direct G-code or strand-toolpath generation. | [MIT `LICENSE`](https://github.com/potalora/luminaforge/blob/main/LICENSE) | **Potentially reusable UI/mesh scaffold after a code review; separate it strictly from toolpath generation.** It cannot supply the core woven-print behavior by itself. |
| [FullControl](https://github.com/FullControlXYZ/fullcontrol) | Python/Jupyter direct toolpath design, preview and G-code transformation; its state model exposes position, speed, extrusion and printer commands. | [GPL-3.0 `license`](https://github.com/FullControlXYZ/fullcontrol/blob/master/license) | **Strong reference; dependency decision pending.** Direct incorporation requires an appropriate GPL distribution plan. An independently written core is another route; this review does not claim a formal clean-room process. |
| [Bread](https://github.com/nick-parker/Bread) | Experimental Java slicer that takes a part STL plus layer-surface STL for conventional FDM; documents rudimentary FANUC 5-axis support. | [GPL-3.0 `license`](https://github.com/nick-parker/Bread/blob/master/license) | **Study safety model, do not reuse.** It is a different surface-slicing workflow and its documentation says the experimental output can crash or skip a printer. |
| [Bricklayers](https://github.com/TengerTechnologies/Bricklayers) | Prusa/Orca postprocessor for intentionally interlocking, non-planar wall textures; documented sine, triangle, trapezoid and sawtooth perimeter functions with amplitude, frequency and segmented deformation. | [GPL-3.0 `LICENSE`](https://github.com/TengerTechnologies/Bricklayers/blob/main/LICENSE) | **Best decorative behaviour reference.** Recreate selected algorithms from first principles, then compare outputs/prints; do not copy code into a permissive product. |
| [GCodeZAA](https://github.com/Theaninova/GCodeZAA) | Postprocesses sliced STL jobs to introduce sub-layer Z surface detail. Its README lists Klipper-only operation, lack of arc/travel handling, and open flow/artifact work. | [GPL-3.0 `LICENSE`](https://github.com/Theaninova/GCodeZAA/blob/main/LICENSE) | **Study parser and validation needs.** It is unsuitable as the MVP’s single-wall weave engine. |
| [Zip-o-mat/Slic3r nonplanar](https://github.com/Zip-o-mat/Slic3r/tree/nonplanar) | Full Slic3r fork with experimental integrated non-planar slicing, primarily relevant to curved top surfaces. | [AGPL-3.0 `LICENSE`](https://github.com/Zip-o-mat/Slic3r/blob/nonplanar/LICENSE) | **Research reference recommended.** A full slicer fork is disproportionate for this first release; incorporation requires a concrete AGPL compliance plan. Architectural isolation alone does not establish license compatibility. |
| [CurviSlicer](https://github.com/mfx-inria/curvislicer) | Research pipeline that creates slightly curved layers on an ordinary 3-axis FDM printer, then emits Marlin-style G-code. It warns about carriage/part collision and requires manual header/footer and bed fit checks. | [AGPL-3.0 `LICENSE`](https://github.com/mfx-inria/curvislicer/blob/master/LICENSE) | **Study algorithms and collision framing.** Do not make it an MVP dependency. It targets volumetric curved slicing rather than decorative continuous walls. |
| [TOOLPATHS](https://github.com/KonradJuenger/TOOLPATHS) | Grasshopper plugin whose README advertises a vase generator, variable layer heights and non-planar slicing. The repository describes the current offering as closed beta. | **No license file was found in the repository root on the snapshot date; do not infer a license from public visibility.** | **Do not reuse.** Review only its public workflow ideas; request a license from its author before any other use. |

## Source notes and activity checks

The following facts are directly reported by each project’s primary repository or
official site, rather than inferred from third-party articles.

- [gcoordinator's README](https://github.com/tomohiron907/gcoordinator#readme) describes coordinate paths, preview, export, and explicit start/end files. It also states that separate Path objects receive travel moves between them; a continuous-vase integration must examine this behavior. The [PyPI 0.0.24 record](https://pypi.org/project/gcoordinator/0.0.24/) reports release on 31 July 2026. Neither browser suitability nor printer compatibility was benchmarked here.

- [AmiSlicer’s README](https://github.com/kasanetarium/AmiSlicer/blob/main/README.md)
  describes the woven perimeter method and its stated limitations: no branching
  cross-sections or multi-contour interiors. It says the executable/distributable
  application was removed while its public presentation is reconsidered. Its latest
  commit was **2026-04-26 UTC**, per the
  [commits endpoint](https://api.github.com/repos/kasanetarium/AmiSlicer/commits?per_page=1).
- [LuminaForge’s README](https://github.com/potalora/luminaforge#readme) directly
  evidences client-side parameterized geometry, real-time preview and STL export,
  but not G-code generation. Its latest commit was **2026-06-10 UTC**
  ([API evidence](https://api.github.com/repos/potalora/luminaforge/commits?per_page=1)).
- [FullControl’s README](https://github.com/FullControlXYZ/fullcontrol#readme) and
  [reference](https://github.com/FullControlXYZ/fullcontrol/blob/master/llm_ref.md)
  establish direct path/state design and G-code export. The latest repository commit
  was **2026-09-05 UTC** ([API evidence](https://api.github.com/repos/FullControlXYZ/fullcontrol/commits?per_page=1)).
- [Bread’s README](https://github.com/nick-parker/Bread#readme) specifies two-STL
  input and explains its slope/collision caution. Its latest commit was **2018-07-16
  UTC** ([API evidence](https://api.github.com/repos/nick-parker/Bread/commits?per_page=1)).
- [Bricklayers’ README](https://github.com/TengerTechnologies/Bricklayers#readme)
  documents both its pattern menu and integration limits (including no Bambu support,
  disabled arc fitting, and disabled binary G-code). Its latest commit was
  **2025-06-06 UTC** ([API evidence](https://api.github.com/repos/TengerTechnologies/Bricklayers/commits?per_page=1)).
- [GCodeZAA’s README](https://github.com/Theaninova/GCodeZAA#readme) supplies the
  capability and limitation claims above. Its latest commit was **2026-05-03 UTC**
  ([API evidence](https://api.github.com/repos/Theaninova/GCodeZAA/commits?per_page=1)).
- [CurviSlicer’s README](https://github.com/mfx-inria/curvislicer#readme) specifies
  its G-code, geometry and clearance constraints. Its latest commit was **2025-03-28
  UTC** ([API evidence](https://api.github.com/repos/mfx-inria/curvislicer/commits?per_page=1)).

## Licensing boundary

The proposed product's distribution license is deliberately undecided. No candidate code has been incorporated during research. Before incorporation, identify the applicable license for the exact material and approve the integration route. Copyleft code is a possible choice with corresponding obligations, not categorically prohibited. Independently written algorithms and reviewed permissive components are the current recommendation. The product manager separately requested reuse of slicer profiles; see [profile reuse](profile-reuse.md) for that workstream. AmiSlicer's MIT documentation does not provide its missing runnable application. TOOLPATHS has no demonstrated grant for reuse in this review.

For the user-selected initial machine, the official Prusa documentation lists the
Original Prusa MINI build volume as **180 × 180 × 180 mm** and describes the stock
ecosystem as 1.75 mm filament with a 0.4 mm brass nozzle. Those are starting
constraints only: the actual installed nozzle, firmware version, material and
cooling hardware must be recorded before a machine preset or generated file is
approved. [Prusa MINI volume](https://help.prusa3d.com/article/octoprint-configuration-and-install_2182?product=mini),
[Prusa nozzle reference](https://help.prusa3d.com/glossary/duse_141989).

See [toolpath feasibility](toolpath-feasibility.md) for the resulting MVP boundary
and physical-test gates.
