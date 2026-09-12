import { describe, expect, it } from 'vitest';
import { auditMiniGcode } from '../../src/print/auditMini';
import { CALIBRATION_STUDIES } from '../../src/print/calibration';
import { compilePrintJob } from '../../src/print/complete';
import { DEFAULT_PRINT_SETUP } from '../../src/print/setup';
import type { PrintSetup } from '../../src/print/types';

function setup(overrides?: (value: PrintSetup) => void): PrintSetup {
  const value = structuredClone(DEFAULT_PRINT_SETUP);
  value.foundation.enabled = true;
  overrides?.(value);
  return value;
}

const compiledFixtures = new Map<string, string>();
function compiled(value = setup()): { text: string; setup: PrintSetup } {
  const key = JSON.stringify(value), cached = compiledFixtures.get(key);
  if (cached) return { text: cached, setup: value };
  const recipe = CALIBRATION_STUDIES[0]!.recipe;
  const result = compilePrintJob(recipe, value);
  expect(result.diagnostics.filter((entry) => entry.severity === 'error')).toEqual([]);
  expect(result.text).not.toBeNull();
  compiledFixtures.set(key, result.text!);
  return { text: result.text!, setup: value };
}

function withoutFirst(text: string, predicate: (line: string) => boolean): string {
  const lines = text.trimEnd().split('\n');
  const index = lines.findIndex(predicate);
  expect(index).toBeGreaterThanOrEqual(0);
  lines.splice(index, 1);
  return `${lines.join('\n')}\n`;
}

function replaceFirst(text: string, predicate: (line: string) => boolean, replacement: string): string {
  const lines = text.trimEnd().split('\n');
  const index = lines.findIndex(predicate);
  expect(index).toBeGreaterThanOrEqual(0);
  lines[index] = replacement;
  return `${lines.join('\n')}\n`;
}

function expectRejected(text: string, value: PrintSetup, message: RegExp): void {
  const audit = auditMiniGcode(text, value);
  expect(audit.errors.join(' ')).toMatch(message);
}

