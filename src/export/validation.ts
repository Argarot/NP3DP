import type {
  Bounds,
  GeneratedToolpath,
  Recipe,
  ToolpathEvent,
  Vec3,
} from '../domain/types.ts';

export const DRAFT_BED_CENTER_OFFSET_MM = Object.freeze({ x: 90, y: 90 });
export const XYZ_DECIMAL_PLACES = 3;
export const EXTRUSION_DECIMAL_PLACES = 5;
export const FEED_DECIMAL_PLACES = 3;

const MAX_EVENTS = 1_000_000;
const MAX_BANDS = 1_024;
const CONTINUITY_TOLERANCE_MM = 1e-6;
const STAT_TOLERANCE = 1e-6;

export interface DraftExpectations {
  extrusionMm: number;
  quantizedExtrusionMm: number;
  extrusionRoundingBoundMm: number;
  dwellSeconds: number;
  quantizedDwellSeconds: number;
  dwellRoundingBoundSeconds: number;
  moveCount: number;
  extrusionCommandCount: number;
  dwellCommandCount: number;
  coordinateMoveCount: number;
  commandedTimeSeconds: number;
  quantizedCommandedTimeSeconds: number;
  commandedTimeRoundingBoundSeconds: number;
  timedCommandCount: number;
  sourceMachineBounds: Bounds;
  machineBounds: Bounds;
}

export interface ValidatedDraftInput {
  filamentAreaMm2: number;
  expectations: DraftExpectations;
}

/**
 * Current generator/export freshness contract. This is reproducibility metadata,
 * not a cryptographic digest or a security boundary. parseRecipe constructs the
 * known fields in stable order, so the generator stores JSON.stringify(recipe).
 */
export function recipeKeyForDraft(recipe: Recipe): string {
  validateRecipe(recipe);
  return JSON.stringify(recipe);
}

