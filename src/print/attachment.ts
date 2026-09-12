/**
 * Restricted nominal attachment analysis for one circular wave band.
 *
 * A "contact" result means only that matched-angle nozzle-centre paths are no
 * farther apart in Z than the requested nominal strand diameter. It does not
 * predict bead shape, welding, sag, nozzle clearance, or print success.
 */
import type { Band, Process, Shape } from '../domain/types';
import type { FoundationSettings } from './types';

export interface CircularWaveRecipeLike {
  shape: Shape;
  process: Pick<Process, 'pitchMm' | 'strandDiameterMm'>;
  bands: Pick<Band, 'kind' | 'amplitudeMm' | 'repeatsPerTurn' | 'phaseAdvanceDeg' | 'radialAmplitudeMm' | 'speedVariation' | 'flowVariation'>[];
}

export type FoundationLike = Pick<FoundationSettings, 'enabled' | 'layers' | 'layerHeightMm' | 'blendHeightMm' | 'rimTurns'>;

export interface SampledGapEstimate {
  minGapMm: number;
  maxGapMm: number;
  contactFractionEstimate: number;
  sampleIntervals: number;
  hasCentrelineCrossing: boolean;
  hasUnsupportedWindows: boolean;
}

export interface TurnAttachmentEstimate extends SampledGapEstimate {
  /** One-based wall revolution. Turn 1 is compared with the transition. */
  turnIndex: number;
  startHeightMm: number;
  endHeightMm: number;
  comparedWith: 'transition' | 'previous-wall-turn';
}

export interface FullBlendClosedForm {
  minGapMm: number;
  maxGapMm: number;
  contactFraction: number;
  hasCentrelineCrossing: boolean;
  hasUnsupportedWindows: boolean;
}

export interface CircularWaveAttachmentReport {
  applicable: true;
  model: 'matched-angle nominal-centreline-gap';
  strandDiameterMm: number;
  effectiveRepeatsPerTurn: number;
  totalWallTurns: number;
  sampledGeometry: {
    samplesPerMotif: number;
    totalSampleIntervals: number;
    turns: TurnAttachmentEstimate[];
    rimJoin?: SampledGapEstimate;
  };
  fullBlendClosedForm: FullBlendClosedForm;
  warnings: string[];
}

export interface InapplicableCircularWaveAttachmentReport {
  applicable: false;
  reasons: string[];
}

export type WaveAttachmentReport =
  | CircularWaveAttachmentReport
  | InapplicableCircularWaveAttachmentReport;

const EPSILON = 1e-9;
const SAMPLES_PER_MOTIF = 128;
const MAX_TURNS = 512;
const MAX_SAMPLE_INTERVALS = 250_000;

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function approximately(value: number, expected: number): boolean {
  return Math.abs(value - expected) <= EPSILON;
}

function smoothstep(u: number): number {
  return u * u * (3 - 2 * u);
}

function startBlend(heightMm: number, blendHeightMm: number): number {
  if (blendHeightMm === 0) return heightMm === 0 ? 0 : 1;
  return smoothstep(Math.min(1, Math.max(0, heightMm / blendHeightMm)));
}

function edgeEnvelope(turn: number, totalTurns: number, repeats: number): number {
  if (turn <= 0 || turn >= totalTurns) return 0;
  const transitionTurns = Math.min(1 / repeats, totalTurns / 2);
  const edgeDistanceTurns = Math.min(turn, totalTurns - turn);
  if (edgeDistanceTurns >= transitionTurns) return 1;
  return smoothstep(edgeDistanceTurns / transitionTurns);
}

function waveOffsetMm(
  turn: number,
  totalTurns: number,
  pitchMm: number,
  amplitudeMm: number,
  repeats: number,
  blendHeightMm: number,
): number {
  return amplitudeMm
    * edgeEnvelope(turn, totalTurns, repeats)
    * startBlend(pitchMm * turn, blendHeightMm)
    * Math.sin(2 * Math.PI * repeats * turn);
}

