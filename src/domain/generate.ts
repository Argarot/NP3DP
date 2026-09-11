import type { Band, Diagnostic, GeneratedToolpath, Recipe, Vec3 } from './types';
import {
  MAX_TOOLPATH_EVENTS,
  estimatePatternEvents,
  generatePattern,
  type BandRange,
  type PatternPlacementSettings,
} from './patterns';
import { minimumNominalRadius, shapePoint } from './shapes';
import { calculateStats } from './stats';

export const ENGINE_VERSION = '0.1.0';
const TWO_PI = 2 * Math.PI;

export type GenerationPlacementSettings = PatternPlacementSettings;

function assertFinite(label: string, value: number): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
}

function validateBand(band: Band): void {
  if (typeof band.id !== 'string' || band.id.length === 0) throw new RangeError('Band IDs cannot be empty.');
  if (!['wave', 'triangle', 'arch', 'bridge'].includes(band.kind)) {
    throw new RangeError(`Unknown pattern kind: ${String(band.kind)}.`);
  }
  const numericEntries: ReadonlyArray<readonly [string, number]> = [
    ['weight', band.weight],
    ['amplitudeMm', band.amplitudeMm],
    ['repeatsPerTurn', band.repeatsPerTurn],
    ['phaseAdvanceDeg', band.phaseAdvanceDeg],
    ['radialAmplitudeMm', band.radialAmplitudeMm],
    ['speedVariation', band.speedVariation],
    ['flowVariation', band.flowVariation],
    ['dwellSeconds', band.dwellSeconds],
    ['anchorVolumeMm3', band.anchorVolumeMm3],
  ];
  for (const [label, value] of numericEntries) assertFinite(`Band ${band.id} ${label}`, value);
  if (band.weight <= 0) throw new RangeError(`Band ${band.id} weight must be greater than zero.`);
  if (band.repeatsPerTurn <= 0) {
    throw new RangeError(`Band ${band.id} repeats per turn must be greater than zero.`);
  }
  if (band.repeatsPerTurn + band.phaseAdvanceDeg / 360 <= 0) {
    throw new RangeError(`Band ${band.id} phase advance reverses or stops motif progression.`);
  }
  if (Math.abs(band.speedVariation) >= 1) {
    throw new RangeError(`Band ${band.id} speed variation must have magnitude below one.`);
  }
  if (Math.abs(band.flowVariation) > 1) {
    throw new RangeError(`Band ${band.id} flow variation must have magnitude at most one.`);
  }
  if (band.dwellSeconds < 0 || band.anchorVolumeMm3 < 0) {
    throw new RangeError(`Band ${band.id} dwell and anchor volume cannot be negative.`);
  }
}

function validateRecipe(recipe: Recipe): void {
  if (!recipe || typeof recipe !== 'object') throw new TypeError('Recipe must be an object.');
  if (recipe.schemaVersion !== 1) throw new RangeError('Only recipe schema version 1 is supported.');
  if (typeof recipe.name !== 'string') throw new TypeError('Recipe name must be a string.');
  if (!recipe.shape || !recipe.process || !Array.isArray(recipe.bands)) {
    throw new TypeError('Recipe shape, process and bands are required.');
  }
  if (recipe.bands.length > MAX_TOOLPATH_EVENTS) {
    throw new RangeError(`Toolpath would exceed the ${MAX_TOOLPATH_EVENTS.toLocaleString('en-US')} event limit.`);
  }
  const shapeEntries: ReadonlyArray<readonly [string, number]> = [
    ['heightMm', recipe.shape.heightMm],
    ['baseDiameterMm', recipe.shape.baseDiameterMm],
    ['topDiameterMm', recipe.shape.topDiameterMm],
    ['bellyMm', recipe.shape.bellyMm],
    ['aspectRatio', recipe.shape.aspectRatio],
    ['twistDeg', recipe.shape.twistDeg],
  ];
  for (const [label, value] of shapeEntries) assertFinite(`Shape ${label}`, value);
  if (recipe.shape.heightMm <= 0 || recipe.shape.baseDiameterMm <= 0
    || recipe.shape.topDiameterMm <= 0 || recipe.shape.aspectRatio <= 0) {
    throw new RangeError('Shape height, diameters and aspect ratio must be greater than zero.');
  }
  if (minimumNominalRadius(recipe.shape) <= 0) {
    throw new RangeError('Shape taper and belly must leave a positive radius at every height.');
  }
  if (!['circle', 'ellipse', 'squircle'].includes(recipe.shape.section)) {
    throw new RangeError(`Unknown section kind: ${String(recipe.shape.section)}.`);
  }

  const processEntries: ReadonlyArray<readonly [string, number]> = [
    ['pitchMm', recipe.process.pitchMm],
    ['strandDiameterMm', recipe.process.strandDiameterMm],
    ['filamentDiameterMm', recipe.process.filamentDiameterMm],
    ['speedMmS', recipe.process.speedMmS],
    ['travelMmS', recipe.process.travelMmS],
    ['flowMultiplier', recipe.process.flowMultiplier],
  ];
  for (const [label, value] of processEntries) assertFinite(`Process ${label}`, value);
  if (recipe.process.pitchMm <= 0 || recipe.process.strandDiameterMm <= 0
    || recipe.process.filamentDiameterMm <= 0 || recipe.process.speedMmS <= 0
    || recipe.process.travelMmS <= 0 || recipe.process.flowMultiplier < 0) {
    throw new RangeError('Process dimensions and speeds must be positive; flow multiplier cannot be negative.');
  }
  if (recipe.bands.length === 0) throw new RangeError('At least one band is required.');
  const ids = new Set<string>();
  for (const band of recipe.bands) {
    validateBand(band);
    if (ids.has(band.id)) throw new RangeError(`Duplicate band ID: ${band.id}.`);
    ids.add(band.id);
  }
}

