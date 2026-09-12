import type { Vec3 } from '../domain/types';
import type { PrintSetup } from './types';
import { inspectMiniDisplayMetadata } from './auditDisplay';

export interface MiniAudit {
  errors: string[];
  moveCount: number;
  bodyMoveCount: number;
  bodyExtrusionMm: number;
  bodyDwellSeconds: number;
  depositedFilamentMm: number;
  commandedSeconds: number;
  maximumFlowMm3S: number;
  shutdownComplete: boolean;
  startupExtrusionMm: number;
  purgeComplete: boolean;
  progressUpdates: number;
}

type Stage = 'startup' | 'body' | 'finish';
type BodyStage = 'approach' | 'foundation' | 'transition' | 'wall' | 'rim';

const XYZ_TOLERANCE_MM = 0.001;
const PROBE_NOZZLE_C = 170;
const CLEARANCE_Z_MM = 2;
const FINISH_LIFT_MM = 5;
const FINISH_RETRACT_MM = 0.8;
const FINISH_PARK_X_MM = 10;
const FINISH_PARK_Y_MM = 170;

/** Independent interpreter for the deliberately small MINI export dialect.
 * It parses final text, including startup and finish, rather than trusting
 * generated events. Thermal waits/probing/homing have no predicted duration. */
export function auditMiniGcode(text: string, setup: PrintSetup): MiniAudit {
  const result: MiniAudit = {
    errors: [], moveCount: 0, bodyMoveCount: 0, bodyExtrusionMm: 0,
    bodyDwellSeconds: 0, depositedFilamentMm: 0, commandedSeconds: 0,
    maximumFlowMm3S: 0, shutdownComplete: false, startupExtrusionMm: 0, purgeComplete: false, progressUpdates: 0,
  };
  const fail = (line: number, message: string) => {
    if (result.errors.length < 30) result.errors.push(`Line ${line}: ${message}`);
  };
  if (text.length > 20_000_000) {
    fail(0, 'File exceeds the audit budget.');
    return result;
  }

  const firstNozzle = quantized(setup.material.firstLayerNozzleC);
  const firstBed = quantized(setup.material.firstLayerBedC);
  const bodyNozzle = quantized(setup.material.nozzleC);
  const bodyBed = quantized(setup.material.bedC);
  const expectedAcceleration = quantized(setup.printer.accelerationMmS2);
  const expectedFanPwm = Math.round(setup.material.fanPercent * 255 / 100);

  let position: Vec3 | null = null;
  let postHomeZ: number | null = null;
  let feed = 0;
  let nozzle = 0;
  let bed = 0;
  let readyNozzle = 0;
  let readyBed = 0;
  let nozzleWaitedForTarget = false;
  let bedWaitedForTarget = false;
  let fan = 0;
  let millimetres = false;
  let absolute = false;
  let relativeE = false;
  let linearE = false;
  let flowReset = false;
  let speedReset = false;
  let pressureReset = false;
  let accelerationSet = false;
  let fanInitialized = false;
  let homed = false;
  let mesh = false;
  let disabled = false;
  let modelCheck = false;
  let nozzleCheck = false;
  let startupExtrusion = false;
  let purgeStep = 0;
  let lastPercent = -1, lastRemaining = Infinity, lastProgressSeconds = 0;
  let progressFinished = false;
  const progressRecords: { percent: number; remaining: number; elapsed: number }[] = [];
  let needsPostWaitProgress = false;
  let stage: Stage = 'startup';
  let bodyStage: BodyStage = 'approach';
  let enteredBody = false;
  let enteredFinish = false;
  let sawFoundation = false;
  let sawTransition = false;
  let sawWall = false;
  let fanTransitionPending = false;
  let retractDebt = 0;
  let maximumBodyZ = -Infinity;
  let finishRetracted = false;
  let finishLifted = false;
  let finishParked = false;
  let finishBarrier = false;
  let finishNozzleOff = false;
  let finishBedOff = false;
  let finishFanOff = false;
  let finishPressureReset = false;
  let finishFlowReset = false;
  const filamentArea = Math.PI * (1.75 / 2) ** 2;

  const lines = text.split(/\r?\n/);
  if (lines.length > 150_000) {
    fail(0, 'File exceeds the line budget.');
    return result;
  }

  lines.forEach((original, offset) => {
    const n = offset + 1;
    if (original === '; NP3DP_PHASE body') {
      if (enteredBody || enteredFinish) fail(n, 'Unexpected body boundary.');
      if (!startupExtrusion || !position || !mesh || purgeStep !== 5) fail(n, 'Body begins before the probed, primed startup and complete two-segment purge.');
      if (!atFirstLayerTargets()) fail(n, 'Body begins without resolved first-layer temperature states.');
      enteredBody = true;
      stage = 'body';
      maximumBodyZ = position?.z ?? -Infinity;
      return;
    }
    if (original === '; NP3DP_PHASE finish') {
      if (!enteredBody || enteredFinish) fail(n, 'Unexpected finish boundary.');
      if (!sawFoundation || !sawTransition || !sawWall) fail(n, 'Finish begins before required body stages.');
      if (fanTransitionPending || fan !== expectedFanPwm) fail(n, 'Finish begins without the resolved transition fan state.');
      if (!position || result.bodyExtrusionMm <= 0) fail(n, 'Finish begins without a resolved extruded body.');
      enteredFinish = true;
      stage = 'finish';
      return;
    }
    if (original.startsWith('; STAGE ')) {
      if (stage !== 'body') {
        fail(n, 'Stage marker outside the body.');
        return;
      }
      const named = original.slice('; STAGE '.length);
      if (named === 'foundation') {
        if (bodyStage !== 'approach' || sawFoundation) fail(n, 'Unexpected foundation stage.');
        sawFoundation = true;
        bodyStage = 'foundation';
      } else if (named === 'transition') {
        if (bodyStage !== 'foundation' || sawTransition) fail(n, 'Unexpected transition stage.');
        sawTransition = true;
        bodyStage = 'transition';
        fanTransitionPending = true;
      } else if (named === 'wall') {
        if (bodyStage !== 'transition' || fanTransitionPending || fan !== expectedFanPwm || sawWall) fail(n, 'Unexpected wall stage or unresolved transition fan.');
        sawWall = true;
        bodyStage = 'wall';
      } else if (named === 'rim') {
        if (bodyStage !== 'wall' || !sawWall) fail(n, 'Unexpected rim stage.');
        bodyStage = 'rim';
      } else {
        fail(n, 'Unsupported body stage.');
      }
      return;
    }

    const code = original.split(';', 1)[0]!.trim();
    if (!code) return;
    if (result.progressUpdates === 0 && !code.startsWith('M73 ')) fail(n, 'The first executable command must initialize MINI progress.');
    if (needsPostWaitProgress && !code.startsWith('M73 ')) fail(n, 'A thermal/probe wait must be followed by a progress refresh.');
    needsPostWaitProgress = /^(?:M109|M190|G29)(?:\s|$)/.test(code);
    if (disabled) {
      fail(n, 'Command after motor shutdown.');
      return;
    }
    if (code === 'M862.3 P"MINI"') {
      if (stage !== 'startup') fail(n, 'Model check outside startup.');
      modelCheck = true;
      return;
    }

    const tokens = code.split(/\s+/);
    const command = tokens.shift()!;
    if (!/^[GM]\d+(?:\.\d+)?$/.test(command)) {
      fail(n, 'Malformed command.');
      return;
    }
    const words: Record<string, number> = Object.create(null) as Record<string, number>;
    for (const token of tokens) {
      const match = /^([A-Z])(-?(?:\d+(?:\.\d*)?|\.\d+))$/.exec(token);
      if (!match || !Number.isFinite(Number(match[2]))) {
        fail(n, `Malformed parameter ${token}.`);
        return;
      }
      if (Object.hasOwn(words, match[1]!)) {
        fail(n, `Duplicate parameter ${match[1]}.`);
        return;
      }
      words[match[1]!] = Number(match[2]);
    }
    const exact = (required: string[], optional: string[] = []) => {
      const valid = required.every((key) => Object.hasOwn(words, key))
        && Object.keys(words).every((key) => required.includes(key) || optional.includes(key));
      if (!valid) fail(n, `Invalid parameters for ${command}.`);
      return valid;
    };

    switch (command) {
      case 'M73':
        if (!exact(['P', 'R'])) break;
        if (!Number.isInteger(words.P) || words.P! < 0 || words.P! > 100 || !Number.isInteger(words.R) || words.R! < 0 || words.R! > 0xffff_ffff) fail(n, 'Invalid MINI progress values.');
        if (result.progressUpdates === 0 && words.P !== 0) fail(n, 'Progress must begin at zero.');
        if (words.P! < lastPercent || words.R! > lastRemaining) fail(n, 'Progress or remaining time moved backwards.');
        if (words.P === 100 && (stage !== 'finish' || !finishBarrier || words.R !== 0)) fail(n, 'Completion progress requires the finished motion barrier and zero remaining time.');
        if (words.R === 0 && words.P !== 100) fail(n, 'Zero remaining time is reserved for completion.');
        if (result.commandedSeconds - lastProgressSeconds > 60.001) fail(n, 'Progress refresh interval exceeds the adapter budget.');
        lastPercent = words.P!; lastRemaining = words.R!; lastProgressSeconds = result.commandedSeconds;
        progressFinished = words.P === 100;
        result.progressUpdates++;
        progressRecords.push({ percent: words.P!, remaining: words.R!, elapsed: result.commandedSeconds });
        break;
      case 'G21':
        if (exact([]) && stage === 'startup') millimetres = true;
        else if (stage !== 'startup') fail(n, 'Unit mode change outside startup.');
        break;
      case 'G90':
        if (exact([]) && stage === 'startup') absolute = true;
        else if (stage !== 'startup') fail(n, 'XYZ mode change outside startup.');
        break;
      case 'M83':
        if (exact([]) && stage === 'startup') relativeE = true;
        else if (stage !== 'startup') fail(n, 'Extrusion mode change outside startup.');
        break;
      case 'M200':
        if (exact(['D']) && words.D === 0 && stage === 'startup') linearE = true;
        else fail(n, 'Volumetric E must be disabled in startup.');
        break;
      case 'M220':
        if (exact(['S']) && words.S === 100 && stage === 'startup') speedReset = true;
        else fail(n, 'Speed scaling must equal 100% in startup.');
        break;
      case 'M221':
        if (!exact(['S']) || words.S !== 100) {
          fail(n, 'Flow scaling must equal 100%.');
        } else if (stage === 'startup') {
          flowReset = true;
        } else if (stage === 'finish' && finishBarrier) {
          finishFlowReset = true;
        } else {
          fail(n, 'Flow reset appears outside an allowed startup or finish position.');
        }
        break;
      case 'M572':
        if (stage === 'startup') {
          if (exact(['S', 'W']) && words.S === 0 && words.W === 0.04) pressureReset = true;
          else fail(n, 'Startup pressure-advance reset must be M572 S0 W0.04.');
        } else if (stage === 'finish' && finishBarrier) {
          if (exact(['S']) && words.S === 0) finishPressureReset = true;
          else fail(n, 'Finish pressure-advance reset must be M572 S0.');
        } else {
          fail(n, 'Pressure-advance command outside an allowed startup or finish position.');
        }
        break;
      case 'M862.1':
        if (exact(['P']) && words.P === 0.4 && stage === 'startup') nozzleCheck = true;
        else fail(n, 'Missing startup 0.4 mm nozzle check.');
        break;
      case 'M204':
        if (stage !== 'startup') fail(n, 'Acceleration change outside startup.');
        if (exact(['P', 'R', 'T'])
          && [words.P, words.R, words.T].every((value) => value === expectedAcceleration)) {
          accelerationSet = true;
        } else {
          fail(n, 'Acceleration differs from the quantized resolved setup.');
        }
        break;
      case 'M104':
      case 'M109':
        parseNozzle(command === 'M109', n, words, command);
        break;
      case 'M140':
      case 'M190':
        parseBed(command === 'M190', n, words, command);
        break;
      case 'G28':
        if (exact([])) {
          if (stage !== 'startup' || homed) fail(n, 'Unexpected homing command.');
          homed = true;
          mesh = false;
          position = null;
          postHomeZ = null;
        }
        break;
      case 'G29':
        if (exact([])) {
          if (stage !== 'startup' || !homed || mesh || nozzle !== PROBE_NOZZLE_C
            || !nozzleWaitedForTarget || readyNozzle !== PROBE_NOZZLE_C
            || bed !== firstBed || !bedWaitedForTarget || readyBed !== firstBed) {
            fail(n, 'Mesh requires homing and exact completed probing-temperature waits.');
          }
          mesh = true;
        }
        break;
      case 'G92':
        if (!exact(['E']) || words.E !== 0) fail(n, 'Only G92 E0 is supported.');
        if (stage === 'startup' && purgeStep === 3) purgeStep = 4;
        break;
      case 'M107':
        if (!exact([])) break;
        if (stage === 'startup') {
          fan = 0;
          fanInitialized = true;
        } else if (stage === 'finish' && finishBarrier) {
          fan = 0;
          finishFanOff = true;
        } else {
          fail(n, 'Fan-off command outside an allowed startup or finish position.');
        }
        break;
      case 'M106':
        if (!exact(['S'])) break;
        if (stage !== 'body' || bodyStage !== 'transition' || !fanTransitionPending
          || words.S !== expectedFanPwm) {
          fail(n, 'Transition fan PWM differs from the resolved setup or appears in the wrong stage.');
        } else {
          fan = words.S!;
          fanTransitionPending = false;
        }
        break;
      case 'G4':
        if (exact(['P'])) {
          if (!Number.isInteger(words.P) || words.P! < 0 || words.P! > 60_000) fail(n, 'Invalid dwell.');
          if (stage === 'finish') fail(n, 'Dwell is not allowed in the finish sequence.');
          requireFanForBodyMotion(n);
          result.commandedSeconds += words.P! / 1_000;
          if (stage === 'body') result.bodyDwellSeconds += words.P! / 1_000;
        }
        break;
      case 'G0':
      case 'G1':
        parseMotion(command, n, words);
        break;
      case 'M400':
        if (exact([])) {
          if (stage !== 'finish' || !finishParked || finishBarrier) fail(n, 'Finish barrier must follow the completed park move exactly once.');
          else finishBarrier = true;
        }
        break;
      case 'M84':
        if (exact([])) {
          if (stage !== 'finish' || !finishBarrier || !finishNozzleOff || !finishBedOff
            || !finishFanOff || !finishPressureReset || !finishFlowReset
            || nozzle !== 0 || bed !== 0 || fan !== 0) {
            fail(n, 'Incomplete controlled shutdown.');
          }
          disabled = true;
        }
        break;
      default:
        fail(n, `Unsupported command ${command}.`);
    }
  });

  result.shutdownComplete = disabled && enteredBody && enteredFinish && finishRetracted
    && finishLifted && finishParked && finishBarrier && finishNozzleOff && finishBedOff
    && finishFanOff && finishPressureReset && finishFlowReset;
  if (!result.shutdownComplete) fail(lines.length, 'Missing body or controlled finish.');
  if (result.bodyExtrusionMm <= 0) fail(lines.length, 'No body extrusion.');
  result.purgeComplete = purgeStep === 5;
  if (!progressFinished || result.progressUpdates < 2) fail(lines.length, 'Missing initial/complete progress metadata.');
  for (const record of progressRecords) {
    const finished = record.percent === 100;
    const percent = finished ? 100 : Math.min(99, Math.floor(record.elapsed / result.commandedSeconds * 100));
    const remaining = finished ? 0 : Math.ceil(Math.max(0, result.commandedSeconds - record.elapsed) / 60);
    if (record.percent !== percent || record.remaining !== remaining) { fail(lines.length, 'Progress values disagree with independently parsed command time.'); break; }
  }
  for (const error of inspectMiniDisplayMetadata(text, result.commandedSeconds)) fail(0, error);
  return result;

  function initializedForMotion(): boolean {
    return millimetres && absolute && relativeE && linearE && flowReset && speedReset
      && pressureReset && accelerationSet && fanInitialized;
  }

  function atFirstLayerTargets(): boolean {
    return nozzle === firstNozzle && readyNozzle === firstNozzle && nozzleWaitedForTarget
      && bed === firstBed && readyBed === firstBed && bedWaitedForTarget;
  }

  function atRequiredBodyTargets(z: number): boolean {
    const beyondFirstLayer = z > quantized(setup.foundation.layerHeightMm) + 0.0001;
    const expectedNozzle = beyondFirstLayer ? bodyNozzle : firstNozzle;
    const expectedBed = beyondFirstLayer ? bodyBed : firstBed;
    return nozzle === expectedNozzle && bed === expectedBed
      && readyNozzle >= nozzle && readyBed >= bed;
  }

  function parseNozzle(wait: boolean, n: number, parameters: Record<string, number>, commandName: string): void {
    if (!exactTemperatureWord(wait, n, parameters, commandName)) return;
    const target = parameters[wait ? 'R' : 'S']!;
    if (target < 0 || target > 240) fail(n, 'Nozzle temperature is outside the adapter range.');
    if (stage === 'finish') {
      if (wait || target !== 0 || !finishBarrier) fail(n, 'Finish nozzle shutdown must be M104 S0 after the park barrier.');
      else finishNozzleOff = true;
    } else if (stage === 'startup') {
      const expected = mesh ? firstNozzle : PROBE_NOZZLE_C;
      const expectedWait = mesh || target === PROBE_NOZZLE_C && wait;
      if (target !== expected || wait !== expectedWait) fail(n, 'Unexpected startup nozzle target or wait mode.');
    } else {
      const waitModeValid = bodyNozzle === firstNozzle
        || wait === (bodyNozzle > firstNozzle);
      if (target !== bodyNozzle || !waitModeValid) fail(n, 'Body nozzle target or wait mode differs from the resolved setup.');
    }
    nozzle = target;
    nozzleWaitedForTarget = wait;
    if (wait) readyNozzle = target;
    else if (target === 0) readyNozzle = 0;
  }

  function parseBed(wait: boolean, n: number, parameters: Record<string, number>, commandName: string): void {
    if (!exactTemperatureWord(wait, n, parameters, commandName)) return;
    const target = parameters[wait ? 'R' : 'S']!;
    if (target < 0 || target > 80) fail(n, 'Bed temperature is outside the adapter range.');
    if (wait && target === 0) fail(n, 'An unheated bed must use explicit heater-off state without a cooling wait to zero.');
    if (stage === 'finish') {
      if (wait || target !== 0 || !finishBarrier) fail(n, 'Finish bed shutdown must be M140 S0 after the park barrier.');
      else finishBedOff = true;
    } else if (stage === 'startup') {
      if (target !== firstBed || wait === false && bed !== 0) fail(n, 'Unexpected startup bed target or duplicate non-wait command.');
    } else {
      const waitModeValid = bodyBed === firstBed || wait === (bodyBed > firstBed);
      if (target !== bodyBed || !waitModeValid) fail(n, 'Body bed target or wait mode differs from the resolved setup.');
    }
    bed = target;
    // Zero means heater disabled, not a physical temperature to wait for.
    bedWaitedForTarget = wait || target === 0;
    if (wait) readyBed = target;
    else if (target === 0) readyBed = 0;
  }

  function exactTemperatureWord(
    wait: boolean,
    n: number,
    parameters: Record<string, number>,
    commandName: string,
  ): boolean {
    const required = wait ? 'R' : 'S';
    const valid = Object.keys(parameters).length === 1 && Object.hasOwn(parameters, required);
    if (!valid) fail(n, `Invalid parameters for ${commandName}.`);
    return valid;
  }

  function requireFanForBodyMotion(n: number): void {
    if (stage !== 'body') return;
    if (bodyStage === 'foundation' || bodyStage === 'approach') {
      if (fan !== 0) fail(n, 'Fan must remain off through the foundation.');
    } else if (fanTransitionPending || fan !== expectedFanPwm) {
      fail(n, 'Body motion requires the resolved transition fan PWM.');
    }
  }

  function parseMotion(commandName: 'G0' | 'G1', n: number, parameters: Record<string, number>): void {
    if (!exactMotionWords(n, parameters, commandName)) return;
    if (!initializedForMotion()) fail(n, 'Motion before explicit unit/extrusion/process state initialization.');
    if (!homed) fail(n, 'Motion before homing.');
    if (parameters.F !== undefined) feed = parameters.F;
    if (!(feed > 0)) fail(n, 'Motion feed is missing or non-positive.');

    const hasPosition = ['X', 'Y', 'Z'].some((key) => parameters[key] !== undefined);
    const hasExtrusion = parameters.E !== undefined;
    if (!hasPosition && !hasExtrusion) fail(n, 'Motion command has no axis or extrusion word.');
    if (commandName === 'G0' && hasExtrusion) fail(n, 'Travel command carries an E word.');
    if (commandName === 'G1' && !hasExtrusion) fail(n, 'G1 requires an extrusion word in this dialect.');

    if (!position) {
      if (postHomeZ === null) {
        const clearance = commandName === 'G0' && parameters.Z !== undefined
          && parameters.X === undefined && parameters.Y === undefined && parameters.E === undefined;
        if (!clearance) {
          fail(n, 'First post-home motion must be a Z-only clearance lift.');
          return;
        }
        if (!mesh || parameters.Z! < CLEARANCE_Z_MM || parameters.Z! > 180
          || feed / 60 > setup.printer.maxZSpeedMmS + 0.001) {
          fail(n, 'Invalid post-probe clearance move.');
        }
        postHomeZ = parameters.Z!;
        result.moveCount++;
        return;
      }
      const resolveXy = commandName === 'G0' && parameters.X !== undefined && parameters.Y !== undefined
        && parameters.Z === undefined && parameters.E === undefined;
      if (!resolveXy) {
        fail(n, 'Post-home XY must resolve at the completed clearance height.');
        return;
      }
      if (feed / 60 > setup.printer.maxXySpeedMmS + 0.001) fail(n, 'Post-home XY feed exceeds the selected limit.');
      position = { x: parameters.X!, y: parameters.Y!, z: postHomeZ };
      if (position.x !== 5 || position.y !== 6 || position.z !== 2) fail(n, 'Purge approach must resolve X5 Y6 at Z2.');
      checkEnvelope(position, n);
      result.moveCount++;
      return;
    }

    const next: Vec3 = hasPosition
      ? { x: parameters.X ?? position.x, y: parameters.Y ?? position.y, z: parameters.Z ?? position.z }
      : position;
    checkEnvelope(next, n);
    const length = Math.hypot(next.x - position.x, next.y - position.y, next.z - position.z);
    const seconds = length > 0 ? length / (feed / 60)
      : hasExtrusion ? Math.abs(parameters.E!) / (feed / 60) : 0;
    if (length > 0) {
      if (Math.hypot(next.x - position.x, next.y - position.y) / length * feed / 60
        > setup.printer.maxXySpeedMmS + 0.001) fail(n, 'Parsed XY component exceeds the selected limit.');
      if (Math.abs(next.z - position.z) / length * feed / 60
        > setup.printer.maxZSpeedMmS + 0.001) fail(n, 'Parsed Z component exceeds the selected limit.');
    }

    const e = parameters.E ?? 0;
    if (stage === 'startup' && purgeStep < 5) {
      const only = (...names: string[]) => Object.keys(parameters).every((name) => names.includes(name));
      if (purgeStep === 0 && commandName === 'G0' && only('Z', 'F') && next.z === 0.2) purgeStep = 1;
      else if (purgeStep === 1 && commandName === 'G1' && only('X', 'Y', 'E', 'F') && next.x === 65 && next.y === 6 && next.z === 0.2 && e === 8) purgeStep = 2;
      else if (purgeStep === 2 && commandName === 'G1' && only('X', 'Y', 'E', 'F') && next.x === 135 && next.y === 6 && next.z === 0.2 && e === 10) purgeStep = 3;
      else if (purgeStep === 4 && commandName === 'G0' && only('Z', 'F') && next.z === 2) purgeStep = 5;
      else fail(n, 'Invalid ordered purge: lower, E8 intro, E10 verification line, E reset, clearance lift required.');
    } else if (stage === 'startup' && e !== 0) fail(n, 'Unexpected extrusion after the completed purge.');
    if (stage === 'finish') {
      parseFinishMotion(commandName, next, e, hasPosition, n, parameters);
    } else {
      requireFanForBodyMotion(n);
      if (e !== 0 && (!mesh || !position || !modelCheck || !nozzleCheck)) fail(n, 'Extrusion before resolved machine checks, mesh and position.');
      if (e < 0) fail(n, 'Retraction is only allowed in the controlled finish.');
      if (e > 0) {
        if (stage === 'startup') {
          if (!atFirstLayerTargets()) fail(n, 'Startup extrusion requires exact waited first-layer targets.');
          startupExtrusion = true;
          result.startupExtrusionMm += e;
        } else if (!atRequiredBodyTargets(next.z)) {
          fail(n, 'Body extrusion does not have a complete resolved temperature pair.');
        }
      }
    }

    if (e < 0) retractDebt += -e;
    const fresh = e > 0 ? Math.max(0, e - retractDebt) : 0;
    if (e > 0) retractDebt = Math.max(0, retractDebt - e);
    if (fresh > 0) {
      if (seconds <= 0) fail(n, 'Positive extrusion without a timed movement.');
      const flow = seconds > 0 ? fresh * filamentArea / seconds : Infinity;
      result.maximumFlowMm3S = Math.max(result.maximumFlowMm3S, flow);
      if (flow > setup.material.maxFlowMm3S * 1.01 + 0.002) fail(n, 'Parsed deposition flow exceeds the selected limit.');
    }
    result.depositedFilamentMm += fresh;
    if (stage === 'body') {
      result.bodyMoveCount++;
      result.bodyExtrusionMm += Math.max(0, e);
      maximumBodyZ = Math.max(maximumBodyZ, next.z);
    }
    result.moveCount++;
    result.commandedSeconds += seconds;
    position = next;
  }

  function exactMotionWords(n: number, parameters: Record<string, number>, commandName: string): boolean {
    const allowed = ['X', 'Y', 'Z', 'E', 'F'];
    const valid = Object.keys(parameters).every((key) => allowed.includes(key));
    if (!valid) fail(n, `Invalid parameters for ${commandName}.`);
    return valid;
  }

  function parseFinishMotion(
    commandName: 'G0' | 'G1',
    next: Vec3,
    e: number,
    hasPosition: boolean,
    n: number,
    parameters: Record<string, number>,
  ): void {
    if (!finishRetracted) {
      if (commandName !== 'G1' || hasPosition || e !== -FINISH_RETRACT_MM) fail(n, 'Finish must begin with the exact 0.8 mm stationary retraction.');
      else finishRetracted = true;
      return;
    }
    if (!finishLifted) {
      const zOnly = commandName === 'G0' && parameters.Z !== undefined
        && parameters.X === undefined && parameters.Y === undefined && parameters.E === undefined;
      if (!zOnly || next.z + XYZ_TOLERANCE_MM < maximumBodyZ + FINISH_LIFT_MM) {
        fail(n, 'Finish requires a Z-only lift at least 5 mm above parsed body height.');
      } else {
        finishLifted = true;
      }
      return;
    }
    if (!finishParked) {
      const xyOnly = commandName === 'G0' && parameters.X !== undefined && parameters.Y !== undefined
        && parameters.Z === undefined && parameters.E === undefined;
      if (!xyOnly || parameters.X !== FINISH_PARK_X_MM || parameters.Y !== FINISH_PARK_Y_MM) {
        fail(n, 'Finish requires the exact X10 Y170 park after lifting.');
      } else {
        finishParked = true;
      }
      return;
    }
    fail(n, 'Unexpected motion after the finish park.');
  }

  function checkEnvelope(point: Vec3, n: number): void {
    if (point.x < 0 || point.x > 180 || point.y < 0 || point.y > 180
      || point.z < 0.05 || point.z > 180) fail(n, 'Commanded point leaves the MINI envelope.');
  }
}

function quantized(value: number): number {
  const rounded = Number(value.toFixed(3));
  return Object.is(rounded, -0) ? 0 : rounded;
}
