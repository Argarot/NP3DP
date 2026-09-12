import { MAX_RECIPE_TEXT_BYTES, parseRecipe } from '../domain/recipe';
import type { PrintProject } from './types';
import { parsePrintSetup } from './setup';

const PROJECT_KEYS = ['format', 'schemaVersion', 'recipe', 'setup'] as const;

/** Serializes both independently-versioned records without changing recipe semantics. */
export function serializeProject(project: PrintProject): string {
  return JSON.stringify(parseProject(project), null, 2);
}

/** Parses a persisted project envelope, keeping recipe and setup validation separate. */
export function parseProjectText(text: string): PrintProject {
  if (new TextEncoder().encode(text).byteLength > MAX_RECIPE_TEXT_BYTES) {
    throw new Error(`Invalid project JSON: text exceeds the ${MAX_RECIPE_TEXT_BYTES}-byte limit.`);
  }
  try {
    return parseProject(JSON.parse(text) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Invalid project JSON: ${error.message}`);
    throw error;
  }
}

export function parseProject(input: unknown): PrintProject {
  const project = expectRecord(input, 'project');
  expectExactKeys(project, PROJECT_KEYS, 'project');
  if (project.format !== 'np3dp-project') throw new Error('Invalid project.format: expected "np3dp-project".');
  if (project.schemaVersion !== 1 && project.schemaVersion !== 2) {
    throw new Error(`Invalid project: unsupported schemaVersion ${describe(project.schemaVersion)}; versions 1 and 2 are supported.`);
  }
  const setup = expectRecord(project.setup, 'project.setup');
  if (setup.schemaVersion !== project.schemaVersion) throw new Error('Invalid project: envelope and print setup schema versions must match.');
  return { format: 'np3dp-project', schemaVersion: 2, recipe: parseRecipe(project.recipe), setup: parsePrintSetup(setup) };
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`Invalid ${path}: expected a plain object.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`Invalid ${path}: expected a plain object.`);
  return value as Record<string, unknown>;
}

function expectExactKeys(value: Record<string, unknown>, expected: readonly string[], path: string): void {
  const allowed = new Set(expected);
  const extra = Object.keys(value).filter((key) => !allowed.has(key));
  if (extra.length) throw new Error(`Invalid ${path}: unexpected field${extra.length === 1 ? '' : 's'} ${extra.map((key) => `"${key}"`).join(', ')}.`);
  const missing = expected.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  if (missing.length) throw new Error(`Invalid ${path}: missing required field${missing.length === 1 ? '' : 's'} ${missing.map((key) => `"${key}"`).join(', ')}.`);
}

function describe(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}
