import type { Band, ExtrudeEvent, Recipe, ToolpathEvent, Vec3 } from './types';
import { distance } from './math';
import { maximumNominalRadius, shapePointWithRadialOffset } from './shapes';

export const MAX_TOOLPATH_EVENTS = 100_000;
const SAMPLES_PER_MOTIF = 16;
const MAX_SMOOTH_STEP_MM = 0.6;
const MOTION_CONTINUITY_TOLERANCE_MM = 1e-9;
// This controls density for a circular reference contour. It is a heuristic,
// not a geometric error bound for modulated paths or squircle parameterization.
const CIRCULAR_CHORD_DENSITY_MM = 0.05;
const TWO_PI = 2 * Math.PI;

export interface BandRange {
  band: Band;
  startTheta: number;
  endTheta: number;
  startPhaseRad: number;
  startHeightFraction: number;
  endHeightFraction: number;
}

export interface PatternContext {
  recipe: Recipe;
  range: BandRange;
  events: ToolpathEvent[];
  placement?: PatternPlacementSettings;
}

/** Optional build placement leaves schema-1 recipe coordinates unchanged. */
export interface PatternPlacementSettings {
  zOffsetMm: number;
  /** Smoothly introduces recipe Z/radial offsets over nominal wall height. */
  startBlendHeightMm: number;
}

function effectiveRepeats(band: Band): number {
  return band.repeatsPerTurn + band.phaseAdvanceDeg / 360;
}

function rangePhaseAt(range: BandRange, theta: number): number {
  return range.startPhaseRad + effectiveRepeats(range.band) * (theta - range.startTheta);
}

function fractionAt(range: BandRange, theta: number): number {
  const span = range.endTheta - range.startTheta;
  if (span === 0) return range.endHeightFraction;
  const local = (theta - range.startTheta) / span;
  return range.startHeightFraction
    + (range.endHeightFraction - range.startHeightFraction) * local;
}

/**
 * Let w=min(2pi/effectiveRepeats, bandSpan/2), u=edgeDistance/w, and
 * s(u)=u^2(3-2u). The first and last w use s; the interior uses one.
 * Offsets are exactly zero with zero slope at an edge and exactly one after a
 * full motif; longer bands therefore retain a full-amplitude interior plateau.
 */
function edgeEnvelope(range: BandRange, theta: number): number {
  const span = range.endTheta - range.startTheta;
  if (span === 0) return 0;
  if (theta <= range.startTheta || theta >= range.endTheta) return 0;
  const motifSpan = TWO_PI / effectiveRepeats(range.band);
  const transitionSpan = Math.min(motifSpan, span / 2);
  const edgeDistance = Math.min(theta - range.startTheta, range.endTheta - theta);
  if (edgeDistance >= transitionSpan) return 1;
  const u = edgeDistance / transitionSpan;
  return u * u * (3 - 2 * u);
}

function localFactor(variation: number, phase: number): number {
  return 1 + variation * Math.sin(phase + Math.PI / 4);
}

function point(
  context: PatternContext,
  theta: number,
  radialOffsetMm: number,
  zOffsetMm: number,
): Vec3 {
  const heightFraction = fractionAt(context.range, theta);
  const nominalHeightMm = context.recipe.shape.heightMm * heightFraction;
  let startBlend = 1;
  if (context.placement !== undefined) {
    if (context.placement.startBlendHeightMm === 0) {
      startBlend = nominalHeightMm === 0 ? 0 : 1;
    } else {
      const u = Math.min(1, nominalHeightMm / context.placement.startBlendHeightMm);
      startBlend = u * u * (3 - 2 * u);
    }
  }
  const nominal = shapePointWithRadialOffset(
    context.recipe.shape,
    theta,
    heightFraction,
    radialOffsetMm * startBlend,
  );
  return {
    x: nominal.x,
    y: nominal.y,
    z: nominal.z + (context.placement?.zOffsetMm ?? 0) + zOffsetMm * startBlend,
  };
}

