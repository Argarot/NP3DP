import { describe, expect, it } from 'vitest';
import { buildTimeline, eventIndexAtTime, positionAtTime } from './timeline';
import { calculateStats } from '../domain/stats';
import type { GeneratedToolpath, ToolpathEvent } from '../domain/types';

const origin = { x: 0, y: 0, z: 1 };
const next = { x: 10, y: 0, z: 1 };
const events: ToolpathEvent[] = [
  { kind: 'anchor', at: origin, bandId: 'test' },
  { kind: 'deposit', at: origin, volumeMm3: 2, volumeRateMm3S: 1, bandId: 'test' },
  { kind: 'dwell', at: origin, seconds: 3, bandId: 'test' },
  { kind: 'extrude', from: origin, to: next, volumeMm3: 1, speedMmS: 5, role: 'span', bandId: 'test' },
  { kind: 'anchor', at: next, bandId: 'test' },
];
const path: GeneratedToolpath = { engineVersion: 'test', recipeKey: '', events, diagnostics: [], stats: calculateStats(events, 1.75) };

describe('commanded event timeline', () => {
  it('keeps deposit, hold and travel durations distinct and skips zero-time markers', () => {
    const timeline = buildTimeline(path);
    expect(timeline.durationS).toBe(7);
    expect(eventIndexAtTime(timeline, 0)).toBe(1);
    expect(eventIndexAtTime(timeline, 2)).toBe(2);
    expect(eventIndexAtTime(timeline, 5)).toBe(3);
    expect(positionAtTime(events, timeline, 4)).toEqual(origin);
    expect(positionAtTime(events, timeline, 6)).toEqual({ x: 5, y: 0, z: 1 });
    expect(positionAtTime(events, timeline, 7)).toEqual(next);
  });
  it('handles an empty timeline without fabricating coordinates', () => {
    const empty = buildTimeline({ ...path, events: [] });
    expect(empty.durationS).toBe(0);
    expect(positionAtTime([], empty, 0)).toBeNull();
  });
});
