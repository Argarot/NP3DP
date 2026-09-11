import type { Bounds, GeneratedToolpath, Recipe, ToolpathEvent, Vec3 } from '../domain/types.ts';
import { auditDraftGcode } from './audit.ts';
import {
  auditNumericTolerance,
  DRAFT_BED_CENTER_OFFSET_MM,
  EXTRUSION_DECIMAL_PLACES,
  FEED_DECIMAL_PLACES,
  formatDraftNumber,
  XYZ_DECIMAL_PLACES,
  validateDraftInput,
} from './validation.ts';

/**
 * Serializes motion-only experimental instructions. The result deliberately has
 * no temperatures, homing, purge, base generation, machine setup or end routine.
 * The UI should retain the `.gcode.txt` extension and draft framing.
 */
export function exportDraft(recipe: Recipe, path: GeneratedToolpath): string {
  const { filamentAreaMm2, expectations } = validateDraftInput(recipe, path);
  const blockingDiagnostic = path.diagnostics.find((diagnostic) => diagnostic.severity === 'error');
  if (blockingDiagnostic) {
    throw new Error(`Draft export is blocked by ${blockingDiagnostic.code}: ${blockingDiagnostic.message}`);
  }
  const first = eventStart(path.events[0]);
  const lines = [
    '; ================================================================',
    '; DRAFT WALL TOOLPATH — NOT A COMPLETE PRINT JOB',
    '; Missing machine start/end setup, temperatures, homing, purge and base.',
    '; Machine firmware, exact material SKU and hotend geometry are unrecorded.',
    '; No physical print, clearance, adhesion or filament-behaviour validation.',
    '; Download and retain this experiment as .gcode.txt.',
    '; ================================================================',
    '; Generator: NP3DP experimental deposition studio',
    `; Engine version: ${sanitizeComment(path.engineVersion)}`,
    `; Units: XYZ millimetres; feed millimetres/minute; E millimetres of filament`,
    `; Recipe: ${sanitizeComment(recipe.name)}`,
    `; Recipe schema: ${recipe.schemaVersion}`,
    `; Recipe key: ${sanitizeComment(path.recipeKey, 512)}`,
    '; Draft coordinate assumption: part centre offset to X90 Y90 on a nominal MINI 180 mm square bed.',
    '; Extrusion model: event volume / circular filament area; process flow is not applied again.',
    `; Numeric precision: XYZ ${XYZ_DECIMAL_PLACES} decimals; E ${EXTRUSION_DECIMAL_PLACES}; feed ${FEED_DECIMAL_PLACES}; dwell 1 ms.`,
    'G21',
    'G90',
    'M83',
    'G92 E0',
    `G0 ${formatPosition(first)} F${formatNumber(recipe.process.travelMmS * 60, FEED_DECIMAL_PLACES)}`,
  ];

  path.events.forEach((event, index) => emitEvent(lines, event, index, filamentAreaMm2));
  lines.push('; END DRAFT WALL TOOLPATH — no machine shutdown or park commands follow.');
  const text = `${lines.join('\n')}\n`;

  // Independent parsing catches modal/format drift in this adapter. Comparisons
  // allow only the serializer's declared decimal quantization.
  const audit = auditDraftGcode(text);
  if (audit.errors.length > 0) {
    throw new Error(`Draft export failed its independent audit: ${audit.errors.join(' ')}`);
  }
  const extrusionNumericTolerance = auditNumericTolerance(
    expectations.quantizedExtrusionMm,
    expectations.extrusionCommandCount,
  );
  const dwellNumericTolerance = auditNumericTolerance(
    expectations.quantizedDwellSeconds,
    expectations.dwellCommandCount,
  );
  const timeNumericTolerance = auditNumericTolerance(
    expectations.quantizedCommandedTimeSeconds,
    expectations.timedCommandCount,
  );
  const maximumCoordinate = Math.max(
    ...Object.values(expectations.machineBounds.min).map(Math.abs),
    ...Object.values(expectations.machineBounds.max).map(Math.abs),
  );
  const coordinateNumericTolerance = auditNumericTolerance(maximumCoordinate, 1);
  if (Math.abs(audit.extrusionMm - expectations.quantizedExtrusionMm) > extrusionNumericTolerance) {
    throw new Error('Draft export parsed extrusion does not match the per-event quantized commands.');
  }
  if (Math.abs(audit.extrusionMm - expectations.extrusionMm) > expectations.extrusionRoundingBoundMm + extrusionNumericTolerance) {
    throw new Error('Draft export extrusion exceeds its accumulated per-event E rounding bound.');
  }
  if (Math.abs(audit.dwellSeconds - expectations.quantizedDwellSeconds) > dwellNumericTolerance) {
    throw new Error('Draft export parsed dwell does not match the per-event quantized commands.');
  }
  if (Math.abs(audit.dwellSeconds - expectations.dwellSeconds) > expectations.dwellRoundingBoundSeconds + dwellNumericTolerance) {
    throw new Error('Draft export dwell time exceeds its accumulated millisecond rounding bound.');
  }
  if (Math.abs(audit.commandedTimeSeconds - expectations.quantizedCommandedTimeSeconds) > timeNumericTolerance) {
    throw new Error('Draft export parsed command time does not match the per-event quantized commands.');
  }
  if (Math.abs(audit.commandedTimeSeconds - expectations.commandedTimeSeconds) > expectations.commandedTimeRoundingBoundSeconds + timeNumericTolerance) {
    throw new Error('Draft export command time exceeds its accumulated per-event rounding bound.');
  }
  if (audit.moveCount !== expectations.moveCount) {
    throw new Error('Draft export move count does not match the generated events.');
  }
  if (!audit.bounds || !sameBounds(audit.bounds, expectations.machineBounds, coordinateNumericTolerance)) {
    throw new Error('Draft export coordinates do not match the generated toolpath bounds.');
  }

  return text;
}