export function quantizeDraftNumber(value: number, decimalPlaces: number): number {
  if (!Number.isFinite(value)) throw new Error('Cannot quantize a non-finite number.');
  const rounded = Number(value.toFixed(decimalPlaces));
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatDraftNumber(value: number, decimalPlaces: number): string {
  return quantizeDraftNumber(value, decimalPlaces).toFixed(decimalPlaces);
}

/** Floating-point accumulation allowance for independently parsed positive totals. */
export function auditNumericTolerance(total: number, commandCount: number): number {
  return 32 * Number.EPSILON * Math.max(1, Math.abs(total)) * Math.max(1, commandCount);
}

export function validateDraftInput(
  recipe: Recipe,
  path: GeneratedToolpath,
): ValidatedDraftInput {
  validateRecipe(recipe);
  assertPlainObject(path, 'toolpath');
  assertExactKeys(
    path,
    ['engineVersion', 'recipeKey', 'events', 'stats', 'diagnostics'],
    'toolpath',
  );
  assertBoundedString(path.engineVersion, 'toolpath.engineVersion', 256);
  assertBoundedString(path.recipeKey, 'toolpath.recipeKey', 1_000_000);

  const expectedKey = JSON.stringify(recipe);
  if (path.recipeKey !== expectedKey) {
    throw new Error('Toolpath recipeKey does not match the supplied recipe. Regenerate the toolpath before export.');
  }

  if (!Array.isArray(path.events) || path.events.length === 0) {
    throw new Error('Toolpath events must be a non-empty array.');
  }
  if (path.events.length > MAX_EVENTS) {
    throw new Error(`Toolpath exceeds the draft export limit of ${MAX_EVENTS} events.`);
  }

  const filamentAreaMm2 = Math.PI * (recipe.process.filamentDiameterMm / 2) ** 2;
  let current: Vec3 | undefined;
  let pathLengthMm = 0;
  let extrusionVolumeMm3 = 0;
  let commandedDurationS = 0;
  let extrudeMoves = 0;
  let travelMoves = 0;
  let dwellCount = 0;
  let positiveDepositMoves = 0;
  let quantizedExtrusionMm = 0;
  let extrusionRoundingBoundMm = 0;
  let quantizedDwellSeconds = 0;
  let dwellRoundingBoundSeconds = 0;
  let quantizedCommandedTimeSeconds = 0;
  let commandedTimeRoundingBoundSeconds = 0;
  let timedCommandCount = 0;
  const points: Vec3[] = [];
  const quantizedMachinePoints: Vec3[] = [];
  const bandIds = new Set(recipe.bands.map((band) => band.id));
  let quantizedCurrent: Vec3 | undefined;

  const initialFeed = quantizeDraftNumber(recipe.process.travelMmS * 60, FEED_DECIMAL_PLACES);
  if (initialFeed <= 0) {
    throw new Error(`Initial approach feed is not representable at ${FEED_DECIMAL_PLACES} decimal places.`);
  }

  path.events.forEach((event, index) => {
    validateEvent(event, index);
    if (!bandIds.has(event.bandId)) {
      throw new Error(`toolpath.events[${index}].bandId does not identify a recipe band.`);
    }
    const start = event.kind === 'extrude' || event.kind === 'travel' ? event.from : event.at;

    if (current && !samePoint(current, start)) {
      throw new Error(`Toolpath is discontinuous before event ${index}.`);
    }
    const quantizedStart = quantizeMachinePoint(start);
    if (quantizedCurrent && !samePointExactly(quantizedCurrent, quantizedStart)) {
      throw new Error(`Toolpath continuity before event ${index} is not representable at ${XYZ_DECIMAL_PLACES}-decimal XYZ precision.`);
    }
    if (!current) {
      points.push(start);
      quantizedMachinePoints.push(quantizedStart);
      quantizedCurrent = quantizedStart;
    }

    switch (event.kind) {
      case 'extrude': {
        const length = distance(event.from, event.to);
        if (length === 0) {
          throw new Error(`toolpath.events[${index}] must use a deposit event for stationary extrusion.`);
        }
        const quantizedTo = quantizeMachinePoint(event.to);
        const quantizedLength = distance(quantizedCurrent!, quantizedTo);
        if (quantizedLength === 0) {
          throw new Error(`toolpath.events[${index}] has positive path length ${length} mm but collapses to zero at ${XYZ_DECIMAL_PLACES}-decimal XYZ precision.`);
        }
        const quantizedFeedMmMin = representablePositiveFeed(event.speedMmS * 60, index);
        const extrusionMm = event.volumeMm3 / filamentAreaMm2;
        const quantizedE = representableExtrusion(extrusionMm, index);
        const rawDuration = length / event.speedMmS;
        const quantizedDuration = quantizedLength / (quantizedFeedMmMin / 60);
        pathLengthMm += length;
        extrusionVolumeMm3 += event.volumeMm3;
        commandedDurationS += rawDuration;
        quantizedExtrusionMm += quantizedE;
        extrusionRoundingBoundMm += Math.abs(quantizedE - extrusionMm);
        quantizedCommandedTimeSeconds += quantizedDuration;
        commandedTimeRoundingBoundSeconds += Math.abs(quantizedDuration - rawDuration);
        timedCommandCount += 1;
        extrudeMoves += 1;
        current = event.to;
        quantizedCurrent = quantizedTo;
        points.push(event.to);
        quantizedMachinePoints.push(quantizedTo);
        break;
      }
      case 'travel': {
        const length = distance(event.from, event.to);
        if (length === 0) {
          throw new Error(`toolpath.events[${index}] is a zero-length travel.`);
        }
        const quantizedTo = quantizeMachinePoint(event.to);
        const quantizedLength = distance(quantizedCurrent!, quantizedTo);
        if (quantizedLength === 0) {
          throw new Error(`toolpath.events[${index}] has positive path length ${length} mm but collapses to zero at ${XYZ_DECIMAL_PLACES}-decimal XYZ precision.`);
        }
        const quantizedFeedMmMin = representablePositiveFeed(event.speedMmS * 60, index);
        const rawDuration = length / event.speedMmS;
        const quantizedDuration = quantizedLength / (quantizedFeedMmMin / 60);
        pathLengthMm += length;
        commandedDurationS += rawDuration;
        quantizedCommandedTimeSeconds += quantizedDuration;
        commandedTimeRoundingBoundSeconds += Math.abs(quantizedDuration - rawDuration);
        timedCommandCount += 1;
        travelMoves += 1;
        current = event.to;
        quantizedCurrent = quantizedTo;
        points.push(event.to);
        quantizedMachinePoints.push(quantizedTo);
        break;
      }
      case 'dwell': {
        const quantizedDuration = quantizedDwell(event.seconds, index);
        commandedDurationS += event.seconds;
        quantizedDwellSeconds += quantizedDuration;
        dwellRoundingBoundSeconds += Math.abs(quantizedDuration - event.seconds);
        quantizedCommandedTimeSeconds += quantizedDuration;
        commandedTimeRoundingBoundSeconds += Math.abs(quantizedDuration - event.seconds);
        timedCommandCount += 1;
        dwellCount += 1;
        current = event.at;
        quantizedCurrent = quantizedStart;
        points.push(event.at);
        quantizedMachinePoints.push(quantizedStart);
        break;
      }
      case 'deposit': {
        extrusionVolumeMm3 += event.volumeMm3;
        if (event.volumeMm3 > 0) {
          const extrusionMm = event.volumeMm3 / filamentAreaMm2;
          const quantizedE = representableExtrusion(extrusionMm, index);
          const quantizedFeedMmMin = representablePositiveFeed(
            event.volumeRateMm3S / filamentAreaMm2 * 60,
            index,
          );
          const rawDuration = event.volumeMm3 / event.volumeRateMm3S;
          const quantizedDuration = quantizedE / (quantizedFeedMmMin / 60);
          commandedDurationS += rawDuration;
          quantizedExtrusionMm += quantizedE;
          extrusionRoundingBoundMm += Math.abs(quantizedE - extrusionMm);
          quantizedCommandedTimeSeconds += quantizedDuration;
          commandedTimeRoundingBoundSeconds += Math.abs(quantizedDuration - rawDuration);
          timedCommandCount += 1;
          positiveDepositMoves += 1;
        }
        current = event.at;
        quantizedCurrent = quantizedStart;
        points.push(event.at);
        quantizedMachinePoints.push(quantizedStart);
        break;
      }
      case 'anchor':
        current = event.at;
        quantizedCurrent = quantizedStart;
        points.push(event.at);
        quantizedMachinePoints.push(quantizedStart);
        break;
    }
  });

  const partBounds = boundsFor(points);
  validateStats(path, {
    pathLengthMm,
    extrusionVolumeMm3,
    filamentLengthMm: extrusionVolumeMm3 / filamentAreaMm2,
    commandedDurationS,
    extrudeMoves,
    travelMoves,
    dwellCount,
    bounds: partBounds,
  });
  validateDiagnostics(path.diagnostics);

  return {
    filamentAreaMm2,
    expectations: {
      extrusionMm: extrusionVolumeMm3 / filamentAreaMm2,
      quantizedExtrusionMm,
      extrusionRoundingBoundMm,
      dwellSeconds: path.events.reduce((total, event) => total + (event.kind === 'dwell' ? event.seconds : 0), 0),
      quantizedDwellSeconds,
      dwellRoundingBoundSeconds,
      // One explicit initial XYZ approach precedes path event commands.
      moveCount: 1 + extrudeMoves + travelMoves + positiveDepositMoves,
      extrusionCommandCount: extrudeMoves + positiveDepositMoves,
      dwellCommandCount: dwellCount,
      coordinateMoveCount: 1 + extrudeMoves + travelMoves,
      commandedTimeSeconds: commandedDurationS,
      quantizedCommandedTimeSeconds,
      commandedTimeRoundingBoundSeconds,
      timedCommandCount,
      sourceMachineBounds: offsetBounds(partBounds),
      machineBounds: boundsFor(quantizedMachinePoints),
    },
  };

  function representableExtrusion(extrusionMm: number, eventIndex: number): number {
    const quantized = quantizeDraftNumber(extrusionMm, EXTRUSION_DECIMAL_PLACES);
    if (extrusionMm > 0 && quantized === 0) {
      throw new Error(`toolpath.events[${eventIndex}] requests ${extrusionMm} mm of filament, which resolves to E0 at ${EXTRUSION_DECIMAL_PLACES}-decimal E precision. Increase the event volume or change the export precision.`);
    }
    return quantized;
  }

  function representablePositiveFeed(feedMmMin: number, eventIndex: number): number {
    const quantized = quantizeDraftNumber(feedMmMin, FEED_DECIMAL_PLACES);
    if (quantized <= 0) {
      throw new Error(`toolpath.events[${eventIndex}] feed ${feedMmMin} mm/min is not representable at ${FEED_DECIMAL_PLACES}-decimal feed precision.`);
    }
    return quantized;
  }
}

function validateRecipe(recipe: Recipe): void {
  assertPlainObject(recipe, 'recipe');
  assertExactKeys(recipe, ['schemaVersion', 'name', 'shape', 'process', 'bands'], 'recipe');
  if (recipe.schemaVersion !== 1) throw new Error('Only recipe schemaVersion 1 can be exported.');
  assertBoundedString(recipe.name, 'recipe.name', 4_096);

  assertPlainObject(recipe.shape, 'recipe.shape');
  assertExactKeys(
    recipe.shape,
    ['heightMm', 'baseDiameterMm', 'topDiameterMm', 'bellyMm', 'section', 'aspectRatio', 'twistDeg'],
    'recipe.shape',
  );
  positive(recipe.shape.heightMm, 'recipe.shape.heightMm');
  positive(recipe.shape.baseDiameterMm, 'recipe.shape.baseDiameterMm');
  positive(recipe.shape.topDiameterMm, 'recipe.shape.topDiameterMm');
  finite(recipe.shape.bellyMm, 'recipe.shape.bellyMm');
  if (!['circle', 'ellipse', 'squircle'].includes(recipe.shape.section)) {
    throw new Error('recipe.shape.section is unsupported.');
  }
  positive(recipe.shape.aspectRatio, 'recipe.shape.aspectRatio');
  finite(recipe.shape.twistDeg, 'recipe.shape.twistDeg');

  assertPlainObject(recipe.process, 'recipe.process');
  assertExactKeys(
    recipe.process,
    ['pitchMm', 'strandDiameterMm', 'filamentDiameterMm', 'speedMmS', 'travelMmS', 'flowMultiplier'],
    'recipe.process',
  );
  positive(recipe.process.pitchMm, 'recipe.process.pitchMm');
  positive(recipe.process.strandDiameterMm, 'recipe.process.strandDiameterMm');
  positive(recipe.process.filamentDiameterMm, 'recipe.process.filamentDiameterMm');
  positive(recipe.process.speedMmS, 'recipe.process.speedMmS');
  positive(recipe.process.travelMmS, 'recipe.process.travelMmS');
  nonNegative(recipe.process.flowMultiplier, 'recipe.process.flowMultiplier');

  if (!Array.isArray(recipe.bands) || recipe.bands.length === 0 || recipe.bands.length > MAX_BANDS) {
    throw new Error(`recipe.bands must contain between 1 and ${MAX_BANDS} entries.`);
  }
  const ids = new Set<string>();
  recipe.bands.forEach((band, index) => {
    const label = `recipe.bands[${index}]`;
    assertPlainObject(band, label);
    assertExactKeys(
      band,
      ['id', 'kind', 'weight', 'amplitudeMm', 'repeatsPerTurn', 'phaseAdvanceDeg', 'radialAmplitudeMm', 'speedVariation', 'flowVariation', 'dwellSeconds', 'anchorVolumeMm3'],
      label,
    );
    assertBoundedString(band.id, `${label}.id`, 256);
    if (ids.has(band.id)) throw new Error(`Duplicate band id: ${band.id}`);
    ids.add(band.id);
    if (!['wave', 'triangle', 'arch', 'bridge'].includes(band.kind)) {
      throw new Error(`${label}.kind is unsupported.`);
    }
    positive(band.weight, `${label}.weight`);
    nonNegative(band.amplitudeMm, `${label}.amplitudeMm`);
    positive(band.repeatsPerTurn, `${label}.repeatsPerTurn`);
    finite(band.phaseAdvanceDeg, `${label}.phaseAdvanceDeg`);
    nonNegative(band.radialAmplitudeMm, `${label}.radialAmplitudeMm`);
    finite(band.speedVariation, `${label}.speedVariation`);
    finite(band.flowVariation, `${label}.flowVariation`);
    nonNegative(band.dwellSeconds, `${label}.dwellSeconds`);
    nonNegative(band.anchorVolumeMm3, `${label}.anchorVolumeMm3`);
  });
}

function validateEvent(event: ToolpathEvent, index: number): void {
  const label = `toolpath.events[${index}]`;
  assertPlainObject(event, label);
  assertBoundedString(event.bandId, `${label}.bandId`, 256);

  switch (event.kind) {
    case 'extrude':
      assertExactKeys(event, ['kind', 'bandId', 'from', 'to', 'volumeMm3', 'speedMmS', 'role'], label);
      point(event.from, `${label}.from`);
      point(event.to, `${label}.to`);
      nonNegative(event.volumeMm3, `${label}.volumeMm3`);
      positive(event.speedMmS, `${label}.speedMmS`);
      if (!['wall', 'span', 'rise', 'fall', 'transition', 'foundation', 'rim'].includes(event.role)) {
        throw new Error(`${label}.role is unsupported.`);
      }
      return;
    case 'travel':
      assertExactKeys(event, ['kind', 'bandId', 'from', 'to', 'speedMmS'], label);
      point(event.from, `${label}.from`);
      point(event.to, `${label}.to`);
      positive(event.speedMmS, `${label}.speedMmS`);
      return;
    case 'dwell':
      assertExactKeys(event, ['kind', 'bandId', 'at', 'seconds'], label);
      point(event.at, `${label}.at`);
      nonNegative(event.seconds, `${label}.seconds`);
      return;
    case 'deposit':
      assertExactKeys(event, ['kind', 'bandId', 'at', 'volumeMm3', 'volumeRateMm3S'], label);
      point(event.at, `${label}.at`);
      nonNegative(event.volumeMm3, `${label}.volumeMm3`);
      nonNegative(event.volumeRateMm3S, `${label}.volumeRateMm3S`);
      if (event.volumeMm3 > 0 && event.volumeRateMm3S === 0) {
        throw new Error(`${label}.volumeRateMm3S must be greater than zero for a positive deposit.`);
      }
      return;
    case 'anchor':
      assertExactKeys(event, ['kind', 'bandId', 'at'], label);
      point(event.at, `${label}.at`);
      return;
    default:
      throw new Error(`${label}.kind is unsupported.`);
  }
}

function validateStats(path: GeneratedToolpath, calculated: GeneratedToolpath['stats']): void {
  const stats = path.stats;
  assertPlainObject(stats, 'toolpath.stats');
  assertExactKeys(
    stats,
    ['pathLengthMm', 'extrusionVolumeMm3', 'filamentLengthMm', 'commandedDurationS', 'extrudeMoves', 'travelMoves', 'dwellCount', 'bounds'],
    'toolpath.stats',
  );
  for (const key of ['pathLengthMm', 'extrusionVolumeMm3', 'filamentLengthMm', 'commandedDurationS'] as const) {
    nonNegative(stats[key], `toolpath.stats.${key}`);
    close(stats[key], calculated[key], `toolpath.stats.${key}`);
  }
  for (const key of ['extrudeMoves', 'travelMoves', 'dwellCount'] as const) {
    nonNegativeInteger(stats[key], `toolpath.stats.${key}`);
    if (stats[key] !== calculated[key]) throw new Error(`toolpath.stats.${key} does not match events.`);
  }
  bounds(stats.bounds, 'toolpath.stats.bounds');
  for (const edge of ['min', 'max'] as const) {
    for (const axis of ['x', 'y', 'z'] as const) {
      close(stats.bounds[edge][axis], calculated.bounds[edge][axis], `toolpath.stats.bounds.${edge}.${axis}`);
    }
  }
}

function validateDiagnostics(value: GeneratedToolpath['diagnostics']): void {
  if (!Array.isArray(value)) throw new Error('toolpath.diagnostics must be an array.');
  value.forEach((diagnostic, index) => {
    const label = `toolpath.diagnostics[${index}]`;
    assertPlainObject(diagnostic, label);
    const keys = diagnostic.bandId === undefined
      ? ['severity', 'code', 'message']
      : ['severity', 'code', 'message', 'bandId'];
    assertExactKeys(diagnostic, keys, label);
    if (!['error', 'warning', 'info'].includes(diagnostic.severity)) {
      throw new Error(`${label}.severity is unsupported.`);
    }
    assertBoundedString(diagnostic.code, `${label}.code`, 256);
    assertBoundedString(diagnostic.message, `${label}.message`, 4_096);
    if (diagnostic.bandId !== undefined) assertBoundedString(diagnostic.bandId, `${label}.bandId`, 256);
  });
}

function boundsFor(points: readonly Vec3[]): Bounds {
  const first = points[0];
  if (!first) throw new Error('Toolpath has no positions.');
  const min = { ...first };
  const max = { ...first };
  for (const candidate of points.slice(1)) {
    for (const axis of ['x', 'y', 'z'] as const) {
      min[axis] = Math.min(min[axis], candidate[axis]);
      max[axis] = Math.max(max[axis], candidate[axis]);
    }
  }
  return { min, max };
}

function offsetBounds(value: Bounds): Bounds {
  return {
    min: {
      x: value.min.x + DRAFT_BED_CENTER_OFFSET_MM.x,
      y: value.min.y + DRAFT_BED_CENTER_OFFSET_MM.y,
      z: value.min.z,
    },
    max: {
      x: value.max.x + DRAFT_BED_CENTER_OFFSET_MM.x,
      y: value.max.y + DRAFT_BED_CENTER_OFFSET_MM.y,
      z: value.max.z,
    },
  };
}

function quantizeMachinePoint(value: Vec3): Vec3 {
  return {
    x: quantizeDraftNumber(value.x + DRAFT_BED_CENTER_OFFSET_MM.x, XYZ_DECIMAL_PLACES),
    y: quantizeDraftNumber(value.y + DRAFT_BED_CENTER_OFFSET_MM.y, XYZ_DECIMAL_PLACES),
    z: quantizeDraftNumber(value.z, XYZ_DECIMAL_PLACES),
  };
}

function quantizedDwell(seconds: number, eventIndex: number): number {
  const milliseconds = Math.round(seconds * 1_000);
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
    throw new Error(`toolpath.events[${eventIndex}] dwell cannot be represented as whole milliseconds.`);
  }
  if (seconds > 0 && milliseconds === 0) {
    throw new Error(`toolpath.events[${eventIndex}] positive dwell resolves to zero at 1 ms precision.`);
  }
  return milliseconds / 1_000;
}

