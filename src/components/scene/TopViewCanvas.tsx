import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import type { OrthographicCamera as OrthographicCameraType } from 'three';
import { useWizardStore } from '../../store/useWizardStore';
import { getSceneBounds } from '../../utils/sceneBounds';
import { SCENE_DEPTH, SCENE_WIDTH } from '../../utils/constants';
import { SharedScene } from './SharedScene';

export const TopViewCanvas = () => {
  const sceneObjects = useWizardStore((s) => s.sceneObjects);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<OrthographicCameraType | null>(null);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const isPanningRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control') setCtrlPressed(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control') setCtrlPressed(false);
    };
    const onBlur = () => setCtrlPressed(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const applyTopCamera = (x: number, z: number, zoom: number) => {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.position.set(x, 700, z);
    camera.up.set(0, 0, -1);
    camera.lookAt(x, 0, z);
    camera.zoom = Math.max(0.3, Math.min(12, zoom));
    camera.updateProjectionMatrix();
  };

  const zoomBy = (factor: number) => {
    const camera = cameraRef.current;
    if (!camera) return;
    applyTopCamera(camera.position.x, camera.position.z, camera.zoom * factor);
  };

  const fitByRect = (centerX: number, centerZ: number, width: number, depth: number) => {
    const camera = cameraRef.current;
    const viewport = viewportRef.current;
    if (!camera || !viewport) return;
    const pad = 1.2;
    const widthPx = Math.max(1, viewport.clientWidth);
    const heightPx = Math.max(1, viewport.clientHeight);
    const zoomForWidth = widthPx / (width * pad);
    const zoomForDepth = heightPx / (depth * pad);
    const nextZoom = Math.max(0.3, Math.min(12, Math.min(zoomForWidth, zoomForDepth)));
    applyTopCamera(centerX, centerZ, nextZoom);
  };

  const fitView = () => {
    const bounds = getSceneBounds(sceneObjects);
    if (!bounds) {
      fitByRect(0, 0, SCENE_WIDTH, SCENE_DEPTH);
      return;
    }
    fitByRect(bounds.centerX, bounds.centerZ, bounds.width, bounds.depth);
  };

  const beginPan = (event: any) => {
    if (!ctrlPressed) return;
    isPanningRef.current = true;
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const movePan = (event: any) => {
    if (!isPanningRef.current) return;
    const camera = cameraRef.current;
    if (!camera) return;
    const dx = event.movementX / camera.zoom;
    const dz = event.movementY / camera.zoom;
    applyTopCamera(camera.position.x - dx, camera.position.z + dz, camera.zoom);
    event.preventDefault();
  };

  const endPan = (event: any) => {
    if (!isPanningRef.current) return;
    isPanningRef.current = false;
    setIsPanning(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheelZoom = (event: any) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomBy(factor);
  };

  return (
    <div
      className="viewport"
      ref={viewportRef}
      onPointerDownCapture={beginPan}
      onPointerMoveCapture={movePan}
      onPointerUpCapture={endPan}
      onPointerCancelCapture={endPan}
      onWheelCapture={handleWheelZoom}
      onLostPointerCapture={() => {
        isPanningRef.current = false;
        setIsPanning(false);
      }}
    >
      <div className="viewport-title">TOP VIEW</div>
      <div className="viewport-controls">
        <button onClick={() => zoomBy(1.2)} title="Zoom in">+</button>
        <button onClick={() => zoomBy(1 / 1.2)} title="Zoom out">-</button>
        <button onClick={fitView} title="Fit objects to viewport">Fit</button>
      </div>
      {ctrlPressed && <div className="viewport-hint">Pan mode: drag mouse</div>}
      <Canvas
        shadows
        gl={{ antialias: true }}
        fallback={<div className="canvas-fallback">WebGL is not available.</div>}
        onCreated={({ camera }) => {
          cameraRef.current = camera as OrthographicCameraType;
          fitByRect(0, 0, SCENE_WIDTH, SCENE_DEPTH);
        }}
      >
        <OrthographicCamera makeDefault zoom={1.8} near={0.1} far={2000} />
        <SharedScene topView interactionDisabled={ctrlPressed || isPanning} />
      </Canvas>
    </div>
  );
};
