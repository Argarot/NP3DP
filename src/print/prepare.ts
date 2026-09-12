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
import {
  interpolateClosedOutlineAtPhases,
  inwardOffsetConvexPolygon,
  refinePhasedOutlineBySegmentLength,
} from './foundationInset';
import type { FoundationSettings, PreparedBuild, PrintStage } from './types';
import { inspectCircularWaveAttachment } from './attachment';
import { inspectMatchedRevolutionPathContact } from './pathContact';

export const PREPARED_BUILD_ENGINE_VERSION = '0.4.0';
const TWO_PI = 2 * Math.PI;
const MAX_SEGMENT_MM = 0.6;
const MIN_CONTOUR_SAMPLES = 32;
const LAYER_CHANGE_SPEED_MM_S = 2;
const POSITION_EPSILON_MM = 1e-9;
const PHASE_EPSILON = 1e-12;
const MAX_ELEPHANT_FOOT_MM = 0.5;

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
    ['elephant-foot inset', elephantFootMm(settings)],
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
  if (elephantFootMm(settings) < 0 || elephantFootMm(settings) > MAX_ELEPHANT_FOOT_MM) {
    throw new RangeError(`Foundation elephant-foot inset must be between 0 and ${MAX_ELEPHANT_FOOT_MM} mm.`);
  }
}

function elephantFootMm(settings: FoundationSettings): number {
  return settings.elephantFootMm;
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

function uniformContourPhases(shape: Shape, heightFraction: number, scale: number): number[] {
  const diameter = shape.baseDiameterMm
    + (shape.topDiameterMm - shape.baseDiameterMm) * heightFraction
    + 2 * shape.bellyMm * Math.sin(Math.PI * heightFraction);
  const radius = diameter / 2;
  const estimate = Math.ceil(TWO_PI * radius * maximumSectionUnitRadius(shape) * scale / MAX_SEGMENT_MM);
  if (!Number.isSafeInteger(estimate)) {
    throw new RangeError(`Toolpath would exceed the ${MAX_TOOLPATH_EVENTS.toLocaleString('en-US')} event limit.`);
  }
  const samples = Math.max(MIN_CONTOUR_SAMPLES, estimate);
  if (samples > MAX_TOOLPATH_EVENTS) {
    throw new RangeError(`Toolpath would exceed the ${MAX_TOOLPATH_EVENTS.toLocaleString('en-US')} event limit.`);
  }
  return Array.from({ length: samples + 1 }, (_, sample) => TWO_PI * sample / samples);
}

/**
 * Squircle's square-root parameterization has an unbounded derivative at the
 * axes, so a circumference estimate does not bound emitted chords. Bisect in
 * phase until every actual planar segment is within MAX_SEGMENT_MM. Circle
 * and ellipse retain their legacy uniform phases exactly.
 */
function contourPhases(shape: Shape, heightFraction: number, scale: number, phaseOffset = 0): number[] {
  assertFinite('Contour phase offset', phaseOffset);
  if (shape.section !== 'squircle') return uniformContourPhases(shape, heightFraction, scale);
  const phases = [0];
  const appendInterval = (from: number, to: number): void => {
    const start = sectionPoint(shape, phaseOffset + from, heightFraction, scale, 0);
    const end = sectionPoint(shape, phaseOffset + to, heightFraction, scale, 0);
    const chordMm = Math.hypot(end.x - start.x, end.y - start.y);
    if (!Number.isFinite(chordMm)) throw new RangeError('Foundation contour chord must be finite.');
    if (chordMm <= MAX_SEGMENT_MM + POSITION_EPSILON_MM) {
      if (phases.length - 1 >= MAX_TOOLPATH_EVENTS) {
        throw new RangeError(`Toolpath would exceed the ${MAX_TOOLPATH_EVENTS.toLocaleString('en-US')} event limit.`);
      }
      phases.push(to);
      return;
    }
    const middle = (from + to) / 2;
    if (!Number.isFinite(middle) || middle === from || middle === to) {
      throw new RangeError('Foundation contour cannot be refined within finite phase precision.');
    }
    appendInterval(from, middle);
    appendInterval(middle, to);
  };
  // Splitting at the actual (shifted) axes avoids crossing a signed-power
  // discontinuity when a rim begins after a partial wall turn.
  const normalizedOffset = ((phaseOffset % TWO_PI) + TWO_PI) % TWO_PI;
  const boundaries = [0, TWO_PI];
  for (let quadrant = 0; quadrant < 4; quadrant += 1) {
    const phase = ((quadrant * Math.PI / 2 - normalizedOffset) % TWO_PI + TWO_PI) % TWO_PI;
    if (phase > PHASE_EPSILON && phase < TWO_PI - PHASE_EPSILON) boundaries.push(phase);
  }
  boundaries.sort((left, right) => left - right);
  for (let index = 1; index < boundaries.length; index += 1) {
    const from = boundaries[index - 1];
    const to = boundaries[index];
    if (from === undefined || to === undefined) throw new RangeError('Foundation contour phase table is incomplete.');
    appendInterval(from, to);
  }
  return phases;
}

function contourSegmentCount(shape: Shape, heightFraction: number, scale: number, phaseOffset = 0): number {
  return contourPhases(shape, heightFraction, scale, phaseOffset).length - 1;
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
    count = addBoundedCount(count, contourSegmentCount(shape, 0, ring / rings));
  }
  return count;
}

