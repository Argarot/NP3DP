/** Independent structural check of the final ASCII thumbnail payloads. Does
 * not call the encoder; checks QOI operation lengths and decoded pixel count. */
export function inspectMiniDisplayMetadata(text: string, commandedSeconds: number): string[] {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/);
  const firstCommand = lines.findIndex((line) => /^[GM]\d/.test(line));
  const expected = new Set(['220x124', '200x240']);
  const estimate = lines[0]?.match(/^; estimated printing time \(normal mode\) = (.+)$/)?.[1];
  if (!estimate || estimate.length > 15 || !/^(?:\d+d )?(?:\d+h )?(?:\d+m )?\d+s$/.test(estimate)) errors.push('Missing or invalid MINI duration header.');
  const durationLines = lines.filter((line) => line.startsWith('; estimated printing time (normal mode) = '));
  if (durationLines.length !== 2 || lines.filter((line) => line.trim() !== '').at(-1) !== lines[0] || durationLines[1] !== lines[0]) errors.push('MINI duration metadata must match at the file head and tail.');
  const units: Record<string, number> = { d: 86400, h: 3600, m: 60, s: 1 };
  let displayedSeconds = 0;
  for (const part of (estimate ?? '').matchAll(/(\d+)([dhms])/g)) displayedSeconds += Number(part[1]) * units[part[2]!]!;
  const expectedSeconds = commandedSeconds >= 60 ? Math.floor(commandedSeconds) : Math.round(commandedSeconds);
  if (displayedSeconds !== expectedSeconds) errors.push('MINI displayed duration differs from independently parsed command time.');
  for (let line = 0; line < Math.min(firstCommand, 1805); line++) {
    const match = lines[line]?.match(/^; thumbnail_QOI begin (\d+)x(\d+) (\d+)$/);
    if (!match) continue;
    const width = Number(match[1]), height = Number(match[2]), key = `${width}x${height}`;
    if (!expected.delete(key)) { errors.push('Unexpected or repeated MINI thumbnail size.'); break; }
    let base64 = '';
    let ended = false;
    while (++line < firstCommand && line < 1805) {
      const row = lines[line]!;
      if (row === '; thumbnail_QOI end') { ended = true; break; }
      if (!/^; [A-Za-z0-9+/=]{1,78}$/.test(row)) { errors.push('Invalid thumbnail base64 row.'); break; }
      base64 += row.slice(2);
    }
    if (!ended || base64.length !== Number(match[3])) { errors.push('Thumbnail payload length/end differs from its header.'); continue; }
    try {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      if (!validQoi(bytes, width, height)) errors.push('Thumbnail QOI dimensions, operations or end marker are invalid.');
    } catch { errors.push('Invalid thumbnail base64 encoding.'); }
  }
  if (expected.size) errors.push(`Missing early MINI LCD thumbnail(s): ${[...expected].join(', ')}.`);
  return errors;
}

function validQoi(bytes: Uint8Array, width: number, height: number): boolean {
  if (bytes.length < 22 || width * height > 100_000) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== 0x716f6966 || view.getUint32(4) !== width || view.getUint32(8) !== height || ![3, 4].includes(bytes[12]!) || bytes[13]! > 1) return false;
  const end = bytes.length - 8;
  if (bytes.at(-1) !== 1 || bytes.slice(end, -1).some((value) => value !== 0)) return false;
  let offset = 14, pixels = 0;
  while (offset < end && pixels < width * height) {
    const op = bytes[offset++]!;
    if (op === 0xfe) { offset += 3; pixels++; }
    else if (op === 0xff) { offset += 4; pixels++; }
    else if ((op & 0xc0) === 0x80) { offset++; pixels++; }
    else if ((op & 0xc0) === 0xc0) pixels += (op & 0x3f) + 1;
    else pixels++;
  }
  return pixels === width * height && offset === end;
}
