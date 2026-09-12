import { parseRecipe } from '../domain/recipe';
import type { Recipe, ToolpathEvent } from '../domain/types';
import { exportAuditedMotion } from '../export/draft';
import { auditNumericTolerance, validateDraftInput } from '../export/validation';
import { prepareBuild } from './prepare';
import { parsePrintSetup } from './setup';
import { inspectPrintJob } from './diagnostics';
import type { CommandMetrics } from './diagnostics';
import { auditMiniGcode } from './auditMini';
import type { MiniAudit } from './auditMini';
import type { JobDiagnostic, PreparedBuild, PrintSetup } from './types';
import { renderPrintThumbnail } from './thumbnail';
import { frameMiniThumbnailPrefix, qoiThumbnail } from './miniMetadata';
import { addMiniProgress } from './miniProgress';

export interface PrintJobResult {
  text: string | null;
  report: string;
  diagnostics: JobDiagnostic[];
  metrics: CommandMetrics;
  audit: MiniAudit | null;
}

/** Compile from the persisted inputs again at the export boundary. UI-cached
 * events can never substitute for a different setup or partially updated plan. */
export function compilePrintJob(recipeInput: Recipe, setupInput: PrintSetup): PrintJobResult {
  const recipe = parseRecipe(recipeInput), setup = parsePrintSetup(setupInput);
  const build = prepareBuild(recipe, setup.foundation);
  const inspected = inspectPrintJob(recipe, setup, build);
  const diagnostics = [...inspected.diagnostics];
  let text: string | null = null, audit: MiniAudit | null = null;
  if (!diagnostics.some((entry) => entry.severity === 'error')) {
    try {
      const program = serializeMiniJob(recipe, setup, build);
      audit = auditMiniGcode(program, setup);
      const { expectations } = validateDraftInput(recipe, build.path);
      if (Math.abs(audit.bodyExtrusionMm - expectations.quantizedExtrusionMm) > auditNumericTolerance(expectations.quantizedExtrusionMm, expectations.extrusionCommandCount)) audit.errors.push('Parsed body E does not match the independently validated quantized event total.');
      if (Math.abs(audit.bodyDwellSeconds - expectations.quantizedDwellSeconds) > auditNumericTolerance(expectations.quantizedDwellSeconds, expectations.dwellCommandCount)) audit.errors.push('Parsed body dwell does not match the quantized event total.');
      if (audit.bodyMoveCount !== expectations.moveCount) audit.errors.push('Parsed body motion count does not match the event plan and initial approach.');
      if (audit.errors.length) diagnostics.push({ severity: 'error', code: 'export.audit', message: audit.errors.slice(0, 3).join(' ') });
      else text = program;
    } catch (error) {
      diagnostics.push({ severity: 'error', code: 'export.representation', message: error instanceof Error ? error.message : 'Job export failed.' });
    }
  }
  const report = JSON.stringify({
    format: 'np3dp-print-report', schemaVersion: 1, engineVersion: build.path.engineVersion,
    adapterVersion: 'mini-5.1.2/2', project: { format: 'np3dp-project', schemaVersion: 2, recipe, setup },
    buildKey: build.buildKey, wallOffsetZMm: build.wallOffsetZMm, stages: build.stages,
    commandMetrics: inspected.metrics, toolpathStats: build.path.stats, diagnostics, audit,
    attachment: build.attachment,
    pathContact: build.pathContact,
    printerDisplay: { thumbnails: ['220x124/QOI', '200x240/QOI'], progress: 'M73 P/R, command-time estimate refreshed every 30 commanded seconds and after thermal/probe waits' },
    outputStatus: text ? 'software-checked-experimental-job' : 'blocked',
    physicalStatus: 'unprinted; no nozzle-clearance or calibrated material simulation',
    previewModels: { wall: 'circular volume-equivalent strand', foundation: 'flattened volume-equivalent rectangle', transitionAndRim: 'sloped flattened approximation', stationaryDeposit: 'volume-equivalent sphere', physicalSolver: null },
    durationScope: 'Commanded motion, extrusion and dwell only; thermal waits, homing, probing, acceleration and firmware planning excluded.',
    observations: { printed: false, date: null, sheet: null, filamentColor: setup.material.color, adhesion: null, measuredDiameterMm: null, measuredWallMm: null, sagMm: null, notes: '' },
  }, null, 2);
  return { text, report, diagnostics, metrics: inspected.metrics, audit };
}

