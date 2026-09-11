import type { ToolpathEvent, Vec3 } from './types';

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

/** Commanded feed/deposit/dwell time only; firmware planning is deliberately absent. */
export function eventDurationSeconds(event: ToolpathEvent): number {
  switch (event.kind) {
    case 'extrude':
    case 'travel': {
      if (!Number.isFinite(event.speedMmS) || event.speedMmS <= 0) {
        throw new RangeError('Motion speed must be finite and greater than zero.');
      }
      return distance(event.from, event.to) / event.speedMmS;
    }
    case 'deposit': {
      if (!Number.isFinite(event.volumeRateMm3S) || event.volumeRateMm3S <= 0) {
        if (event.volumeMm3 === 0) return 0;
        throw new RangeError('Deposit volume rate must be finite and greater than zero.');
      }
      return event.volumeMm3 / event.volumeRateMm3S;
    }
    case 'dwell':
      return event.seconds;
    case 'anchor':
      return 0;
  }
}
