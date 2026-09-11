import type { Band, PatternKind, Process, Recipe, Shape } from './types';
import { minimumNominalRadius } from './shapes';

/** Numeric input bounds used consistently by the editor and recipe parser. */
export interface ParameterSpec {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
  readonly description?: string;
}

export const SHAPE_PARAMETERS = {
  heightMm: { label: 'Height', min: 10, max: 200, step: 0.1, unit: 'mm' },
  baseDiameterMm: { label: 'Base diameter', min: 10, max: 220, step: 0.1, unit: 'mm' },
  topDiameterMm: { label: 'Top diameter', min: 10, max: 220, step: 0.1, unit: 'mm' },
  bellyMm: {
    label: 'Belly', min: -50, max: 80, step: 0.1, unit: 'mm',
    description: 'Radial bulge at mid-height; negative values create a waist.',
  },
  aspectRatio: { label: 'Aspect ratio', min: 0.3, max: 2, step: 0.01, unit: 'ratio' },
  twistDeg: { label: 'Twist', min: -360, max: 360, step: 1, unit: '°' },
} as const satisfies Record<Exclude<keyof Shape, 'section'>, ParameterSpec>;

export const PROCESS_PARAMETERS = {
  pitchMm: { label: 'Pitch', min: 0.3, max: 5, step: 0.01, unit: 'mm' },
  strandDiameterMm: { label: 'Strand diameter', min: 0.2, max: 1.2, step: 0.01, unit: 'mm' },
  filamentDiameterMm: { label: 'Filament diameter', min: 1, max: 3, step: 0.01, unit: 'mm' },
  speedMmS: { label: 'Print speed', min: 1, max: 100, step: 0.1, unit: 'mm/s' },
  travelMmS: { label: 'Travel speed', min: 1, max: 200, step: 0.1, unit: 'mm/s' },
  flowMultiplier: { label: 'Flow multiplier', min: 0.1, max: 3, step: 0.01, unit: 'ratio' },
} as const satisfies Record<keyof Process, ParameterSpec>;

export const BAND_PARAMETERS = {
  weight: { label: 'Height share', min: 0.1, max: 10, step: 0.1, unit: 'ratio' },
  amplitudeMm: { label: 'Pattern amplitude', min: 0, max: 12, step: 0.1, unit: 'mm' },
  repeatsPerTurn: { label: 'Repeats per turn', min: 4, max: 96, step: 1, unit: 'count' },
  phaseAdvanceDeg: {
    label: 'Phase advance', min: -180, max: 180, step: 1, unit: '°',
    description: 'Continuous phase change over each revolution.',
  },
  radialAmplitudeMm: { label: 'Radial amplitude', min: 0, max: 12, step: 0.1, unit: 'mm' },
  speedVariation: { label: 'Speed variation', min: 0, max: 0.9, step: 0.01, unit: 'ratio' },
  flowVariation: { label: 'Flow variation', min: 0, max: 1, step: 0.01, unit: 'ratio' },
  dwellSeconds: { label: 'Vertex dwell', min: 0, max: 5, step: 0.01, unit: 's' },
  anchorVolumeMm3: { label: 'Anchor volume', min: 0, max: 2, step: 0.01, unit: 'mm³' },
} as const satisfies Record<Exclude<keyof Band, 'id' | 'kind'>, ParameterSpec>;

export const MAX_RECIPE_TEXT_BYTES = 1_000_000;

const SHAPE_KEYS = ['heightMm', 'baseDiameterMm', 'topDiameterMm', 'bellyMm', 'section', 'aspectRatio', 'twistDeg'] as const;
const PROCESS_KEYS = ['pitchMm', 'strandDiameterMm', 'filamentDiameterMm', 'speedMmS', 'travelMmS', 'flowMultiplier'] as const;
const BAND_KEYS = ['id', 'kind', 'weight', 'amplitudeMm', 'repeatsPerTurn', 'phaseAdvanceDeg', 'radialAmplitudeMm', 'speedVariation', 'flowVariation', 'dwellSeconds', 'anchorVolumeMm3'] as const;
const RECIPE_KEYS = ['schemaVersion', 'name', 'shape', 'process', 'bands'] as const;
const SECTION_KINDS = new Set(['circle', 'ellipse', 'squircle']);
const PATTERN_KINDS = new Set(['wave', 'triangle', 'arch', 'bridge']);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

type RecordValue = Record<string, unknown>;

