import { Grid, Line } from '@react-three/drei';
import { useMemo } from 'react';
import { PRODUCT_BY_ID } from '../../data/products';
import { useWizardStore } from '../../store/useWizardStore';
import { GHOST_SHELF_POSITIONS, SCENE_DEPTH, SCENE_WIDTH } from '../../utils/constants';
import { getFootprint, snappedXZ } from '../../utils/geometry';
import { SceneObjectMesh } from './SceneObjectMesh';

interface Props {
  topView?: boolean;
}

export const SharedScene = ({ topView = false }: Props) => {
  const currentStep = useWizardStore((s) => s.currentStep);
  const sceneObjects = useWizardStore((s) => s.sceneObjects);
  const selectedObjectId = useWizardStore((s) => s.selectedObjectId);
  const draggedProductId = useWizardStore((s) => s.draggedProductId);
  const selectObject = useWizardStore((s) => s.selectObject);
  const rotateObject = useWizardStore((s) => s.rotateObject);
  const moveObject = useWizardStore((s) => s.moveObject);
  const addObject = useWizardStore((s) => s.addObject);
  const endDrag = useWizardStore((s) => s.endDrag);
  const addShelfToFrame = useWizardStore((s) => s.addShelfToFrame);
  const getFrame96Objects = useWizardStore((s) => s.getFrame96Objects);
  const getOccupiedSlots = useWizardStore((s) => s.getOccupiedSlots);

  const frameObjects = useMemo(() => getFrame96Objects(), [getFrame96Objects, sceneObjects]);

  const floorY = 0;
  const halfW = SCENE_WIDTH / 2;
  const halfD = SCENE_DEPTH / 2;

  const handleFloorPointer = (e: any) => {
    const { x, z } = snappedXZ(e.point.x, e.point.z);
    if (draggedProductId) {
      const product = PRODUCT_BY_ID[draggedProductId];
      if (product.step === 1) {
        addObject(draggedProductId, x, z, 0);
      }
      endDrag();
      return;
    }
    if (selectedObjectId) {
      const target = sceneObjects.find((obj) => obj.instanceId === selectedObjectId);
      if (!target) return;
      if (e.altKey && currentStep === 1) {
        useWizardStore.getState().duplicateObject(selectedObjectId, x + 20, z + 20);
      } else if (PRODUCT_BY_ID[target.productId].category !== 'shelf') {
        moveObject(selectedObjectId, x, z);
      } else {
        selectObject(null);
      }
    } else {
      selectObject(null);
    }
  };

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight intensity={0.8} position={[200, 300, 200]} castShadow />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} receiveShadow>
        <planeGeometry args={[SCENE_WIDTH, SCENE_DEPTH]} />
        <meshStandardMaterial color="#F5F5F5" />
      </mesh>
      <Grid
        args={[SCENE_WIDTH, SCENE_DEPTH]}
        position={[0, floorY + 0.1, 0]}
        cellSize={5}
        sectionSize={50}
        cellColor="#dfe4ea"
        sectionColor="#bdc3c7"
        fadeDistance={1000}
        infiniteGrid={false}
      />
      <Line
        points={[
          [-halfW, 0.15, -halfD],
          [halfW, 0.15, -halfD],
          [halfW, 0.15, halfD],
          [-halfW, 0.15, halfD],
          [-halfW, 0.15, -halfD],
        ]}
        color="#90A4AE"
        lineWidth={1}
      />

      {sceneObjects.map((object) => (
        <SceneObjectMesh
          key={object.instanceId}
          object={object}
          selected={selectedObjectId === object.instanceId}
          locked={currentStep === 2 && PRODUCT_BY_ID[object.productId].step === 1}
          onPointerDown={() => selectObject(object.instanceId)}
          onContextMenu={() => rotateObject(object.instanceId)}
        />
      ))}

      {currentStep === 2 &&
        draggedProductId &&
        PRODUCT_BY_ID[draggedProductId]?.category === 'shelf' &&
        frameObjects.map((frame) => {
          const frameProduct = PRODUCT_BY_ID[frame.productId];
          const occupied = getOccupiedSlots(frame.instanceId);
          return GHOST_SHELF_POSITIONS.map((slotY, slotIndex) => {
            const slotTaken = occupied.includes(slotIndex);
            const shelfDepth = PRODUCT_BY_ID[draggedProductId].dimensions.depth;
            const ghostZ = frameProduct.dimensions.depth / 2 + shelfDepth / 2 + 0.5;
            return (
              <mesh
                key={`${frame.instanceId}-${slotIndex}`}
                position={[frame.position[0], slotY, frame.position[2]]}
                rotation={[0, frame.rotation, 0]}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (slotTaken) return;
                  addShelfToFrame(draggedProductId, frame.instanceId, slotIndex);
                  endDrag();
                }}
              >
                <boxGeometry args={[frameProduct.dimensions.width * 0.9, 2, shelfDepth]} />
                <meshStandardMaterial
                  color={slotTaken ? '#f44336' : '#4CAF50'}
                  transparent
                  opacity={slotTaken ? 0.35 : 0.22}
                />
                <group position={[0, 0, ghostZ]} />
              </mesh>
            );
          });
        })}

      {draggedProductId && PRODUCT_BY_ID[draggedProductId].step === 1 && (
        <mesh position={[0, PRODUCT_BY_ID[draggedProductId].dimensions.height / 2, 0]}>
          <boxGeometry
            args={[
              getFootprint(draggedProductId, 0).width,
              PRODUCT_BY_ID[draggedProductId].dimensions.height,
              getFootprint(draggedProductId, 0).depth,
            ]}
          />
          <meshStandardMaterial color="#4CAF50" transparent opacity={0.2} />
        </mesh>
      )}

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.2, 0]}
        visible={false}
        onPointerDown={handleFloorPointer}
      >
        <planeGeometry args={[SCENE_WIDTH, SCENE_DEPTH]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {!topView && (
        <mesh position={[0, 125, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
    </>
  );
};