function addIfInterior(points: Set<number>, value: number, start: number, end: number): void {
  if (Number.isFinite(value) && value > start + EPSILON && value < end - EPSILON) points.add(value);
}

function analysisPoints(
  startTurn: number,
  endTurn: number,
  totalTurns: number,
  repeats: number,
  pitchMm: number,
  blendHeightMm: number,
): number[] {
  const points = new Set<number>([startTurn, endTurn]);
  const step = 1 / (repeats * SAMPLES_PER_MOTIF);
  const firstUniform = Math.floor(startTurn / step) + 1;
  const lastUniform = Math.ceil(endTurn / step) - 1;
  for (let index = firstUniform; index <= lastUniform; index += 1) {
    addIfInterior(points, index * step, startTurn, endTurn);
  }

  // Include exact sine zero/extrema and cubic-envelope boundaries. Products of
  // sine and smoothstep can have extrema between these boundaries, hence the
  // estimates remain explicitly sampled rather than claimed as analytic.
  const quarterCycle = 1 / (4 * repeats);
  const firstQuarter = Math.floor(startTurn / quarterCycle) + 1;
  const lastQuarter = Math.ceil(endTurn / quarterCycle) - 1;
  for (let index = firstQuarter; index <= lastQuarter; index += 1) {
    addIfInterior(points, index * quarterCycle, startTurn, endTurn);
  }
  addIfInterior(points, 1 / repeats, startTurn, endTurn);
  addIfInterior(points, totalTurns - 1 / repeats, startTurn, endTurn);
  if (blendHeightMm > 0) {
    addIfInterior(points, blendHeightMm / pitchMm, startTurn, endTurn);
    addIfInterior(points, 1 + blendHeightMm / pitchMm, startTurn, endTurn);
  }
  return [...points].sort((a, b) => a - b);
}

function contactFractionFromSegments(
  points: number[],
  gapAt: (turn: number) => number,
  strandDiameterMm: number,
): { fraction: number; min: number; max: number } {
  let contactLength = 0;
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let previousTurn = points[0]!;
  let previousDelta = gapAt(previousTurn) - strandDiameterMm;
  minimum = Math.min(minimum, previousDelta + strandDiameterMm);
  maximum = Math.max(maximum, previousDelta + strandDiameterMm);

  for (let index = 1; index < points.length; index += 1) {
    const turn = points[index]!;
    const delta = gapAt(turn) - strandDiameterMm;
    const span = turn - previousTurn;
    minimum = Math.min(minimum, delta + strandDiameterMm);
    maximum = Math.max(maximum, delta + strandDiameterMm);
    if (previousDelta <= 0 && delta <= 0) {
      contactLength += span;
    } else if ((previousDelta <= 0) !== (delta <= 0)) {
      const crossingFraction = Math.abs(previousDelta) / (Math.abs(previousDelta) + Math.abs(delta));
      contactLength += previousDelta <= 0 ? span * crossingFraction : span * (1 - crossingFraction);
    }
    previousTurn = turn;
    previousDelta = delta;
  }

  const total = points.at(-1)! - points[0]!;
  return { fraction: total > 0 ? contactLength / total : 0, min: minimum, max: maximum };
}

function estimateGap(
  points: number[],
  gapAt: (turn: number) => number,
  strandDiameterMm: number,
): SampledGapEstimate {
  const result = contactFractionFromSegments(points, gapAt, strandDiameterMm);
  return {
    minGapMm: result.min,
    maxGapMm: result.max,
    contactFractionEstimate: result.fraction,
    sampleIntervals: points.length - 1,
    hasCentrelineCrossing: result.min <= 0,
    hasUnsupportedWindows: result.max > strandDiameterMm,
  };
}

