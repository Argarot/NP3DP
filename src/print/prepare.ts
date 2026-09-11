import { estimateToolpathEvents, generateToolpath } from '../domain/generate';
import { distance } from '../domain/math';
import { MAX_TOOLPATH_EVENTS } from '../domain/patterns';
import { shapePoint, WALL_START_Z_MM } from '../domain/shapes';
import { calculateStats } from '../domain/stats';
import type {
  Diagnostic,
  ExtrudeEvent,
  GeneratedToolpath,
  Recipe,
  Shape,
  ToolpathEvent,
  Vec3,
} from '../domain/types';
import type { FoundationSettings, PreparedBuild, PrintStage } from './types';

export const PREPARED_BUILD_ENGINE_VERSION = '0.2.0';
const TWO_PI = 2 * Math.PI;
const MAX_SEGMENT_MM = 0.6;
const MIN_CONTOUR_SAMPLES = 32;
const LAYER_CHANGE_SPEED_MM_S = 2;
const POSITION_EPSILON_MM = 1e-9;

function assertFinite(label: string, value: number): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
}

function validateFoundationSettings(settings: FoundationSettings): void {
  if (!settings || typeof settings !== 'object') {
    throw new TypeError('Foundation settings must be an object.');
  }
  if (typeof settings.enabled !== 'boolean') {
    throw new TypeError('Foundation enabled must be a boolean.');
  }
  const values: ReadonlyArray<readonly [string, number]> = [
    ['layers', settings.layers],
    ['layer height', settings.layerHeightMm],
    ['line width', settings.lineWidthMm],
    ['speed', settings.speedMmS],
    ['blend height', settings.blendHeightMm],
    ['rim turns', settings.rimTurns],
  ];
  for (const [label, value] of values) assertFinite(`Foundation ${label}`, value);
  if (!Number.isSafeInteger(settings.layers) || settings.layers < 1) {
    throw new RangeError('Foundation layers must be a positive safe integer.');
  }
  if (settings.layerHeightMm <= 0 || settings.lineWidthMm <= 0 || settings.speedMmS <= 0) {
    throw new RangeError('Foundation layer height, line width and speed must be greater than zero.');
  }
  if (settings.lineWidthMm < settings.layerHeightMm) {
    throw new RangeError('Foundation line width must be at least the layer height for the stadium bead model.');
  }
  if (settings.blendHeightMm < 0) {
    throw new RangeError('Foundation blend height cannot be negative.');
  }
  if (!Number.isSafeInteger(settings.rimTurns) || settings.rimTurns < 0) {
    throw new RangeError('Foundation rim turns must be a non-negative safe integer.');
  }
}

function maximumSectionUnitRadius(shape: Shape): number {
  if (shape.section === 'circle') return 1;
  if (shape.section === 'ellipse') return Math.max(1, 1 / shape.aspectRatio);
  return (1 + 1 / shape.aspectRatio ** 4) ** 0.25;
}

function sectionPoint(shape: Shape, theta: number, heightFraction: number, scale: number, z: number): Vec3 {
  const nominal = shapePoint(shape, theta, heightFraction);
  return { x: nominal.x * scale, y: nominal.y * scale, z };
}

function contourSamples(shape: Shape, heightFraction: number, scale: number): number {
  const diameter = shape.baseDiameterMm
    + (shape.topDiameterMm - shape.baseDiameterMm) * heightFraction
    + 2 * shape.bellyMm * Math.sin(Math.PI * heightFraction);
  const radius = diameter / 2;
  const estimate = Math.ceil(TWO_PI * radius * maximumSectionUnitRadius(shape) * scale / MAX_SEGMENT_MM);
  if (!Number.isSafeInteger(estimate)) {
    throw new RangeError(`Toolpath would exceed the ${MAX_TOOLPATH_EVENTS.toLocaleString('en-US')} event limit.`);
  }
  return Math.max(MIN_CONTOUR_SAMPLES, estimate);
}