function compensatedFirstLayerEventCount(
  recipe: Recipe,
  settings: FoundationSettings,
  contour: FirstLayerContour,
): number {
  const rings = ringCount(recipe.shape, settings.lineWidthMm);
  let count = rings;
  for (let ring = 1; ring <= rings; ring += 1) {
    count = addBoundedCount(count, contour.phases(ring / rings).length - 1);
  }
  return count;
}

function plannedEventUpperBound(recipe: Recipe, settings: FoundationSettings): number {
  let count = estimateToolpathEvents(recipe, {
    zOffsetMm: settings.layers * settings.layerHeightMm + settings.layerHeightMm - WALL_START_Z_MM,
    startBlendHeightMm: settings.blendHeightMm,
  });
  const compensatedFirstLayer = firstLayerContour(recipe, settings);
  const firstLayer = compensatedFirstLayer === undefined
    ? foundationLayerEventCount(recipe.shape, settings)
    : compensatedFirstLayerEventCount(recipe, settings, compensatedFirstLayer);
  count = addBoundedCount(count, firstLayer);
  const perLaterLayer = foundationLayerEventCount(recipe.shape, settings);
  for (let layer = 1; layer < settings.layers; layer += 1) {
    count = addBoundedCount(count, perLaterLayer);
  }
  count = addBoundedCount(count, settings.layers - 1);
  // Only an outward first layer ends on the inset perimeter. Its next
  // nominal contour needs one XY travel after the Z-only layer lift (or before
  // the transition when there is a single layer). Inward first layers start
  // directly on the compensated outline.
  if (elephantFootMm(settings) > 0 && settings.layers % 2 === 1) {
    count = addBoundedCount(count, 1);
  }
  count = addBoundedCount(count, contourSegmentCount(recipe.shape, 0, 1));
  if (settings.rimTurns > 0) {
    const perTurn = contourSegmentCount(recipe.shape, 1, 1, totalThetaForRim(recipe));
    for (let turn = 0; turn < settings.rimTurns; turn += 1) {
      count = addBoundedCount(count, perTurn);
    }
  }
  return count;
}

function beadAreaMm2(settings: FoundationSettings, height = settings.layerHeightMm): number {
  return (settings.lineWidthMm - height) * height + Math.PI * height * height / 4;
}

