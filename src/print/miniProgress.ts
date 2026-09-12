import { estimatedPrintingTimeComment, miniProgressCommand, remainingMinutesCeil } from './miniMetadata';

export interface MiniProgressResult {
  text: string;
  commandedSeconds: number;
}

interface Position { x: number; y: number; z: number }
interface ParsedLine { text: string; seconds: number; elapsed: number; refreshAfter: boolean; finishBarrier: boolean }

const ESTIMATE_PREFIX = '; estimated printing time (normal mode) = ';
const GENERATED_M73 = /^M73\s+P\d+\s+R\d+\s*(?:;.*)?$/;

/** Add MINI progress to final, quantized G-code text. The estimate deliberately
 * covers commanded motion, stationary extrusion and G4 P dwell only. */
export function addMiniProgress(program: string): MiniProgressResult {
  if (program.length > 20_000_000) throw new RangeError('G-code exceeds the progress annotation budget.');
  const sourceLines = program.split(/\r?\n/).filter((line) => !line.startsWith(ESTIMATE_PREFIX) && !GENERATED_M73.test(line.trim()));
  if (sourceLines.length > 150_000) throw new RangeError('G-code exceeds the progress line budget.');

  const parsed = parseCommandedTimeline(sourceLines);
  const commandedSeconds = parsed.length === 0 ? 0 : parsed.at(-1)!.elapsed;
  const finishBarrier = findFinishBarrier(parsed);
  if (parsed.slice(finishBarrier + 1).some((line) => line.seconds > 0)) {
    throw new Error('Timed commands occur after the finish M400 barrier.');
  }
  const estimate = estimatedPrintingTimeComment(commandedSeconds);
  if (estimate.slice(ESTIMATE_PREFIX.length).length > 15) {
    throw new RangeError('Estimated duration does not fit the MINI 15-character display field.');
  }

  const firstCommand = parsed.findIndex((line) => isCommand(line.text));
  if (firstCommand < 0) throw new Error('G-code has no commands.');

  const output: string[] = [estimate];
  let lastProgressElapsed = 0;
  let emittedInitial = false;
  for (let index = 0; index < parsed.length; index++) {
    const line = parsed[index]!;
    if (index === firstCommand) {
      output.push(miniProgressCommand(0, remainingMinutesCeil(commandedSeconds)));
      emittedInitial = true;
    }
    output.push(line.text);

    if (index === finishBarrier) {
      output.push(miniProgressCommand(100, 0));
      continue;
    }
    if (line.seconds > 60.000_001) {
      throw new RangeError(`A single command leaves ${line.seconds.toFixed(3)} commanded seconds between M73 updates.`);
    }
    if (index > finishBarrier || line.elapsed >= commandedSeconds) continue;

    const elapsedSinceProgress = line.elapsed - lastProgressElapsed;
    if (line.refreshAfter || elapsedSinceProgress >= 30) {
      if (elapsedSinceProgress > 60.000_001) {
        throw new RangeError(`A single command leaves ${elapsedSinceProgress.toFixed(3)} commanded seconds between M73 updates.`);
      }
      output.push(progressAt(line.elapsed, commandedSeconds));
      lastProgressElapsed = line.elapsed;
    }
  }
  if (!emittedInitial) throw new Error('Initial M73 was not emitted.');

  while (output.at(-1) === '') output.pop();
  output.push(estimate);
  return { text: `${output.join('\n')}\n`, commandedSeconds };
}

function parseCommandedTimeline(lines: readonly string[]): ParsedLine[] {
  const result: ParsedLine[] = [];
  let elapsed = 0, feedMmMin = 0;
  let homed = false, postHomeZ: number | null = null, position: Position | null = null;
  let millimetres = false, absoluteXyz = false, relativeE = false;

  for (const text of lines) {
    const code = text.split(';', 1)[0]!.trim();
    const command = code.match(/^([GMT]\d+)\b/)?.[1] ?? '';
    const words = parseWords(code.slice(command.length));
    let seconds = 0;

    if (command === 'G20') throw new Error('Progress timing does not support inch units.');
    if (command === 'G21') millimetres = true;
    if (command === 'G91') throw new Error('Progress timing does not support relative XYZ.');
    if (command === 'G90') absoluteXyz = true;
    if (command === 'M82') throw new Error('Progress timing does not support absolute extrusion.');
    if (command === 'M83') relativeE = true;
    if (command === 'G28') { homed = true; postHomeZ = null; position = null; }

    if (command === 'G0' || command === 'G1') {
      if (Object.keys(words).some((word) => !['X', 'Y', 'Z', 'E', 'F'].includes(word))) {
        throw new Error(`Unsupported motion word: ${text}`);
      }
      if (!millimetres || !absoluteXyz || !relativeE) throw new Error(`Motion before G21/G90/M83 initialization: ${text}`);
      if (!homed) throw new Error(`Motion before G28: ${text}`);
      if (words.F !== undefined) feedMmMin = words.F;
      if (!(feedMmMin > 0)) throw new Error(`Motion has no positive feed: ${text}`);
      if (!position) {
        if (postHomeZ === null && words.Z !== undefined && words.X === undefined && words.Y === undefined) {
          postHomeZ = words.Z;
        } else if (postHomeZ !== null && words.X !== undefined && words.Y !== undefined) {
          position = { x: words.X, y: words.Y, z: postHomeZ };
        } else {
          throw new Error(`Cannot resolve first post-home position: ${text}`);
        }
      } else {
        const next: Position = { x: words.X ?? position.x, y: words.Y ?? position.y, z: words.Z ?? position.z };
        const distance = Math.hypot(next.x - position.x, next.y - position.y, next.z - position.z);
        const timedDistance = distance > 0 ? distance : Math.abs(words.E ?? 0);
        seconds = timedDistance / (feedMmMin / 60);
        position = next;
      }
    } else if (command === 'G4') {
      if (words.P === undefined || Object.keys(words).some((word) => word !== 'P')) {
        throw new Error(`Only G4 P millisecond dwell is supported: ${text}`);
      }
      seconds = words.P / 1_000;
    }

    if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`Invalid commanded duration: ${text}`);
    elapsed += seconds;
    result.push({
      text, seconds, elapsed,
      refreshAfter: command === 'M109' || command === 'M190' || command === 'G29',
      finishBarrier: command === 'M400',
    });
  }
  return result;
}

function findFinishBarrier(lines: readonly ParsedLine[]): number {
  let finishPhase = false, barrier = -1;
  lines.forEach((line, index) => {
    if (line.text.trim() === '; NP3DP_PHASE finish') finishPhase = true;
    if (finishPhase && line.finishBarrier) barrier = index;
  });
  if (barrier < 0) throw new Error('Finish phase has no M400 motion barrier.');
  return barrier;
}

function progressAt(elapsed: number, total: number): string {
  const percent = total > 0 ? Math.min(99, Math.floor(elapsed / total * 100)) : 0;
  return miniProgressCommand(percent, remainingMinutesCeil(Math.max(0, total - elapsed)));
}

function parseWords(text: string): Record<string, number> {
  const words: Record<string, number> = {};
  const pattern = /(?:^|\s)([A-Z])([-+]?(?:\d+(?:\.\d*)?|\.\d+))/g;
  for (const match of text.matchAll(pattern)) {
    const name = match[1]!, value = Number(match[2]);
    if (Object.hasOwn(words, name) || !Number.isFinite(value)) throw new Error(`Invalid or duplicate ${name} word.`);
    words[name] = value;
  }
  return words;
}

function isCommand(text: string): boolean { return /^[GMT]\d+\b/.test(text.trim()); }
