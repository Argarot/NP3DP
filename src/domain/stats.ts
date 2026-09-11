import type { Bounds, ToolpathEvent, ToolpathStats, Vec3 } from './types';
import { distance, eventDurationSeconds } from './math';

function pointsOf(event: ToolpathEvent): readonly Vec3[] {
  switch (event.kind) {
    case 'extrude':
    case 'travel':
      return [event.from, event.to];
    case 'deposit':
    case 'dwell':
    case 'anchor':
      return [event.at];
  }
}

function boundsOf(events: readonly ToolpathEvent[]): Bounds {
  const minimum = { x: Infinity, y: Infinity, z: Infinity };
  const maximum = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const event of events) {
    for (const point of pointsOf(event)) {
      minimum.x = Math.min(minimum.x, point.x);
      minimum.y = Math.min(minimum.y, point.y);
      minimum.z = Math.min(minimum.z, point.z);
      maximum.x = Math.max(maximum.x, point.x);
      maximum.y = Math.max(maximum.y, point.y);
      maximum.z = Math.max(maximum.z, point.z);
    }
  }
  if (!Number.isFinite(minimum.x)) throw new Error('Cannot calculate bounds for an empty toolpath.');
  return { min: minimum, max: maximum };
}

export function calculateStats(
  events: readonly ToolpathEvent[],
  filamentDiameterMm: number,
): ToolpathStats {
  let pathLengthMm = 0;
  let extrusionVolumeMm3 = 0;
  let commandedDurationS = 0;
  let extrudeMoves = 0;
  let travelMoves = 0;
  let dwellCount = 0;

  for (const event of events) {
    commandedDurationS += eventDurationSeconds(event);
    switch (event.kind) {
      case 'extrude':
        pathLengthMm += distance(event.from, event.to);
        extrusionVolumeMm3 += event.volumeMm3;
        extrudeMoves += 1;
        break;
      case 'travel':
        pathLengthMm += distance(event.from, event.to);
        travelMoves += 1;
        break;
      case 'deposit':
        extrusionVolumeMm3 += event.volumeMm3;
        break;
      case 'dwell':
        dwellCount += 1;
        break;
      case 'anchor':
        break;
    }
  }

  const filamentArea = Math.PI * (filamentDiameterMm / 2) ** 2;
  return {
    pathLengthMm,
    extrusionVolumeMm3,
    filamentLengthMm: extrusionVolumeMm3 / filamentArea,
    commandedDurationS,
    extrudeMoves,
    travelMoves,
    dwellCount,
    bounds: boundsOf(events),
  };
}
