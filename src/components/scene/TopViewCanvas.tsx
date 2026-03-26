import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { SharedScene } from './SharedScene';

export const TopViewCanvas = () => {
  return (
    <div className="viewport">
      <div className="viewport-title">TOP VIEW</div>
      <Canvas
        shadows
        gl={{ antialias: true }}
      >
        <OrthographicCamera makeDefault position={[0, 700, 0]} zoom={1.8} near={0.1} far={2000} />
        <SharedScene topView />
      </Canvas>
    </div>
  );
};
