/**
 * Bounded nominal separation analysis over the emitted extrusion path.
 *
 * The analysis compares each deposited wall/rim revolution with the path one
 * revolution earlier at the same polar angle. Points are evaluated on the
 * actual emitted line segments, including their radial and Z displacement.
 * This remains a centreline diagnostic: it does not model bead shape,
 * bonding, sag, cooling, or nozzle clearance.
 */
import type { ExtrudeEvent, GeneratedToolpath, ToolpathEvent, Vec3 } from '../domain/types';

type PathContactStageKind = 'foundation' | 'transition' | 'wall' | 'rim';

export interface PathContactStageLike {
  kind: PathContactStageKind;
  startEvent: number;
  endEvent: number;
}

export interface PathContactBuildLike {
  path: GeneratedToolpath;
  stages: readonly PathContactStageLike[];
}

export interface MatchedRevolutionEstimate {
  currentStage: 'wall' | 'rim';
  /** One-based revolution within the current stage. */
  revolutionIndex: number;
  /** Less than one only for the final partial revolution of a stage. */
  revolutionFraction: number;
  startPhaseRad: number;
  endPhaseRad: number;
  referenceStages: Array<'transition' | 'wall' | 'rim'>;
  minSeparationMm: number;
  maxSeparationMm: number;
  contactFractionEstimate: number;
  sampleIntervals: number;
  hasNominalContact: boolean;
  hasUnsupportedWindows: boolean;
}

export interface PathContactReport {
  applicable: true;
  model: 'matched-revolution-nominal-centreline-separation';
  nominalStrandDiameterMm: number;
  rotationDirection: 'counter-clockwise' | 'clockwise';
  totalSampleIntervals: number;
  comparisons: MatchedRevolutionEstimate[];
  warnings: string[];
}

export interface InapplicablePathContactReport {
  applicable: false;
  reasons: string[];
}

export type MatchedRevolutionPathContactReport =
  | PathContactReport
  | InapplicablePathContactReport;

const TWO_PI = 2 * Math.PI;
const ANGLE_EPSILON_RAD = 1e-10;
const PHASE_TOLERANCE_RAD = 1e-6;
const POSITION_TOLERANCE_MM = 1e-6;
const MIN_RADIUS_MM = 1e-6;
const SAMPLES_PER_REVOLUTION = 512;
const MAX_RELEVANT_EVENTS = 100_000;
const MAX_COMPARISONS = 512;
const MAX_SAMPLE_INTERVALS = 250_000;
const MAX_BOUNDARY_SCANS = 4_000_000;

interface RotationalSegment {
  event: ExtrudeEvent;
  startPhaseRad: number;
  endPhaseRad: number;
}

interface RotationalCurve {
  kind: 'transition' | 'wall' | 'rim';
  segments: RotationalSegment[];
  spanRad: number;
  startAngleRad: number;
  direction: 1 | -1;
  globalStartPhaseRad: number;
  globalEndPhaseRad: number;
}

interface PendingCurve extends Omit<RotationalCurve, 'globalStartPhaseRad' | 'globalEndPhaseRad'> {}

interface ExtractedStage {
  extrusions: ExtrudeEvent[];
  stationaryEventCount: number;
  stationaryDepositCount: number;
}

function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function radius(point: Vec3): number {
  return Math.hypot(point.x, point.y);
}

function signedSmallestAngle(from: number, to: number): number {
  let delta = (to - from) % TWO_PI;
  if (delta <= -Math.PI) delta += TWO_PI;
  if (delta > Math.PI) delta -= TWO_PI;
  return delta;
}

function angularDifference(a: number, b: number): number {
  return Math.abs(signedSmallestAngle(a, b));
}