/**
 * Parses an editable recipe. The parser deliberately rejects unknown fields so
 * a newer recipe cannot be loaded and silently saved without its semantics.
 */
export function parseRecipe(input: unknown): Recipe {
  const recipe = expectRecord(input, 'recipe');
  expectExactKeys(recipe, RECIPE_KEYS, 'recipe');

  if (recipe.schemaVersion !== 1) {
    throw new Error(`Invalid recipe: unsupported schemaVersion ${describeValue(recipe.schemaVersion)}; only version 1 is supported.`);
  }

  const name = expectName(recipe.name, 'recipe.name');
  const shape = parseShape(recipe.shape);
  const process = parseProcess(recipe.process);
  const bands = parseBands(recipe.bands);
  validateGeometry(shape, bands);

  return { schemaVersion: 1, name, shape, process, bands };
}

/** Parses JSON text with a bounded payload size before applying recipe validation. */
export function parseRecipeText(text: string): Recipe {
  if (new TextEncoder().encode(text).byteLength > MAX_RECIPE_TEXT_BYTES) {
    throw new Error(`Invalid recipe JSON: text exceeds the ${MAX_RECIPE_TEXT_BYTES}-byte limit.`);
  }
  try {
    return parseRecipe(JSON.parse(text) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid recipe JSON: ${error.message}`);
    }
    throw error;
  }
}

/** Returns a deterministic, human-readable JSON representation of a valid recipe. */
export function serializeRecipe(recipe: Recipe): string {
  return JSON.stringify(parseRecipe(recipe), null, 2);
}

function parseShape(value: unknown): Shape {
  const shape = expectRecord(value, 'recipe.shape');
  expectExactKeys(shape, SHAPE_KEYS, 'recipe.shape');
  const section = expectEnum(shape.section, SECTION_KINDS, 'recipe.shape.section') as Shape['section'];
  return {
    heightMm: expectParameter(shape.heightMm, SHAPE_PARAMETERS.heightMm, 'recipe.shape.heightMm'),
    baseDiameterMm: expectParameter(shape.baseDiameterMm, SHAPE_PARAMETERS.baseDiameterMm, 'recipe.shape.baseDiameterMm'),
    topDiameterMm: expectParameter(shape.topDiameterMm, SHAPE_PARAMETERS.topDiameterMm, 'recipe.shape.topDiameterMm'),
    bellyMm: expectParameter(shape.bellyMm, SHAPE_PARAMETERS.bellyMm, 'recipe.shape.bellyMm'),
    section,
    aspectRatio: expectParameter(shape.aspectRatio, SHAPE_PARAMETERS.aspectRatio, 'recipe.shape.aspectRatio'),
    twistDeg: expectParameter(shape.twistDeg, SHAPE_PARAMETERS.twistDeg, 'recipe.shape.twistDeg'),
  };
}

function parseProcess(value: unknown): Process {
  const process = expectRecord(value, 'recipe.process');
  expectExactKeys(process, PROCESS_KEYS, 'recipe.process');
  return {
    pitchMm: expectParameter(process.pitchMm, PROCESS_PARAMETERS.pitchMm, 'recipe.process.pitchMm'),
    strandDiameterMm: expectParameter(process.strandDiameterMm, PROCESS_PARAMETERS.strandDiameterMm, 'recipe.process.strandDiameterMm'),
    filamentDiameterMm: expectParameter(process.filamentDiameterMm, PROCESS_PARAMETERS.filamentDiameterMm, 'recipe.process.filamentDiameterMm'),
    speedMmS: expectParameter(process.speedMmS, PROCESS_PARAMETERS.speedMmS, 'recipe.process.speedMmS'),
    travelMmS: expectParameter(process.travelMmS, PROCESS_PARAMETERS.travelMmS, 'recipe.process.travelMmS'),
    flowMultiplier: expectParameter(process.flowMultiplier, PROCESS_PARAMETERS.flowMultiplier, 'recipe.process.flowMultiplier'),
  };
}

function parseBands(value: unknown): Band[] {
  if (!Array.isArray(value)) throw new Error('Invalid recipe.bands: expected an array.');
  if (value.length > 8) throw new Error('Invalid recipe.bands: at most 8 bands are supported.');
  if (value.length === 0) throw new Error('Invalid recipe.bands: at least one band is required.');

  const ids = new Set<string>();
  return value.map((item, index) => {
    const path = `recipe.bands[${index}]`;
    const band = expectRecord(item, path);
    expectExactKeys(band, BAND_KEYS, path);
    const id = expectId(band.id, `${path}.id`);
    if (ids.has(id)) throw new Error(`Invalid ${path}.id: duplicate band id "${id}".`);
    ids.add(id);
    return {
      id,
      kind: expectEnum(band.kind, PATTERN_KINDS, `${path}.kind`) as PatternKind,
      weight: expectParameter(band.weight, BAND_PARAMETERS.weight, `${path}.weight`),
      amplitudeMm: expectParameter(band.amplitudeMm, BAND_PARAMETERS.amplitudeMm, `${path}.amplitudeMm`),
      repeatsPerTurn: expectParameter(band.repeatsPerTurn, BAND_PARAMETERS.repeatsPerTurn, `${path}.repeatsPerTurn`, true),
      phaseAdvanceDeg: expectParameter(band.phaseAdvanceDeg, BAND_PARAMETERS.phaseAdvanceDeg, `${path}.phaseAdvanceDeg`),
      radialAmplitudeMm: expectParameter(band.radialAmplitudeMm, BAND_PARAMETERS.radialAmplitudeMm, `${path}.radialAmplitudeMm`),
      speedVariation: expectParameter(band.speedVariation, BAND_PARAMETERS.speedVariation, `${path}.speedVariation`),
      flowVariation: expectParameter(band.flowVariation, BAND_PARAMETERS.flowVariation, `${path}.flowVariation`),
      dwellSeconds: expectParameter(band.dwellSeconds, BAND_PARAMETERS.dwellSeconds, `${path}.dwellSeconds`),
      anchorVolumeMm3: expectParameter(band.anchorVolumeMm3, BAND_PARAMETERS.anchorVolumeMm3, `${path}.anchorVolumeMm3`),
    };
  });
}

function validateGeometry(shape: Shape, bands: readonly Band[]): void {
  // The same analytical extremum calculation is used by the path engine.
  const minimumRadius = minimumNominalRadius(shape);
  if (!(minimumRadius > 0)) {
    throw new Error('Invalid recipe.shape: base/top diameter and belly produce a non-positive radius.');
  }
  for (const band of bands) {
    if (band.radialAmplitudeMm >= minimumRadius) {
      throw new Error(`Invalid recipe.bands[${band.id}].radialAmplitudeMm: deformation produces a non-positive radius.`);
    }
  }
}

function expectRecord(value: unknown, path: string): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${path}: expected an object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`Invalid ${path}: expected a plain object.`);
  }
  return value as RecordValue;
}

function expectExactKeys(value: RecordValue, expected: readonly string[], path: string): void {
  const expectedSet = new Set<string>(expected);
  const actual = Object.keys(value);
  const unexpected = actual.filter((key) => !expectedSet.has(key));
  if (unexpected.length > 0) {
    throw new Error(`Invalid ${path}: unexpected field${unexpected.length === 1 ? '' : 's'} ${unexpected.map((key) => `"${key}"`).join(', ')}.`);
  }
  const missing = expected.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  if (missing.length > 0) {
    throw new Error(`Invalid ${path}: missing required field${missing.length === 1 ? '' : 's'} ${missing.map((key) => `"${key}"`).join(', ')}.`);
  }
}

function expectParameter(value: unknown, spec: ParameterSpec, path: string, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${path}: expected a finite number.`);
  }
  if (value < spec.min || value > spec.max) {
    throw new Error(`Invalid ${path}: expected a value from ${spec.min} to ${spec.max} ${spec.unit}.`);
  }
  if (integer && !Number.isInteger(value)) {
    throw new Error(`Invalid ${path}: expected an integer.`);
  }
  return value;
}

function expectEnum(value: unknown, values: ReadonlySet<string>, path: string): string {
  if (typeof value !== 'string' || !values.has(value)) {
    throw new Error(`Invalid ${path}: expected one of ${[...values].join(', ')}.`);
  }
  return value;
}

function expectName(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 80 || value.trim().length === 0) {
    throw new Error(`Invalid ${path}: expected 1 to 80 non-blank characters.`);
  }
  return value;
}

function expectId(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 60 || !ID_PATTERN.test(value)) {
    throw new Error(`Invalid ${path}: expected a 1 to 60 character identifier using letters, digits, hyphens, or underscores.`);
  }
  return value;
}

function describeValue(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}
