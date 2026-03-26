import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { SharedScene } from './SharedScene';

export const View3DCanvas = () => {
  return (
    <div className="viewport">
      <div className="viewport-title">3D VIEW</div>
      <Canvas shadows gl={{ antialias: true }}>
        <PerspectiveCamera makeDefault position={[380, 330, 380]} fov={40} />
        <OrbitControls makeDefault target={[0, 80, 0]} />
        <SharedScene />
      </Canvas>
    </div>
  );
};
