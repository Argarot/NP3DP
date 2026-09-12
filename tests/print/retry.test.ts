import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CALIBRATION_STUDIES, RETRY_STUDIES } from '../../src/print/calibration';
import { prepareBuild } from '../../src/print/prepare';
import { DEFAULT_PRINT_SETUP } from '../../src/print/setup';
import { parseProjectText } from '../../src/print/project';
import { compilePrintJob } from '../../src/print/complete';
import { auditMiniGcode } from '../../src/print/auditMini';
import { addMiniProgress } from '../../src/print/miniProgress';
import { renderPrintThumbnail } from '../../src/print/thumbnail';

const setup = structuredClone(DEFAULT_PRINT_SETUP);
setup.foundation.enabled = true;

describe('feedback-driven retry', () => {
  it('keeps original fixture parameters and migrates its foundation without shrinking it', () => {
    const old = parseProjectText(readFileSync('examples/calibration/02-wave-coupon.np3dp-project.json', 'utf8'));
    expect(old.recipe).toEqual(CALIBRATION_STUDIES[1]!.recipe);
    expect(old.setup.foundation.elephantFootMm).toBe(0);
    const report = prepareBuild(old.recipe, old.setup.foundation).attachment!;
    expect(report.applicable).toBe(true);
    if (report.applicable) expect(report.sampledGeometry.turns[1]!.contactFractionEstimate).toBe(0);
  });

  it.each(RETRY_STUDIES)('actual generated first two revolutions have nominal attachment: $id', ({ recipe }) => {
    const build = prepareBuild(recipe, setup.foundation);
    const wall = build.stages.find((stage) => stage.kind === 'wall')!;
    const points: { turn: number; z: number }[] = [];
    let angle = 0;
    for (const event of build.path.events.slice(wall.startEvent, wall.endEvent)) {
      if (event.kind !== 'extrude') continue;
      if (!points.length) points.push({ turn: 0, z: event.from.z });
      angle += Math.atan2(event.from.x * event.to.y - event.from.y * event.to.x, event.from.x * event.to.x + event.from.y * event.to.y);
      points.push({ turn: angle / (2 * Math.PI), z: event.to.z });
      if (angle / (2 * Math.PI) > 2) break;
    }
    let previous = 0;
    const gaps: number[] = [];
    for (const point of points) {
      if (point.turn < 1 || point.turn > 2) continue;
      const t = point.turn - 1;
      while (points[previous + 1]!.turn < t) previous++;
      const a = points[previous]!, b = points[previous + 1]!;
      const beneath = a.z + (b.z - a.z) * (t - a.turn) / (b.turn - a.turn);
      gaps.push(point.z - beneath);
    }
    expect(gaps.length).toBeGreaterThan(100);
    expect(Math.min(...gaps)).toBeGreaterThan(0);
    expect(Math.max(...gaps)).toBeLessThan(recipe.process.strandDiameterMm);
    const attachment = build.attachment!;
    if (!attachment.applicable) throw new Error('Missing attachment fixture');
    expect(Math.min(...gaps)).toBeCloseTo(attachment.sampledGeometry.turns[1]!.minGapMm, 2);
    expect(Math.max(...gaps)).toBeCloseTo(attachment.sampledGeometry.turns[1]!.maxGapMm, 2);
  });

  it('exports A with decodable LCD thumbnails, independently timed progress, purge and retained mesh', () => {
    const result = compilePrintJob(RETRY_STUDIES[0]!.recipe, setup);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const text = result.text!;
    expect(result.audit).toMatchObject({ errors: [], purgeComplete: true, startupExtrusionMm: 18, shutdownComplete: true });
    expect(result.audit!.progressUpdates).toBeGreaterThan(15);
    expect(text.indexOf('\nG29\n')).toBeLessThan(text.indexOf('\nG1 '));
    expect(text).toContain('; thumbnail_QOI begin 220x124 ');
    expect(text).toContain('; thumbnail_QOI begin 200x240 ');
    expect(text).toContain('M400\nM73 P100 R0');
    expect(addMiniProgress(text).commandedSeconds).toBeCloseTo(result.audit!.commandedSeconds, 8);
    const mutations = [
      text.replace(/; thumbnail_QOI begin 220x124 \d+/, '; thumbnail_QOI begin 220x124 1'),
      text.replace('; thumbnail_QOI begin 200x240', '; thumbnail_QOI begin 240x200'),
      text.replace(/^M73 .+\n/gm, ''),
      text.replace(/^M73 .+\n/m, ''),
      text.replace(/^; estimated printing time \(normal mode\) = .+$/m, '; estimated printing time (normal mode) = 1m 0s'),
      text.trimEnd().split('\n').slice(0, -1).join('\n'),
      text.replace('G29\nM73', 'G29\nM105\nM73'),
      text.replace(/G1 X135\.000 Y6\.000 E10\.00000 F[\d.]+\n/, ''),
      text.replace('G1 X65.000 Y6.000 E8.00000', 'G1 X65.000 Y6.000 E1.00000'),
      text.replace('M400\nM73 P100 R0', 'M73 P100 R0\nM400'),
    ];
    for (const mutation of mutations) expect(auditMiniGcode(mutation, setup).errors.length).toBeGreaterThan(0);
  });

  it('exports B and limits purge flow when a lower flow ceiling is selected', () => {
    const lowFlow = structuredClone(setup); lowFlow.material.maxFlowMm3S = 2;
    const result = compilePrintJob(RETRY_STUDIES[1]!.recipe, lowFlow);
    expect(result.audit?.errors).toEqual([]);
    expect(result.audit!.maximumFlowMm3S).toBeLessThanOrEqual(2.002);
    expect(result.audit!.startupExtrusionMm).toBe(18);
  });

  it('renders deterministic geometry-specific thumbnails without travel strands', () => {
    const build = prepareBuild(RETRY_STUDIES[0]!.recipe, setup.foundation);
    const image = renderPrintThumbnail(build.path, setup.foundation, 220, 124);
    expect(renderPrintThumbnail(build.path, setup.foundation, 220, 124).pixels).toEqual(image.pixels);
    const foreground = image.pixels.filter((_, index) => index % 3 === 0 && image.pixels[index] !== 22).length;
    expect(foreground).toBeGreaterThan(1000);
    expect(foreground).toBeLessThan(220 * 124 * 0.8);
    const noTravels = { ...build.path, events: build.path.events.filter((event) => event.kind !== 'travel') };
    expect(renderPrintThumbnail(noTravels, setup.foundation, 220, 124).pixels).toEqual(image.pixels);
    expect(() => renderPrintThumbnail(build.path, setup.foundation, 2000, 2000)).toThrow(/budget/);
  });
});