function ringCount(shape: Shape, lineWidthMm: number): number {
  const count = Math.ceil(shape.baseDiameterMm / 2
    * maximumSectionUnitRadius(shape) / lineWidthMm);
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_TOOLPATH_EVENTS) {
    throw new RangeError(`Toolpath would exceed the ${MAX_TOOLPATH_EVENTS.toLocaleString('en-US')} event limit.`);
  }
  return count;
}

function addBoundedCount(total: number, addition: number): number {
  const next = total + addition;
  if (!Number.isSafeInteger(addition) || addition < 0
    || !Number.isSafeInteger(next) || next > MAX_TOOLPATH_EVENTS) {
    throw new RangeError(`Toolpath would exceed the ${MAX_TOOLPATH_EVENTS.toLocaleString('en-US')} event limit.`);
  }
  return next;
}

function foundationLayerEventCount(shape: Shape, settings: FoundationSettings): number {
  const rings = ringCount(shape, settings.lineWidthMm);
  let count = rings; // one radial connector per contour
  for (let ring = 1; ring <= rings; ring += 1) {
    count = addBoundedCount(count, contourSamples(shape, 0, ring / rings));
  }
  return count;
}

function plannedEventUpperBound(recipe: Recipe, settings: FoundationSettings): number {
  let count = estimateToolpathEvents(recipe, {
    zOffsetMm: settings.layers * settings.layerHeightMm + settings.layerHeightMm - WALL_START_Z_MM,
    startBlendHeightMm: settings.blendHeightMm,
  });
  const perLayer = foundationLayerEventCount(recipe.shape, settings);
  for (let layer = 0; layer < settings.layers; layer += 1) {
    count = addBoundedCount(count, perLayer);
  }
  count = addBoundedCount(count, settings.layers - 1);
  count = addBoundedCount(count, contourSamples(recipe.shape, 0, 1));
  if (settings.rimTurns > 0) {
    const perTurn = contourSamples(recipe.shape, 1, 1);
    for (let turn = 0; turn < settings.rimTurns; turn += 1) {
      count = addBoundedCount(count, perTurn);
    }
  }
  return count;
}

function beadAreaMm2(settings: FoundationSettings, height = settings.layerHeightMm): number {
  return (settings.lineWidthMm - height) * height + Math.PI * height * height / 4;
}

function appendExtrusion(
  events: ToolpathEvent[],
  recipe: Recipe,
  settings: FoundationSettings,
  bandId: string,
  role: ExtrudeEvent['role'],
  from: Vec3,
  to: Vec3,
  beadHeightMm = settings.layerHeightMm,
): Vec3 {
  const length = distance(from, to);
  if (length <= POSITION_EPSILON_MM) return from;
  events.push({
    kind: 'extrude',
    bandId,
    from,
    to,
    volumeMm3: beadAreaMm2(settings, beadHeightMm) * length * recipe.process.flowMultiplier,
    speedMmS: settings.speedMmS,
    role,
  });
  return to;
}

function appendFoundation(
  events: ToolpathEvent[],
  recipe: Recipe,
  settings: FoundationSettings,
): Vec3 {
  const bandId = recipe.bands[0]?.id;
  if (bandId === undefined) throw new RangeError('At least one band is required.');
  const rings = ringCount(recipe.shape, settings.lineWidthMm);
  const firstLayerOutward = settings.layers % 2 === 1;
  let current = sectionPoint(recipe.shape, 0, 0, firstLayerOutward ? 0 : 1, settings.layerHeightMm);

  for (let layer = 0; layer < settings.layers; layer += 1) {
    const z = (layer + 1) * settings.layerHeightMm;
    const outward = firstLayerOutward !== (layer % 2 === 1);
    if (layer > 0) {
      const lifted = { x: current.x, y: current.y, z };
      events.push({
        kind: 'travel',
        bandId,
        from: current,
        to: lifted,
        speedMmS: LAYER_CHANGE_SPEED_MM_S,
      });
      current = lifted;
    }

    if (outward) {
      for (let ring = 1; ring <= rings; ring += 1) {
        const scale = ring / rings;
        current = appendExtrusion(events, recipe, settings, bandId, 'foundation', current,
          sectionPoint(recipe.shape, 0, 0, scale, z));
        const samples = contourSamples(recipe.shape, 0, scale);
        for (let sample = 1; sample <= samples; sample += 1) {
          current = appendExtrusion(events, recipe, settings, bandId, 'foundation', current,
            sectionPoint(recipe.shape, TWO_PI * sample / samples, 0, scale, z));
        }
      }
    } else {
      for (let ring = rings; ring >= 1; ring -= 1) {
        const scale = ring / rings;
        const samples = contourSamples(recipe.shape, 0, scale);
        for (let sample = 1; sample <= samples; sample += 1) {
          current = appendExtrusion(events, recipe, settings, bandId, 'foundation', current,
            sectionPoint(recipe.shape, TWO_PI * sample / samples, 0, scale, z));
        }
        current = appendExtrusion(events, recipe, settings, bandId, 'foundation', current,
          sectionPoint(recipe.shape, 0, 0, (ring - 1) / rings, z));
      }
    }
  }
  return current;
}