function buildRanges(recipe: Recipe): BandRange[] {
  const totalWeight = recipe.bands.reduce((sum, band) => sum + band.weight, 0);
  const totalTheta = recipe.shape.heightMm / recipe.process.pitchMm * TWO_PI;
  const ranges: BandRange[] = [];
  let startHeightFraction = 0;
  let startPhaseRad = 0;
  for (let index = 0; index < recipe.bands.length; index += 1) {
    const band = recipe.bands[index];
    if (band === undefined) continue;
    const isLast = index === recipe.bands.length - 1;
    const endHeightFraction = isLast
      ? 1
      : startHeightFraction + band.weight / totalWeight;
    ranges.push({
      band,
      startTheta: totalTheta * startHeightFraction,
      endTheta: totalTheta * endHeightFraction,
      startPhaseRad,
      startHeightFraction,
      endHeightFraction,
    });
    const thetaSpan = totalTheta * (endHeightFraction - startHeightFraction);
    startPhaseRad += (band.repeatsPerTurn + band.phaseAdvanceDeg / 360) * thetaSpan;
    startHeightFraction = endHeightFraction;
  }
  return ranges;
}

function validatePlacement(placement: GenerationPlacementSettings | undefined): void {
  if (placement === undefined) return;
  if (!placement || typeof placement !== 'object') {
    throw new TypeError('Generation placement must be an object.');
  }
  assertFinite('Generation Z offset', placement.zOffsetMm);
  assertFinite('Generation start blend height', placement.startBlendHeightMm);
  if (placement.startBlendHeightMm < 0) {
    throw new RangeError('Generation start blend height cannot be negative.');
  }
}

/** Conservative count used by build planning before allocating event arrays. */
export function estimateToolpathEvents(
  recipe: Recipe,
  placement?: GenerationPlacementSettings,
): number {
  validateRecipe(recipe);
  validatePlacement(placement);
  const ranges = buildRanges(recipe);
  let estimatedEvents = 0;
  for (const range of ranges) {
    estimatedEvents += estimatePatternEvents(recipe, range);
    if (!Number.isSafeInteger(estimatedEvents) || estimatedEvents > MAX_TOOLPATH_EVENTS) {
      throw new RangeError(`Toolpath would exceed the ${MAX_TOOLPATH_EVENTS.toLocaleString('en-US')} event limit.`);
    }
  }
  return estimatedEvents;
}

function commonDiagnostics(): Diagnostic[] {
  return [
    {
      severity: 'info',
      code: 'scope.walls-only',
      message: 'This generation contains one wall starting at Z=0.4 mm; no floor or base is generated.',
    },
    {
      severity: 'warning',
      code: 'model.extrusion-uncalibrated',
      message: 'Extrusion uses nominal circular strand area times full 3D segment length and applies flow scaling once. It is an uncalibrated approximation.',
    },
    {
      severity: 'info',
      code: 'estimate.commanded-time',
      message: 'Duration sums commanded feed, stationary deposit and dwell times; it is not a firmware motion simulation.',
    },
    {
      severity: 'info',
      code: 'bands.edge-taper',
      message: 'Band offsets use cubic smoothstep over the first and last motif, capped at half the band, with full amplitude between them. Exact nominal-surface joins and continuous global phase are preserved.',
    },
    {
      severity: 'info',
      code: 'sampling.polyline-heuristic',
      message: 'Smooth-path sampling combines motif and step-density heuristics. Its 0.05 mm circular chord target is not an error bound for modulated or squircle paths.',
    },
  ];
}

export function generateToolpath(
  recipe: Recipe,
  placement?: GenerationPlacementSettings,
): GeneratedToolpath {
  estimateToolpathEvents(recipe, placement);
  const recipeKey = JSON.stringify(recipe);
  const ranges = buildRanges(recipe);

  const events: GeneratedToolpath['events'] = [];
  const initial = shapePoint(recipe.shape, 0, 0);
  let current: Vec3 = placement === undefined
    ? initial
    : { x: initial.x, y: initial.y, z: initial.z + placement.zOffsetMm };
  for (const range of ranges) {
    current = generatePattern({ recipe, range, events, placement }, current);
    if (events.length > MAX_TOOLPATH_EVENTS) {
      throw new RangeError(`Toolpath exceeded the ${MAX_TOOLPATH_EVENTS.toLocaleString('en-US')} event limit.`);
    }
  }

  const stats = calculateStats(events, recipe.process.filamentDiameterMm);
  const diagnostics = commonDiagnostics();
  if (stats.bounds.min.z < 0) {
    diagnostics.push({
      severity: 'warning',
      code: 'bounds.below-reference-plane',
      message: `Commanded path minimum Z is ${stats.bounds.min.z.toFixed(3)} mm, below the Z=0 reference plane.`,
    });
  }

  return {
    engineVersion: ENGINE_VERSION,
    recipeKey,
    events,
    stats,
    diagnostics,
  };
}