function serializeMiniJob(recipe: Recipe, setup: PrintSetup, build: PreparedBuild): string {
  const motion = exportAuditedMotion(recipe, build.path);
  const first = start(build.path.events[0]!);
  const lastEvent = build.path.events.at(-1)!;
  const last = lastEvent.kind === 'extrude' || lastEvent.kind === 'travel' ? lastEvent.to : lastEvent.at;
  const { material, printer, foundation } = setup;
  const adapterTravelFeed = number(Math.min(50, printer.maxXySpeedMmS) * 60);
  const purgeFeed = (lengthMm: number, extrusionMm: number, requestedFeed: number) => {
    const bounded = Math.min(requestedFeed, printer.maxXySpeedMmS * 60, 0.9 * material.maxFlowMm3S * 60 * lengthMm / (extrusionMm * Math.PI * (1.75 / 2) ** 2));
    return (Math.floor(bounded * 1000) / 1000).toFixed(3);
  };
  const commands = [
    '; NP3DP — experimental MINI-family job',
    `; Recipe: ${comment(recipe.name)}`,
    `; Engine: ${build.path.engineVersion}; adapter: mini-5.1.2/2`,
    `; Target firmware: ${comment(printer.firmware)}; variant: ${printer.variant}; nozzle: 0.4 mm`,
    `; Material: ${comment(material.name)}; colour: ${material.color}`,
    '; Software-checked commands. Physical printability and printhead clearance are unvalidated.',
    '; Complete first-layer calibration for the installed sheet before the first control print.',
    '; Pressure advance disabled for this experiment; firmware input-shaper tuning is retained.',
    '; Nominal duration excludes heating, probing, homing and firmware dynamics.',
    'M862.3 P"MINI"', 'M862.1 P0.4',
    'G21', 'G90', 'M83', 'M200 D0', 'M220 S100', 'M221 S100', 'M572 S0 W0.04',
    `M204 P${number(printer.accelerationMmS2)} R${number(printer.accelerationMmS2)} T${number(printer.accelerationMmS2)}`,
    'M107', `M140 S${number(material.firstLayerBedC)}`, 'M104 S170',
    ...(Number(number(material.firstLayerBedC)) > 0 ? [`M190 R${number(material.firstLayerBedC)}`] : []),
    'M109 R170', 'G28', 'G29',
    'G0 Z2.000 F120.000', `G0 X5.000 Y6.000 F${adapterTravelFeed}`,
    `M109 R${number(material.firstLayerNozzleC)}`, 'G92 E0',
    '; PURGE: two moving intro segments at Y6; second segment must be continuous',
    'G0 Z0.200 F120.000', `G1 X65.000 Y6.000 E8.00000 F${purgeFeed(60, 8, 840)}`,
    `G1 X135.000 Y6.000 E10.00000 F${purgeFeed(70, 10, 700)}`, 'G92 E0',
    'G0 Z2.000 F120.000',
    `G0 X${number(first.x + 90)} Y${number(first.y + 90)} F${number(Math.min(recipe.process.travelMmS, printer.maxXySpeedMmS) * 60)}`,
    'G92 E0', '; NP3DP_PHASE body',
    `G0 X${number(first.x + 90)} Y${number(first.y + 90)} Z${number(first.z)} F120.000`,
  ];
  let bodyTemperature = false;
  const stages = new Map(build.stages.map((stage) => [stage.startEvent, stage.kind]));
  for (let index = 0; index < build.path.events.length; index++) {
    const event = build.path.events[index]!;
    const stage = stages.get(index);
    if (stage) commands.push(`; STAGE ${stage}`);
    if (!bodyTemperature && event.kind === 'extrude' && Number(number(event.to.z)) > Number(number(foundation.layerHeightMm)) + 0.0001) {
      commands.push(`${material.nozzleC > material.firstLayerNozzleC ? 'M109 R' : 'M104 S'}${number(material.nozzleC)}`);
      commands.push(`${material.bedC > material.firstLayerBedC ? 'M190 R' : 'M140 S'}${number(material.bedC)}`);
      bodyTemperature = true;
    }
    if (stage === 'transition') commands.push(`M106 S${Math.round(material.fanPercent * 255 / 100)}`);
    commands.push(...motion.eventCommands[index]!);
  }
  const liftZ = Math.max(last.z, build.path.stats.bounds.max.z) + 5;
  commands.push('; NP3DP_PHASE finish', 'G1 E-0.80000 F1200.000',
    `G0 Z${number(liftZ)} F120.000`, `G0 X10.000 Y170.000 F${adapterTravelFeed}`,
    'M400', 'M104 S0', 'M140 S0', 'M107', 'M572 S0', 'M221 S100', 'M84',
    '; END NP3DP EXPERIMENT');
  const thumbnails = frameMiniThumbnailPrefix([[220, 124], [200, 240]].map(([width, height]) => qoiThumbnail(renderPrintThumbnail(build.path, foundation, width!, height!))));
  return addMiniProgress(`${thumbnails}${commands.join('\n')}\n`).text;
}

function number(value: number): string { if (!Number.isFinite(value)) throw new Error('Non-finite machine parameter.'); return value.toFixed(3); }
function start(event: ToolpathEvent) { return event.kind === 'extrude' || event.kind === 'travel' ? event.from : event.at; }
function comment(value: string): string { return value.replace(/[\r\n\x00-\x1f\x7f]/g, ' ').slice(0, 140); }
