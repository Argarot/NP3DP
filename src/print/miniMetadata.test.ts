import { describe, expect, it } from 'vitest';
import {
  encodeQoi, estimatedPrintingTimeComment, formatDurationDhms, frameGcodeThumbnail,
  frameMiniThumbnailPrefix, miniProgressCommand, qoiThumbnail, remainingMinutesCeil,
} from './miniMetadata';

describe('MINI QOI encoding', () => {
  it('round-trips mixed RGBA pixels through an independent decoder', () => {
    const pixels = new Uint8Array([
      0, 0, 0, 255, 1, 1, 1, 255, 20, 25, 22, 255,
      20, 25, 22, 255, 20, 25, 22, 130, 250, 2, 200, 130,
    ]);
    const encoded = encodeQoi({ width: 3, height: 2, channels: 4, pixels });
    expect(decodeQoiIndependent(encoded)).toEqual({ width: 3, height: 2, channels: 4, pixels });
  });

  it('converts bottom-left raster rows to normal top-left image order', () => {
    const bottomThenTop = new Uint8Array([0, 0, 255, 255, 0, 0]);
    const encoded = encodeQoi({ width: 1, height: 2, channels: 3, pixels: bottomThenTop, origin: 'bottom-left' });
    expect(decodeQoiIndependent(encoded).pixels).toEqual(new Uint8Array([255, 0, 0, 0, 0, 255]));
  });

  it('compresses long flat runs and enforces raster bounds', () => {
    const encoded = encodeQoi({ width: 220, height: 124, channels: 4, pixels: new Uint8Array(220 * 124 * 4) });
    expect(encoded.length).toBeLessThan(600);
    expect(() => encodeQoi({ width: 2, height: 2, channels: 3, pixels: new Uint8Array(11) })).toThrow(/byte length/);
    expect(() => encodeQoi({ width: 2, height: 2, channels: 3, pixels: new Uint8Array(12) }, 3)).toThrow(/pixel budget/);
  });
});

describe('MINI plain-G-code framing', () => {
  it('uses the QOI tag, base64 character count and 78-character rows', () => {
    const thumbnail = qoiThumbnail({ width: 8, height: 8, channels: 3, pixels: new Uint8Array(8 * 8 * 3) });
    const framed = frameGcodeThumbnail(thumbnail);
    const lines = framed.split('\n');
    const begin = lines.find((line) => line.startsWith('; thumbnail_QOI begin'))!;
    const payload = lines.filter((line) => line.startsWith('; ') && !line.includes('thumbnail_')).map((line) => line.slice(2)).join('');
    expect(begin).toBe(`; thumbnail_QOI begin 8x8 ${payload.length}`);
    expect(Math.max(...lines.filter((line) => /^; [A-Za-z0-9+/]/.test(line)).map((line) => line.length - 2))).toBeLessThanOrEqual(78);
    expect(decodeQoiIndependent(base64DecodeIndependent(payload)).pixels).toEqual(new Uint8Array(8 * 8 * 3));
    expect(framed).toContain('; thumbnail_QOI end\n;\n');
  });

  it('uses the unsuffixed PNG tag for already encoded PNG bytes', () => {
    const framed = frameGcodeThumbnail({ width: 1, height: 1, format: 'PNG', bytes: new Uint8Array([137, 80, 78, 71]) });
    expect(framed).toContain('; thumbnail begin 1x1 8');
    expect(framed).toContain('; thumbnail end');
  });

  it('rejects a prefix over the bounded firmware search margin', () => {
    const noisy = { width: 1, height: 1, format: 'PNG' as const, bytes: new Uint8Array(1000) };
    expect(() => frameMiniThumbnailPrefix([noisy], 4)).toThrow(/line/);
    expect(frameMiniThumbnailPrefix([noisy], 100).split('\n').length - 1).toBeLessThanOrEqual(100);
  });
});

describe('MINI duration and progress metadata', () => {
  it('emits exact M73 P/R integer fields', () => {
    expect(miniProgressCommand(0, 8)).toBe('M73 P0 R8');
    expect(miniProgressCommand(100, 0)).toBe('M73 P100 R0');
    expect(() => miniProgressCommand(101, 0)).toThrow(/percent/);
    expect(() => miniProgressCommand(50, 1.5)).toThrow(/minutes/);
    expect(remainingMinutesCeil(448)).toBe(8);
  });

  it('matches the PrusaSlicer normal-mode comment shape', () => {
    expect(formatDurationDhms(24 * 60 + 24.9)).toBe('24m 24s');
    expect(formatDurationDhms(38)).toBe('38s');
    expect(estimatedPrintingTimeComment(4_489)).toBe('; estimated printing time (normal mode) = 1h 14m 49s');
  });
});

/** Test-only decoder written around the QOI wire grammar, independently from
 * the production encoder's branch structure. */
function decodeQoiIndependent(bytes: Uint8Array): { width: number; height: number; channels: number; pixels: Uint8Array } {
  expect(Array.from(bytes.slice(0, 4))).toEqual([0x71, 0x6f, 0x69, 0x66]);
  const width = readU32(bytes, 4), height = readU32(bytes, 8), channels = bytes[12]!;
  const output = new Uint8Array(width * height * channels);
  const cache = new Uint8Array(64 * 4);
  let r = 0, g = 0, b = 0, a = 255, source = 14, target = 0, run = 0;
  for (let pixel = 0; pixel < width * height; pixel++) {
    if (run > 0) run--;
    else {
      const op = bytes[source++]!;
      if (op === 0xfe) { r = bytes[source++]!; g = bytes[source++]!; b = bytes[source++]!; }
      else if (op === 0xff) { r = bytes[source++]!; g = bytes[source++]!; b = bytes[source++]!; a = bytes[source++]!; }
      else if ((op & 0xc0) === 0) {
        const slot = (op & 63) * 4; r = cache[slot]!; g = cache[slot + 1]!; b = cache[slot + 2]!; a = cache[slot + 3]!;
      } else if ((op & 0xc0) === 0x40) {
        r = byte(r + ((op >> 4) & 3) - 2); g = byte(g + ((op >> 2) & 3) - 2); b = byte(b + (op & 3) - 2);
      } else if ((op & 0xc0) === 0x80) {
        const next = bytes[source++]!, dg = (op & 63) - 32;
        r = byte(r + dg + (next >> 4) - 8); g = byte(g + dg); b = byte(b + dg + (next & 15) - 8);
      } else run = op & 63;
      const slot = ((r * 3 + g * 5 + b * 7 + a * 11) & 63) * 4;
      cache[slot] = r; cache[slot + 1] = g; cache[slot + 2] = b; cache[slot + 3] = a;
    }
    output[target++] = r; output[target++] = g; output[target++] = b;
    if (channels === 4) output[target++] = a;
  }
  return { width, height, channels, pixels: output };
}

function readU32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;
}
function byte(value: number): number { return value & 255; }

function base64DecodeIndependent(text: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const output: number[] = [];
  for (let index = 0; index < text.length; index += 4) {
    const a = alphabet.indexOf(text[index]!); const b = alphabet.indexOf(text[index + 1]!);
    const c = text[index + 2] === '=' ? 0 : alphabet.indexOf(text[index + 2]!);
    const d = text[index + 3] === '=' ? 0 : alphabet.indexOf(text[index + 3]!);
    output.push((a << 2) | (b >> 4));
    if (text[index + 2] !== '=') output.push(((b & 15) << 4) | (c >> 2));
    if (text[index + 3] !== '=') output.push(((c & 3) << 6) | d);
  }
  return new Uint8Array(output);
}
