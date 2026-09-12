import type { Recipe, ToolpathEvent, Vec3 } from '../domain/types';
import { distance } from '../domain/math';
import type { JobDiagnostic, PreparedBuild, PrintSetup } from './types';

export const MINI_BED_MM = 180;
export const BED_CENTER_MM = 90;
export const PURGE_STRIP_Y_MM = 10;
export const FINISH_LIFT_MM = 5;

export interface CommandMetrics {
  maximumXySpeedMmS: number;
  maximumZSpeedMmS: number;
  maximumFlowMm3S: number;
  minimumZMm: number;
  maximumZMm: number;
}

export function inspectPrintJob(recipe: Recipe, setup: PrintSetup, build: PreparedBuild): { diagnostics: JobDiagnostic[]; metrics: CommandMetrics } {
  const diagnostics: JobDiagnostic[] = [];
  const add = (severity: JobDiagnostic['severity'], code: string, message: string, eventIndex?: number) => {
    if (!diagnostics.some((entry) => entry.code === code)) diagnostics.push({ severity, code, message, ...(eventIndex === undefined ? {} : { eventIndex }) });
  };
  const { printer, material, foundation } = setup;
  if (build.buildKey !== JSON.stringify({ recipe, foundation })) add('error', 'job.stale', 'The prepared build does not match these foundation and recipe settings. Regenerate it.');
  if (!foundation.enabled) add('error', 'job.foundation-required', 'Enable the foundation to export a complete job. Wall-only drafts remain available.');
  if (!/^5\.1\.2(?:\+\d+)?$/.test(printer.firmware)) add('error', 'printer.firmware', 'This adapter targets MINI Buddy firmware 5.1.2. Other versions need a reviewed adapter.');
  if (printer.hotend !== 'stock') add('error', 'printer.hotend', 'The current full-job adapter requires the stock MINI hotend. Modified or unknown hardware needs a reviewed setup.');
  if (Math.abs(printer.nozzleDiameterMm - 0.4) > 1e-9) add('error', 'printer.nozzle', 'The current MINI adapter is configured for a 0.4 mm nozzle.');
  if (Math.abs(recipe.process.filamentDiameterMm - 1.75) > 1e-9) add('error', 'printer.filament', 'The MINI adapter expects 1.75 mm filament. Review the recipe process settings.');
  if (printer.variant === 'unknown') add('info', 'printer.variant', 'MINI versus MINI+ is unconfirmed. The adapter uses shared MINI-family firmware commands; probe behaviour remains the installed firmware’s responsibility.');
  if (foundation.lineWidthMm < printer.nozzleDiameterMm * 0.8 || foundation.lineWidthMm > printer.nozzleDiameterMm * 2) add('warning', 'foundation.width', 'The foundation line width is unusual for this nozzle; inspect a first-layer coupon before using it for a vessel.');
  if (foundation.layerHeightMm > printer.nozzleDiameterMm * 0.8) add('warning', 'foundation.height', 'The foundation layer height exceeds 80% of nozzle diameter. Line contact is unverified.');
  if (material.nozzleC < 210 || material.nozzleC > 230 || material.firstLayerNozzleC < 210 || material.firstLayerNozzleC > 230) add('warning', 'material.temperature', 'The selected nozzle temperature is outside eSUN’s published 210–230 °C PLA Basic starting range. It remains an editable experiment.');

  const metrics: CommandMetrics = { maximumXySpeedMmS: 0, maximumZSpeedMmS: 0, maximumFlowMm3S: 0, minimumZMm: Infinity, maximumZMm: -Infinity };
  build.path.events.forEach((event, index) => {
    let radius = 0;
    if (event.kind === 'extrude') {
      const area = event.volumeMm3 / Math.max(distance(event.from, event.to), 1e-12);
      const buildBead = event.role === 'foundation' || event.role === 'transition' || event.role === 'rim';
      // Cover both the nominal bead width and the displayed rectangle, including
      // flow overrides. This bound does not model printhead clearance or spread.
      radius = buildBead
        ? Math.max(foundation.lineWidthMm * recipe.process.flowMultiplier / 2, Math.hypot(area / foundation.layerHeightMm, foundation.layerHeightMm) / 2)
        : Math.sqrt(area / Math.PI);
    } else if (event.kind === 'deposit') radius = Math.cbrt(3 * event.volumeMm3 / (4 * Math.PI));
    radius += 0.001; // Reserve more than one XYZ rounding half-step at bed edges.
    for (const point of points(event)) {
      metrics.minimumZMm = Math.min(metrics.minimumZMm, point.z);
      metrics.maximumZMm = Math.max(metrics.maximumZMm, point.z);
      if (point.x + BED_CENTER_MM - radius < 0 || point.x + BED_CENTER_MM + radius > MINI_BED_MM || point.y + BED_CENTER_MM - radius < 0 || point.y + BED_CENTER_MM + radius > MINI_BED_MM) add('error', 'bounds.bed', 'The path or nominal deposited width extends beyond the 180 × 180 mm bed. Reduce the size or pattern excursion.', index);
      if (point.y + BED_CENTER_MM - radius < PURGE_STRIP_Y_MM) add('error', 'bounds.purge-strip', 'The design enters the reserved front purge strip (Y < 10 mm). Reduce its extent before exporting with this adapter.', index);
      if (point.z < 0.05) add('error', 'bounds.below-bed', 'The prepared toolpath reaches below the minimum commanded Z of 0.05 mm.', index);
      if (point.z > MINI_BED_MM - FINISH_LIFT_MM) add('error', 'bounds.height', 'The path leaves insufficient space for the 5 mm finish lift within the 180 mm Z envelope.', index);
    }
    if (event.kind === 'extrude' || event.kind === 'travel') {
      const length = distance(event.from, event.to);
      if (length <= 1e-12) return;
      const xySpeed = Math.hypot(event.to.x - event.from.x, event.to.y - event.from.y) / length * event.speedMmS;
      const zSpeed = Math.abs(event.to.z - event.from.z) / length * event.speedMmS;
      metrics.maximumXySpeedMmS = Math.max(metrics.maximumXySpeedMmS, xySpeed);
      metrics.maximumZSpeedMmS = Math.max(metrics.maximumZSpeedMmS, zSpeed);
      if (xySpeed > printer.maxXySpeedMmS + 1e-6) add('error', 'motion.xy-limit', `A commanded XY speed exceeds the selected ${printer.maxXySpeedMmS} mm/s limit. Lower the process speed or review the limit.`, index);
      if (zSpeed > printer.maxZSpeedMmS + 1e-6) add('error', 'motion.z-limit', `A commanded Z speed exceeds the selected ${printer.maxZSpeedMmS} mm/s limit. Lower the process speed or pattern steepness.`, index);
      if (event.kind === 'extrude') {
        const flow = event.volumeMm3 / length * event.speedMmS;
        metrics.maximumFlowMm3S = Math.max(metrics.maximumFlowMm3S, flow);
        if (flow > material.maxFlowMm3S + 1e-6) add('error', 'flow.limit', `Commanded flow exceeds the selected ${material.maxFlowMm3S} mm³/s limit. Lower speed, strand diameter or flow multiplier.`, index);
      }
    } else if (event.kind === 'deposit') {
      if (event.volumeMm3 > 0) metrics.maximumFlowMm3S = Math.max(metrics.maximumFlowMm3S, event.volumeRateMm3S);
      if (event.volumeMm3 > 0 && event.volumeRateMm3S > material.maxFlowMm3S + 1e-6) add('error', 'flow.limit', `Stationary deposition exceeds the selected ${material.maxFlowMm3S} mm³/s flow limit.`, index);
    }
  });
  for (const diagnostic of build.path.diagnostics) {
    if (diagnostic.severity === 'error') add('error', diagnostic.code, diagnostic.message);
  }
  if (!build.path.events.some((event) => event.kind === 'extrude' && event.volumeMm3 > 0 && event.role !== 'foundation' && event.role !== 'transition')) add('error', 'job.no-wall-extrusion', 'The wall has no positive moving extrusion. Review flow before exporting a complete job.');
  add('warning', 'physical.untested', 'This newly generated job has no recorded physical result. The original control and A/B retries were reported successful; changed shapes or deposition methods require their own print observations.');
  if (recipe.bands.some((band) => band.kind === 'bridge' && (band.amplitudeMm !== 0 || band.radialAmplitudeMm !== 0))) {
    add('warning', 'bridge.retraced-post', 'The lifted bridge method extrudes down to an anchor and back up its post before the next span. Both passes add material. Use the zero-lift held-span comparison to isolate stationary anchoring and dwell; lifted posts need separate physical testing.');
  }
  if (recipe.bands.some((band) => band.kind === 'bridge' && band.amplitudeMm >= recipe.process.pitchMm && Math.abs(band.phaseAdvanceDeg % 360) < 1e-9 && Number.isInteger(band.repeatsPerTurn))) {
    add('warning', 'bridge.post-overlap', 'With aligned bridge anchors and lift at least as large as rise per turn, a later anchor can lie on or inside a previously deposited post. This is a geometric interaction in the original held-span study. Reduce lift or redesign the anchor sequence before using that experiment.');
  }
  if (build.attachment?.applicable && build.attachment.sampledGeometry.turns.some((turn) => turn.contactFractionEstimate === 0)) add('warning', 'attachment.missing', 'The circular-wave estimate finds a turn with no sampled matched-angle Z gap within the requested strand diameter. This matches a geometric problem in the failed original coupon; review rise per turn and attachment geometry.');
  add('warning', 'clearance.unknown', 'Bed and commanded-speed checks do not prove nozzle/fan-duct clearance or attachment to previous strands. Non-planar contact remains unmodelled.');
  add('info', 'motion.commanded', 'Speed, flow and duration are command-based estimates. Acceleration, pressure history, cooling, probe motion and thermal waits are not simulated.');
  return { diagnostics, metrics };
}

function points(event: ToolpathEvent): readonly Vec3[] {
  return event.kind === 'extrude' || event.kind === 'travel' ? [event.from, event.to] : [event.at];
}
