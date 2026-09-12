import type { Recipe } from '../domain/types';
import { parsePrintSetup } from './setup';
import type { PrintSetup } from './types';

export interface ProfileImportChange { field: string; before: string; after: string }
export interface ProfileImportResult {
  setup: PrintSetup;
  process: Partial<Recipe['process']>;
  changes: ProfileImportChange[];
  warnings: string[];
}

const MAX_PROFILE_TEXT_BYTES = 1_000_000;
const MAX_LINES = 10_000;
const MAX_REPORTED_ITEMS = 1_000;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const UNSAFE_KEY = /(gcode|macro|post_process|script)/i;
const INHERITANCE_KEY = 'inherits';
const COMPATIBILITY_KEYS = new Set(['compatible_prints_condition', 'compatible_printers_condition', 'compatible_printers', 'compatible_prints']);

/**
 * Imports a single, flattened PrusaSlicer exported configuration. Values only
 * become proposals for the review UI; this function never runs a macro or
 * writes any printer command.
 */
export async function importPrusaConfig(text: string, filename: string, current: PrintSetup): Promise<ProfileImportResult> {
  if (new TextEncoder().encode(text).byteLength > MAX_PROFILE_TEXT_BYTES) {
    throw new Error(`PrusaSlicer configuration exceeds the ${MAX_PROFILE_TEXT_BYTES}-byte limit.`);
  }
  if (typeof filename !== 'string' || filename.length < 1 || filename.length > 255 || CONTROL.test(filename)) {
    throw new Error('Invalid import filename.');
  }
  if (CONTROL.test(text)) throw new Error('PrusaSlicer configuration contains unsupported control characters.');

  const settings = parseFlatConfig(text);
  const setup = parsePrintSetup(current);
  const draft: PrintSetup = structuredClone(setup);
  const process: Partial<Recipe['process']> = {};
  const changes: ProfileImportChange[] = [];
  const warnings: string[] = [];
  const mapped: string[] = [];
  const ignored: string[] = [];
  let hardwareFound = false;
  let ordinaryIgnoredCount = 0;
  const unsafeKeys: string[] = [];
  const importedTargets = new Set<ImportedTarget>();
  let printVolumetricSpeed: number | undefined;
  let filamentVolumetricSpeed: number | undefined;
  // Source identity is per-file. Never inherit a previous file's profile names
  // or slicer version merely because its resolved setup is a useful baseline.
  let importedPrinterProfile = '';
  let importedFilamentProfile = '';
  let importedSlicerVersion = '';
  const explicitHardware = hasExplicitMiniHardware(settings);

  for (const [key, value] of settings) {
    if (key === INHERITANCE_KEY) {
      if (value) throw new Error('Unsupported unresolved profile field "inherits". Export one flattened configuration without inheritance.');
      report(ignored, key, 'ignored settings');
      report(warnings, 'Ignored an empty inherits field; no inherited settings were evaluated.', 'warnings');
      continue;
    }
    if (COMPATIBILITY_KEYS.has(key)) {
      if (value && !explicitHardware) throw new Error(`Cannot safely ignore "${key}" without explicit compatible MINI hardware fields.`);
      report(ignored, key, 'ignored settings');
      report(warnings, value
        ? `Ignored compatibility selector "${key}" after explicit MINI hardware fields resolved the source; its expression was not evaluated.`
        : `Ignored empty compatibility selector "${key}"; no expression was evaluated.`, 'warnings');
      continue;
    }
    if (UNSAFE_KEY.test(key)) {
      report(ignored, key, 'ignored settings');
      report(unsafeKeys, key, 'unsafe settings');
      continue;
    }

    switch (key) {
      case 'nozzle_diameter': {
        const number = parseScalarNumber(value, key);
        setSetup(draft, 'printer.nozzleDiameterMm', number, changes);
        importedTargets.add('printer.nozzleDiameterMm');
        report(mapped, key, 'mapped settings');
        break;
      }
      case 'filament_diameter': {
        const number = parseScalarNumber(value, key);
        expectRange(number, 1, 3, key);
        process.filamentDiameterMm = number;
        importedTargets.add('process.filamentDiameterMm');
        changes.push({ field: 'process.filamentDiameterMm', before: 'current recipe not supplied', after: format(number) });
        report(mapped, key, 'mapped settings');
        break;
      }
      case 'extrusion_multiplier': {
        const number = parseScalarNumber(value, key);
        expectRange(number, 0.1, 3, key);
        process.flowMultiplier = number;
        importedTargets.add('process.flowMultiplier');
        changes.push({ field: 'process.flowMultiplier', before: 'current recipe not supplied', after: format(number) });
        report(mapped, key, 'mapped settings');
        break;
      }
      case 'temperature': mapNumber(draft, 'material.nozzleC', value, key, changes, mapped, importedTargets); break;
      case 'first_layer_temperature': mapNumber(draft, 'material.firstLayerNozzleC', value, key, changes, mapped, importedTargets); break;
      case 'bed_temperature': mapNumber(draft, 'material.bedC', value, key, changes, mapped, importedTargets); break;
      case 'first_layer_bed_temperature': mapNumber(draft, 'material.firstLayerBedC', value, key, changes, mapped, importedTargets); break;
      case 'max_volumetric_speed':
        printVolumetricSpeed = parseScalarNumber(value, key);
        if (printVolumetricSpeed < 0) throw new Error('Invalid scalar numeric value for "max_volumetric_speed".');
        report(mapped, key, 'mapped settings');
        break;
      case 'filament_max_volumetric_speed':
        filamentVolumetricSpeed = parseScalarNumber(value, key);
        if (filamentVolumetricSpeed < 0) throw new Error('Invalid scalar numeric value for "filament_max_volumetric_speed".');
        report(mapped, key, 'mapped settings');
        break;
      case 'max_fan_speed': mapNumber(draft, 'material.fanPercent', value, key, changes, mapped, importedTargets); break;
      case 'layer_height': mapNumber(draft, 'foundation.layerHeightMm', value, key, changes, mapped, importedTargets); break;
      case 'elefant_foot_compensation': mapNumber(draft, 'foundation.elephantFootMm', value, key, changes, mapped, importedTargets); break;
      case 'extrusion_width': {
        const number = parseScalarNumber(value, key);
        if (number === 0) {
          report(ignored, key, 'ignored settings');
          report(warnings, 'extrusion_width=0 means automatic width and remains unresolved; the current explicit line width was retained.', 'warnings');
        } else {
          setSetup(draft, 'foundation.lineWidthMm', number, changes);
          importedTargets.add('foundation.lineWidthMm');
          report(mapped, key, 'mapped settings');
        }
        break;
      }
      case 'first_layer_height': {
        // The current foundation model has no separate first-layer-height field.
        parseScalarNumber(value, key);
        report(ignored, key, 'ignored settings');
        report(warnings, 'first_layer_height was reviewed but is not represented by the current foundation model.', 'warnings');
        break;
      }
      case 'machine_max_feedrate_x': {
        const number = parseMachineLimit(value, key, warnings);
        applyConservativeXyLimit(draft, number, key, changes, mapped, warnings, importedTargets);
        break;
      }
      case 'machine_max_feedrate_y': {
        const number = parseMachineLimit(value, key, warnings);
        applyConservativeXyLimit(draft, number, key, changes, mapped, warnings, importedTargets);
        break;
      }
      case 'machine_max_feedrate_z': {
        const number = parseMachineLimit(value, key, warnings);
        if (number < draft.printer.maxZSpeedMmS) setSetup(draft, 'printer.maxZSpeedMmS', number, changes);
        else report(warnings, `Retained the current conservative Z command ceiling; "${key}" is not lower.`, 'warnings');
        importedTargets.add('printer.maxZSpeedMmS');
        report(mapped, key, 'mapped settings');
        break;
      }
      case 'machine_max_acceleration_x':
      case 'machine_max_acceleration_y': {
        const number = parseMachineLimit(value, key, warnings);
        if (number <= 0) throw new Error(`Invalid scalar numeric value for "${key}".`);
        if (number < draft.printer.accelerationMmS2) setSetup(draft, 'printer.accelerationMmS2', number, changes);
        else report(warnings, `Retained the current conservative acceleration ceiling; "${key}" is not lower.`, 'warnings');
        importedTargets.add('printer.accelerationMmS2');
        report(mapped, key, 'mapped settings');
        break;
      }
      case 'bed_shape': {
        validateMiniBed(value);
        hardwareFound = true;
        report(mapped, key, 'mapped settings');
        break;
      }
      case 'max_print_height': {
        if (parseScalarNumber(value, key) !== 180) throw new Error('Unsupported machine: max_print_height must be 180 mm for the MINI adapter.');
        hardwareFound = true;
        report(mapped, key, 'mapped settings');
        break;
      }
      case 'printer_model': {
        hardwareFound = true;
        if (value === 'MINI' || value === 'MINIIS') {
          report(warnings, `printer_model=${value} identifies a Prusa MINI profile family, not the physical MINI/MINI+ variant; retained the user-selected variant.`, 'warnings');
        }
        else throw new Error(`Unsupported printer_model "${value}" for the MINI adapter.`);
        report(mapped, key, 'mapped settings');
        break;
      }
      case 'filament_settings_id':
        importedFilamentProfile = parseProfileName(value, key);
        report(mapped, key, 'mapped settings');
        break;
      case 'printer_settings_id':
        importedPrinterProfile = parseProfileName(value, key);
        report(mapped, key, 'mapped settings');
        break;
      case 'config_version':
        importedSlicerVersion = parseProfileName(value, key);
        report(mapped, key, 'mapped settings');
        break;
      default:
        report(ignored, key, 'ignored settings');
        ordinaryIgnoredCount += 1;
    }
  }

  if (unsafeKeys.length) report(warnings, `Ignored unsafe setting${unsafeKeys.length === 1 ? '' : 's'} ${unsafeKeys.join(', ')}; embedded commands are never executed.`, 'warnings');
  if (ordinaryIgnoredCount) report(warnings, `Ignored ${ordinaryIgnoredCount} unsupported flattened slicer setting${ordinaryIgnoredCount === 1 ? '' : 's'}; every key is recorded in provenance.`, 'warnings');
  applyVolumetricLimits(draft, printVolumetricSpeed, filamentVolumetricSpeed, changes, warnings, importedTargets);
  if (!hardwareFound) report(warnings, 'No recognized printer hardware field was exported; review MINI/MINI+ compatibility before applying this proposal.', 'warnings');
  const detectedVersion = detectSlicerVersion(text);
  draft.provenance = {
    source: 'prusaslicer-config',
    filename,
    digest: await sha256(text),
    slicerVersion: importedSlicerVersion || detectedVersion,
    printerProfile: importedPrinterProfile,
    filamentProfile: importedFilamentProfile,
    importedValues: collectImportedValues(draft, process, importedTargets),
    mappedFields: mapped,
    ignoredFields: ignored,
    warnings,
  };
  return { setup: parsePrintSetup(draft), process, changes, warnings };
}

