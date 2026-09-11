import { expect, it } from 'vitest';
import * as THREE from 'three';
import { createPathScene, disposeObject } from './scene';
import { DEFAULT_RECIPE } from '../domain/presets';
import { calculateStats } from '../domain/stats';
import type { GeneratedToolpath, ToolpathEvent } from '../domain/types';

const start = { x: 0, y: 0, z: 1 }, end = { x: 10, y: 4, z: 1 };
const events: ToolpathEvent[] = [
  { kind: 'extrude', from: start, to: end, volumeMm3: 5, speedMmS: 10, role: 'span', bandId: 'ripple' },
  { kind: 'deposit', at: end, volumeMm3: 4, volumeRateMm3S: 1, bandId: 'ripple' },
];
const path: GeneratedToolpath = { engineVersion: 'test', recipeKey: '', events, diagnostics: [], stats: calculateStats(events, 1.75) };

it('shows only the traversed portion of a long strand and grows stationary volume over time', () => {
  const scene = createPathScene(DEFAULT_RECIPE, path, 'strand', 'method');
  scene.setPlayback(0, 0.5);
  const completed = scene.root.getObjectByName('completed-strands') as THREE.InstancedMesh;
  const partial = scene.root.getObjectByName('current-strand')!;
  expect(completed.count).toBe(0);
  expect(partial.scale.y).toBeCloseTo(Math.hypot(10, 4) / 2);
  expect(partial.position.x).toBeCloseTo(2.5);
  scene.setPlayback(1, 0.25);
  expect(completed.count).toBe(1);
  expect(partial.visible).toBe(false);
  const deposit = scene.root.getObjectByName('current-deposit')!;
  expect(4 / 3 * Math.PI * deposit.scale.x ** 3).toBeCloseTo(1);
  scene.setPlayback(0, 0);
  expect(deposit.visible).toBe(false);
  expect(completed.count).toBe(0);
  disposeObject(scene.root);
});

it('clips the commanded line to the same interpolated nozzle position', () => {
  const scene = createPathScene(DEFAULT_RECIPE, path, 'path', 'method');
  scene.setPlayback(0, 0.25);
  const line = scene.root.getObjectByName('current-path') as THREE.LineSegments;
  const positions = line.geometry.getAttribute('position');
  expect([positions.getX(1), positions.getY(1), positions.getZ(1)]).toEqual([2.5, 1, -1]);
  expect(scene.root.getObjectByName('completed-strands')).toBeUndefined();
  disposeObject(scene.root);
});
