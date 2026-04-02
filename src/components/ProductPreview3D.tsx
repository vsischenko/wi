import { Canvas } from '@react-three/fiber';
import { Fragment } from 'react';
import { PRODUCT_BY_ID } from '../data/products';

interface Props {
  productId: string;
}

const PreviewMesh = ({ productId }: Props) => {
  const product = PRODUCT_BY_ID[productId];
  const isFrameCounter = product.category === 'frame-counter';
  const isArch = product.category === 'arch';

  if (isArch) {
    const topY = product.dimensions.height / 2 - 2;
    const halfWidth = product.dimensions.width / 2;
    const halfDepth = product.dimensions.depth / 2;
    return (
      <group>
        <mesh>
          <boxGeometry args={[96, 250, 4]} />
          <meshStandardMaterial color="#B0BEC5" />
        </mesh>
        <mesh position={[0, topY, product.dimensions.depth]}>
          <boxGeometry args={[product.dimensions.width, 4, 4]} />
          <meshStandardMaterial color="#8E9AA1" />
        </mesh>
        <mesh position={[0, topY, 0]}>
          <boxGeometry args={[product.dimensions.width, 4, 4]} />
          <meshStandardMaterial color="#8E9AA1" />
        </mesh>
        <mesh position={[halfWidth, topY, halfDepth]}>
          <boxGeometry args={[4, 4, product.dimensions.depth]} />
          <meshStandardMaterial color="#8E9AA1" />
        </mesh>
        <mesh position={[-halfWidth, topY, halfDepth]}>
          <boxGeometry args={[4, 4, product.dimensions.depth]} />
          <meshStandardMaterial color="#8E9AA1" />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      <mesh>
        <boxGeometry args={[product.dimensions.width, product.dimensions.height, product.dimensions.depth]} />
        <meshStandardMaterial color={product.color} />
      </mesh>
      {product.accentColor && product.category !== 'shelf' && product.category !== 'hangable' && (
        <mesh position={[0, 0, product.dimensions.depth / 2 + 0.2]}>
          <planeGeometry args={[product.dimensions.width * 0.9, product.dimensions.height * 0.9]} />
          <meshStandardMaterial color={product.accentColor} />
        </mesh>
      )}
      {isFrameCounter && (
        <mesh position={[0, 100 - product.dimensions.height / 2, 18]}>
          <boxGeometry args={[96, 3, 40]} />
          <meshStandardMaterial color="#8D6E63" />
        </mesh>
      )}
      {product.hasSupportBars && (
        <Fragment>
          {[-product.dimensions.width / 3, 0, product.dimensions.width / 3].map((x) => (
            <mesh key={x} position={[x, 0, product.dimensions.depth / 2 + 0.4]}>
              <boxGeometry args={[0.7, product.dimensions.height * 0.95, 0.7]} />
              <meshStandardMaterial color="#37474F" />
            </mesh>
          ))}
        </Fragment>
      )}
    </group>
  );
};

export const ProductPreview3D = ({ productId }: Props) => {
  const product = PRODUCT_BY_ID[productId];
  const maxSpan = Math.max(product.dimensions.width, product.dimensions.height, product.dimensions.depth, 40);
  const isShelfOrHangable = product.category === 'shelf' || product.category === 'hangable';

  // Product preview in catalog is a small "icon". For thin items (shelves, TVs),
  // the original camera baseline made them look too small. We zoom in for those categories.
  const cameraDistance = isShelfOrHangable ? Math.max(140, maxSpan * 1.15) : Math.max(250, maxSpan * 1.45);
  const cameraY = isShelfOrHangable ? Math.max(80, maxSpan * 0.45) : Math.max(180, product.dimensions.height * 1.05);
  const targetY = isShelfOrHangable ? Math.max(25, product.dimensions.height * 0.45) : Math.max(35, product.dimensions.height * 0.35);

  return (
    <div className="product-preview-3d">
      <Canvas
        gl={{ antialias: true }}
        camera={{ fov: 32, near: 0.1, far: 5000, position: [cameraDistance, cameraY, cameraDistance] }}
        style={{ pointerEvents: 'none' }}
        onCreated={({ camera }) => {
          camera.position.set(cameraDistance, cameraY, cameraDistance);
          camera.lookAt(0, targetY, 0);
        }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight intensity={0.7} position={[cameraDistance, cameraY + 120, cameraDistance]} />
        <group rotation={[0, -0.45, 0]}>
          <PreviewMesh productId={productId} />
        </group>
      </Canvas>
    </div>
  );
};
