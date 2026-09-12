/**
 * A bounded, planar offset for the sampled first-layer outline.  The input is
 * required to be a strictly convex simple polygon, which lets each vertex of
 * the inset be defined as the intersection of its two inward-shifted edges.
 * This is a perpendicular polyline offset; it deliberately is not a radial
 * scale of an ellipse or squircle.
 */
export type PlanarPoint = Readonly<{ x: number; y: number }>;
export interface PhasedOutline { vertices: PlanarPoint[]; phases: number[] }

const GEOMETRY_EPSILON = 1e-10;

function cross(a: PlanarPoint, b: PlanarPoint): number {
  return a.x * b.y - a.y * b.x;
}

function subtract(a: PlanarPoint, b: PlanarPoint): PlanarPoint {
  return { x: a.x - b.x, y: a.y - b.y };
}

interface ShiftedLine { start: PlanarPoint; edge: PlanarPoint }

function lineIntersection(first: ShiftedLine, second: ShiftedLine): PlanarPoint | undefined {
  const determinant = cross(first.edge, second.edge);
  const scale = Math.hypot(first.edge.x, first.edge.y) * Math.hypot(second.edge.x, second.edge.y);
  if (Math.abs(determinant) <= GEOMETRY_EPSILON * scale) return undefined;
  const fraction = cross(subtract(second.start, first.start), second.edge) / determinant;
  return {
    x: first.start.x + first.edge.x * fraction,
    y: first.start.y + first.edge.y * fraction,
  };
}

/**
 * Validates the shifted half-plane intersection in O(n log n). Returning an
 * inset only when every original boundary remains active keeps the sampled
 * phase correspondence intact; a collapsed or topology-changing inset fails
 * explicitly rather than producing an unrelated polygon.
 */
function assertShiftedInterior(lines: readonly ShiftedLine[], winding: number): void {
  const ordered = [...lines].sort((a, b) =>
    Math.atan2(a.edge.y, a.edge.x) - Math.atan2(b.edge.y, b.edge.x));
  const active: ShiftedLine[] = [];
  let head = 0;
  const activeLength = (): number => active.length - head;
  const outside = (line: ShiftedLine, point: PlanarPoint): boolean =>
    winding * cross(line.edge, subtract(point, line.start))
      < -GEOMETRY_EPSILON * Math.hypot(line.edge.x, line.edge.y);
  const intersectionAtEnd = (): PlanarPoint | undefined => {
    const previous = active[active.length - 2];
    const last = active.at(-1);
    return previous === undefined || last === undefined ? undefined : lineIntersection(previous, last);
  };
  const intersectionAtStart = (): PlanarPoint | undefined => {
    const first = active[head];
    const second = active[head + 1];
    return first === undefined || second === undefined ? undefined : lineIntersection(first, second);
  };

  for (const line of ordered) {
    while (activeLength() > 1) {
      const point = intersectionAtEnd();
      if (point !== undefined && !outside(line, point)) break;
      active.pop();
    }
    while (activeLength() > 1) {
      const point = intersectionAtStart();
      if (point !== undefined && !outside(line, point)) break;
      head += 1;
    }
    active.push(line);
  }
  while (activeLength() > 2) {
    const point = intersectionAtEnd();
    const first = active[head];
    if (point !== undefined && first !== undefined && !outside(first, point)) break;
    active.pop();
  }
  while (activeLength() > 2) {
    const point = intersectionAtStart();
    const last = active.at(-1);
    if (point !== undefined && last !== undefined && !outside(last, point)) break;
    head += 1;
  }
  if (activeLength() !== lines.length || activeLength() < 3) {
    throw new RangeError('Foundation inset collapses or changes the sampled convex boundary.');
  }
}

function signedAreaTwice(points: readonly PlanarPoint[]): number {
  let areaTwice = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (a === undefined || b === undefined) throw new RangeError('Inset outline is incomplete.');
    areaTwice += a.x * b.y - a.y * b.x;
  }
  return areaTwice;
}

