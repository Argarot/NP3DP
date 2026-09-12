/** Pure helpers for the plain-text G-code metadata understood by Prusa MINI
 * Buddy firmware 5.1.2. No DOM, canvas, Node, or compression dependency. */

export type RasterOrigin = 'top-left' | 'bottom-left';

export interface RasterPixels {
  width: number;
  height: number;
  /** Interleaved RGB or RGBA bytes, identified by channels. */
  pixels: Uint8Array;
  channels: 3 | 4;
  /** Normal image rows are top-left. Use bottom-left for raw WebGL pixels. */
  origin?: RasterOrigin;
}

export type MiniThumbnailFormat = 'QOI' | 'PNG';

export interface EncodedThumbnail {
  width: number;
  height: number;
  format: MiniThumbnailFormat;
  bytes: Uint8Array;
}

export const MINI_THUMBNAIL_SIZES = {
  preview: { width: 220, height: 124 },
  progress: { width: 200, height: 240 },
  progressCurrent: { width: 240, height: 240 },
  icon: { width: 16, height: 16 },
} as const;

const QOI_MAGIC = [0x71, 0x6f, 0x69, 0x66] as const;
const QOI_END_MARKER = [0, 0, 0, 0, 0, 0, 0, 1] as const;
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Encode the Quite OK Image format used for MINI LCD thumbnails. */
export function encodeQoi(raster: RasterPixels, maxPixels = 1_000_000): Uint8Array {
  validateRaster(raster, maxPixels);
  const { width, height, pixels, channels } = raster;
  // A valid stream cannot exceed header + five bytes per pixel + end marker.
  const output = new Uint8Array(14 + width * height * 5 + QOI_END_MARKER.length);
  let out = 0;
  for (const byte of QOI_MAGIC) output[out++] = byte;
  writeU32(output, out, width); out += 4;
  writeU32(output, out, height); out += 4;
  output[out++] = channels;
  output[out++] = 0; // sRGB with linear alpha

  const index = new Uint8Array(64 * 4);
  let previousR = 0, previousG = 0, previousB = 0, previousA = 255;
  let run = 0;
  const origin = raster.origin ?? 'top-left';

  for (let y = 0; y < height; y++) {
    const sourceY = origin === 'top-left' ? y : height - y - 1;
    for (let x = 0; x < width; x++) {
      const source = (sourceY * width + x) * channels;
      const r = pixels[source]!;
      const g = pixels[source + 1]!;
      const b = pixels[source + 2]!;
      const a = channels === 4 ? pixels[source + 3]! : 255;

      if (r === previousR && g === previousG && b === previousB && a === previousA) {
        run++;
        if (run === 62 || (y === height - 1 && x === width - 1)) {
          output[out++] = 0xc0 | (run - 1);
          run = 0;
        }
        continue;
      }

      if (run > 0) {
        output[out++] = 0xc0 | (run - 1);
        run = 0;
      }

      const slot = ((r * 3 + g * 5 + b * 7 + a * 11) & 63) * 4;
      if (index[slot] === r && index[slot + 1] === g && index[slot + 2] === b && index[slot + 3] === a) {
        output[out++] = slot / 4;
      } else {
        index[slot] = r; index[slot + 1] = g; index[slot + 2] = b; index[slot + 3] = a;
        if (a !== previousA) {
          output[out++] = 0xff;
          output[out++] = r; output[out++] = g; output[out++] = b; output[out++] = a;
        } else {
          const dr = r - previousR, dg = g - previousG, db = b - previousB;
          if (dr >= -2 && dr <= 1 && dg >= -2 && dg <= 1 && db >= -2 && db <= 1) {
            output[out++] = 0x40 | ((dr + 2) << 4) | ((dg + 2) << 2) | (db + 2);
          } else {
            const drdg = dr - dg, dbdg = db - dg;
            if (dg >= -32 && dg <= 31 && drdg >= -8 && drdg <= 7 && dbdg >= -8 && dbdg <= 7) {
              output[out++] = 0x80 | (dg + 32);
              output[out++] = ((drdg + 8) << 4) | (dbdg + 8);
            } else {
              output[out++] = 0xfe;
              output[out++] = r; output[out++] = g; output[out++] = b;
            }
          }
        }
      }

      previousR = r; previousG = g; previousB = b; previousA = a;
    }
  }

  for (const byte of QOI_END_MARKER) output[out++] = byte;
  return output.slice(0, out);
}

export function qoiThumbnail(raster: RasterPixels): EncodedThumbnail {
  return { width: raster.width, height: raster.height, format: 'QOI', bytes: encodeQoi(raster) };
}

/** PrusaSlicer-compatible ASCII thumbnail block. The size in the begin line is
 * the number of base64 characters, which is what Buddy's reader consumes. */
