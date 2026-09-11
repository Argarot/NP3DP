import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { GeneratedToolpath, Recipe } from '../domain/types';
import type { FoundationSettings } from '../print/types';
import { createPathScene, disposeObject, scenePoint } from '../preview/scene';
import type { PathScene } from '../preview/scene';
import type { ColorMode, ViewMode } from '../preview/types';
import { buildTimeline, eventIndexAtTime, positionAtTime } from '../preview/timeline';
import { Icon } from './Icons';

interface SceneState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  marker: THREE.Mesh;
  pathScene: PathScene | null;
  fit: (recipe: Recipe, view?: 'iso' | 'top' | 'front') => void;
  invalidate: () => void;
}
interface Props {
  recipe: Recipe; path: GeneratedToolpath | null; mode: ViewMode; colorMode: ColorMode;
  progress: number; pending: boolean; playing: boolean; generationFailed: boolean;
  wallOffsetZMm?: number;
  foundation?: FoundationSettings;
}

export function Viewport({ recipe, path, mode, colorMode, progress, pending, playing, generationFailed, wallOffsetZMm = 0, foundation }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const state = useRef<SceneState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialRecipe = useRef(recipe);
  const timeline = useMemo(() => path ? buildTimeline(path) : null, [path]);
  useEffect(() => {
    if (!container.current) return;
    const host = container.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setError('3D rendering is unavailable. Enable WebGL in your browser; recipe editing and exports still work.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor('#191d22', 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D design viewport. Drag to orbit, scroll to zoom, right-drag to pan.');
    renderer.domElement.setAttribute('role', 'img');
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#191d22', 450, 1100);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 3000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 15;
    controls.maxDistance = 1200;
    let frame: number | null = null;
    const invalidate = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        controls.update();
        renderer.render(scene, camera);
      });
    };
    // OrbitControls emits changes while damping settles. An idle scene draws no
    // frames, avoiding continuous GPU work (especially on software renderers).
    controls.addEventListener('change', invalidate);
    scene.add(new THREE.HemisphereLight('#e9f2ff', '#495541', 2.3));
    const keyLight = new THREE.DirectionalLight('#fff9e9', 3.2);
    keyLight.position.set(120, 220, 150);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight('#a0c7ef', 1.4);
    fillLight.position.set(-120, 80, -100);
    scene.add(fillLight);
    const grid = new THREE.GridHelper(240, 24, '#414950', '#2c3239');
    grid.position.y = -0.05;
    scene.add(grid);
    const bed = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-90, 0, -90), new THREE.Vector3(90, 0, -90), new THREE.Vector3(90, 0, 90), new THREE.Vector3(-90, 0, 90),
    ]), new THREE.LineBasicMaterial({ color: '#535d62' }));
    scene.add(bed);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false }));
    marker.renderOrder = 10;
    marker.visible = false;
    scene.add(marker);
    const fit = (value: Recipe, view: 'iso' | 'top' | 'front' = 'iso') => {
      const radial = Math.max(...value.bands.map((band) => band.radialAmplitudeMm));
      const width = (Math.max(value.shape.baseDiameterMm, value.shape.topDiameterMm) + 2 * Math.abs(value.shape.bellyMm) + 2 * radial)
        * (value.shape.section === 'circle' ? 1 : Math.max(1, 1 / value.shape.aspectRatio)) * (value.shape.section === 'squircle' ? Math.SQRT2 : 1);
      const extent = Math.max(value.shape.heightMm + 2 * Math.max(...value.bands.map((band) => band.amplitudeMm)), width);
      const target = new THREE.Vector3(0, value.shape.heightMm * 0.5, 0);
      controls.target.copy(target);
      const direction = view === 'top' ? new THREE.Vector3(0, 1, 0.001) : view === 'front' ? new THREE.Vector3(0, 0.08, 1) : new THREE.Vector3(1.25, 0.9, 1.65);
      camera.position.copy(target).addScaledVector(direction.normalize(), extent * 2.45);
      controls.update();
    };
    state.current = { scene, camera, controls, marker, pathScene: null, fit, invalidate };
    fit(initialRecipe.current);
    const resize = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      invalidate();
    });
    resize.observe(host);
    invalidate();
    const lost = (event: Event) => { event.preventDefault(); setError('The graphics context was lost. Reload to restore the 3D view; save your recipe first.'); };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      resize.disconnect(); controls.removeEventListener('change', invalidate); controls.dispose();
      disposeObject(scene); renderer.dispose(); renderer.domElement.removeEventListener('webglcontextlost', lost);
      renderer.domElement.remove(); state.current = null;
    };
  }, []);
  useEffect(() => {
    const current = state.current;
    if (!current) return;
    if (current.pathScene) { current.scene.remove(current.pathScene.root); disposeObject(current.pathScene.root); }
    current.pathScene = createPathScene(recipe, path, mode, colorMode, foundation);
    if (mode === 'form') current.pathScene.root.position.y = wallOffsetZMm;
    current.scene.add(current.pathScene.root);
    current.invalidate();
  }, [recipe, path, mode, colorMode, wallOffsetZMm, foundation]);
  useEffect(() => {
    const current = state.current;
    if (!current || !path || !timeline) return;
    const seconds = progress * timeline.durationS;
    const index = eventIndexAtTime(timeline, seconds);
    const start = index ? timeline.ends[index - 1]! : 0;
    const eventDuration = timeline.ends[index]! - start;
    const fraction = eventDuration > 0 ? Math.max(0, Math.min(1, (seconds - start) / eventDuration)) : 1;
    current.pathScene?.setPlayback(index, progress === 0 ? 0 : fraction);
    const point = positionAtTime(path.events, timeline, seconds);
    current.marker.visible = !!point && mode !== 'form' && (playing || progress < 1);
    if (point) current.marker.position.copy(scenePoint(point));
    current.invalidate();
  }, [path, timeline, progress, mode, colorMode, recipe, playing]);
  return <div className="viewport-shell">
    <div className="canvas-host" ref={container} />
    <div className="viewport-caption"><span className="micro-label">{mode === 'form' ? 'DESIGN ENVELOPE' : mode === 'path' ? 'COMMANDED NOZZLE PATH' : 'NOMINAL STRAND GEOMETRY'}</span>
      <span>{mode === 'form' ? 'The intended outer form' : mode === 'path' ? 'Motion + extrusion + holds' : 'Volume along the path · no gravity or cooling'}</span></div>
    <div className="viewport-top-right"><span className={`build-state ${pending || generationFailed ? 'pending' : ''}`}>{generationFailed ? path ? 'Generation failed · previous result' : 'Generation failed' : pending ? 'Updating path…' : path ? 'Experiment · untested' : 'Generating…'}</span></div>
    {error && <div className="viewport-error" role="alert">{error}</div>}
    <div className="viewport-dimensions"><span>{recipe.shape.heightMm}<small> mm tall</small></span><span>{recipe.shape.baseDiameterMm}<small> mm base</small></span></div>
    <div className="camera-controls" aria-label="Camera controls">
      <button onClick={() => state.current?.fit(recipe)} title="Fit isometric view" aria-label="Fit isometric view"><Icon name="cube" /></button>
      <button onClick={() => state.current?.fit(recipe, 'front')}>Front</button><button onClick={() => state.current?.fit(recipe, 'top')}>Top</button>
    </div>
    <div className="viewport-help">Drag to orbit <span>·</span> Scroll to zoom <span>·</span> Grid 10 mm</div>
    <span className="bed-label">180 × 180 mm reference bed</span>
  </div>;
}