function emitEvent(lines: string[], event: ToolpathEvent, index: number, filamentAreaMm2: number): void {
  switch (event.kind) {
    case 'extrude':
      lines.push(
        `G1 ${formatPosition(event.to)} E${formatNumber(event.volumeMm3 / filamentAreaMm2, EXTRUSION_DECIMAL_PLACES)} F${formatNumber(event.speedMmS * 60, FEED_DECIMAL_PLACES)}`,
      );
      return;
    case 'travel':
      lines.push(`G0 ${formatPosition(event.to)} F${formatNumber(event.speedMmS * 60, FEED_DECIMAL_PLACES)}`);
      return;
    case 'dwell':
      lines.push(`G4 P${formatIntegerMilliseconds(event.seconds)}`);
      return;
    case 'deposit':
      if (event.volumeMm3 === 0) {
        lines.push(`; DEPOSIT event=${index} band=${sanitizeComment(event.bandId)} at ${formatPosition(event.at)} volume=0 (no extrusion command)`);
        return;
      }
      lines.push(
        `G1 E${formatNumber(event.volumeMm3 / filamentAreaMm2, EXTRUSION_DECIMAL_PLACES)} F${formatNumber(event.volumeRateMm3S / filamentAreaMm2 * 60, FEED_DECIMAL_PLACES)}`,
      );
      return;
    case 'anchor':
      lines.push(`; ANCHOR band=${sanitizeComment(event.bandId)} at ${formatPosition(event.at)}`);
  }
}

function eventStart(event: ToolpathEvent | undefined): Vec3 {
  if (!event) throw new Error('Toolpath events must be non-empty.');
  return event.kind === 'extrude' || event.kind === 'travel' ? event.from : event.at;
}

function formatPosition(point: Vec3): string {
  return `X${formatNumber(point.x + DRAFT_BED_CENTER_OFFSET_MM.x, XYZ_DECIMAL_PLACES)} Y${formatNumber(point.y + DRAFT_BED_CENTER_OFFSET_MM.y, XYZ_DECIMAL_PLACES)} Z${formatNumber(point.z, XYZ_DECIMAL_PLACES)}`;
}

function formatNumber(value: number, decimalPlaces: number): string {
  return formatDraftNumber(value, decimalPlaces);
}

function formatIntegerMilliseconds(seconds: number): string {
  const milliseconds = Math.round(seconds * 1_000);
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
    throw new Error('Dwell cannot be represented as whole milliseconds.');
  }
  return String(milliseconds);
}

function sanitizeComment(value: string, maxLength = 160): string {
  const printable = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (printable || '(unnamed)').slice(0, maxLength);
}

function sameBounds(
  actual: Bounds,
  expected: Bounds,
  tolerance: number,
): boolean {
  return (['min', 'max'] as const).every((edge) =>
    (['x', 'y', 'z'] as const).every((axis) =>
      Math.abs(actual[edge][axis] - expected[edge][axis]) <= tolerance,
    ),
  );
}