export function frameGcodeThumbnail(thumbnail: EncodedThumbnail, rowLength = 78): string {
  validateEncodedThumbnail(thumbnail);
  if (!Number.isInteger(rowLength) || rowLength < 4 || rowLength > 120 || rowLength % 4 !== 2) {
    // 78 matches PrusaSlicer and keeps every non-final row between base64 quartets.
    throw new RangeError('Thumbnail row length must be 4n+2 between 4 and 120.');
  }
  const payload = bytesToBase64(thumbnail.bytes);
  const tag = thumbnail.format === 'QOI' ? 'thumbnail_QOI' : 'thumbnail';
  const lines = ['', ';', `; ${tag} begin ${thumbnail.width}x${thumbnail.height} ${payload.length}`];
  for (let offset = 0; offset < payload.length; offset += rowLength) {
    lines.push(`; ${payload.slice(offset, offset + rowLength)}`);
  }
  lines.push(`; ${tag} end`, ';');
  return `${lines.join('\n')}\n`;
}

/** Build a file-head prefix and reject thumbnails that would drift outside the
 * firmware's bounded initial-line scan. 1,800 leaves margin under its 2,048-line scan. */
export function frameMiniThumbnailPrefix(thumbnails: readonly EncodedThumbnail[], maxLines = 1_800): string {
  if (!Number.isInteger(maxLines) || maxLines < 1 || maxLines > 2_048) {
    throw new RangeError('Thumbnail prefix line budget must be 1..2048.');
  }
  const prefix = thumbnails.map((thumbnail) => frameGcodeThumbnail(thumbnail)).join('');
  const lineCount = prefix === '' ? 0 : prefix.split('\n').length - 1;
  if (lineCount > maxLines) {
    throw new RangeError(`Thumbnail prefix uses ${lineCount} lines; limit is ${maxLines}.`);
  }
  return prefix;
}

/** Exact M73 P/R dialect. Remaining time is an unsigned integer in minutes. */
export function miniProgressCommand(percent: number, remainingMinutes: number): string {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new RangeError('M73 percent must be an integer from 0 to 100.');
  }
  if (!Number.isInteger(remainingMinutes) || remainingMinutes < 0 || remainingMinutes > 0xffff_ffff) {
    throw new RangeError('M73 remaining minutes must be an unsigned 32-bit integer.');
  }
  return `M73 P${percent} R${remainingMinutes}`;
}

export function remainingMinutesCeil(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Remaining seconds must be finite and non-negative.');
  return Math.ceil(seconds / 60);
}

/** Metadata shown in the MINI pre-print description and completed-print view.
 * It describes the qualified estimate supplied by the caller; it does not drive live ETA. */
export function estimatedPrintingTimeComment(seconds: number): string {
  return `; estimated printing time (normal mode) = ${formatDurationDhms(seconds)}`;
}

export function formatDurationDhms(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Duration must be finite and non-negative.');
  let remaining = seconds;
  const days = Math.floor(remaining / 86_400); remaining -= days * 86_400;
  const hours = Math.floor(remaining / 3_600); remaining -= hours * 3_600;
  const minutes = Math.floor(remaining / 60); remaining -= minutes * 60;
  const wholeSeconds = days > 0 || hours > 0 || minutes > 0 ? Math.floor(remaining) : Math.round(remaining);
  if (days > 0) return `${days}d ${hours}h ${minutes}m ${wholeSeconds}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${wholeSeconds}s`;
  if (minutes > 0) return `${minutes}m ${wholeSeconds}s`;
  return `${wholeSeconds}s`;
}

function validateRaster(raster: RasterPixels, maxPixels: number): void {
  if (!Number.isInteger(raster.width) || !Number.isInteger(raster.height)
    || raster.width < 1 || raster.height < 1 || raster.width > 0xffff || raster.height > 0xffff) {
    throw new RangeError('Raster dimensions must be integers from 1 to 65535.');
  }
  const count = raster.width * raster.height;
  if (!Number.isSafeInteger(count) || !Number.isInteger(maxPixels) || maxPixels < 1 || count > maxPixels) {
    throw new RangeError('Raster exceeds the pixel budget.');
  }
  if (raster.pixels.length !== count * raster.channels) {
    throw new RangeError('Raster byte length does not match dimensions and channel count.');
  }
}

function validateEncodedThumbnail(thumbnail: EncodedThumbnail): void {
  if (!Number.isInteger(thumbnail.width) || !Number.isInteger(thumbnail.height)
    || thumbnail.width < 1 || thumbnail.height < 1 || thumbnail.width > 0xffff || thumbnail.height > 0xffff) {
    throw new RangeError('Thumbnail dimensions must be integers from 1 to 65535.');
  }
  if (thumbnail.bytes.length < 1) throw new RangeError('Thumbnail payload is empty.');
}

function writeU32(output: Uint8Array, offset: number, value: number): void {
  output[offset] = value >>> 24;
  output[offset + 1] = value >>> 16;
  output[offset + 2] = value >>> 8;
  output[offset + 3] = value;
}

function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    result += BASE64[a >>> 2];
    result += BASE64[((a & 3) << 4) | ((b ?? 0) >>> 4)];
    result += b === undefined ? '=' : BASE64[((b & 15) << 2) | ((c ?? 0) >>> 6)];
    result += c === undefined ? '=' : BASE64[c & 63];
  }
  return result;
}