function appendTransition(
  events: ToolpathEvent[],
  recipe: Recipe,
  settings: FoundationSettings,
  initial: Vec3,
): Vec3 {
  const bandId = recipe.bands[0]?.id;
  if (bandId === undefined) throw new RangeError('At least one band is required.');
  const count = contourSamples(recipe.shape, 0, 1);
  const foundationTop = settings.layers * settings.layerHeightMm;
  let current = initial;
  for (let sample = 1; sample <= count; sample += 1) {
    const fraction = sample / count;
    const midpointGapMm = settings.layerHeightMm * (sample - 0.5) / count;
    current = appendExtrusion(events, recipe, settings, bandId, 'transition', current,
      sectionPoint(recipe.shape, TWO_PI * fraction, 0, 1,
        foundationTop + settings.layerHeightMm * fraction), midpointGapMm);
  }
  return current;
}

function eventEnd(event: ToolpathEvent): Vec3 {
  return event.kind === 'extrude' || event.kind === 'travel' ? event.to : event.at;
}

function appendRim(
  events: ToolpathEvent[],
  recipe: Recipe,
  settings: FoundationSettings,
  initial: Vec3,
  wallBaseZMm: number,
): Vec3 {
  const bandId = recipe.bands[recipe.bands.length - 1]?.id;
  if (bandId === undefined) throw new RangeError('At least one band is required.');
  const totalTheta = recipe.shape.heightMm / recipe.process.pitchMm * TWO_PI;
  const samplesPerTurn = contourSamples(recipe.shape, 1, 1);
  const totalSamples = samplesPerTurn * settings.rimTurns;
  let current = initial;
  for (let sample = 1; sample <= totalSamples; sample += 1) {
    const turnFraction = sample / samplesPerTurn;
    const nominal = shapePoint(recipe.shape, totalTheta + TWO_PI * turnFraction, 1);
    const next = {
      x: nominal.x,
      y: nominal.y,
      z: wallBaseZMm + recipe.shape.heightMm + settings.layerHeightMm * turnFraction,
    };
    current = appendExtrusion(events, recipe, settings, bandId, 'rim', current, next);
  }
  return current;
}

function maximumDownwardOffsetMm(recipe: Recipe): number {
  let maximum = 0;
  for (const band of recipe.bands) {
    const possible = band.kind === 'wave'
      ? Math.abs(band.amplitudeMm)
      : Math.max(0, -band.amplitudeMm);
    maximum = Math.max(maximum, possible);
  }
  return maximum;
}