function cross2(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function stageForKind(
  stages: readonly PathContactStageLike[],
  kind: PathContactStageKind,
): PathContactStageLike | undefined {
  return stages.find((stage) => stage.kind === kind);
}

function extractExtrusions(
  events: readonly ToolpathEvent[],
  stages: readonly PathContactStageLike[],
  kind: 'transition' | 'wall' | 'rim',
  reasons: string[],
): ExtractedStage | undefined {
  const matches = stages.filter((stage) => stage.kind === kind);
  if (matches.length === 0) {
    if (kind !== 'rim') reasons.push(`A ${kind} stage is required.`);
    return undefined;
  }
  if (matches.length !== 1) {
    reasons.push(`Exactly one ${kind} stage is required.`);
    return undefined;
  }
  const stage = stageForKind(stages, kind)!;
  if (!Number.isSafeInteger(stage.startEvent) || !Number.isSafeInteger(stage.endEvent)
    || stage.startEvent < 0 || stage.endEvent > events.length || stage.startEvent >= stage.endEvent) {
    reasons.push(`The ${kind} stage has invalid event bounds.`);
    return undefined;
  }
  const selected = events.slice(stage.startEvent, stage.endEvent);
  const allowedRoles: ReadonlySet<ExtrudeEvent['role']> = kind === 'wall'
    ? new Set(['wall', 'span', 'rise', 'fall'])
    : new Set([kind]);
  const extrusions: ExtrudeEvent[] = [];
  let stationaryEventCount = 0;
  let stationaryDepositCount = 0;
  let currentPosition: Vec3 | undefined;
  for (const event of selected) {
    if (event.kind === 'travel') {
      reasons.push(`The ${kind} stage contains travel, so it is not a continuous deposited path.`);
      return undefined;
    }
    if (event.kind === 'extrude') {
      if (!allowedRoles.has(event.role)) {
        reasons.push(`The ${kind} stage contains unsupported extrusion role "${event.role}".`);
        return undefined;
      }
      if (!Number.isFinite(event.volumeMm3) || event.volumeMm3 <= 0) {
        reasons.push(`The ${kind} stage contains moving extrusion without positive finite volume.`);
        return undefined;
      }
      if (currentPosition !== undefined && distance3(currentPosition, event.from) > POSITION_TOLERANCE_MM) {
        reasons.push(`The ${kind} event sequence is not position-continuous.`);
        return undefined;
      }
      currentPosition = event.to;
      extrusions.push(event);
      continue;
    }
    if (![event.at.x, event.at.y, event.at.z].every(Number.isFinite)) {
      reasons.push(`The ${kind} stage contains a stationary event with non-finite coordinates.`);
      return undefined;
    }
    if (currentPosition !== undefined && distance3(currentPosition, event.at) > POSITION_TOLERANCE_MM) {
      reasons.push(`A stationary ${event.kind} event is displaced from the ${kind} path position.`);
      return undefined;
    }
    currentPosition ??= event.at;
    stationaryEventCount += 1;
    if (event.kind === 'deposit') stationaryDepositCount += 1;
  }
  return { extrusions, stationaryEventCount, stationaryDepositCount };
}

function makeCurve(
  kind: 'transition' | 'wall' | 'rim',
  events: ExtrudeEvent[],
  expectedDirection: 1 | -1 | undefined,
  reasons: string[],
): PendingCurve | undefined {
  if (events.length === 0) {
    reasons.push(`The ${kind} stage has no extrusion segments.`);
    return undefined;
  }
  let direction = expectedDirection;
  let phase = 0;
  const segments: RotationalSegment[] = [];
  let previousEnd: Vec3 | undefined;

  for (const event of events) {
    if (![event.from.x, event.from.y, event.from.z, event.to.x, event.to.y, event.to.z]
      .every(Number.isFinite)) {
      reasons.push(`The ${kind} stage contains non-finite coordinates.`);
      return undefined;
    }
    if (previousEnd !== undefined && distance3(previousEnd, event.from) > POSITION_TOLERANCE_MM) {
      reasons.push(`The ${kind} extrusion path is not continuous.`);
      return undefined;
    }
    if (radius(event.from) <= MIN_RADIUS_MM || radius(event.to) <= MIN_RADIUS_MM) {
      reasons.push(`The ${kind} path approaches the polar origin, so matched angles are ambiguous.`);
      return undefined;
    }

    const startAngle = Math.atan2(event.from.y, event.from.x);
    const endAngle = Math.atan2(event.to.y, event.to.x);
    const delta = signedSmallestAngle(startAngle, endAngle);
    if (Math.abs(delta) <= ANGLE_EPSILON_RAD) {
      reasons.push(`The ${kind} path contains a segment with no resolvable rotational advance.`);
      return undefined;
    }
    const segmentDirection: 1 | -1 = delta > 0 ? 1 : -1;
    direction ??= segmentDirection;
    if (segmentDirection !== direction) {
      reasons.push(`The ${kind} path reverses rotational direction.`);
      return undefined;
    }
    const advance = Math.abs(delta);
    if (advance >= Math.PI - PHASE_TOLERANCE_RAD) {
      reasons.push(`A ${kind} segment spans too much angle to identify a unique matched ray.`);
      return undefined;
    }
    segments.push({ event, startPhaseRad: phase, endPhaseRad: phase + advance });
    phase += advance;
    previousEnd = event.to;
  }

  return {
    kind,
    segments,
    spanRad: phase,
    startAngleRad: Math.atan2(events[0]!.from.y, events[0]!.from.x),
    direction: direction!,
  };
}

function attachGlobalPhase(curve: PendingCurve, startPhaseRad: number): RotationalCurve {
  return {
    ...curve,
    globalStartPhaseRad: startPhaseRad,
    globalEndPhaseRad: startPhaseRad + curve.spanRad,
  };
}

function pointOnCurve(
  curve: RotationalCurve,
  globalPhaseRad: number,
  baseAngleRad: number,
): Vec3 | undefined {
  const localPhase = globalPhaseRad - curve.globalStartPhaseRad;
  if (localPhase < -PHASE_TOLERANCE_RAD || localPhase > curve.spanRad + PHASE_TOLERANCE_RAD) {
    return undefined;
  }
  let low = 0;
  let high = curve.segments.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (curve.segments[middle]!.endPhaseRad < localPhase - ANGLE_EPSILON_RAD) low = middle + 1;
    else high = middle;
  }
  const segment = curve.segments[low]!;
  if (Math.abs(localPhase - segment.startPhaseRad) <= ANGLE_EPSILON_RAD) return segment.event.from;
  if (Math.abs(localPhase - segment.endPhaseRad) <= ANGLE_EPSILON_RAD) return segment.event.to;

  // Intersect the emitted chord with the requested polar ray. This recovers
  // the chord's actual parameter rather than treating atan2 as linear in t.
  const targetAngle = baseAngleRad + curve.direction * globalPhaseRad;
  const rayX = Math.cos(targetAngle);
  const rayY = Math.sin(targetAngle);
  const dx = segment.event.to.x - segment.event.from.x;
  const dy = segment.event.to.y - segment.event.from.y;
  const denominator = cross2(dx, dy, rayX, rayY);
  if (Math.abs(denominator) <= Number.EPSILON) return undefined;
  const t = -cross2(segment.event.from.x, segment.event.from.y, rayX, rayY) / denominator;
  if (t < -POSITION_TOLERANCE_MM || t > 1 + POSITION_TOLERANCE_MM) return undefined;
  const boundedT = Math.min(1, Math.max(0, t));
  const x = segment.event.from.x + dx * boundedT;
  const y = segment.event.from.y + dy * boundedT;
  if (x * rayX + y * rayY <= MIN_RADIUS_MM) return undefined;
  return {
    x,
    y,
    z: segment.event.from.z + (segment.event.to.z - segment.event.from.z) * boundedT,
  };
}

