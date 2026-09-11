import * as THREE from 'three';
import { shapePoint } from '../domain/shapes';
import type { GeneratedToolpath, Recipe, Vec3 } from '../domain/types';

import { METHOD_COLORS } from './types';
import type { ColorMode, ViewMode } from './types';
export function scenePoint(point: Vec3): THREE.Vector3 { return new THREE.Vector3(point.x, point.z, -point.y); }

export function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
      if (object instanceof THREE.InstancedMesh) object.dispose();
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function nominalSurface(recipe: Recipe): THREE.Mesh {
  const rows = 64, columns = 160;
  const vertices: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    const point = scenePoint(shapePoint(recipe.shape, column / columns * 2 * Math.PI, row / rows));
    vertices.push(point.x, point.y, point.z);
  }
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const i = row * (columns + 1) + column;
    indices.push(i, i + columns + 1, i + 1, i + 1, i + columns + 1, i + columns + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#c6cbd0', roughness: 0.48, metalness: 0.06, side: THREE.DoubleSide }));
}

export interface PathScene {
  root: THREE.Group;
  setPlayback: (currentEvent: number, eventFraction: number) => void;
}

/** Only the selected representation is allocated. Partial events never display
 * material ahead of the commanded nozzle. Cylinders/spheres are volume geometry,
 * with no sag, cooling, contact or flow physics. */
