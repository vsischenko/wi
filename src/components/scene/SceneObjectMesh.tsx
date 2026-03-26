import { Edges } from '@react-three/drei';
import { Fragment } from 'react';
import { PRODUCT_BY_ID } from '../../data/products';
import { LOCKED_OPACITY } from '../../utils/constants';
import type { SceneObject } from '../../types';

interface Props {
  object: SceneObject;
  selected: boolean;
  locked: boolean;
  onPointerDown: () => void;
  onContextMenu: () => void;
}

export const SceneObjectMesh = ({
  object,
  selected,
  locked,
  onPointerDown,
  onContextMenu,
}: Props) => {
  const product = PRODUCT_BY_ID[object.productId];
  const isFrameCounter = product.category === 'frame-counter';
  const isShelf = product.category === 'shelf';
  const opacity = locked ? LOCKED_OPACITY : 1;

  return (
    <group
      position={object.position}
      rotation={[0, object.rotation, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.button === 0) onPointerDown();
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        e.nativeEvent.preventDefault();
        onContextMenu();
      }}
    >
      <mesh>
        <boxGeometry args={[product.dimensions.width, product.dimensions.height, product.dimensions.depth]} />
        <meshStandardMaterial color={product.color} transparent opacity={opacity} />
        {selected && <Edges color="#2196F3" />}
      </mesh>

      {product.accentColor && !isShelf && (
        <mesh position={[0, 0, product.dimensions.depth / 2 + 0.2]}>
          <planeGeometry args={[product.dimensions.width * 0.9, product.dimensions.height * 0.9]} />
          <meshStandardMaterial color={product.accentColor} transparent opacity={opacity} />
        </mesh>
      )}

      {isFrameCounter && (
        <mesh position={[0, 100 - product.dimensions.height / 2, 18]}>
          <boxGeometry args={[96, 3, 40]} />
          <meshStandardMaterial color="#8D6E63" transparent opacity={opacity} />
        </mesh>
      )}

      {product.hasSupportBars && (
        <Fragment>
          {[-product.dimensions.width / 3, 0, product.dimensions.width / 3].map((x) => (
            <mesh
              key={x}
              position={[
                x,
                0,
                product.dimensions.depth / 2 + 0.4,
              ]}
            >
              <boxGeometry args={[0.7, product.dimensions.height * 0.95, 0.7]} />
              <meshStandardMaterial color="#37474F" />
            </mesh>
          ))}
        </Fragment>
      )}
    </group>
  );
};