function findCurve(curves: readonly RotationalCurve[], phaseRad: number): RotationalCurve | undefined {
  return curves.find((curve) => phaseRad >= curve.globalStartPhaseRad - PHASE_TOLERANCE_RAD
    && phaseRad <= curve.globalEndPhaseRad + PHASE_TOLERANCE_RAD);
}

function pointAtPhase(
  curves: readonly RotationalCurve[],
  phaseRad: number,
  baseAngleRad: number,
): Vec3 | undefined {
  const curve = findCurve(curves, phaseRad);
  return curve === undefined ? undefined : pointOnCurve(curve, phaseRad, baseAngleRad);
}

function referenceStagesFor(
  curves: readonly RotationalCurve[],
  startPhaseRad: number,
  endPhaseRad: number,
): Array<'transition' | 'wall' | 'rim'> {
  return curves
    .filter((curve) => Math.min(endPhaseRad, curve.globalEndPhaseRad)
      - Math.max(startPhaseRad, curve.globalStartPhaseRad) > PHASE_TOLERANCE_RAD)
    .map((curve) => curve.kind);
}

function revolutionCount(spanRad: number): number {
  return Math.ceil(spanRad / TWO_PI - PHASE_TOLERANCE_RAD);
}

function samplePhases(
  current: RotationalCurve,
  curves: readonly RotationalCurve[],
  startPhaseRad: number,
  endPhaseRad: number,
): number[] {
  const values = [startPhaseRad, endPhaseRad];
  const step = TWO_PI / SAMPLES_PER_REVOLUTION;
  const firstUniform = Math.floor(startPhaseRad / step) + 1;
  const lastUniform = Math.ceil(endPhaseRad / step) - 1;
  for (let index = firstUniform; index <= lastUniform; index += 1) {
    const phase = index * step;
    if (phase > startPhaseRad + ANGLE_EPSILON_RAD && phase < endPhaseRad - ANGLE_EPSILON_RAD) {
      values.push(phase);
    }
  }
  for (const segment of current.segments) {
    const phase = current.globalStartPhaseRad + segment.endPhaseRad;
    if (phase > startPhaseRad + ANGLE_EPSILON_RAD && phase < endPhaseRad - ANGLE_EPSILON_RAD) {
      values.push(phase);
    }
  }
  for (const curve of curves) {
    for (const segment of curve.segments) {
      const currentPhase = curve.globalStartPhaseRad + segment.endPhaseRad + TWO_PI;
      if (currentPhase > startPhaseRad + ANGLE_EPSILON_RAD
        && currentPhase < endPhaseRad - ANGLE_EPSILON_RAD) {
        values.push(currentPhase);
      }
    }
  }
  values.sort((a, b) => a - b);
  return values.filter((value, index) => index === 0
    || value - values[index - 1]! > ANGLE_EPSILON_RAD);
}