function segmentSettings(context: PatternContext, theta: number): { speedMmS: number; flow: number } {
  const phase = rangePhaseAt(context.range, theta);
  return {
    speedMmS: context.recipe.process.speedMmS
      * localFactor(context.range.band.speedVariation, phase),
    flow: localFactor(context.range.band.flowVariation, phase),
  };
}

function extrusionVolume(context: PatternContext, from: Vec3, to: Vec3, flow: number): number {
  const strandRadius = context.recipe.process.strandDiameterMm / 2;
  const nominalArea = Math.PI * strandRadius * strandRadius;
  return nominalArea * distance(from, to) * context.recipe.process.flowMultiplier * flow;
}

function pushExtrude(
  context: PatternContext,
  from: Vec3,
  to: Vec3,
  theta: number,
  role: ExtrudeEvent['role'],
): Vec3 {
  if (distance(from, to) <= MOTION_CONTINUITY_TOLERANCE_MM) return from;
  const settings = segmentSettings(context, theta);
  context.events.push({
    kind: 'extrude',
    bandId: context.range.band.id,
    from,
    to,
    volumeMm3: extrusionVolume(context, from, to, settings.flow),
    speedMmS: settings.speedMmS,
    role,
  });
  return to;
}

function smoothSampleCount(context: PatternContext): number {
  const { recipe, range } = context;
  const thetaSpan = range.endTheta - range.startTheta;
  const phaseSpan = Math.abs(rangePhaseAt(range, range.endTheta) - rangePhaseAt(range, range.startTheta));
  const twistSpan = Math.abs(recipe.shape.twistDeg) * Math.PI / 180
    * (range.endHeightFraction - range.startHeightFraction);
  const maximumRadius = (maximumNominalRadius(recipe.shape) + Math.abs(range.band.radialAmplitudeMm))
    * Math.max(1, 1 / recipe.shape.aspectRatio);
  const angularTravel = maximumRadius * (Math.abs(thetaSpan) + twistSpan);
  const verticalTravel = recipe.shape.heightMm
    * (range.endHeightFraction - range.startHeightFraction);
  const motifCount = phaseSpan / TWO_PI;
  const modulationTravel = 4 * motifCount
    * (Math.abs(range.band.amplitudeMm) + Math.abs(range.band.radialAmplitudeMm));
  const byStepLength = Math.ceil((angularTravel + verticalTravel + modulationTravel) / MAX_SMOOTH_STEP_MM);
  const byMotif = Math.ceil(motifCount * SAMPLES_PER_MOTIF);
  const safeRadius = Math.max(maximumRadius, Number.EPSILON);
  const maxChordAngle = 2 * Math.acos(Math.max(-1, 1 - CIRCULAR_CHORD_DENSITY_MM / safeRadius));
  const byChordError = Number.isFinite(maxChordAngle) && maxChordAngle > 0
    ? Math.ceil((Math.abs(thetaSpan) + twistSpan) / maxChordAngle)
    : 1;
  return Math.max(1, byStepLength, byMotif, byChordError);
}

function interiorPhaseIndices(range: BandRange, halfCycles: boolean) {
  const phaseStep = halfCycles ? Math.PI : TWO_PI;
  const startPhase = rangePhaseAt(range, range.startTheta);
  const endPhase = rangePhaseAt(range, range.endTheta);
  // Accumulated phase can land a few ulps either side of an exact motif
  // boundary. Such a boundary must not create a zero-motion deposit/hold.
  // Preflight and emission use the same scale-aware numerical tolerance.
  const tolerance = 8 * Number.EPSILON * Math.max(1, Math.abs(startPhase), Math.abs(endPhase));
  return { phaseStep,
    first: Math.floor((startPhase + tolerance) / phaseStep) + 1,
    end: Math.ceil((endPhase - tolerance) / phaseStep),
  };
}

function phaseIntervalCount(range: BandRange, halfCycles: boolean): number {
  const { first, end } = interiorPhaseIndices(range, halfCycles);
  return Math.max(0, end - first) + 1;
}