function assertStrictlyConvex(points: readonly PlanarPoint[], label: string): number {
  if (points.length < 3) throw new RangeError(`${label} needs at least three vertices.`);
  if (!points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))) {
    throw new RangeError(`${label} vertices must be finite.`);
  }
  const areaTwice = signedAreaTwice(points);
  if (Math.abs(areaTwice) <= GEOMETRY_EPSILON) {
    throw new RangeError(`${label} is degenerate.`);
  }
  const winding = Math.sign(areaTwice);
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (previous === undefined || current === undefined || next === undefined) {
      throw new RangeError(`${label} is incomplete.`);
    }
    const incoming = subtract(current, previous);
    const outgoing = subtract(next, current);
    const incomingLength = Math.hypot(incoming.x, incoming.y);
    const outgoingLength = Math.hypot(outgoing.x, outgoing.y);
    if (incomingLength <= GEOMETRY_EPSILON || outgoingLength <= GEOMETRY_EPSILON) {
      throw new RangeError(`${label} has a zero-length edge.`);
    }
    if (winding * cross(incoming, outgoing) <= GEOMETRY_EPSILON * incomingLength * outgoingLength) {
      throw new RangeError(`${label} must remain strictly convex and non-self-intersecting.`);
    }
  }
  return winding;
}

/**
 * Insets a strictly convex closed polygon by intersecting adjacent shifted
 * supporting lines. Throws instead of changing a requested inset when the
 * sampled geometry would become degenerate or lose convexity.
 */
export function inwardOffsetConvexPolygon(
  vertices: readonly PlanarPoint[],
  insetMm: number,
): PlanarPoint[] {
  if (!Number.isFinite(insetMm) || insetMm <= 0) {
    throw new RangeError('Foundation elephant-foot inset must be finite and greater than zero.');
  }
  const winding = assertStrictlyConvex(vertices, 'Foundation outline');
  const lines: ShiftedLine[] = [];

  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    if (start === undefined || end === undefined) throw new RangeError('Foundation outline is incomplete.');
    const edge = subtract(end, start);
    const length = Math.hypot(edge.x, edge.y);
    if (length <= GEOMETRY_EPSILON) throw new RangeError('Foundation outline has a zero-length edge.');
    // The left normal points inward for CCW; reverse it for CW input.
    const inward = winding > 0
      ? { x: -edge.y / length, y: edge.x / length }
      : { x: edge.y / length, y: -edge.x / length };
    lines.push({
      start: { x: start.x + inward.x * insetMm, y: start.y + inward.y * insetMm },
      edge,
    });
  }

  assertShiftedInterior(lines, winding);

  const inset: PlanarPoint[] = [];
  for (let index = 0; index < vertices.length; index += 1) {
    const previous = (index - 1 + vertices.length) % vertices.length;
    const previousLine = lines[previous];
    const nextLine = lines[index];
    if (previousLine === undefined || nextLine === undefined) {
      throw new RangeError('Foundation inset construction is incomplete.');
    }
    const point = lineIntersection(previousLine, nextLine);
    if (point === undefined) {
      throw new RangeError('Foundation inset has parallel adjacent edges.');
    }
    inset.push(point);
  }
  assertStrictlyConvex(inset, 'Foundation inset');
  return inset;
}

/** Interpolates a closed polygon at a phase in [0, 1], retaining its seam. */
export function interpolateClosedOutline(vertices: readonly PlanarPoint[], phase: number): PlanarPoint {
  if (!Number.isFinite(phase) || phase < 0 || phase > 1) {
    throw new RangeError('Foundation contour phase must be between zero and one.');
  }
  if (vertices.length < 3) throw new RangeError('Foundation inset outline needs at least three vertices.');
  if (phase === 1) return vertices[0] as PlanarPoint;
  const position = phase * vertices.length;
  const index = Math.floor(position);
  const fraction = position - index;
  const from = vertices[index];
  const to = vertices[(index + 1) % vertices.length];
  if (from === undefined || to === undefined) throw new RangeError('Foundation inset outline is incomplete.');
  return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
}

/**
 * Interpolates a closed outline by its original, non-uniform contour phases.
 * `phases` includes the closing phase, so it has one more entry than vertices.
 */