function estimateComparison(
  current: RotationalCurve,
  curves: readonly RotationalCurve[],
  baseAngleRad: number,
  revolutionIndex: number,
  startPhaseRad: number,
  endPhaseRad: number,
  strandDiameterMm: number,
): MatchedRevolutionEstimate | undefined {
  const phases = samplePhases(current, curves, startPhaseRad, endPhaseRad);
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let contactPhase = 0;
  let previousPhase = phases[0]!;
  let previousSeparation: number | undefined;

  for (const phase of phases) {
    const currentPoint = pointOnCurve(current, phase, baseAngleRad);
    const referencePoint = pointAtPhase(curves, phase - TWO_PI, baseAngleRad);
    if (currentPoint === undefined || referencePoint === undefined) return undefined;
    const separation = distance3(currentPoint, referencePoint);
    minimum = Math.min(minimum, separation);
    maximum = Math.max(maximum, separation);
    if (previousSeparation !== undefined) {
      const span = phase - previousPhase;
      const previousDelta = previousSeparation - strandDiameterMm;
      const delta = separation - strandDiameterMm;
      if (previousDelta <= 0 && delta <= 0) {
        contactPhase += span;
      } else if ((previousDelta <= 0) !== (delta <= 0)) {
        const crossing = Math.abs(previousDelta) / (Math.abs(previousDelta) + Math.abs(delta));
        contactPhase += previousDelta <= 0 ? span * crossing : span * (1 - crossing);
      }
    }
    previousPhase = phase;
    previousSeparation = separation;
  }

  const span = endPhaseRad - startPhaseRad;
  return {
    currentStage: current.kind as 'wall' | 'rim',
    revolutionIndex,
    revolutionFraction: span / TWO_PI,
    startPhaseRad,
    endPhaseRad,
    referenceStages: referenceStagesFor(curves, startPhaseRad - TWO_PI, endPhaseRad - TWO_PI),
    minSeparationMm: minimum,
    maxSeparationMm: maximum,
    contactFractionEstimate: span > 0 ? contactPhase / span : 0,
    sampleIntervals: phases.length - 1,
    hasNominalContact: minimum <= strandDiameterMm,
    hasUnsupportedWindows: maximum > strandDiameterMm,
  };
}