export function createPathScene(recipe: Recipe, path: GeneratedToolpath | null, mode: ViewMode, colorMode: ColorMode): PathScene {
  const root = new THREE.Group();
  if (mode === 'form') root.add(nominalSurface(recipe));
  if (mode === 'form' || !path) return { root, setPlayback: () => {} };
  const { events } = path;
  const counts = events.reduce((value, event) => {
    if (event.kind === 'extrude') value.extrude++;
    if (event.kind === 'travel') value.travel++;
    if (event.kind === 'deposit') value.deposit++;
    return value;
  }, { extrude: 0, travel: 0, deposit: 0 });
  const extrudedAt = new Uint32Array(events.length), traveledAt = new Uint32Array(events.length), depositedAt = new Uint32Array(events.length);
  const kinds = new Map(recipe.bands.map((band) => [band.id, band.kind]));
  const color = new THREE.Color(), direction = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), dummy = new THREE.Object3D();
  const eventColor = (bandId: string, speedMmS?: number) => {
    if (colorMode === 'speed' && speedMmS !== undefined) return color.setHSL(0.57 - 0.45 * Math.min(1, speedMmS / (recipe.process.speedMmS * 2)), 0.7, 0.65);
    return color.set(METHOD_COLORS[kinds.get(bandId) ?? 'wave']);
  };
  const segmentTransform = (object: THREE.Object3D, a: Vec3, b: Vec3, radius: number) => {
    direction.set(b.x - a.x, b.z - a.z, a.y - b.y);
    const length = direction.length();
    object.position.set((a.x + b.x) / 2, (a.z + b.z) / 2, -(a.y + b.y) / 2);
    object.quaternion.setFromUnitVectors(up, length ? direction.divideScalar(length) : up);
    object.scale.set(radius, length, radius);
    object.updateMatrix();
  };
  const lineAttribute = (count: number) => new THREE.BufferAttribute(new Float32Array(count * 6), 3);
  const setLine = (attribute: THREE.BufferAttribute, index: number, a: Vec3, b: Vec3) => {
    attribute.setXYZ(index * 2, a.x, a.z, -a.y);
    attribute.setXYZ(index * 2 + 1, b.x, b.z, -b.y);
  };
  const cylinder = mode === 'strand' ? new THREE.CylinderGeometry(1, 1, 1, 7, 1, true) : null;
  const strandMaterial = mode === 'strand' ? new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.05 }) : null;
  const strands = cylinder && strandMaterial ? new THREE.InstancedMesh(cylinder, strandMaterial, counts.extrude) : null;
  const partialStrand = cylinder ? new THREE.Mesh(cylinder, new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.05 })) : null;
  const linePositions = mode === 'path' ? lineAttribute(counts.extrude) : null;
  const lineColors = mode === 'path' ? lineAttribute(counts.extrude) : null;
  const lineGeometry = linePositions && lineColors ? new THREE.BufferGeometry().setAttribute('position', linePositions).setAttribute('color', lineColors) : null;
  const partialLineGeometry = mode === 'path' ? new THREE.BufferGeometry().setAttribute('position', lineAttribute(1)) : null;
  const partialLine = partialLineGeometry ? new THREE.LineSegments(partialLineGeometry, new THREE.LineBasicMaterial()) : null;
  const travelPositions = lineAttribute(counts.travel);
  const travelGeometry = new THREE.BufferGeometry().setAttribute('position', travelPositions);
  const travelMaterial = new THREE.LineDashedMaterial({ color: '#939cac', dashSize: 1, gapSize: 1, transparent: true, opacity: 0.5 });
  const travels = new THREE.LineSegments(travelGeometry, travelMaterial);
  const partialTravel = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', lineAttribute(1)), travelMaterial);
  const sphere = new THREE.SphereGeometry(1, 8, 6);
  const deposits = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ roughness: 0.65 }), counts.deposit);
  const partialDeposit = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ roughness: 0.65 }));
  if (strands) strands.name = 'completed-strands';
  if (partialStrand) partialStrand.name = 'current-strand';
  if (partialLine) partialLine.name = 'current-path';
  deposits.name = 'completed-deposits';
  partialDeposit.name = 'current-deposit';
  let count = 0, travelCount = 0, depositCount = 0;
  for (let index = 0; index < events.length; index++) {
    const event = events[index]!;
    if (event.kind === 'extrude') {
      const c = eventColor(event.bandId, event.speedMmS);
      if (strands) {
        const length = Math.hypot(event.to.x - event.from.x, event.to.y - event.from.y, event.to.z - event.from.z);
        segmentTransform(dummy, event.from, event.to, length ? Math.sqrt(event.volumeMm3 / length / Math.PI) : 0);
        strands.setMatrixAt(count, dummy.matrix); strands.setColorAt(count, c);
      } else if (linePositions && lineColors) {
        setLine(linePositions, count, event.from, event.to);
        lineColors.setXYZ(count * 2, c.r, c.g, c.b); lineColors.setXYZ(count * 2 + 1, c.r, c.g, c.b);
      }
      count++;
    } else if (event.kind === 'travel') {
      setLine(travelPositions, travelCount++, event.from, event.to);
    } else if (event.kind === 'deposit') {
      dummy.position.copy(scenePoint(event.at)); dummy.quaternion.identity();
      dummy.scale.setScalar(Math.cbrt(event.volumeMm3 * 3 / (4 * Math.PI))); dummy.updateMatrix();
      deposits.setMatrixAt(depositCount, dummy.matrix); deposits.setColorAt(depositCount, eventColor(event.bandId)); depositCount++;
    }
    extrudedAt[index] = count; traveledAt[index] = travelCount; depositedAt[index] = depositCount;
  }
  for (const instances of [strands, deposits]) if (instances) {
    instances.instanceMatrix.needsUpdate = true;
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
    instances.computeBoundingSphere(); root.add(instances);
  }
  if (lineGeometry) root.add(new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ vertexColors: true })));
  if (partialStrand) root.add(partialStrand);
  if (partialLine) root.add(partialLine);
  travels.computeLineDistances(); root.add(travels, partialTravel, partialDeposit);
  for (const partial of [partialStrand, partialLine, partialTravel, partialDeposit]) if (partial) {
    partial.visible = false; partial.frustumCulled = false;
  }
  const setPlayback = (index: number, fraction: number) => {
    const previous = index - 1;
    const visible = previous < 0 ? 0 : extrudedAt[previous] ?? 0;
    if (strands) strands.count = visible;
    lineGeometry?.setDrawRange(0, visible * 2);
    deposits.count = previous < 0 ? 0 : depositedAt[previous] ?? 0;
    travelGeometry.setDrawRange(0, previous < 0 ? 0 : (traveledAt[previous] ?? 0) * 2);
    for (const partial of [partialStrand, partialLine, partialTravel, partialDeposit]) if (partial) partial.visible = false;
    const event = events[index];
    if (!event || fraction <= 0) return;
    if (event.kind === 'extrude' || event.kind === 'travel') {
      const end = {
        x: event.from.x + (event.to.x - event.from.x) * fraction,
        y: event.from.y + (event.to.y - event.from.y) * fraction,
        z: event.from.z + (event.to.z - event.from.z) * fraction,
      };
      if (event.kind === 'extrude') {
        if (partialStrand) {
          const length = Math.hypot(event.to.x - event.from.x, event.to.y - event.from.y, event.to.z - event.from.z);
          segmentTransform(partialStrand, event.from, end, length ? Math.sqrt(event.volumeMm3 / length / Math.PI) : 0);
          partialStrand.material.color.copy(eventColor(event.bandId, event.speedMmS)); partialStrand.visible = true;
        } else if (partialLine) {
          const attribute = partialLine.geometry.getAttribute('position') as THREE.BufferAttribute;
          setLine(attribute, 0, event.from, end); attribute.needsUpdate = true;
          partialLine.material.color.copy(eventColor(event.bandId, event.speedMmS)); partialLine.visible = true;
        }
      } else {
        const attribute = partialTravel.geometry.getAttribute('position') as THREE.BufferAttribute;
        setLine(attribute, 0, event.from, end); attribute.needsUpdate = true;
        partialTravel.computeLineDistances(); partialTravel.visible = true;
      }
    } else if (event.kind === 'deposit') {
      partialDeposit.position.copy(scenePoint(event.at));
      partialDeposit.scale.setScalar(Math.cbrt(event.volumeMm3 * fraction * 3 / (4 * Math.PI)));
      partialDeposit.material.color.copy(eventColor(event.bandId)); partialDeposit.visible = true;
    }
  };
  setPlayback(events.length, 0);
  return { root, setPlayback };
}
