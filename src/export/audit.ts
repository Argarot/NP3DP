import type { Bounds, Vec3 } from '../domain/types.ts';

export interface DraftGcodeAudit {
  extrusionMm: number;
  dwellSeconds: number;
  /** G0/G1 command count, including the initial approach and stationary extrusion. */
  moveCount: number;
  bounds: Bounds | null;
  /** Excludes the initial approach because its starting machine position is unknown. */
  commandedTimeSeconds: number;
  errors: string[];
  modalState: {
    units: 'millimetres' | 'unknown';
    xyzMode: 'absolute' | 'unknown';
    extrusionMode: 'relative' | 'unknown';
    extrusionOriginReset: boolean;
  };
}

type Parameters = Record<string, number>;

/**
 * Parses only the deliberately small dialect emitted by exportDraft. Unknown
 * opcodes, unsupported parameters and incomplete modal setup are reported.
 */
export function auditDraftGcode(text: string): DraftGcodeAudit {
  const errors: string[] = [];
  let units: DraftGcodeAudit['modalState']['units'] = 'unknown';
  let xyzMode: DraftGcodeAudit['modalState']['xyzMode'] = 'unknown';
  let extrusionMode: DraftGcodeAudit['modalState']['extrusionMode'] = 'unknown';
  let extrusionOriginReset = false;
  let current: Vec3 | undefined;
  let resultBounds: Bounds | null = null;
  let extrusionMm = 0;
  let dwellSeconds = 0;
  let moveCount = 0;
  let commandedTimeSeconds = 0;

  const lines = text.split(/\r?\n/);
  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const commandText = rawLine.split(';', 1)[0]?.trim() ?? '';
    if (!commandText) continue;

    const tokens = commandText.toUpperCase().split(/\s+/);
    const opcode = tokens.shift();
    if (!opcode || !/^[GMT]\d+$/.test(opcode)) {
      errors.push(`Line ${lineNumber}: malformed or unsupported opcode.`);
      continue;
    }
    const parameters = parseParameters(tokens, lineNumber, errors);
    if (!parameters) continue;

    switch (opcode) {
      case 'G21':
        requireKeys(parameters, [], lineNumber, errors);
        units = 'millimetres';
        break;
      case 'G90':
        requireKeys(parameters, [], lineNumber, errors);
        xyzMode = 'absolute';
        break;
      case 'M83':
        requireKeys(parameters, [], lineNumber, errors);
        extrusionMode = 'relative';
        break;
      case 'G92':
        if (requireKeys(parameters, ['E'], lineNumber, errors) && parameters.E === 0) {
          extrusionOriginReset = true;
        } else if (parameters.E !== 0) {
          errors.push(`Line ${lineNumber}: draft dialect only permits G92 E0.`);
        }
        break;
      case 'G0':
        parseTravel(parameters, lineNumber);
        break;
      case 'G1':
        parseExtrusion(parameters, lineNumber);
        break;
      case 'G4':
        if (requireKeys(parameters, ['P'], lineNumber, errors)) {
          const milliseconds = parameters.P;
          if (milliseconds === undefined || milliseconds < 0 || !Number.isInteger(milliseconds)) {
            errors.push(`Line ${lineNumber}: G4 P must be non-negative whole milliseconds.`);
          } else {
            dwellSeconds += milliseconds / 1_000;
            commandedTimeSeconds += milliseconds / 1_000;
          }
        }
        break;
      default:
        errors.push(`Line ${lineNumber}: unsupported opcode ${opcode}.`);
    }
  }

  if (units !== 'millimetres') errors.push('Missing G21 millimetre mode.');
  if (xyzMode !== 'absolute') errors.push('Missing G90 absolute XYZ mode.');
  if (extrusionMode !== 'relative') errors.push('Missing M83 relative extrusion mode.');
  if (!extrusionOriginReset) errors.push('Missing G92 E0 extrusion reset.');

  return {
    extrusionMm,
    dwellSeconds,
    moveCount,
    bounds: resultBounds,
    commandedTimeSeconds,
    errors,
    modalState: { units, xyzMode, extrusionMode, extrusionOriginReset },
  };

  function modalReady(lineNumber: number): boolean {
    const ready = units === 'millimetres'
      && xyzMode === 'absolute'
      && extrusionMode === 'relative'
      && extrusionOriginReset;
    if (!ready) errors.push(`Line ${lineNumber}: motion appears before complete G21/G90/M83/G92 E0 setup.`);
    return ready;
  }

  function parseTravel(parameters: Parameters, lineNumber: number): void {
    modalReady(lineNumber);
    if (!requireKeys(parameters, ['X', 'Y', 'Z', 'F'], lineNumber, errors)) return;
    const next = xyz(parameters);
    const feed = parameters.F;
    if (!next || feed === undefined || feed <= 0) {
      errors.push(`Line ${lineNumber}: G0 requires finite XYZ and positive F.`);
      return;
    }
    moveCount += 1;
    if (current) commandedTimeSeconds += distance(current, next) / (feed / 60);
    current = next;
    resultBounds = includePoint(resultBounds, next);
  }

  function parseExtrusion(parameters: Parameters, lineNumber: number): void {
    modalReady(lineNumber);
    const keys = Object.keys(parameters).sort();
    const moving = sameKeys(keys, ['E', 'F', 'X', 'Y', 'Z']);
    const stationary = sameKeys(keys, ['E', 'F']);
    if (!moving && !stationary) {
      errors.push(`Line ${lineNumber}: G1 must be XYZEF motion or EF stationary extrusion.`);
      return;
    }
    const e = parameters.E;
    const feed = parameters.F;
    if (e === undefined || e < 0 || feed === undefined || feed <= 0) {
      errors.push(`Line ${lineNumber}: G1 requires non-negative E and positive F.`);
      return;
    }
    if (extrusionMode !== 'relative') {
      errors.push(`Line ${lineNumber}: G1 E requires M83 relative extrusion mode.`);
    }
    moveCount += 1;
    extrusionMm += e;
    if (moving) {
      const next = xyz(parameters);
      if (!next || !current) {
        errors.push(`Line ${lineNumber}: moving G1 requires a prior full G0 position.`);
        return;
      }
      commandedTimeSeconds += distance(current, next) / (feed / 60);
      current = next;
      resultBounds = includePoint(resultBounds, next);
    } else {
      commandedTimeSeconds += e / (feed / 60);
    }
  }
}