function parseFlatConfig(text: string): Map<string, string> {
  const lines = text.split(/\r?\n/);
  if (lines.length > MAX_LINES) throw new Error(`PrusaSlicer configuration exceeds the ${MAX_LINES}-line limit.`);
  const result = new Map<string, string>();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    if (line.startsWith('[') || line.endsWith(']')) throw new Error(`Unsupported vendor bundle section at line ${index + 1}; export one flattened configuration.`);
    const equals = line.indexOf('=');
    if (equals < 1) throw new Error(`Malformed configuration line ${index + 1}: expected key = value.`);
    const key = line.slice(0, equals).trim();
    const value = line.slice(equals + 1).trim();
    if (!KEY_PATTERN.test(key)) throw new Error(`Malformed configuration line ${index + 1}.`);
    if (result.has(key)) throw new Error(`Duplicate configuration key "${key}" at line ${index + 1}.`);
    result.set(key, value);
  }
  if (result.size === 0) throw new Error('PrusaSlicer configuration contains no settings.');
  return result;
}

function parseScalarNumber(value: string, key: string): number {
  if (value.includes('%')) throw new Error(`Unsupported percentage value for "${key}"; export an explicit numeric value.`);
  if (/[;,]/.test(value) || !NUMBER_PATTERN.test(value)) throw new Error(`Invalid scalar numeric value for "${key}"; arrays and expressions are unsupported.`);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid scalar numeric value for "${key}".`);
  return number;
}

/** Machine-rate pairs represent normal/quiet modes, not independent extruders. */
function parseMachineLimit(value: string, key: string, warnings: string[]): number {
  if (value.includes('%')) throw new Error(`Unsupported percentage value for "${key}"; export explicit numeric machine limits.`);
  const values = value.split(',').map((part) => part.trim());
  if (values.length < 1 || values.length > 2 || values.some((part) => !NUMBER_PATTERN.test(part))) {
    throw new Error(`Invalid machine limit for "${key}"; expected one numeric value or a normal/quiet pair.`);
  }
  const numbers = values.map(Number);
  if (numbers.some((number) => !Number.isFinite(number) || number <= 0)) throw new Error(`Invalid machine limit for "${key}".`);
  if (numbers.length === 2) report(warnings, `Consolidated normal/quiet machine modes from "${key}" to their conservative minimum.`, 'warnings');
  return Math.min(...numbers);
}

function applyVolumetricLimits(draft: PrintSetup, printLimit: number | undefined, filamentLimit: number | undefined, changes: ProfileImportChange[], warnings: string[], importedTargets: Set<ImportedTarget>): void {
  const positive = [printLimit, filamentLimit].filter((value): value is number => value !== undefined && value > 0);
  if (printLimit === 0) report(warnings, 'max_volumetric_speed=0 means no print-profile cap; retained the selected limit unless a positive filament cap is present.', 'warnings');
  if (filamentLimit === 0) report(warnings, 'filament_max_volumetric_speed=0 means no filament cap.', 'warnings');
  if (!positive.length) return;
  const effective = Math.min(...positive);
  setSetup(draft, 'material.maxFlowMm3S', effective, changes);
  importedTargets.add('material.maxFlowMm3S');
  if (positive.length === 2) report(warnings, 'Used the lower positive print/filament volumetric-flow cap.', 'warnings');
}

function hasExplicitMiniHardware(settings: ReadonlyMap<string, string>): boolean {
  const model = settings.get('printer_model');
  if (model === 'MINI' || model === 'MINIIS') return true;
  return isMiniBedShape(settings.get('bed_shape') ?? '') && settings.get('max_print_height') === '180';
}

function parseProfileName(value: string, key: string): string {
  if (value.length > 160 || CONTROL.test(value) || /[\[\]]/.test(value)) throw new Error(`Invalid profile identifier for "${key}".`);
  return value;
}

function validateMiniBed(value: string): void {
  if (!isMiniBedShape(value)) {
    throw new Error('Unsupported bed_shape: the MINI adapter requires the 0..180 mm rectangular bed.');
  }
}

function isMiniBedShape(value: string): boolean {
  const corners = value.split(',').map((point) => point.trim());
  const expected = new Set(['0x0', '180x0', '180x180', '0x180']);
  return corners.length === 4 && !corners.some((point) => !expected.delete(point)) && expected.size === 0;
}

function mapNumber(draft: PrintSetup, field: SetupNumberField, value: string, key: string, changes: ProfileImportChange[], mapped: string[], importedTargets: Set<ImportedTarget>): void {
  setSetup(draft, field, parseScalarNumber(value, key), changes);
  importedTargets.add(field);
  report(mapped, key, 'mapped settings');
}

function applyConservativeXyLimit(draft: PrintSetup, number: number, key: string, changes: ProfileImportChange[], mapped: string[], warnings: string[], importedTargets: Set<ImportedTarget>): void {
  if (number <= 0) throw new Error(`Invalid scalar numeric value for "${key}".`);
  if (number < draft.printer.maxXySpeedMmS) setSetup(draft, 'printer.maxXySpeedMmS', number, changes);
  else report(warnings, `Retained the current conservative XY command ceiling; "${key}" is not lower.`, 'warnings');
  importedTargets.add('printer.maxXySpeedMmS');
  report(mapped, key, 'mapped settings');
}

type SetupNumberField = 'printer.nozzleDiameterMm' | 'printer.maxXySpeedMmS' | 'printer.maxZSpeedMmS' | 'printer.accelerationMmS2' | 'material.nozzleC' | 'material.firstLayerNozzleC' | 'material.bedC' | 'material.firstLayerBedC' | 'material.maxFlowMm3S' | 'material.fanPercent' | 'foundation.layerHeightMm' | 'foundation.lineWidthMm' | 'foundation.elephantFootMm';
type SetupStringField = 'printer.variant' | 'provenance.filamentProfile' | 'provenance.printerProfile' | 'provenance.slicerVersion';
type ImportedTarget = SetupNumberField | 'process.filamentDiameterMm' | 'process.flowMultiplier';

function setSetup(draft: PrintSetup, field: SetupNumberField | SetupStringField, value: number | string, changes: ProfileImportChange[]): void {
  const [section, property] = field.split('.') as [keyof Pick<PrintSetup, 'printer' | 'material' | 'foundation' | 'provenance'>, string];
  const target = draft[section] as unknown as Record<string, number | string>;
  const before = target[property];
  if (before !== value) {
    target[property] = value;
    changes.push({ field, before: format(before), after: format(value) });
  }
}

function expectRange(value: number, min: number, max: number, key: string): void {
  if (value < min || value > max) throw new Error(`Invalid value for "${key}": expected ${min} to ${max}.`);
}

function report(target: string[], message: string, label: string): void {
  if (target.length >= MAX_REPORTED_ITEMS) throw new Error(`Too many ${label}; the ${MAX_REPORTED_ITEMS}-item limit was exceeded.`);
  target.push(message);
}

function format(value: number | string | undefined): string { return String(value); }

function collectImportedValues(draft: PrintSetup, process: Partial<Recipe['process']>, targets: ReadonlySet<ImportedTarget>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const target of targets) {
    if (target.startsWith('process.')) {
      const property = target.slice('process.'.length) as keyof Recipe['process'];
      const value = process[property];
      if (typeof value === 'number') result[target] = format(value);
      continue;
    }
    const [section, property] = target.split('.') as [keyof Pick<PrintSetup, 'printer' | 'material' | 'foundation'>, string];
    const value = (draft[section] as unknown as Record<string, number>)[property];
    if (typeof value === 'number') result[target] = format(value);
  }
  return result;
}

function detectSlicerVersion(text: string): string {
  const match = text.match(/^\s*[#;]\s*(?:generated|exported) by PrusaSlicer\s+([^\s]+).*$/im);
  return match?.[1]?.slice(0, 100) ?? '';
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
