import { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import type { PerspectiveCamera as PerspectiveCameraType } from 'three';
import { useWizardStore } from '../../store/useWizardStore';
import { getSceneBounds } from '../../utils/sceneBounds';
import { EstimateWidgetOverlay } from '../EstimateWidgetOverlay';
import { SharedScene } from './SharedScene';

export const View3DCanvas = () => {
  const sceneObjects = useWizardStore((s) => s.sceneObjects);
  const cameraRef = useRef<PerspectiveCameraType | null>(null);
  const controlsRef = useRef<OrbitControlsType | null>(null);
  const [objectDragging, setObjectDragging] = useState(false);
  const DEFAULT_DISTANCE = 380;

  const zoomBy = (factor: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const offset = camera.position.clone().sub(controls.target);
    offset.multiplyScalar(factor);
    camera.position.copy(controls.target.clone().add(offset));
    controls.update();
  };

  const fitView = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const bounds = getSceneBounds(sceneObjects);
    if (!bounds) {
      controls.target.set(0, 80, 0);
      camera.position.set(380, 330, 380);
      controls.update();
      return;
    }

    const targetY = Math.max(70, bounds.centerY);
    const maxSize = Math.max(bounds.width, bounds.height, bounds.depth);
    const fitDistance = (maxSize * 0.5) / Math.tan((camera.fov * Math.PI) / 360);
    const distance = Math.max(180, fitDistance * 1.4);

    const direction = camera.position.clone().sub(controls.target).normalize();
    controls.target.set(bounds.centerX, targetY, bounds.centerZ);
    camera.position.copy(controls.target.clone().add(direction.multiplyScalar(distance)));
    controls.update();
  };

  const setPresetView = (preset: 'front' | 'back' | 'left' | 'right') => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const target = controls.target.clone();
    const offset = camera.position.clone().sub(target);
    const distance = Math.max(DEFAULT_DISTANCE, offset.length());
    const y = target.y + Math.max(80, distance * 0.22);

    if (preset === 'front') {
      camera.position.set(target.x, y, target.z + distance);
    } else if (preset === 'back') {
      camera.position.set(target.x, y, target.z - distance);
    } else if (preset === 'left') {
      camera.position.set(target.x - distance, y, target.z);
    } else if (preset === 'right') {
      camera.position.set(target.x + distance, y, target.z);
    }

    controls.update();
  };

  return (
    <div className="viewport">
      <div className="viewport-title">3D VIEW</div>
      <div className="viewport-controls">
        <button onClick={() => zoomBy(0.85)} title="Zoom in">+</button>
        <button onClick={() => zoomBy(1.15)} title="Zoom out">-</button>
        <button onClick={fitView} title="Fit objects to viewport">Fit</button>
        <button onClick={() => setPresetView('left')} title="View from left">L</button>
        <button onClick={() => setPresetView('right')} title="View from right">R</button>
        <button onClick={() => setPresetView('back')} title="View from back">B</button>
        <button onClick={() => setPresetView('front')} title="View from front">F</button>
      </div>
      <Canvas
        shadows
        gl={{ antialias: true }}
        fallback={<div className="canvas-fallback">WebGL is not available.</div>}
      >
        <PerspectiveCamera ref={cameraRef} makeDefault position={[380, 330, 380]} fov={40} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={[0, 80, 0]}
          // Prevent camera rotation while an object is being dragged with LMB.
          enabled={!objectDragging}
        />
        <SharedScene onObjectDragStateChange={setObjectDragging} />
      </Canvas>
      <EstimateWidgetOverlay />
    </div>
  );
};
