import { expect, it } from 'vitest';
import * as THREE from 'three';
import { createPathScene, disposeObject } from './scene';
import { DEFAULT_RECIPE } from '../domain/presets';
import { calculateStats } from '../domain/stats';
import type { GeneratedToolpath, ToolpathEvent } from '../domain/types';
import type { FoundationSettings } from '../print/types';

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

const foundation: FoundationSettings = {
  enabled: true,
  layers: 3,
  layerHeightMm: 0.2,
  lineWidthMm: 0.45,
  speedMmS: 20,
  blendHeightMm: 4,
  rimTurns: 1,
};

function matrixAt(mesh: THREE.InstancedMesh, index: number): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(index, matrix);
  return matrix;
}

it('renders a planar foundation from the bed through the nozzle centre height', () => {
  const foundationEvent: ToolpathEvent = {
    kind: 'extrude',
    from: { x: 0, y: 0, z: 0.2 },
    to: { x: 10, y: 0, z: 0.2 },
    volumeMm3: 1.2,
    speedMmS: 20,
    role: 'foundation',
    bandId: 'ripple',
  };
  const foundationPath: GeneratedToolpath = {
    ...path,
    events: [foundationEvent],
    stats: calculateStats([foundationEvent], 1.75),
  };
  const scene = createPathScene(DEFAULT_RECIPE, foundationPath, 'strand', 'method', foundation);
  const beads = scene.root.getObjectByName('completed-build-beads') as THREE.InstancedMesh;
  const bounds = new THREE.Box3().setFromObject(beads);
  expect(bounds.min.y).toBeCloseTo(0, 7);
  expect(bounds.max.y).toBeCloseTo(0.2, 7);
  const scale = new THREE.Vector3();
  matrixAt(beads, 0).decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
  expect(scale.x * scale.y * scale.z).toBeCloseTo(foundationEvent.volumeMm3, 6);
  disposeObject(scene.root);
});

it('preserves rectangular bead volume and traversed length during partial playback', () => {
  const foundationEvent: ToolpathEvent = {
    kind: 'extrude',
    from: { x: 0, y: 0, z: 0.2 },
    to: { x: 10, y: 0, z: 0.2 },
    volumeMm3: 1.2,
    speedMmS: 20,
    role: 'foundation',
    bandId: 'ripple',
  };
  const foundationPath: GeneratedToolpath = {
    ...path,
    events: [foundationEvent],
    stats: calculateStats([foundationEvent], 1.75),
  };
  const scene = createPathScene(DEFAULT_RECIPE, foundationPath, 'strand', 'method', foundation);
  scene.setPlayback(0, 0.25);
  const completed = scene.root.getObjectByName('completed-build-beads') as THREE.InstancedMesh;
  const partial = scene.root.getObjectByName('current-build-bead') as THREE.Mesh;
  expect(completed.count).toBe(0);
  expect(partial.visible).toBe(true);
  expect(partial.scale.y).toBeCloseTo(2.5, 10);
  expect(partial.scale.x * partial.scale.y * partial.scale.z).toBeCloseTo(0.3, 10);
  expect(partial.position.x).toBeCloseTo(1.25, 10);
  disposeObject(scene.root);
});

it('keeps body strand geometry unchanged when flattened build beads are enabled', () => {
  const mixedEvents: ToolpathEvent[] = [
    {
      kind: 'extrude', from: { x: 0, y: 0, z: 0.2 }, to: { x: 2, y: 0, z: 0.2 },
      volumeMm3: 0.2, speedMmS: 20, role: 'foundation', bandId: 'ripple',
    },
    {
      kind: 'extrude', from: { x: 2, y: 0, z: 0.2 }, to: { x: 3, y: 1, z: 1 },
      volumeMm3: 0.4, speedMmS: 10, role: 'wall', bandId: 'ripple',
    },
  ];
  const mixedPath = { ...path, events: mixedEvents, stats: calculateStats(mixedEvents, 1.75) };
  const legacy = createPathScene(DEFAULT_RECIPE, mixedPath, 'strand', 'method');
  const prepared = createPathScene(DEFAULT_RECIPE, mixedPath, 'strand', 'method', foundation);
  const legacyStrands = legacy.root.getObjectByName('completed-strands') as THREE.InstancedMesh;
  const preparedStrands = prepared.root.getObjectByName('completed-strands') as THREE.InstancedMesh;
  expect(preparedStrands.count).toBe(1);
  expect(matrixAt(preparedStrands, 0).elements).toEqual(matrixAt(legacyStrands, 1).elements);
  const legacyColor = new THREE.Color(), preparedColor = new THREE.Color();
  legacyStrands.getColorAt(1, legacyColor); preparedStrands.getColorAt(0, preparedColor);
  expect(preparedColor.getHex()).toBe(legacyColor.getHex());
  disposeObject(legacy.root); disposeObject(prepared.root);
});

it('uses distinct method grays for foundation and rim while retaining speed coloring', () => {
  const roleEvents: ToolpathEvent[] = [
    {
      kind: 'extrude', from: { x: 0, y: 0, z: 0.2 }, to: { x: 1, y: 0, z: 0.2 },
      volumeMm3: 0.1, speedMmS: 20, role: 'foundation', bandId: 'ripple',
    },
    {
      kind: 'extrude', from: { x: 1, y: 0, z: 0.2 }, to: { x: 2, y: 0, z: 0.4 },
      volumeMm3: 0.1, speedMmS: 20, role: 'rim', bandId: 'ripple',
    },
  ];
  const rolePath = { ...path, events: roleEvents, stats: calculateStats(roleEvents, 1.75) };
  const methodScene = createPathScene(DEFAULT_RECIPE, rolePath, 'strand', 'method', foundation);
  const methodBeads = methodScene.root.getObjectByName('completed-build-beads') as THREE.InstancedMesh;
  const first = new THREE.Color(), second = new THREE.Color();
  methodBeads.getColorAt(0, first); methodBeads.getColorAt(1, second);
  expect(first.getHex()).not.toBe(second.getHex());
  const speedScene = createPathScene(DEFAULT_RECIPE, rolePath, 'strand', 'speed', foundation);
  const speedBeads = speedScene.root.getObjectByName('completed-build-beads') as THREE.InstancedMesh;
  speedBeads.getColorAt(0, first); speedBeads.getColorAt(1, second);
  expect(first.getHex()).toBe(second.getHex());
  disposeObject(methodScene.root); disposeObject(speedScene.root);
});