function parseParameters(tokens: string[], lineNumber: number, errors: string[]): Parameters | undefined {
  const result: Parameters = {};
  for (const token of tokens) {
    const match = /^([A-Z])([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/.exec(token);
    if (!match) {
      errors.push(`Line ${lineNumber}: malformed parameter ${token}.`);
      return undefined;
    }
    const letter = match[1];
    const source = match[2];
    if (!letter || !source) {
      errors.push(`Line ${lineNumber}: malformed parameter ${token}.`);
      return undefined;
    }
    if (Object.hasOwn(result, letter)) {
      errors.push(`Line ${lineNumber}: duplicate ${letter} parameter.`);
      return undefined;
    }
    const value = Number(source);
    if (!Number.isFinite(value)) {
      errors.push(`Line ${lineNumber}: ${letter} is not finite.`);
      return undefined;
    }
    result[letter] = Object.is(value, -0) ? 0 : value;
  }
  return result;
}

function requireKeys(parameters: Parameters, expected: readonly string[], lineNumber: number, errors: string[]): boolean {
  const actual = Object.keys(parameters).sort();
  const wanted = [...expected].sort();
  if (!sameKeys(actual, wanted)) {
    errors.push(`Line ${lineNumber}: expected parameters ${wanted.join('') || '(none)'}, received ${actual.join('') || '(none)'}.`);
    return false;
  }
  return true;
}

function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

function xyz(parameters: Parameters): Vec3 | undefined {
  const x = parameters.X;
  const y = parameters.Y;
  const z = parameters.Z;
  return x === undefined || y === undefined || z === undefined ? undefined : { x, y, z };
}

function includePoint(bounds: Bounds | null, point: Vec3): Bounds {
  if (!bounds) return { min: { ...point }, max: { ...point } };
  return {
    min: {
      x: Math.min(bounds.min.x, point.x),
      y: Math.min(bounds.min.y, point.y),
      z: Math.min(bounds.min.z, point.z),
    },
    max: {
      x: Math.max(bounds.max.x, point.x),
      y: Math.max(bounds.max.y, point.y),
      z: Math.max(bounds.max.z, point.z),
    },
  };
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}