function appendTravel(
  events: ToolpathEvent[],
  bandId: string,
  from: Vec3,
  to: Vec3,
  speedMmS = LAYER_CHANGE_SPEED_MM_S,
): Vec3 {
  if (distance(from, to) <= POSITION_EPSILON_MM) return from;
  events.push({ kind: 'travel', bandId, from, to, speedMmS });
  return to;
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

interface FirstLayerContour {
  point(phase: number, scale: number, z: number): Vec3;
  phases(scale: number): readonly number[];
}

function firstLayerContour(recipe: Recipe, settings: FoundationSettings): FirstLayerContour | undefined {
  const insetMm = elephantFootMm(settings);
  if (insetMm === 0) return undefined;
  const outerPhases = contourPhases(recipe.shape, 0, 1);
  const outerRadius = recipe.shape.baseDiameterMm / 2;
  if (recipe.shape.section === 'circle') {
    if (outerRadius <= insetMm) {
      throw new RangeError('Foundation elephant-foot inset collapses the circular first-layer outline.');
    }
    const insetScale = (outerRadius - insetMm) / outerRadius;
    return {
      point: (phase, scale, z) => sectionPoint(recipe.shape, phase, 0, insetScale * scale, z),
      phases: (scale) => contourPhases(recipe.shape, 0, scale),
    };
  }

  const outline = [];
  for (const phase of outerPhases.slice(0, -1)) {
    const point = sectionPoint(recipe.shape, phase, 0, 1, 0);
    outline.push({ x: point.x, y: point.y });
  }
  const insetOutline = inwardOffsetConvexPolygon(outline, insetMm);
  const refinedInset = refinePhasedOutlineBySegmentLength(
    insetOutline, outerPhases, MAX_SEGMENT_MM, MAX_TOOLPATH_EVENTS,
  );
  return {
    point: (phase, scale, z) => {
      const point = interpolateClosedOutlineAtPhases(
        refinedInset.vertices, refinedInset.phases, phase,
      );
      return { x: point.x * scale, y: point.y * scale, z };
    },
    // Every inner homothetic ring is no longer than this refined outer ring.
    phases: () => refinedInset.phases,
  };
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
  const compensatedFirstLayer = firstLayerContour(recipe, settings);
  let current = firstLayerOutward
    ? sectionPoint(recipe.shape, 0, 0, 0, settings.layerHeightMm)
    : compensatedFirstLayer?.point(0, 1, settings.layerHeightMm)
      ?? sectionPoint(recipe.shape, 0, 0, 1, settings.layerHeightMm);

  for (let layer = 0; layer < settings.layers; layer += 1) {
    const z = (layer + 1) * settings.layerHeightMm;
    const outward = firstLayerOutward !== (layer % 2 === 1);
    if (layer > 0) {
      current = appendTravel(events, bandId, current, { x: current.x, y: current.y, z });
      // An outward first layer ends on the inset boundary, while the second
      // layer deliberately remains nominal. Keep that placement change a
      // continuous, non-extruding move rather than a stale-coordinate jump.
      if (layer === 1 && compensatedFirstLayer !== undefined && firstLayerOutward) {
        current = appendTravel(events, bandId, current, sectionPoint(recipe.shape, 0, 0, 1, z));
      }
    }

    const point = layer === 0 && compensatedFirstLayer !== undefined
      ? (phase: number, scale: number) => compensatedFirstLayer.point(phase, scale, z)
      : (phase: number, scale: number) => sectionPoint(recipe.shape, phase, 0, scale, z);

    if (outward) {
      for (let ring = 1; ring <= rings; ring += 1) {
        const scale = ring / rings;
        current = appendExtrusion(events, recipe, settings, bandId, 'foundation', current,
          point(0, scale));
        const phases = layer === 0 && compensatedFirstLayer !== undefined
          ? compensatedFirstLayer.phases(scale)
          : contourPhases(recipe.shape, 0, scale);
        for (const phase of phases.slice(1)) {
          current = appendExtrusion(events, recipe, settings, bandId, 'foundation', current,
            point(phase, scale));
        }
      }
    } else {
      for (let ring = rings; ring >= 1; ring -= 1) {
        const scale = ring / rings;
        const phases = layer === 0 && compensatedFirstLayer !== undefined
          ? compensatedFirstLayer.phases(scale)
          : contourPhases(recipe.shape, 0, scale);
        for (const phase of phases.slice(1)) {
          current = appendExtrusion(events, recipe, settings, bandId, 'foundation', current,
            point(phase, scale));
        }
        current = appendExtrusion(events, recipe, settings, bandId, 'foundation', current,
          point(0, (ring - 1) / rings));
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
  const phases = contourPhases(recipe.shape, 0, 1);
  const foundationTop = settings.layers * settings.layerHeightMm;
  let current = initial;
  for (let index = 1; index < phases.length; index += 1) {
    const previousPhase = phases[index - 1];
    const phase = phases[index];
    if (previousPhase === undefined || phase === undefined) throw new RangeError('Foundation phase table is incomplete.');
    const fraction = phase / TWO_PI;
    const midpointGapMm = settings.layerHeightMm * (previousPhase + phase) / (2 * TWO_PI);
    current = appendExtrusion(events, recipe, settings, bandId, 'transition', current,
      sectionPoint(recipe.shape, phase, 0, 1,
        foundationTop + settings.layerHeightMm * fraction), midpointGapMm);
  }
  return current;
}

function eventEnd(event: ToolpathEvent): Vec3 {
  return event.kind === 'extrude' || event.kind === 'travel' ? event.to : event.at;
}

function totalThetaForRim(recipe: Recipe): number {
  const total = recipe.shape.heightMm / recipe.process.pitchMm * TWO_PI;
  assertFinite('Rim start phase', total);
  return total;
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
  const totalTheta = totalThetaForRim(recipe);
  const phases = contourPhases(recipe.shape, 1, 1, totalTheta);
  let current = initial;
  for (let turn = 0; turn < settings.rimTurns; turn += 1) {
    for (const phase of phases.slice(1)) {
      const turnFraction = turn + phase / TWO_PI;
      const nominal = shapePoint(recipe.shape, totalTheta + TWO_PI * turnFraction, 1);
      const next = {
        x: nominal.x,
        y: nominal.y,
        z: wallBaseZMm + recipe.shape.heightMm + settings.layerHeightMm * turnFraction,
      };
      current = appendExtrusion(events, recipe, settings, bandId, 'rim', current, next);
    }
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
  const elephantFootDiagnostic: Diagnostic[] = elephantFootMm(settings) === 0 ? [] : [{
    severity: 'info',
    code: 'geometry.foundation-elephant-foot-inset',
    message: recipeSectionInsetMessage(elephantFootMm(settings)),
  }];
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
    ...elephantFootDiagnostic,
  ];
}

function recipeSectionInsetMessage(insetMm: number): string {
  return `The first foundation layer uses a ${insetMm.toFixed(3)} mm inward elephant-foot offset. Circular outlines use the exact reduced radius; ellipse and squircle outlines use a validated perpendicular offset of their sampled convex polygon, not a physical adhesion prediction.`;
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
  if (elephantFootMm(settings) > 0 && settings.layers === 1) {
    const bandId = recipe.bands[0]?.id;
    if (bandId === undefined) throw new RangeError('At least one band is required.');
    current = appendTravel(events, bandId, current,
      sectionPoint(recipe.shape, 0, 0, 1, foundationTop));
  }
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

  const path: GeneratedToolpath = {
    engineVersion: PREPARED_BUILD_ENGINE_VERSION,
    recipeKey: body.recipeKey,
    events,
    stats: calculateStats(events, recipe.process.filamentDiameterMm),
    diagnostics: preparedDiagnostics(body, settings),
  };
  return {
    buildKey,
    path,
    wallOffsetZMm,
    stages,
    attachment: inspectCircularWaveAttachment(recipe, settings),
    pathContact: inspectMatchedRevolutionPathContact({ path, stages }, recipe.process.strandDiameterMm),
  };
}
