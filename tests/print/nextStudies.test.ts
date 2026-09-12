import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CALIBRATION_STUDIES, NEXT_STUDIES, RETRY_STUDIES, studyFilename, studyFoundation } from '../../src/print/calibration';
import { parseProjectText } from '../../src/print/project';
import { compilePrintJob } from '../../src/print/complete';
import { prepareBuild } from '../../src/print/prepare';
import { DEFAULT_PRINT_SETUP } from '../../src/print/setup';
import { inspectPrintJob } from '../../src/print/diagnostics';
import { distance } from '../../src/domain/math';

const setup = structuredClone(DEFAULT_PRINT_SETUP);
setup.foundation.enabled = true;
const directory = 'public/print-tests/session-005/';

describe('next physical test delivery', () => {
  it('preserves historical recipes and keeps the shaped vase on B’s deposition baseline', () => {
    for (const study of [...CALIBRATION_STUDIES, ...RETRY_STUDIES]) {
      const folder = RETRY_STUDIES.includes(study) ? 'retries' : 'calibration';
      expect(parseProjectText(readFileSync(`examples/${folder}/${studyFilename(study)}.np3dp-project.json`, 'utf8')).recipe).toEqual(study.recipe);
    }
    const mini = NEXT_STUDIES.find((study) => study.id === 'mini-b')!.recipe;
    expect(mini.process).toEqual(RETRY_STUDIES[1]!.recipe.process);
    expect(mini.bands).toEqual(RETRY_STUDIES[1]!.recipe.bands);
    expect(mini.shape.topDiameterMm).toBeGreaterThan(mini.shape.baseDiameterMm);
    expect(mini.shape.bellyMm).toBeGreaterThan(0);
  });

  it.each(NEXT_STUDIES)('published $id is a fresh, audited export of its supplied project', (study) => {
    const stem = studyFilename(study);
    const projectText = readFileSync(`${directory}${stem}.np3dp-project.json`, 'utf8');
    const project = parseProjectText(projectText);
    expect(project.recipe).toEqual(study.recipe);
    expect(project).toEqual(parseProjectText(readFileSync(`examples/next-prints/${stem}.np3dp-project.json`, 'utf8')));
    expect(project.setup).toEqual({ ...setup, foundation: studyFoundation(study, setup.foundation) });
    const actual = readFileSync(`${directory}${stem}.gcode`, 'utf8');
    const delivered = JSON.parse(readFileSync(`${directory}${stem}.print-report.json`, 'utf8'));
    const fresh = compilePrintJob(project.recipe, project.setup);
    expect(fresh.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    expect(fresh.text).toBe(actual);
    expect(delivered.gcodeSha256).toBe(createHash('sha256').update(actual).digest('hex'));
    expect(delivered).toEqual({ ...JSON.parse(fresh.report), gcodeSha256: delivered.gcodeSha256 });
    expect(fresh.audit).toMatchObject({ errors: [], purgeComplete: true, startupExtrusionMm: 18, shutdownComplete: true });
    expect(actual.indexOf('\nG29\n')).toBeLessThan(actual.indexOf('\nG1 '));
    expect(actual).toContain('; thumbnail_QOI begin 220x124');
    expect(actual).toContain('; thumbnail_QOI begin 200x240');
    expect(actual).toContain('M400\nM73 P100 R0');
    const manifest = JSON.parse(readFileSync(`${directory}manifest.json`, 'utf8'));
    const entry = manifest.studies.find((item: { id: string }) => item.id === study.id);
    expect(entry.gcodeSha256).toBe(delivered.gcodeSha256);
    expect(entry.audit).toEqual(fresh.audit);
    expect(entry.bytes).toBe(Buffer.byteLength(actual));
    expect(delivered.observations.printed).toBe(false);
  });

  it.each(NEXT_STUDIES)('$id has continuous event joins, including collar and rim', (study) => {
    const build = prepareBuild(study.recipe, studyFoundation(study, setup.foundation));
    const events = build.path.events;
    for (let index = 1; index < events.length; index++) {
      const previous = events[index - 1]!, current = events[index]!;
      const end = previous.kind === 'extrude' || previous.kind === 'travel' ? previous.to : previous.at;
      const start = current.kind === 'extrude' || current.kind === 'travel' ? current.from : current.at;
      expect(distance(end, start)).toBeLessThan(1e-8);
    }
    if (!build.pathContact?.applicable) throw new Error('Reference specimen must support emitted-path analysis');
    // These particular fixtures intentionally retain positive separation.
    // A former arch finish rim approached to ~0.0065 mm and is omitted.
    expect(Math.min(...build.pathContact.comparisons.map((item) => item.minSeparationMm))).toBeGreaterThan(0.09);
  });

  it('explains retracing and prior-post interaction in the original lifted bridge without rewriting it', () => {
    const recipe = structuredClone(CALIBRATION_STUDIES[3]!.recipe);
    const before = JSON.stringify(recipe);
    const diagnostics = inspectPrintJob(recipe, setup, prepareBuild(recipe, setup.foundation)).diagnostics;
    expect(diagnostics.some((item) => item.code === 'bridge.retraced-post')).toBe(true);
    expect(diagnostics.some((item) => item.code === 'bridge.post-overlap')).toBe(true);
    expect(JSON.stringify(recipe)).toBe(before);
  });

  it('emits one deposit, hold and chord per whole timed motif, without ghost endpoint holds or retraced posts', () => {
    const recipe = NEXT_STUDIES.find((study) => study.id === 'held-span-v2')!.recipe;
    const build = prepareBuild(recipe, setup.foundation);
    const events = build.path.events.filter((event) => event.bandId === 'timed-chords' && !('role' in event && event.role === 'rim'));
    const spans = events.filter((event) => event.kind === 'extrude');
    expect(spans).toHaveLength(480);
    expect(spans.every((event) => event.role === 'span')).toBe(true);
    expect(events.filter((event) => event.kind === 'deposit')).toHaveLength(480);
    expect(events.filter((event) => event.kind === 'dwell')).toHaveLength(480);
    expect(events.filter((event) => event.kind === 'anchor')).toHaveLength(481);
    expect(events[0]?.kind).toBe('anchor');
    for (let index = 1; index < events.length; index += 4) {
      expect(events.slice(index, index + 4).map((event) => event.kind)).toEqual(['deposit', 'dwell', 'extrude', 'anchor']);
      const span = events[index + 2]!;
      if (span.kind !== 'extrude') throw new Error('Missing timed span');
      expect(distance(span.from, span.to)).toBeGreaterThan(4);
      expect(distance(span.from, span.to)).toBeLessThan(4.3);
    }
    expect(inspectPrintJob(recipe, setup, build).diagnostics.some((item) => item.code.startsWith('bridge.'))).toBe(false);
    const fresh = compilePrintJob(recipe, setup);
    expect(fresh.audit!.bodyDwellSeconds).toBeCloseTo(48, 8);
  });

  it('preserves genuine partial motifs when a method boundary moves off the exact phase', () => {
    const recipe = structuredClone(NEXT_STUDIES.find((study) => study.id === 'held-span-v2')!.recipe);
    recipe.bands[0]!.weight += 0.01;
    const events = prepareBuild(recipe, setup.foundation).path.events.filter((event) => event.bandId === 'timed-chords' && event.kind === 'extrude' && event.role === 'span');
    const lengths = events.map((event) => event.kind === 'extrude' ? distance(event.from, event.to) : 0);
    expect(lengths.some((length) => length > 0.01 && length < 4)).toBe(true);
  });
});