function fullBlendClosedForm(
  pitchMm: number,
  amplitudeMm: number,
  strandDiameterMm: number,
): FullBlendClosedForm {
  const swing = 2 * Math.abs(amplitudeMm);
  const minGapMm = pitchMm - swing;
  const maxGapMm = pitchMm + swing;
  let contactFraction: number;
  if (swing === 0) {
    contactFraction = pitchMm <= strandDiameterMm ? 1 : 0;
  } else if (strandDiameterMm < minGapMm) {
    contactFraction = 0;
  } else if (strandDiameterMm >= maxGapMm) {
    contactFraction = 1;
  } else {
    const threshold = (strandDiameterMm - pitchMm) / swing;
    contactFraction = 0.5 + Math.asin(threshold) / Math.PI;
  }
  return {
    minGapMm,
    maxGapMm,
    contactFraction,
    hasCentrelineCrossing: minGapMm <= 0,
    hasUnsupportedWindows: maxGapMm > strandDiameterMm,
  };
}

export function inspectCircularWaveAttachment(
  recipe: CircularWaveRecipeLike,
  foundation: FoundationLike,
): WaveAttachmentReport {
  const reasons: string[] = [];
  const band = recipe.bands[0];
  const { shape, process } = recipe;

  if (!foundation.enabled) reasons.push('A prepared foundation and rising transition are required.');
  if (recipe.bands.length !== 1 || band?.kind !== 'wave') reasons.push('Exactly one full-height wave band is required.');
  if (shape.section !== 'circle') reasons.push('Only circular sections are supported.');
  if (!approximately(shape.baseDiameterMm, shape.topDiameterMm)
    || !approximately(shape.bellyMm, 0)
    || !approximately(shape.twistDeg, 0)) {
    reasons.push('The circle must have constant radius, zero belly, and zero twist.');
  }
  if (!isFinitePositive(shape.heightMm) || !isFinitePositive(process.pitchMm)
    || !isFinitePositive(process.strandDiameterMm) || !isFinitePositive(foundation.layerHeightMm)
    || !Number.isFinite(foundation.blendHeightMm) || foundation.blendHeightMm < 0) {
    reasons.push('Height, pitch, strand diameter, layer height, and blend height must be finite and valid.');
  }
  if (band !== undefined) {
    if (![band.amplitudeMm, band.repeatsPerTurn, band.phaseAdvanceDeg, band.radialAmplitudeMm,
      band.speedVariation, band.flowVariation].every(Number.isFinite)) {
      reasons.push('Wave parameters must be finite.');
    }
    if (!approximately(band.radialAmplitudeMm, 0)
      || !approximately(band.speedVariation, 0)
      || !approximately(band.flowVariation, 0)) {
      reasons.push('Radial, speed, and flow variation must all be zero.');
    }
  }
  if (reasons.length > 0 || band === undefined) return { applicable: false, reasons };

  const repeats = band.repeatsPerTurn + band.phaseAdvanceDeg / 360;
  const fractionalRepeats = repeats - Math.floor(repeats);
  if (!(repeats > 0) || !approximately(fractionalRepeats, 0.5)) {
    reasons.push('Effective repeats per turn must be a positive half-integer (N + 0.5).');
  }
  const totalTurns = shape.heightMm / process.pitchMm;
  if (!Number.isFinite(totalTurns) || totalTurns < 1) {
    reasons.push('The wall must contain at least one revolution.');
  } else if (Math.ceil(totalTurns) > MAX_TURNS) {
    reasons.push(`Analysis is capped at ${MAX_TURNS} wall revolutions.`);
  }
  const estimatedIntervals = Math.ceil(totalTurns * repeats * SAMPLES_PER_MOTIF);
  if (!Number.isSafeInteger(estimatedIntervals) || estimatedIntervals > MAX_SAMPLE_INTERVALS) {
    reasons.push(`Sampled analysis is capped at ${MAX_SAMPLE_INTERVALS.toLocaleString('en-US')} intervals.`);
  }
  if (reasons.length > 0) return { applicable: false, reasons };

  const turns: TurnAttachmentEstimate[] = [];
  let totalSampleIntervals = 0;
  for (let turnIndex = 1; turnIndex <= Math.ceil(totalTurns); turnIndex += 1) {
    const startTurn = turnIndex - 1;
    const endTurn = Math.min(turnIndex, totalTurns);
    const points = analysisPoints(startTurn, endTurn, totalTurns, repeats,
      process.pitchMm, foundation.blendHeightMm);
    const gapAt = turnIndex === 1
      ? (turn: number): number => foundation.layerHeightMm
        + (process.pitchMm - foundation.layerHeightMm) * turn
        + waveOffsetMm(turn, totalTurns, process.pitchMm, band.amplitudeMm,
          repeats, foundation.blendHeightMm)
      : (turn: number): number => process.pitchMm
        + waveOffsetMm(turn, totalTurns, process.pitchMm, band.amplitudeMm,
          repeats, foundation.blendHeightMm)
        - waveOffsetMm(turn - 1, totalTurns, process.pitchMm, band.amplitudeMm,
          repeats, foundation.blendHeightMm);
    const estimate = estimateGap(points, gapAt, process.strandDiameterMm);
    totalSampleIntervals += estimate.sampleIntervals;
    if (totalSampleIntervals > MAX_SAMPLE_INTERVALS) return { applicable: false, reasons: ['Sampled analysis reached its interval budget.'] };
    turns.push({
      turnIndex,
      startHeightMm: process.pitchMm * startTurn,
      endHeightMm: process.pitchMm * endTurn,
      comparedWith: turnIndex === 1 ? 'transition' : 'previous-wall-turn',
      ...estimate,
    });
  }

  let rimJoin: SampledGapEstimate | undefined;
  if (foundation.rimTurns > 0) {
    const points = analysisPoints(totalTurns, totalTurns + 1, totalTurns + 1,
      repeats, process.pitchMm, foundation.blendHeightMm);
    rimJoin = estimateGap(points, (rimTurn: number): number => {
      const u = rimTurn - totalTurns;
      const previousWallTurn = totalTurns + u - 1;
      return process.pitchMm + (foundation.layerHeightMm - process.pitchMm) * u
        - waveOffsetMm(previousWallTurn, totalTurns, process.pitchMm, band.amplitudeMm,
          repeats, foundation.blendHeightMm);
    }, process.strandDiameterMm);
    totalSampleIntervals += rimJoin.sampleIntervals;
    if (totalSampleIntervals > MAX_SAMPLE_INTERVALS) return { applicable: false, reasons: ['Sampled analysis reached its interval budget.'] };
  }

  const closedForm = fullBlendClosedForm(process.pitchMm, band.amplitudeMm,
    process.strandDiameterMm);
  const warnings: string[] = [
    'Contact means only matched-angle nominal centreline gap <= nominal strand diameter; it is not a prediction of bonding, sag, bead shape, or nozzle clearance.',
  ];
  if (turns[0]?.hasUnsupportedWindows) {
    warnings.push('The first wall revolution contains matched-angle gaps larger than the requested strand diameter above the rising transition.');
  }
  const zeroContactTurns = turns.filter((turn) => turn.contactFractionEstimate <= EPSILON)
    .map((turn) => turn.turnIndex);
  if (zeroContactTurns.length > 0) {
    warnings.push(`No nominal matched-angle contact was sampled in wall turn(s): ${zeroContactTurns.join(', ')}.`);
  }
  if (closedForm.hasCentrelineCrossing) {
    warnings.push('The full-blend wave reaches or crosses the preceding turn centreline; nozzle interaction is unmodelled.');
  }
  if (closedForm.hasUnsupportedWindows) {
    warnings.push('The full-blend wave contains nominal gaps larger than the strand diameter.');
  }
  if (rimJoin?.hasUnsupportedWindows) {
    warnings.push('The first rim revolution contains matched-angle gaps larger than the requested strand diameter above the final wall revolution.');
  }

  return {
    applicable: true,
    model: 'matched-angle nominal-centreline-gap',
    strandDiameterMm: process.strandDiameterMm,
    effectiveRepeatsPerTurn: repeats,
    totalWallTurns: totalTurns,
    sampledGeometry: {
      samplesPerMotif: SAMPLES_PER_MOTIF,
      totalSampleIntervals,
      turns,
      ...(rimJoin === undefined ? {} : { rimJoin }),
    },
    fullBlendClosedForm: closedForm,
    warnings,
  };
}
