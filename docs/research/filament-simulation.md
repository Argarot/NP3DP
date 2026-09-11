# Filament simulation strategy

## Decision for the PRD

Physical preview is a required prediction capability with progressively measured fidelity. A candidate interactive model evolves an ordered strand centerline and renders its deposited cross-section, with calibrated uncertainty where available and explicit unknowns elsewhere. Preserve a route to a higher-fidelity solver for selected regions or experiments. Scope includes unsupported arches, bridges, deliberate sag, free-space loops, pause-and-move sequences, cooling, changing flow, and future printer/material profiles. The alpha starts with waves, triangles, arches and an initial timed bridge; deeper loops follow in M6. Solver selection and accuracy budgets remain open.

## What established work supports

A catenary describes static equilibrium of an ideal uniform, perfectly flexible suspended line under gravity. It is a candidate low-cost bridge baseline when endpoints and effective length or tension are known; no NP3DP runtime has been measured. It does not predict how tension arose, moving endpoints, changing diameter, bending resistance, cooling, adhesion or coiling. Treating every unsupported segment as a catenary would omit the dynamics the studio aims to explore. This is a limitation of the assumed static model, not a claim that catenaries cannot be useful in a larger solver.

Reduced slender-thread methods are a candidate foundation. Audoly et al. use a reduced centerline/spin model with inertia, stretch, bend, twist, surface tension and large rotations, validated against steady-coiling references. This supports modeling dynamic threads without resolving the entire fluid volume; it does not establish PLA parameters, solidification, adhesion or browser performance for NP3DP. [Audoly et al., 2013](https://doi.org/10.1016/j.jcp.2013.06.034)

Fully resolved FFF research combines moving free surfaces, heat transfer, temperature-dependent viscosity and viscoelastic stress, with numerical reference/convergence checks. [Xia, Lu and Tryggvason, 2019](https://doi.org/10.1016/j.cma.2018.11.031) A free-surface finite-element study also compares predicted deposited strand dimensions with experiment. [González et al., 2023 issue; first published 2022](https://doi.org/10.1002/fld.5151) These are candidates for local deposition/contact reference models; neither establishes whole-object browser performance.

De Vries et al. report nonlinear melt-pressure behavior associated with rheology/backflow and model steady measurements. [de Vries et al., 2024](https://doi.org/10.1016/j.addma.2024.103966) Our inference is that start/stop predictions should evaluate calibrated pressure/flow history rather than equating commanded E with instantaneous emitted volume. The transient model still needs its own printer/material-specific evidence; steady measurements alone do not validate it.

## Proposed two-tier preview

**Interactive approximation (hypothesis to test).** Evaluate calibrated simple span/deposition baselines, followed by a reduced dynamic solver in a browser worker. Candidate strand nodes carry mass, volume, temperature and mechanical response; modeled forces include gravity, stretch/bend resistance, and contact with the bed or earlier material. Evaluate a calibrated pressure/flow lag and adhesion/solidification rules. Adaptive time steps, local refinement and spatial acceleration are performance candidates requiring benchmarks. A closed-form sag estimate may seed a first frame while dynamic predictions refine progressively. Show nominal path, predicted strand, contacts and uncertainty separately; do not label an unvalidated seed as an accurate solve.

These are engineering hypotheses, not established accuracy/runtime claims. A Rust/C++ kernel compiled to WebAssembly is a candidate if benchmarks justify it. Elastica documents rod dynamics, gravity and self-contact, with a recommended Python implementation and an older C++ implementation. It is a useful formulation reference; neither implementation is evidence of a browser-ready FFF solver. [Elastica documentation](https://www.cosseratrods.org/software/elastica/)

**Higher-fidelity route.** Retain the same time-stamped deposition input and material/profile schema so short spans, loop events, contacts, and calibration coupons can be replayed through (1) a denser thermo-viscoelastic slender-thread solve, then (2) a local free-surface finite-volume/finite-element solve when bead cross-section, wetting/contact, and heat flow matter. First prototype the denser kernel in a worker/WASM benchmark. Choose a local or backend solver only if measured browser memory, runtime, or numerical robustness misses the approved budget. Unknown today: stable time step, element count per deposited millimeter, self-contact scaling, WASM speed, and duration of a full-object solve.

## Calibration, validation, and reported accuracy

No NP3DP filament-physics measurements exist yet; all parameters and accuracy thresholds are therefore unvalidated. The following is the proposed measurement scope.

Fit only on dedicated MINI+ / 0.4 mm / white and black eSUN PLA coupons. Record actual material SKU, diameter, nozzle and ambient temperatures, fan state, speed, flow, dwell, span, nozzle height, and video timebase. Estimate pressure-lag, cooling/solidification, axial and bending response, adhesion/contact, and effective emitted diameter from straight supported beads, stop/start lines, single bridges, falling strands, and short loop deposits.

Keep validation prints held out by geometry and condition: unseen bridge spans/speeds, arch/triangle corners, pause-move bridges, and loop heights/flow ratios. Report median, 90th-percentile, and worst-case error for centerline shape (3D or calibrated multi-view distance), maximum sag and its location, final span and endpoint slip, strand diameter/area, loop wavelength/amplitude, and first-contact time/location. Report failures to attach, break, or collide as events, not averaged geometry. Repeat cases to estimate print variability; propagate fitted-parameter intervals into an uncertainty band and label extrapolation outside calibrated ranges. Maintain separate parameter-fit, numerical-convergence, and physical-validation results. Accuracy means meeting approved thresholds on held-out prints, not visual resemblance.

## Primary sources

Accessed 2026-09-11.

- Audoly et al., [*A discrete geometric approach for simulating the dynamics of thin viscous threads*](https://doi.org/10.1016/j.jcp.2013.06.034), Journal of Computational Physics, 2013.
- Xia, Lu and Tryggvason, [*A numerical study of the effect of viscoelastic stresses in fused filament fabrication*](https://doi.org/10.1016/j.cma.2018.11.031), CMAME, 2019.
- González et al., [*A deforming-mesh finite-element approach applied to the large-translation and free-surface scenario of fused deposition modeling*](https://doi.org/10.1002/fld.5151), 2023 issue, first published 2022.
- de Vries et al., [*Pressure drop non-linearities in material extrusion additive manufacturing*](https://doi.org/10.1016/j.addma.2024.103966), Additive Manufacturing, 2024.
- [Elastica official engine and methods overview](https://www.cosseratrods.org/software/elastica/).
