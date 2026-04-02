import { Grid, Line } from '@react-three/drei';
import { useMemo, useState } from 'react';
import { isFrameSlotProductId, PRODUCT_BY_ID } from '../../data/products';
import { computeTopEdgeWorldPosition, getFrameAttachMode } from '../../utils/frameAttach';
import { useWizardStore } from '../../store/useWizardStore';
import { GHOST_SHELF_POSITIONS, SCENE_DEPTH, SCENE_WIDTH } from '../../utils/constants';
import { snappedXZ } from '../../utils/geometry';
import { SceneObjectMesh } from './SceneObjectMesh';

interface Props {
  topView?: boolean;
  interactionDisabled?: boolean;
  onObjectDragStateChange?: (dragging: boolean) => void;
}

export const SharedScene = ({
  topView = false,
  interactionDisabled = false,
  onObjectDragStateChange,
}: Props) => {
  const currentStep = useWizardStore((s) => s.currentStep);
  const sceneObjects = useWizardStore((s) => s.sceneObjects);
  const selectedObjectId = useWizardStore((s) => s.selectedObjectId);
  const selectedGraphicFrameIds = useWizardStore((s) => s.selectedGraphicFrameIds);
  const draggedProductId = useWizardStore((s) => s.draggedProductId);
  const placementRotation = useWizardStore((s) => s.placementRotation);
  const placementPreview = useWizardStore((s) => s.placementPreview);
  const setPlacementPreview = useWizardStore((s) => s.setPlacementPreview);
  const selectObject = useWizardStore((s) => s.selectObject);
  const openModelContextMenu = useWizardStore((s) => s.openModelContextMenu);
  const closeModelContextMenu = useWizardStore((s) => s.closeModelContextMenu);
  const toggleGraphicFrameSelection = useWizardStore((s) => s.toggleGraphicFrameSelection);
  const clearGraphicFrameSelection = useWizardStore((s) => s.clearGraphicFrameSelection);
  const moveObject = useWizardStore((s) => s.moveObject);
  const rotateObject = useWizardStore((s) => s.rotateObject);
  const addObject = useWizardStore((s) => s.addObject);
  const addShelfToFrame = useWizardStore((s) => s.addShelfToFrame);
  const getFrame96Objects = useWizardStore((s) => s.getFrame96Objects);
  const getOccupiedSlots = useWizardStore((s) => s.getOccupiedSlots);
  const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);

  const frameObjects = useMemo(() => getFrame96Objects(), [getFrame96Objects, sceneObjects]);

  const floorY = 0;
  const halfW = SCENE_WIDTH / 2;
  const halfD = SCENE_DEPTH / 2;
  const floorColor = topView ? '#F8F8F8' : '#F5F5F5';
  const gridCellColor = topView ? '#B3B3B3' : '#dfe4ea';
  const gridSectionColor = topView ? '#8C8C8C' : '#bdc3c7';
  const borderLineColor = topView ? '#999999' : '#90A4AE';

  const placeAt = (x: number, z: number) => {
    if (!draggedProductId) return;
    const product = PRODUCT_BY_ID[draggedProductId];
    if (product.step !== 1) return;
    setPlacementPreview(x, z);
    const nextPreview = useWizardStore.getState().placementPreview;
    if (nextPreview?.valid) {
      addObject(
        draggedProductId,
        nextPreview.x,
        nextPreview.z,
        placementRotation,
      );
    }
  };

  const handleFloorPointer = (e: any) => {
    if (interactionDisabled) return;
    if (e.ctrlKey) return;
    if (e.button !== 0) return;
    const { x, z } = snappedXZ(e.point.x, e.point.z);
    if (draggedProductId) {
      placeAt(x, z);
      return;
    }
    closeModelContextMenu();
    if (currentStep === 3) {
      clearGraphicFrameSelection();
      return;
    }
    // Empty-floor click should only deselect; object movement is by drag on object.
    if (selectedObjectId && e.altKey && currentStep === 1) {
      useWizardStore.getState().duplicateObject(selectedObjectId, x + 20, z + 20);
      return;
    }
    selectObject(null);
  };

  const handleFloorMove = (e: any) => {
    if (interactionDisabled) return;
    if (e.ctrlKey) return;
    if (draggedProductId) {
      const product = PRODUCT_BY_ID[draggedProductId];
      if (product.step === 1) {
        setPlacementPreview(e.point.x, e.point.z);
      }
      return;
    }
    if (!draggingObjectId) return;
    const { x, z } = snappedXZ(e.point.x, e.point.z);
    moveObject(draggingObjectId, x, z);
  };

  const handleFloorContextMenu = (e: any) => {
    e.stopPropagation();
    e.nativeEvent?.preventDefault();
    closeModelContextMenu();
  };

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight intensity={0.8} position={[200, 300, 200]} castShadow />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, floorY, 0]}
        receiveShadow
        onPointerDown={handleFloorPointer}
        onPointerMove={handleFloorMove}
        onPointerUp={() => {
          if (draggingObjectId) {
            onObjectDragStateChange?.(false);
          }
          setDraggingObjectId(null);
        }}
        onContextMenu={handleFloorContextMenu}
      >
        <planeGeometry args={[SCENE_WIDTH, SCENE_DEPTH]} />
        <meshStandardMaterial color={floorColor} />
      </mesh>
      <Grid
        args={[SCENE_WIDTH, SCENE_DEPTH]}
        position={[0, floorY + 0.1, 0]}
        cellSize={5}
        sectionSize={50}
        cellThickness={0.6}
        sectionThickness={1}
        cellColor={gridCellColor}
        sectionColor={gridSectionColor}
        fadeDistance={topView ? 10000 : 1000}
        fadeStrength={topView ? 0 : 1}
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
        color={borderLineColor}
        lineWidth={1}
      />
      <group position={[0, floorY + 0.12, SCENE_DEPTH / 2 - 70]} raycast={() => null}>
        <mesh position={[0, 0, -9]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[2.6, 5.5, 16]} />
          <meshBasicMaterial color="#E53935" />
        </mesh>
        <mesh position={[0, 0, 3]}>
          <boxGeometry args={[1.2, 0.22, 19]} />
          <meshBasicMaterial color="#E53935" />
        </mesh>
        <mesh position={[0, 0, 13]}>
          <boxGeometry args={[4, 0.18, 1]} />
          <meshBasicMaterial color="#E53935" opacity={0.85} transparent />
        </mesh>
      </group>

      {sceneObjects.map((object) => (
        <SceneObjectMesh
          key={object.instanceId}
          object={object}
          selected={
            selectedObjectId === object.instanceId ||
            (currentStep === 3 && selectedGraphicFrameIds.includes(object.instanceId))
          }
          locked={currentStep !== 1 && PRODUCT_BY_ID[object.productId].step === 1}
          onPointerDown={(event) => {
            if (interactionDisabled) return;
            if (event.ctrlKey) return;
            if (draggedProductId) {
              if (event.button === 2) return;
              const { x, z } = snappedXZ(event.point.x, event.point.z);
              placeAt(x, z);
              return;
            }
            if (currentStep === 3) {
              const product = PRODUCT_BY_ID[object.productId];
              const printable = !!product.accentColor || product.category === 'arch';
              if (printable) {
                toggleGraphicFrameSelection(object.instanceId);
              }
              return;
            }
            if (currentStep === 2) {
              // In Edit Product mode, allow editing selection by clicking any object.
              selectObject(object.instanceId);
              return;
            }
            selectObject(object.instanceId);
            const isLocked = currentStep !== 1 && PRODUCT_BY_ID[object.productId].step === 1;
            const topEdgeOnly =
              !!object.attachedToFrameId && getFrameAttachMode(object.productId) === 'top-edge';
            if (!isLocked && !topEdgeOnly) {
              setDraggingObjectId(object.instanceId);
              onObjectDragStateChange?.(true);
              event.target.setPointerCapture?.(event.pointerId);
            }
          }}
          onPointerUp={() => {
            if (draggingObjectId) {
              onObjectDragStateChange?.(false);
            }
            setDraggingObjectId(null);
          }}
          onContextMenu={(event) => {
            event.stopPropagation();
            event.nativeEvent?.preventDefault();
            if (interactionDisabled) return;
            if (event.ctrlKey) return;
            if (draggedProductId) return;
            if (currentStep !== 3) {
              if (selectedObjectId === object.instanceId) {
                rotateObject(object.instanceId);
              } else {
                selectObject(object.instanceId);
              }
              return;
            }
            const product = PRODUCT_BY_ID[object.productId];
            if (
              ['shelf', 'hangable', 'counter', 'frame-counter', 'storage', 'closet'].includes(
                product.category,
              )
            ) {
              openModelContextMenu(object.instanceId, event.nativeEvent.clientX, event.nativeEvent.clientY);
            }
            return;
          }}
        />
      ))}

      {currentStep === 2 &&
        draggedProductId &&
        isFrameSlotProductId(draggedProductId) &&
        frameObjects
          .filter((frame) => PRODUCT_BY_ID[draggedProductId].attachableTo?.includes(frame.productId))
          .flatMap((frame) => {
            const frameProduct = PRODUCT_BY_ID[frame.productId];
            const dragProduct = PRODUCT_BY_ID[draggedProductId];
            const attachMode = getFrameAttachMode(draggedProductId);

            if (attachMode === 'top-edge') {
              const n = dragProduct.topEdgeSlotCount ?? 3;
              const railOcc = getOccupiedSlots(frame.instanceId, 'top-edge');
              return Array.from({ length: n }, (_, slotIndex) => {
                const pos = computeTopEdgeWorldPosition(frame, frameProduct, dragProduct, slotIndex);
                const slotTaken =
                  dragProduct.topEdgeSpan === 'full' ? railOcc.length > 0 : railOcc.includes(slotIndex);
                const slotDepth = dragProduct.dimensions.depth;
                const gw =
                  dragProduct.topEdgeSpan === 'full'
                    ? frameProduct.dimensions.width * 0.92
                    : Math.max(12, dragProduct.dimensions.width * 1.3);
                const gh =
                  dragProduct.topEdgeSpan === 'full' ? 5 : Math.max(8, dragProduct.dimensions.height * 1.15);
                const gd = Math.max(slotDepth + 1, dragProduct.dimensions.depth * 1.1);
                return (
                  <mesh
                    key={`${frame.instanceId}-top-${slotIndex}`}
                    position={[pos.x, pos.y, pos.z]}
                    rotation={[0, pos.rotation, 0]}
                    onPointerDown={(e) => {
                      if (interactionDisabled) return;
                      e.stopPropagation();
                      if (slotTaken) return;
                      addShelfToFrame(draggedProductId, frame.instanceId, slotIndex);
                    }}
                  >
                    <boxGeometry args={[gw, gh, gd]} />
                    <meshStandardMaterial
                      color={slotTaken ? '#f44336' : '#4CAF50'}
                      transparent
                      opacity={slotTaken ? 0.35 : 0.28}
                    />
                  </mesh>
                );
              });
            }

            const occupied = getOccupiedSlots(frame.instanceId, 'front-face');
            return GHOST_SHELF_POSITIONS.map((slotY, slotIndex) => {
              const slotTaken = occupied.includes(slotIndex);
              const slotDepth = dragProduct.dimensions.depth;
              const ghostZ = frameProduct.dimensions.depth / 2 + slotDepth / 2 + 0.5;
              return (
                <mesh
                  key={`${frame.instanceId}-${slotIndex}`}
                  position={[frame.position[0], slotY, frame.position[2]]}
                  rotation={[0, frame.rotation, 0]}
                  onPointerDown={(e) => {
                    if (interactionDisabled) return;
                    e.stopPropagation();
                    if (slotTaken) return;
                    addShelfToFrame(draggedProductId, frame.instanceId, slotIndex);
                  }}
                >
                  <boxGeometry args={[frameProduct.dimensions.width * 0.9, 2, slotDepth]} />
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
        PRODUCT_BY_ID[draggedProductId].category === 'arch' ? (
          <group
            position={[
              placementPreview?.x ?? 0,
              PRODUCT_BY_ID[draggedProductId].dimensions.height / 2,
              placementPreview?.z ?? 0,
            ]}
            rotation={[0, placementRotation, 0]}
            visible={!!placementPreview}
          >
            <mesh>
              <boxGeometry
                args={[
                  PRODUCT_BY_ID[draggedProductId].dimensions.width,
                  PRODUCT_BY_ID['frame-96'].dimensions.height,
                  PRODUCT_BY_ID['frame-96'].dimensions.depth,
                ]}
              />
              <meshStandardMaterial
                color={placementPreview?.valid ? '#4CAF50' : '#F44336'}
                transparent
                opacity={0.22}
              />
            </mesh>
            <mesh
              position={[
                0,
                PRODUCT_BY_ID['frame-96'].dimensions.height / 2 - 2,
                PRODUCT_BY_ID[draggedProductId].dimensions.depth,
              ]}
            >
              <boxGeometry
                args={[
                  PRODUCT_BY_ID[draggedProductId].dimensions.width,
                  4,
                  4,
                ]}
              />
              <meshStandardMaterial
                color={placementPreview?.valid ? '#4CAF50' : '#F44336'}
                transparent
                opacity={0.28}
              />
            </mesh>
            <mesh position={[0, PRODUCT_BY_ID['frame-96'].dimensions.height / 2 - 2, 0]}>
              <boxGeometry
                args={[
                  PRODUCT_BY_ID[draggedProductId].dimensions.width,
                  4,
                  4,
                ]}
              />
              <meshStandardMaterial
                color={placementPreview?.valid ? '#4CAF50' : '#F44336'}
                transparent
                opacity={0.28}
              />
            </mesh>
            <mesh
              position={[
                PRODUCT_BY_ID[draggedProductId].dimensions.width / 2,
                PRODUCT_BY_ID['frame-96'].dimensions.height / 2 - 2,
                PRODUCT_BY_ID[draggedProductId].dimensions.depth / 2,
              ]}
            >
              <boxGeometry
                args={[
                  4,
                  4,
                  PRODUCT_BY_ID[draggedProductId].dimensions.depth,
                ]}
              />
              <meshStandardMaterial
                color={placementPreview?.valid ? '#4CAF50' : '#F44336'}
                transparent
                opacity={0.28}
              />
            </mesh>
            <mesh
              position={[
                -PRODUCT_BY_ID[draggedProductId].dimensions.width / 2,
                PRODUCT_BY_ID['frame-96'].dimensions.height / 2 - 2,
                PRODUCT_BY_ID[draggedProductId].dimensions.depth / 2,
              ]}
            >
              <boxGeometry
                args={[
                  4,
                  4,
                  PRODUCT_BY_ID[draggedProductId].dimensions.depth,
                ]}
              />
              <meshStandardMaterial
                color={placementPreview?.valid ? '#4CAF50' : '#F44336'}
                transparent
                opacity={0.28}
              />
            </mesh>
          </group>
        ) : (
          <mesh
            position={[
              placementPreview?.x ?? 0,
              PRODUCT_BY_ID[draggedProductId].dimensions.height / 2,
              placementPreview?.z ?? 0,
            ]}
            rotation={[0, placementRotation, 0]}
            visible={!!placementPreview}
            raycast={() => null}
          >
            <boxGeometry
              args={[
                PRODUCT_BY_ID[draggedProductId].dimensions.width,
                PRODUCT_BY_ID[draggedProductId].dimensions.height,
                PRODUCT_BY_ID[draggedProductId].dimensions.depth,
              ]}
            />
            <meshStandardMaterial
              color={placementPreview?.valid ? '#4CAF50' : '#F44336'}
              transparent
              opacity={0.25}
            />
          </mesh>
        )
      )}

      {!topView && (
        <mesh position={[0, 125, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
    </>
  );
};
