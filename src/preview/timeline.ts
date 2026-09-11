import type { GeneratedToolpath, ToolpathEvent, Vec3 } from '../domain/types';
import { eventDurationSeconds } from '../domain/math';

export interface Timeline {
  ends: Float64Array;
  durationS: number;
}
export function buildTimeline(path: GeneratedToolpath): Timeline {
  let time = 0;
  const ends = Float64Array.from(path.events, (event) => {
    time += eventDurationSeconds(event);
    return time;
  });
  return { ends, durationS: time };
}

/** Upper bound: at a boundary, choose the next timed operation after markers. */
export function eventIndexAtTime(timeline: Timeline, seconds: number): number {
  let lo = 0;
  let hi = timeline.ends.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (timeline.ends[mid]! <= seconds) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, Math.max(0, timeline.ends.length - 1));
}
export function positionAtTime(events: ToolpathEvent[], timeline: Timeline, seconds: number): Vec3 | null {
  if (!events.length) return null;
  const index = eventIndexAtTime(timeline, seconds);
  const event = events[index]!;
  if (event.kind !== 'extrude' && event.kind !== 'travel') return event.at;
  const start = index ? timeline.ends[index - 1]! : 0;
  const duration = timeline.ends[index]! - start;
  const t = duration > 0 ? Math.max(0, Math.min(1, (seconds - start) / duration)) : 1;
  return {
    x: event.from.x + (event.to.x - event.from.x) * t,
    y: event.from.y + (event.to.y - event.from.y) * t,
    z: event.from.z + (event.to.z - event.from.z) * t,
  };
}
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.floor(seconds % 60).toString().padStart(2, '0')}s`;
}