function phaseBreaks(range: BandRange, halfCycles: boolean): number[] {
  const slope = effectiveRepeats(range.band);
  const { phaseStep, first, end } = interiorPhaseIndices(range, halfCycles);
  const values = [range.startTheta];
  for (let index = first; index < end; index += 1) {
    const theta = range.startTheta
      + (index * phaseStep - range.startPhaseRad) / slope;
    if (theta > range.startTheta && theta < range.endTheta) values.push(theta);
  }
  values.push(range.endTheta);
  return values;
}

function triangleHeight(phase: number): number {
  const cycle = ((phase % TWO_PI) + TWO_PI) % TWO_PI;
  return 1 - Math.abs(cycle - Math.PI) / Math.PI;
}

export function estimatePatternEvents(recipe: Recipe, range: BandRange): number {
  const dummyContext: PatternContext = { recipe, range, events: [] };
  switch (range.band.kind) {
    case 'wave':
      return smoothSampleCount(dummyContext);
    case 'triangle':
      return phaseIntervalCount(range, true);
    case 'arch': {
      const intervals = phaseIntervalCount(range, false);
      const motifCount = Math.abs(rangePhaseAt(range, range.endTheta)
        - rangePhaseAt(range, range.startTheta)) / TWO_PI;
      // Upper bound for per-span rounding and forced midpoint samples, calculated
      // without allocating a phase-break array for an oversized recipe.
      return smoothSampleCount(dummyContext) + Math.ceil(motifCount * SAMPLES_PER_MOTIF)
        + 5 * intervals;
    }
    case 'bridge':
      return 1 + 6 * phaseIntervalCount(range, false);
  }
}

export function generatePattern(context: PatternContext, initialPoint: Vec3): Vec3 {
  switch (context.range.band.kind) {
    case 'wave':
      return generateWave(context, initialPoint);
    case 'triangle':
      return generateTriangles(context, initialPoint);
    case 'arch':
      return generateArches(context, initialPoint);
    case 'bridge':
      return generateBridges(context, initialPoint);
  }
}

function generateWave(context: PatternContext, initialPoint: Vec3): Vec3 {
  const count = smoothSampleCount(context);
  let previous = initialPoint;
  for (let index = 1; index <= count; index += 1) {
    const local = index / count;
    const theta = context.range.startTheta
      + (context.range.endTheta - context.range.startTheta) * local;
    const phase = rangePhaseAt(context.range, theta);
    const envelope = edgeEnvelope(context.range, theta);
    const wave = Math.sin(phase);
    const next = point(
      context,
      theta,
      context.range.band.radialAmplitudeMm * envelope * wave,
      context.range.band.amplitudeMm * envelope * wave,
    );
    previous = pushExtrude(context, previous, next, theta, 'wall');
  }
  return previous;
}

function generateTriangles(context: PatternContext, initialPoint: Vec3): Vec3 {
  const breaks = phaseBreaks(context.range, true);
  let previous = initialPoint;
  for (let index = 1; index < breaks.length; index += 1) {
    const theta = breaks[index];
    if (theta === undefined) continue;
    const phase = rangePhaseAt(context.range, theta);
    const magnitude = triangleHeight(phase) * edgeEnvelope(context.range, theta);
    const next = point(
      context,
      theta,
      context.range.band.radialAmplitudeMm * magnitude,
      context.range.band.amplitudeMm * magnitude,
    );
    previous = pushExtrude(context, previous, next, theta, 'span');
  }
  return previous;
}

function quadraticBezier(a: Vec3, control: Vec3, b: Vec3, t: number): Vec3 {
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * a.x + 2 * oneMinusT * t * control.x + t * t * b.x,
    y: oneMinusT * oneMinusT * a.y + 2 * oneMinusT * t * control.y + t * t * b.y,
    z: oneMinusT * oneMinusT * a.z + 2 * oneMinusT * t * control.z + t * t * b.z,
  };
}

