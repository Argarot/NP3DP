import { distance } from '../domain/math';
import type { GeneratedToolpath, ToolpathEvent, Vec3 } from '../domain/types';
import type { FoundationSettings } from './types';
import type { RasterPixels } from './miniMetadata';

/** Deterministic orthographic nominal-deposition preview. Runs in the export
 * worker without WebGL/DOM. It depicts commanded strands, not filament physics. */
export function renderPrintThumbnail(path: GeneratedToolpath, foundation: FoundationSettings, width: number, height: number): RasterPixels {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 16 || height < 16 || width * height > 100_000 || path.events.length > 100_000) throw new Error('Thumbnail exceeds its rendering budget.');
  const pixels = new Uint8Array(width * height * 3);
  const depths = new Float64Array(width * height).fill(-Infinity);
  for (let i = 0; i < pixels.length; i += 3) { pixels[i] = 22; pixels[i + 1] = 27; pixels[i + 2] = 30; }
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const event of path.events) {
    const strand = depositedSegment(event, foundation);
    if (!strand) continue;
    for (const point of [strand.from, strand.to]) {
      const p = project(point);
      left = Math.min(left, p.x - strand.radius); right = Math.max(right, p.x + strand.radius);
      bottom = Math.min(bottom, p.y - strand.radius); top = Math.max(top, p.y + strand.radius);
    }
  }
  if (![left, right, bottom, top].every(Number.isFinite)) throw new Error('Thumbnail requires deposited geometry.');
  const scale = Math.min((width - 12) / Math.max(right - left, 0.001), (height - 12) / Math.max(top - bottom, 0.001));
  const screen = (point: Vec3) => {
    const p = project(point);
    return { x: width / 2 + (p.x - (left + right) / 2) * scale, y: height / 2 - (p.y - (bottom + top) / 2) * scale, z: p.z * scale };
  };
  let work = 0;
  for (const event of path.events) {
    const strand = depositedSegment(event, foundation);
    if (!strand) continue;
    const a = screen(strand.from), b = screen(strand.to), r = Math.max(0.55, strand.radius * scale);
    const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - r)), x1 = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x) + r));
    const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - r)), y1 = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y) + r));
    work += (x1 - x0 + 1) * (y1 - y0 + 1);
    if (work > 20_000_000) throw new Error('Thumbnail exceeds its pixel-work budget.');
    const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = length2 > 0 ? Math.max(0, Math.min(1, ((x + 0.5 - a.x) * dx + (y + 0.5 - a.y) * dy) / length2)) : 0;
      const ox = x + 0.5 - a.x - dx * t, oy = y + 0.5 - a.y - dy * t;
      const d2 = ox * ox + oy * oy;
      if (d2 > r * r) continue;
      const surface = Math.sqrt(Math.max(0, r * r - d2));
      const depth = a.z + (b.z - a.z) * t + surface;
      const index = y * width + x;
      if (depth <= depths[index]!) continue;
      depths[index] = depth;
      // A small shared palette keeps both LCD thumbnails early in the file.
      const light = Math.round(Math.max(0, Math.min(1, 0.4 + 0.5 * surface / r - 0.1 * oy / r)) * 7) / 7;
      const shade = Math.round(110 + 125 * light);
      pixels[index * 3] = shade; pixels[index * 3 + 1] = shade; pixels[index * 3 + 2] = shade;
    }
  }
  return { width, height, pixels, channels: 3, origin: 'top-left' };
}

function project(point: Vec3): Vec3 {
  return { x: (point.x - point.y) / Math.SQRT2, y: point.z * Math.sqrt(0.75) - (point.x + point.y) / Math.sqrt(8), z: (point.x + point.y) * Math.sqrt(0.375) + point.z / 2 };
}

function depositedSegment(event: ToolpathEvent, foundation: FoundationSettings) {
  if (event.kind === 'deposit' && event.volumeMm3 > 0) return { from: event.at, to: event.at, radius: Math.cbrt(event.volumeMm3 * 3 / (4 * Math.PI)) };
  if (event.kind !== 'extrude' || event.volumeMm3 <= 0) return null;
  const length = distance(event.from, event.to);
  if (length <= 0) return null;
  const radius = ['foundation', 'transition', 'rim'].includes(event.role) ? foundation.lineWidthMm / 2 : Math.sqrt(event.volumeMm3 / length / Math.PI);
  return { from: event.from, to: event.to, radius };
}
