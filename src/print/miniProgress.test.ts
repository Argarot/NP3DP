import { describe, expect, it } from 'vitest';
import { addMiniProgress } from './miniProgress';

const setup = [
  '; NP3DP test', 'G21', 'G90', 'M83', 'G28', 'G29',
  'G0 Z2.000 F120.000', 'G0 X5.000 Y6.000 F3000.000', 'M109 R215',
];

describe('final-text MINI progress annotation', () => {
  it('times resolved motion, stationary extrusion and dwell from final words', () => {
    const input = [...setup,
      'G1 X65.000 Y6.000 E6.00000 F600.000',
      'G1 E2.00000 F60.000', 'G4 P1000',
      '; NP3DP_PHASE finish', 'M400', 'M104 S0',
    ].join('\n');
    const result = addMiniProgress(input);
    expect(result.commandedSeconds).toBe(9);
    expect(result.text.startsWith('; estimated printing time (normal mode) = 9s\n; NP3DP test')).toBe(true);
    expect(result.text).toContain('G29\nM73 P0 R1');
    expect(result.text).toContain('M109 R215\nM73 P0 R1');
    expect(result.text).toContain('M400\nM73 P100 R0\nM104 S0');
    expect(result.text.endsWith('; estimated printing time (normal mode) = 9s\n')).toBe(true);
  });

  it('inserts updates around 30 commanded seconds and stays below 60 seconds', () => {
    const motion: string[] = [];
    for (let index = 0; index < 70; index++) motion.push(`G1 X${index % 2 === 0 ? '105.000' : '5.000'} F6000.000`);
    const result = addMiniProgress([...setup, ...motion, '; NP3DP_PHASE finish', 'M400'].join('\n'));
    expect(result.commandedSeconds).toBe(70);
    const live = [...result.text.matchAll(/^M73 P(?!100\b)(\d+) R(\d+)$/gm)].map((match) => Number(match[1]));
    expect(live.length).toBeGreaterThanOrEqual(3);
    expect(live).toEqual([...live].sort((a, b) => a - b));
    expect(result.text).toContain('M73 P42 R1');
    expect(result.text).toContain('M73 P85 R1');
  });

  it('is idempotent for its own metadata and M73 lines', () => {
    const input = [...setup, 'G1 X65.000 F600.000', '; NP3DP_PHASE finish', 'M400'].join('\n');
    const once = addMiniProgress(input);
    expect(addMiniProgress(once.text)).toEqual(once);
  });

  it('rejects an unsplittable command gap over the update bound', () => {
    const input = [...setup, 'G1 X705.000 F600.000', '; NP3DP_PHASE finish', 'M400'].join('\n');
    expect(() => addMiniProgress(input)).toThrow(/between M73 updates/);
  });
});