function generateArches(context: PatternContext, initialPoint: Vec3): Vec3 {
  const breaks = phaseBreaks(context.range, false);
  const globalSmoothSamples = smoothSampleCount(context);
  const totalThetaSpan = context.range.endTheta - context.range.startTheta;
  let previous = initialPoint;
  for (let spanIndex = 1; spanIndex < breaks.length; spanIndex += 1) {
    const startTheta = breaks[spanIndex - 1];
    const endTheta = breaks[spanIndex];
    if (startTheta === undefined || endTheta === undefined) continue;
    const a = previous;
    const b = point(context, endTheta, 0, 0);
    const middleTheta = (startTheta + endTheta) / 2;
    const envelope = edgeEnvelope(context.range, middleTheta);
    const apex = point(
      context,
      middleTheta,
      context.range.band.radialAmplitudeMm * envelope,
      context.range.band.amplitudeMm * envelope,
    );
    // This control construction makes t=0.5 equal the requested apex exactly.
    const control = {
      x: 2 * apex.x - (a.x + b.x) / 2,
      y: 2 * apex.y - (a.y + b.y) / 2,
      z: 2 * apex.z - (a.z + b.z) / 2,
    };
    const phaseFraction = Math.abs(rangePhaseAt(context.range, endTheta)
      - rangePhaseAt(context.range, startTheta)) / TWO_PI;
    const thetaFraction = (endTheta - startTheta) / totalThetaSpan;
    const rawSamples = Math.max(
      2,
      Math.ceil(phaseFraction * SAMPLES_PER_MOTIF),
      Math.ceil(globalSmoothSamples * thetaFraction),
    );
    // An even count guarantees an emitted point at the requested Bezier midpoint.
    const samples = rawSamples % 2 === 0 ? rawSamples : rawSamples + 1;
    for (let sample = 1; sample <= samples; sample += 1) {
      const t = sample / samples;
      const next = quadraticBezier(a, control, b, t);
      const theta = startTheta + (endTheta - startTheta) * t;
      previous = pushExtrude(context, previous, next, theta, 'span');
    }
  }
  return previous;
}

function generateBridges(context: PatternContext, initialPoint: Vec3): Vec3 {
  const breaks = phaseBreaks(context.range, false);
  let previous = initialPoint;
  context.events.push({ kind: 'anchor', bandId: context.range.band.id, at: previous });

  for (let spanIndex = 1; spanIndex < breaks.length; spanIndex += 1) {
    const startTheta = breaks[spanIndex - 1];
    const endTheta = breaks[spanIndex];
    if (startTheta === undefined || endTheta === undefined) continue;
    const middleTheta = (startTheta + endTheta) / 2;
    const settings = segmentSettings(context, middleTheta);
    const nominalArea = Math.PI * (context.recipe.process.strandDiameterMm / 2) ** 2;
    const depositVolume = context.range.band.anchorVolumeMm3
      * context.recipe.process.flowMultiplier * settings.flow;
    const depositRate = nominalArea * settings.speedMmS
      * context.recipe.process.flowMultiplier * settings.flow;
    context.events.push({
      kind: 'deposit',
      bandId: context.range.band.id,
      at: previous,
      volumeMm3: depositVolume,
      volumeRateMm3S: depositRate,
    });
    context.events.push({
      kind: 'dwell',
      bandId: context.range.band.id,
      at: previous,
      seconds: context.range.band.dwellSeconds,
    });

    const envelope = edgeEnvelope(context.range, middleTheta);
    const radialOffset = context.range.band.radialAmplitudeMm * envelope;
    const lift = context.range.band.amplitudeMm * envelope;
    const raisedStart = point(context, startTheta, radialOffset, lift);
    const raisedEnd = point(context, endTheta, radialOffset, lift);
    const anchorEnd = point(context, endTheta, 0, 0);
    previous = pushExtrude(context, previous, raisedStart, middleTheta, 'rise');
    previous = pushExtrude(context, previous, raisedEnd, middleTheta, 'span');
    previous = pushExtrude(context, previous, anchorEnd, endTheta, 'fall');
    context.events.push({ kind: 'anchor', bandId: context.range.band.id, at: previous });
  }
  return previous;
}