export function interpolateClosedOutlineAtPhases(
  vertices: readonly PlanarPoint[],
  phases: readonly number[],
  phase: number,
): PlanarPoint {
  if (vertices.length < 3 || phases.length !== vertices.length + 1) {
    throw new RangeError('Foundation inset outline and phase table must close together.');
  }
  const total = phases.at(-1);
  if (total === undefined || !Number.isFinite(phase) || phase < 0 || phase > total) {
    throw new RangeError('Foundation contour phase is outside its outline table.');
  }
  if (phase === total) return vertices[0] as PlanarPoint;
  let low = 0;
  let high = vertices.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    const boundary = phases[middle];
    if (boundary === undefined) throw new RangeError('Foundation phase table is incomplete.');
    if (boundary <= phase) low = middle;
    else high = middle;
  }
  const from = vertices[low];
  const to = vertices[(low + 1) % vertices.length];
  const start = phases[low];
  const end = phases[low + 1];
  if (from === undefined || to === undefined || start === undefined || end === undefined || end <= start) {
    throw new RangeError('Foundation phase table is incomplete.');
  }
  const fraction = (phase - start) / (end - start);
  return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
}

/**
 * Splits a phase-mapped polygon boundary until each emitted chord is bounded.
 * This is used after a perpendicular inset because miter vertices can be
 * farther apart than the corresponding nominal samples.
 */
export function refinePhasedOutlineBySegmentLength(
  vertices: readonly PlanarPoint[],
  phases: readonly number[],
  maximumSegmentMm: number,
  maximumSegments: number,
): PhasedOutline {
  if (!Number.isFinite(maximumSegmentMm) || maximumSegmentMm <= 0
    || !Number.isSafeInteger(maximumSegments) || maximumSegments < 3
    || vertices.length < 3 || phases.length !== vertices.length + 1) {
    throw new RangeError('Foundation phased outline bounds are invalid.');
  }
  const resultVertices: PlanarPoint[] = [vertices[0] as PlanarPoint];
  const resultPhases: number[] = [phases[0] as number];
  const append = (
    from: PlanarPoint,
    fromPhase: number,
    to: PlanarPoint,
    toPhase: number,
    closing: boolean,
  ): void => {
    const lengthMm = Math.hypot(to.x - from.x, to.y - from.y);
    if (!Number.isFinite(lengthMm)) throw new RangeError('Foundation phased outline segment must be finite.');
    if (lengthMm <= maximumSegmentMm) {
      if (resultPhases.length > maximumSegments) {
        throw new RangeError(`Foundation contour would exceed the ${maximumSegments.toLocaleString('en-US')} event limit.`);
      }
      if (!closing) resultVertices.push(to);
      resultPhases.push(toPhase);
      return;
    }
    const middlePhase = (fromPhase + toPhase) / 2;
    if (!Number.isFinite(middlePhase) || middlePhase === fromPhase || middlePhase === toPhase) {
      throw new RangeError('Foundation phased outline cannot be refined within finite phase precision.');
    }
    const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    if (!Number.isFinite(middle.x) || !Number.isFinite(middle.y)) {
      throw new RangeError('Foundation phased outline midpoint must be finite.');
    }
    append(from, fromPhase, middle, middlePhase, false);
    append(middle, middlePhase, to, toPhase, closing);
  };
  for (let index = 0; index < vertices.length; index += 1) {
    const from = vertices[index];
    const to = vertices[(index + 1) % vertices.length];
    const fromPhase = phases[index];
    const toPhase = phases[index + 1];
    if (from === undefined || to === undefined || fromPhase === undefined || toPhase === undefined || toPhase <= fromPhase) {
      throw new RangeError('Foundation phase table is incomplete.');
    }
    append(from, fromPhase, to, toPhase, index === vertices.length - 1);
  }
  if (resultVertices.length + 1 !== resultPhases.length) {
    throw new RangeError('Foundation phased outline did not close.');
  }
  return { vertices: resultVertices, phases: resultPhases };
}