/** Inspect actual prepared extrusion segments using matched polar angles. */
export function inspectMatchedRevolutionPathContact(
  build: PathContactBuildLike,
  nominalStrandDiameterMm: number,
): MatchedRevolutionPathContactReport {
  const reasons: string[] = [];
  if (!Number.isFinite(nominalStrandDiameterMm) || nominalStrandDiameterMm <= 0) {
    reasons.push('The nominal strand diameter must be finite and greater than zero.');
  }
  if (!Array.isArray(build.path.events) || !Array.isArray(build.stages)) {
    return { applicable: false, reasons: ['A prepared event path and stage table are required.'] };
  }

  const transitionStage = extractExtrusions(build.path.events, build.stages, 'transition', reasons);
  const wallStage = extractExtrusions(build.path.events, build.stages, 'wall', reasons);
  const rimStage = extractExtrusions(build.path.events, build.stages, 'rim', reasons);
  const transitionEvents = transitionStage?.extrusions;
  const wallEvents = wallStage?.extrusions;
  const rimEvents = rimStage?.extrusions;
  const relevantCount = (transitionEvents?.length ?? 0) + (wallEvents?.length ?? 0)
    + (rimEvents?.length ?? 0);
  if (relevantCount > MAX_RELEVANT_EVENTS) {
    reasons.push(`Analysis is capped at ${MAX_RELEVANT_EVENTS.toLocaleString('en-US')} relevant extrusion events.`);
  }
  if (reasons.length > 0 || transitionEvents === undefined || wallEvents === undefined) {
    return { applicable: false, reasons };
  }

  const transitionPending = makeCurve('transition', transitionEvents, undefined, reasons);
  const wallPending = transitionPending === undefined
    ? undefined
    : makeCurve('wall', wallEvents, transitionPending.direction, reasons);
  const rimPending = rimEvents === undefined || transitionPending === undefined
    ? undefined
    : makeCurve('rim', rimEvents, transitionPending.direction, reasons);
  if (transitionPending !== undefined && Math.abs(transitionPending.spanRad - TWO_PI) > PHASE_TOLERANCE_RAD) {
    reasons.push('The transition must cover exactly one resolvable revolution.');
  }
  if (transitionPending !== undefined && wallPending !== undefined) {
    const transitionEnd = transitionEvents.at(-1)!.to;
    const wallStart = wallEvents[0]!.from;
    if (distance3(transitionEnd, wallStart) > POSITION_TOLERANCE_MM) {
      reasons.push('The transition and wall extrusion paths are not continuous.');
    }
    if (angularDifference(transitionPending.startAngleRad, wallPending.startAngleRad) > PHASE_TOLERANCE_RAD) {
      reasons.push('The transition and wall do not share a resolvable polar seam.');
    }
  }
  if (wallPending !== undefined && rimPending !== undefined) {
    const wallEnd = wallEvents.at(-1)!.to;
    const rimStart = rimEvents![0]!.from;
    if (distance3(wallEnd, rimStart) > POSITION_TOLERANCE_MM) {
      reasons.push('The wall and rim extrusion paths are not continuous.');
    }
    const expectedRimAngle = wallPending.startAngleRad
      + wallPending.direction * wallPending.spanRad;
    if (angularDifference(expectedRimAngle, rimPending.startAngleRad) > PHASE_TOLERANCE_RAD) {
      reasons.push('The wall and rim do not share a resolvable polar seam.');
    }
  }

  const comparisonCount = wallPending === undefined ? 0 : revolutionCount(wallPending.spanRad)
    + (rimPending === undefined ? 0 : revolutionCount(rimPending.spanRad));
  if (comparisonCount > MAX_COMPARISONS) {
    reasons.push(`Analysis is capped at ${MAX_COMPARISONS} current-path revolutions.`);
  }
  if (2 * comparisonCount * relevantCount > MAX_BOUNDARY_SCANS) {
    reasons.push(`Analysis is capped at ${MAX_BOUNDARY_SCANS.toLocaleString('en-US')} segment-boundary scans.`);
  }
  if (reasons.length > 0 || transitionPending === undefined || wallPending === undefined) {
    return { applicable: false, reasons };
  }

  const transition = attachGlobalPhase(transitionPending, -TWO_PI);
  const wall = attachGlobalPhase(wallPending, 0);
  const rim = rimPending === undefined ? undefined : attachGlobalPhase(rimPending, wall.globalEndPhaseRad);
  const curves = rim === undefined ? [transition, wall] : [transition, wall, rim];
  const comparisons: MatchedRevolutionEstimate[] = [];
  let totalSampleIntervals = 0;

  for (const current of curves.filter((curve) => curve.kind !== 'transition')) {
    const revolutions = revolutionCount(current.spanRad);
    for (let revolutionIndex = 1; revolutionIndex <= revolutions; revolutionIndex += 1) {
      const startPhase = current.globalStartPhaseRad + (revolutionIndex - 1) * TWO_PI;
      const endPhase = Math.min(current.globalEndPhaseRad, startPhase + TWO_PI);
      const estimate = estimateComparison(current, curves, wall.startAngleRad, revolutionIndex,
        startPhase, endPhase, nominalStrandDiameterMm);
      if (estimate === undefined) {
        return {
          applicable: false,
          reasons: ['An emitted segment could not be intersected unambiguously at a required matched angle.'],
        };
      }
      totalSampleIntervals += estimate.sampleIntervals;
      if (totalSampleIntervals > MAX_SAMPLE_INTERVALS) {
        return {
          applicable: false,
          reasons: [`Sampled analysis is capped at ${MAX_SAMPLE_INTERVALS.toLocaleString('en-US')} intervals.`],
        };
      }
      comparisons.push(estimate);
    }
  }

  const stationaryEventCount = (transitionStage?.stationaryEventCount ?? 0)
    + (wallStage?.stationaryEventCount ?? 0) + (rimStage?.stationaryEventCount ?? 0);
  const stationaryDepositCount = (transitionStage?.stationaryDepositCount ?? 0)
    + (wallStage?.stationaryDepositCount ?? 0) + (rimStage?.stationaryDepositCount ?? 0);
  const warnings = [
    'Separation is measured between matched-angle points on emitted centreline segments in three dimensions.',
    'Nominal contact means centreline separation <= nominal strand diameter; it does not predict bead shape, bonding, sag, cooling, or nozzle clearance.',
  ];
  if (stationaryEventCount > 0) {
    warnings.push(`${stationaryEventCount} stationary anchor/deposit/dwell event(s), including ${stationaryDepositCount} deposit event(s), were excluded from moving-strand separation; their positions were checked for path continuity.`);
  }

  return {
    applicable: true,
    model: 'matched-revolution-nominal-centreline-separation',
    nominalStrandDiameterMm,
    rotationDirection: wall.direction === 1 ? 'counter-clockwise' : 'clockwise',
    totalSampleIntervals,
    comparisons,
    warnings,
  };
}