describe('MINI complete-job audit', () => {
  it('accepts the actual compiled cooldown job and compares quantized setup values', () => {
    const value = setup((candidate) => {
      candidate.printer.accelerationMmS2 = 500.0004;
      candidate.material.firstLayerNozzleC = 215.0004;
      candidate.material.nozzleC = 210.0004;
      candidate.material.firstLayerBedC = 60.0004;
      candidate.material.bedC = 55.0004;
    });
    const output = compiled(value);
    expect(output.text).toContain('M104 S210.000');
    expect(output.text).toContain('M140 S55.000');
    expect(auditMiniGcode(output.text, value).errors).toEqual([]);
  });

  it('accepts mandatory waits when body temperatures increase', () => {
    const value = setup((candidate) => {
      candidate.material.firstLayerNozzleC = 210;
      candidate.material.nozzleC = 220;
      candidate.material.firstLayerBedC = 55;
      candidate.material.bedC = 60;
    });
    const output = compiled(value);
    expect(output.text).toContain('M109 R220.000');
    expect(output.text).toContain('M190 R60.000');
    expect(auditMiniGcode(output.text, value).errors).toEqual([]);
  });

  it('accepts either safe wait form when raw targets quantize to the same command', () => {
    const value = setup((candidate) => {
      candidate.material.firstLayerNozzleC = 215.0001;
      candidate.material.nozzleC = 215.0004;
      candidate.material.firstLayerBedC = 60.0001;
      candidate.material.bedC = 60.0004;
    });
    const output = compiled(value);
    expect(output.text).toContain('M109 R215.000');
    expect(output.text).toContain('M190 R60.000');
    expect(auditMiniGcode(output.text, value).errors).toEqual([]);
  });

  it('requires a completed Z-only clearance lift before resolving post-home XY', () => {
    const output = compiled();
    const missing = withoutFirst(output.text, (line) => line === 'G0 Z2.000 F120.000');
    expectRejected(missing, output.setup, /First post-home motion must be a Z-only clearance lift/i);

    const diagonal = replaceFirst(output.text, (line) => line === 'G0 Z2.000 F120.000', 'G0 X5.000 Y6.000 Z2.000 F3000.000');
    expectRejected(diagonal, output.setup, /First post-home motion must be a Z-only clearance lift/i);
  });

  it('requires resolved acceleration and pressure state before movement', () => {
    const output = compiled();
    const noAcceleration = withoutFirst(output.text, (line) => line.startsWith('M204 '));
    expectRejected(noAcceleration, output.setup, /Motion before explicit unit\/extrusion\/process state initialization/i);

    const noPressure = withoutFirst(output.text, (line) => line === 'M572 S0 W0.04');
    expectRejected(noPressure, output.setup, /Motion before explicit unit\/extrusion\/process state initialization/i);
  });

  it('requires exact probing and first-layer waits', () => {
    const output = compiled();
    const noProbeWait = withoutFirst(output.text, (line) => line === 'M109 R170');
    expectRejected(noProbeWait, output.setup, /Mesh requires homing and exact completed probing-temperature waits/i);

    const noFirstLayerWait = withoutFirst(output.text, (line) => line === 'M109 R215.000');
    expectRejected(noFirstLayerWait, output.setup, /Startup extrusion requires exact waited first-layer targets|Body begins without exact waited first-layer targets/i);

    const wrongBed = replaceFirst(output.text, (line) => line === 'M190 R60.000', 'M190 R59.000');
    expectRejected(wrongBed, output.setup, /Unexpected startup bed target|Mesh requires homing/i);

    const cooling = compiled(setup((candidate) => { candidate.material.bedC = 55; }));
    const noBodyNozzle = withoutFirst(cooling.text, (line) => line === 'M104 S210.000');
    const noBodyTargets = withoutFirst(noBodyNozzle, (line) => line === 'M140 S55.000');
    expectRejected(noBodyTargets, cooling.setup, /Body extrusion does not have a complete resolved temperature pair/i);
  });

  it('keeps the fan off through foundation and requires resolved PWM at transition', () => {
    const output = compiled();
    const noInitialOff = withoutFirst(output.text, (line) => line === 'M107');
    expectRejected(noInitialOff, output.setup, /Motion before explicit unit\/extrusion\/process state initialization/i);

    const noTransitionFan = withoutFirst(output.text, (line) => line.startsWith('M106 S'));
    expectRejected(noTransitionFan, output.setup, /Body motion requires the resolved transition fan PWM|unresolved transition fan/i);

    const wrongTransitionFan = replaceFirst(output.text, (line) => line.startsWith('M106 S'), 'M106 S127');
    expectRejected(wrongTransitionFan, output.setup, /Transition fan PWM differs from the resolved setup/i);
  });

  it.each([
    ['retraction', (line: string) => line === 'G1 E-0.80000 F1200.000', /Finish must begin with the exact 0.8 mm stationary retraction/i],
    ['lift', (line: string) => /^G0 Z\d+\.\d{3} F120\.000$/.test(line), /Finish requires a Z-only lift|exact X10 Y170 park/i],
    ['park', (line: string) => line === 'G0 X10.000 Y170.000 F3000.000', /Finish requires the exact X10 Y170 park|barrier must follow/i],
    ['barrier', (line: string) => line === 'M400', /after the park barrier|Missing body or controlled finish/i],
    ['nozzle off', (line: string) => line === 'M104 S0', /Incomplete controlled shutdown/i],
    ['bed off', (line: string) => line === 'M140 S0', /Incomplete controlled shutdown/i],
    ['final fan off', (line: string) => line === 'M107', /Incomplete controlled shutdown/i],
    ['final pressure reset', (line: string) => line === 'M572 S0', /Incomplete controlled shutdown/i],
    ['final flow reset', (line: string) => line === 'M221 S100', /Incomplete controlled shutdown/i],
    ['motor disable', (line: string) => line === 'M84', /Missing body or controlled finish/i],
  ])('rejects a finish with the %s command deleted', (_name, predicate, message) => {
    const output = compiled();
    const lines = output.text.trimEnd().split('\n');
    const finish = lines.indexOf('; NP3DP_PHASE finish');
    const relativeIndex = lines.slice(finish + 1).findIndex(predicate);
    expect(relativeIndex).toBeGreaterThanOrEqual(0);
    lines.splice(finish + 1 + relativeIndex, 1);
    expectRejected(`${lines.join('\n')}\n`, output.setup, message);
  });

  it('rejects commands outside the adapter dialect', () => {
    const output = compiled();
    const text = output.text.replace('G21\n', 'G21\nM593 F46.3\n');
    expectRejected(text, output.setup, /Unsupported command M593/i);
  });
});