function validateEnabledCombination(recipe: Recipe, settings: FoundationSettings): void {
  if (recipe.process.flowMultiplier <= 0) {
    throw new RangeError('An enabled foundation requires recipe flow multiplier to be greater than zero.');
  }
  const hasExperimentalOffsets = recipe.bands.some((band) =>
    band.amplitudeMm !== 0 || band.radialAmplitudeMm !== 0);
  if (hasExperimentalOffsets && settings.blendHeightMm === 0) {
    throw new RangeError('Foundation blend height must be greater than zero when experimental offsets are used.');
  }
  const requiredBlend = 1.125 * maximumDownwardOffsetMm(recipe);
  if (settings.blendHeightMm + Number.EPSILON < requiredBlend) {
    throw new RangeError(
      `Foundation blend height must be at least ${requiredBlend.toFixed(3)} mm for the recipe's downward Z excursion.`,
    );
  }
}

function preparedDiagnostics(body: GeneratedToolpath, settings: FoundationSettings): Diagnostic[] {
  const retained = body.diagnostics.filter((entry) =>
    entry.code !== 'scope.walls-only' && entry.code !== 'bounds.below-reference-plane');
  return [
    ...retained,
    {
      severity: 'info',
      code: 'scope.foundation-transition-wall',
      message: `The build includes ${settings.layers} planar foundation layer(s), a one-turn rising transition, the recipe wall, and ${settings.rimTurns} unmodulated rim turn(s).`,
    },
    {
      severity: 'warning',
      code: 'model.foundation-bead-uncalibrated',
      message: 'Foundation and rim volume use a nominal stadium bead area; transition area ramps with its midpoint gap above the foundation. This does not establish bonding, clearance, or physical print success.',
    },
    {
      severity: 'info',
      code: 'placement.start-blend',
      message: `Recipe Z and radial offsets use a cubic start envelope over ${settings.blendHeightMm.toFixed(3)} mm above the wall start.`,
    },
  ];
}

export function prepareBuild(recipe: Recipe, settings: FoundationSettings): PreparedBuild {
  validateFoundationSettings(settings);
  const buildKey = JSON.stringify({ recipe, foundation: settings });
  if (!settings.enabled) {
    const path = generateToolpath(recipe);
    return {
      buildKey,
      path,
      wallOffsetZMm: 0,
      stages: [{ kind: 'wall', startEvent: 0, endEvent: path.events.length }],
    };
  }

  validateEnabledCombination(recipe, settings);
  plannedEventUpperBound(recipe, settings);
  const foundationTop = settings.layers * settings.layerHeightMm;
  const wallBaseZMm = foundationTop + settings.layerHeightMm;
  const wallOffsetZMm = wallBaseZMm - WALL_START_Z_MM;
  const body = generateToolpath(recipe, {
    zOffsetMm: wallOffsetZMm,
    startBlendHeightMm: settings.blendHeightMm,
  });
  const events: ToolpathEvent[] = [];
  const stages: PrintStage[] = [];

  let current = appendFoundation(events, recipe, settings);
  stages.push({ kind: 'foundation', startEvent: 0, endEvent: events.length });
  const transitionStart = events.length;
  current = appendTransition(events, recipe, settings, current);
  stages.push({ kind: 'transition', startEvent: transitionStart, endEvent: events.length });

  const wallStart = events.length;
  for (const event of body.events) events.push(event);
  stages.push({ kind: 'wall', startEvent: wallStart, endEvent: events.length });
  const bodyLast = body.events[body.events.length - 1];
  if (bodyLast !== undefined) current = eventEnd(bodyLast);

  if (settings.rimTurns > 0) {
    const rimStart = events.length;
    appendRim(events, recipe, settings, current, wallBaseZMm);
    stages.push({ kind: 'rim', startEvent: rimStart, endEvent: events.length });
  }
  if (events.length > MAX_TOOLPATH_EVENTS) {
    throw new RangeError(`Toolpath exceeded the ${MAX_TOOLPATH_EVENTS.toLocaleString('en-US')} event limit.`);
  }

  return {
    buildKey,
    path: {
      engineVersion: PREPARED_BUILD_ENGINE_VERSION,
      recipeKey: body.recipeKey,
      events,
      stats: calculateStats(events, recipe.process.filamentDiameterMm),
      diagnostics: preparedDiagnostics(body, settings),
    },
    wallOffsetZMm,
    stages,
  };
}