function bounds(value: Bounds, label: string): void {
  assertPlainObject(value, label);
  assertExactKeys(value, ['min', 'max'], label);
  point(value.min, `${label}.min`);
  point(value.max, `${label}.max`);
  for (const axis of ['x', 'y', 'z'] as const) {
    if (value.min[axis] > value.max[axis]) throw new Error(`${label} has inverted ${axis} bounds.`);
  }
}

function point(value: Vec3, label: string): void {
  assertPlainObject(value, label);
  assertExactKeys(value, ['x', 'y', 'z'], label);
  finite(value.x, `${label}.x`);
  finite(value.y, `${label}.y`);
  finite(value.z, `${label}.z`);
}

function assertPlainObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label} must be a plain object.`);
  }
}

function assertExactKeys(value: object, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} contains missing or unknown fields.`);
  }
}

function assertBoundedString(value: unknown, label: string, maxLength: number): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new Error(`${label} must be a non-empty string no longer than ${maxLength} characters.`);
  }
}

function finite(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

function positive(value: unknown, label: string): asserts value is number {
  finite(value, label);
  if (value <= 0) throw new Error(`${label} must be greater than zero.`);
}

function nonNegative(value: unknown, label: string): asserts value is number {
  finite(value, label);
  if (value < 0) throw new Error(`${label} must not be negative.`);
}

function nonNegativeInteger(value: unknown, label: string): asserts value is number {
  nonNegative(value, label);
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer.`);
}

function close(actual: number, expected: number, label: string): void {
  const tolerance = STAT_TOLERANCE * Math.max(1, Math.abs(expected));
  if (Math.abs(actual - expected) > tolerance) throw new Error(`${label} does not match events.`);
}

function samePoint(a: Vec3, b: Vec3): boolean {
  return distance(a, b) <= CONTINUITY_TOLERANCE_MM;
}

function samePointExactly(a: Vec3, b: Vec3): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}
