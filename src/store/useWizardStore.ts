import { create } from 'zustand';
import { PRODUCTS, PRODUCT_BY_ID } from '../data/products';
import type { BoothLegFootKind, FrameAttachMode, GraphicCrop, SceneObject, WizardStep } from '../types';
import { countStructuralFramesForBooth } from '../utils/booth';
import {
  computeTopEdgeWorldPosition,
  getFrameAttachMode,
  getOccupiedTopEdgeRailIndices,
} from '../utils/frameAttach';
import { GHOST_SHELF_POSITIONS } from '../utils/constants';
import { applyEdgeSnap, getFootprint, intersectsXZ, isWithinBounds, snappedXZ } from '../utils/geometry';

const HISTORY_LIMIT = 30;

interface WizardState {
  currentStep: WizardStep;
  portModeEnabled: boolean;
  portLinks: string[];
  sceneObjects: SceneObject[];
  selectedObjectId: string | null;
  modelContextMenu: { objectId: string; x: number; y: number } | null;
  selectedGraphicFrameIds: string[];
  graphicsAssets: Record<string, string>;
  frameGraphics: Record<string, { assetId: string; crop: GraphicCrop }>;
  draggedProductId: string | null;
  placementRotation: number;
  placementPreview: { x: number; z: number; valid: boolean } | null;
  placementLastPlacedId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  historyPast: SceneObject[][];
  historyFuture: SceneObject[][];
  addObject: (productId: string, x: number, z: number, rotation?: number) => string | null;
  addShelfToFrame: (productId: string, frameId: string, slotIndex: number) => void;
  moveObject: (id: string, x: number, z: number) => void;
  rotateObject: (id: string) => void;
  deleteObject: (id: string) => void;
  duplicateObject: (id: string, x: number, z: number) => void;
  selectObject: (id: string | null) => void;
  openModelContextMenu: (objectId: string, x: number, y: number) => void;
  closeModelContextMenu: () => void;
  setShelfColor: (objectId: string, color: 'white' | 'black' | 'wood') => void;
  setCountertopColor: (objectId: string, color: 'white' | 'black' | 'wood') => void;
  toggleCountertopUsb: (objectId: string) => void;
  setStorageDoor: (objectId: string, hasDoor: boolean) => void;
  toggleGraphicFrameSelection: (id: string) => void;
  clearGraphicFrameSelection: () => void;
  applyGraphicToFrames: (
    assetUrl: string,
    assignments: Array<{ frameId: string; crop: GraphicCrop }>,
  ) => void;
  setStep: (step: WizardStep) => void;
  startDrag: (productId: string) => void;
  endDrag: () => void;
  rotatePlacement: () => void;
  setPlacementPreview: (x: number, z: number) => void;
  clearPlacementPreview: () => void;
  undoLastPlacement: () => void;
  clearScene: () => void;
  undo: () => void;
  redo: () => void;
  togglePortMode: () => void;
  getFrame96Objects: () => SceneObject[];
  getOccupiedSlots: (frameId: string, attachMode?: FrameAttachMode) => number[];
  canPlaceAt: (
    productId: string,
    x: number,
    z: number,
    rotation: number,
    excludeId?: string | string[],
  ) => boolean;
  boothLegCountOverride: number | null;
  boothStabilizerCountOverride: number | null;
  boothLegFootKind: BoothLegFootKind;
  boothSecurityRiskAccepted: boolean;
  setBoothLegCountOverride: (value: number | null) => void;
  setBoothStabilizerCountOverride: (value: number | null) => void;
  setBoothLegFootKind: (kind: BoothLegFootKind) => void;
  acceptBoothSecurityRisk: () => void;
}

const isShelf = (productId: string) => PRODUCT_BY_ID[productId].category === 'shelf';
const attachesToFrameSlot = (productId: string) => {
  const c = PRODUCT_BY_ID[productId]?.category;
  return c === 'shelf' || c === 'hangable';
};
const canSnapProduct = (productId: string) =>
  ['frame-96', 'frame-48', 'frame-22', 'frame-counter-96', 'arch-96'].includes(productId);
const GRAPHIC_SELECTION_LIMIT = 10;
const isCounterLike = (productId: string) =>
  ['counter', 'frame-counter'].includes(PRODUCT_BY_ID[productId].category);
const isStorageLike = (productId: string) =>
  ['storage', 'closet'].includes(PRODUCT_BY_ID[productId].category);

const getDefaultOptions = (productId: string) => {
  if (isShelf(productId)) {
    return { shelfColor: 'white' as const };
  }
  if (isCounterLike(productId)) {
    return {
      countertopColor: 'wood' as const,
      countertopUsb: true,
    };
  }
  if (isStorageLike(productId)) {
    return {
      storageHasDoor: true,
    };
  }
  return undefined;
};

const withHistory = (sceneObjects: SceneObject[], state: WizardState) => {
  const nextPast = [...state.historyPast, state.sceneObjects].slice(-HISTORY_LIMIT);
  return {
    sceneObjects,
    historyPast: nextPast,
    historyFuture: [],
    canUndo: nextPast.length > 0,
    canRedo: false,
  };
};

const uniqueId = () => crypto.randomUUID();

const linkKey = (a: string, b: string) => (a < b ? `${a}::${b}` : `${b}::${a}`);

const intervalDistance = (aMin: number, aMax: number, bMin: number, bMax: number) => {
  if (aMax < bMin) return bMin - aMax;
  if (bMax < aMin) return aMin - bMax;
  return 0;
};

const rebuildPortLinks = (sceneObjects: SceneObject[]) => {
  const structureObjects = sceneObjects.filter((obj) => canSnapProduct(obj.productId));
  const links = new Set<string>();
  for (let i = 0; i < structureObjects.length; i += 1) {
    const a = structureObjects[i];
    const aFp = getFootprint(a.productId, a.rotation);
    const aBox = {
      minX: a.position[0] - aFp.width / 2,
      maxX: a.position[0] + aFp.width / 2,
      minZ: a.position[2] - aFp.depth / 2,
      maxZ: a.position[2] + aFp.depth / 2,
    };
    for (let j = i + 1; j < structureObjects.length; j += 1) {
      const b = structureObjects[j];
      const bFp = getFootprint(b.productId, b.rotation);
      const bBox = {
        minX: b.position[0] - bFp.width / 2,
        maxX: b.position[0] + bFp.width / 2,
        minZ: b.position[2] - bFp.depth / 2,
        maxZ: b.position[2] + bFp.depth / 2,
      };
      const dx = intervalDistance(aBox.minX, aBox.maxX, bBox.minX, bBox.maxX);
      const dz = intervalDistance(aBox.minZ, aBox.maxZ, bBox.minZ, bBox.maxZ);
      if (dx <= 2 && dz <= 2) {
        links.add(linkKey(a.instanceId, b.instanceId));
      }
    }
  }
  return [...links];
};

const sanitizePortLinks = (sceneObjects: SceneObject[], links: string[]) => {
  const ids = new Set(sceneObjects.map((obj) => obj.instanceId));
  return links.filter((entry) => {
    const [a, b] = entry.split('::');
    return !!a && !!b && ids.has(a) && ids.has(b);
  });
};

const getPortLinkedComponent = (startId: string, links: string[]) => {
  const adjacency = new Map<string, Set<string>>();
  for (const entry of links) {
    const [a, b] = entry.split('::');
    if (!a || !b) continue;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }
  const visited = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return visited;
};

const getAttachedShelfPlacement = (
  frame: SceneObject,
  shelf: SceneObject,
): { x: number; y: number; z: number; rotation: number } => {
  const frameProduct = PRODUCT_BY_ID[frame.productId];
  const shelfProduct = PRODUCT_BY_ID[shelf.productId];
  const slotIndex = shelf.shelfSlotIndex ?? 0;
  if (getFrameAttachMode(shelf.productId) === 'top-edge') {
    return computeTopEdgeWorldPosition(frame, frameProduct, shelfProduct, slotIndex);
  }
  const y = GHOST_SHELF_POSITIONS[slotIndex] ?? shelf.position[1];
  const frameFrontOffset = frameProduct.dimensions.depth / 2 + shelfProduct.dimensions.depth / 2;
  const x = frame.position[0] + Math.sin(frame.rotation) * frameFrontOffset;
  const z = frame.position[2] + Math.cos(frame.rotation) * frameFrontOffset;
  return { x, y, z, rotation: frame.rotation };
};

export const useWizardStore = create<WizardState>((set, get) => ({
  currentStep: 1,
  portModeEnabled: true,
  portLinks: [],
  sceneObjects: [],
  selectedObjectId: null,
  modelContextMenu: null,
  selectedGraphicFrameIds: [],
  graphicsAssets: {},
  frameGraphics: {},
  draggedProductId: null,
  placementRotation: 0,
  placementPreview: null,
  placementLastPlacedId: null,
  canUndo: false,
  canRedo: false,
  historyPast: [],
  historyFuture: [],
  boothLegCountOverride: null,
  boothStabilizerCountOverride: null,
  boothLegFootKind: 'pad',
  boothSecurityRiskAccepted: false,

  addObject: (productId, x, z, rotation = 0) => {
    const product = PRODUCT_BY_ID[productId];
    if (!product || product.step !== 1) return null;
    const stateNow = get();

    const { x: sx, z: sz } = snappedXZ(x, z);
    const snapped = stateNow.portModeEnabled
      ? applyEdgeSnap(productId, sx, sz, rotation, stateNow.sceneObjects)
      : { x: sx, z: sz };
    if (!stateNow.canPlaceAt(productId, snapped.x, snapped.z, rotation)) return null;
    const next: SceneObject = {
      instanceId: uniqueId(),
      productId,
      position: [snapped.x, product.dimensions.height / 2, snapped.z],
      rotation,
      options: getDefaultOptions(productId),
    };
    set((state) => ({
      ...withHistory([...state.sceneObjects, next], state),
      selectedObjectId: next.instanceId,
      modelContextMenu: null,
      placementLastPlacedId: state.draggedProductId === productId ? next.instanceId : state.placementLastPlacedId,
      portLinks: state.portModeEnabled
        ? rebuildPortLinks([...state.sceneObjects, next])
        : sanitizePortLinks([...state.sceneObjects, next], state.portLinks),
    }));
    return next.instanceId;
  },

  addShelfToFrame: (productId, frameId, slotIndex) => {
    const frame = get().sceneObjects.find((obj) => obj.instanceId === frameId);
    const slotProduct = PRODUCT_BY_ID[productId];
    if (!frame || !slotProduct || !attachesToFrameSlot(productId)) return;
    const frameProduct = PRODUCT_BY_ID[frame.productId];
    if (!slotProduct.attachableTo?.includes(frame.productId)) return;

    const attachMode = getFrameAttachMode(productId);
    const sceneNow = get().sceneObjects;

    if (attachMode === 'top-edge') {
      const railOcc = getOccupiedTopEdgeRailIndices(frameId, sceneNow);
      if (slotProduct.topEdgeSpan === 'full') {
        if (railOcc.length > 0) return;
      } else if (railOcc.includes(slotIndex)) {
        return;
      }
    } else {
      // Front-face items are stacked vertically by slot index.
      // If their vertical spans overlap (e.g. TV overlaps shelf slots),
      // we must block both: installation AND placeholder rendering.
      const candidateY = GHOST_SHELF_POSITIONS[slotIndex];
      const candidateHalfH = slotProduct.dimensions.height / 2;
      const EPS_Y = 0.01;

      const conflicts = sceneNow
        .filter(
          (obj) =>
            obj.attachedToFrameId === frameId &&
            typeof obj.shelfSlotIndex === 'number' &&
            getFrameAttachMode(obj.productId) === 'front-face',
        )
        .some((obj) => {
          const existingY =
            GHOST_SHELF_POSITIONS[obj.shelfSlotIndex as number] ?? obj.position[1];
          const existing = PRODUCT_BY_ID[obj.productId];
          const existingHalfH = existing.dimensions.height / 2;
          return Math.abs(candidateY - existingY) < candidateHalfH + existingHalfH + EPS_Y;
        });

      if (conflicts) return;
    }

    let position: [number, number, number];
    if (attachMode === 'top-edge') {
      const p = computeTopEdgeWorldPosition(frame, frameProduct, slotProduct, slotIndex);
      position = [p.x, p.y, p.z];
    } else {
      const frameFrontOffset = frameProduct.dimensions.depth / 2 + slotProduct.dimensions.depth / 2;
      const x = frame.position[0] + Math.sin(frame.rotation) * frameFrontOffset;
      const z = frame.position[2] + Math.cos(frame.rotation) * frameFrontOffset;
      position = [x, GHOST_SHELF_POSITIONS[slotIndex], z];
    }

    const next: SceneObject = {
      instanceId: uniqueId(),
      productId,
      position,
      rotation: frame.rotation,
      attachedToFrameId: frameId,
      shelfSlotIndex: slotIndex,
      options: getDefaultOptions(productId),
    };
    set((state) => ({
      ...withHistory([...state.sceneObjects, next], state),
      // Keep frame selected in Step 2 so multiple shelves can be added in sequence.
      selectedObjectId: frameId,
      modelContextMenu: null,
    }));
  },

  moveObject: (id, x, z) => {
    const state = get();
    const obj = state.sceneObjects.find((item) => item.instanceId === id);
    if (!obj) return;
    if (!attachesToFrameSlot(obj.productId) && state.currentStep !== 1) return;
    if (attachesToFrameSlot(obj.productId) && state.currentStep !== 2) return;
    if (getFrameAttachMode(obj.productId) === 'top-edge') return;

    const { x: sx, z: sz } = snappedXZ(x, z);
    const snapped =
      state.portModeEnabled && state.currentStep === 1
        ? applyEdgeSnap(obj.productId, sx, sz, obj.rotation, state.sceneObjects, id)
        : { x: sx, z: sz };

    const linkedIds =
      !attachesToFrameSlot(obj.productId) && !state.portModeEnabled && state.currentStep === 1
        ? getPortLinkedComponent(id, state.portLinks)
        : new Set<string>([id]);

    const moveAsGroup = !attachesToFrameSlot(obj.productId) && linkedIds.size > 1;
    const deltaX = snapped.x - obj.position[0];
    const deltaZ = snapped.z - obj.position[2];

    if (moveAsGroup) {
      const excludeIds = [...linkedIds];
      for (const structure of state.sceneObjects.filter((item) => linkedIds.has(item.instanceId))) {
        if (!state.canPlaceAt(
          structure.productId,
          structure.position[0] + deltaX,
          structure.position[2] + deltaZ,
          structure.rotation,
          excludeIds,
        )) {
          return;
        }
      }
    } else if (!state.canPlaceAt(obj.productId, snapped.x, snapped.z, obj.rotation, id)) {
      return;
    }

    const movedById = new Map<string, SceneObject>();
    if (moveAsGroup) {
      for (const structure of state.sceneObjects.filter((item) => linkedIds.has(item.instanceId))) {
        movedById.set(structure.instanceId, {
          ...structure,
          position: [
            structure.position[0] + deltaX,
            structure.position[1],
            structure.position[2] + deltaZ,
          ],
        });
      }
    } else {
      movedById.set(id, {
        ...obj,
        position: [snapped.x, obj.position[1], snapped.z],
      });
    }

    const movedFrameIds = new Set(
      [...movedById.values()]
        .filter((item) => !attachesToFrameSlot(item.productId))
        .map((item) => item.instanceId),
    );

    const next = state.sceneObjects.map((item) => {
      if (movedById.has(item.instanceId)) {
        return movedById.get(item.instanceId) as SceneObject;
      }
      if (item.attachedToFrameId && movedFrameIds.has(item.attachedToFrameId) && attachesToFrameSlot(item.productId)) {
        const frame = movedById.get(item.attachedToFrameId);
        if (!frame) return item;
        const placement = getAttachedShelfPlacement(frame, item);
        return {
          ...item,
          position: [placement.x, placement.y, placement.z] as [number, number, number],
          rotation: placement.rotation,
        };
      }
      return item;
    });
    set((prev) => ({
      ...withHistory(next, prev),
      modelContextMenu: prev.modelContextMenu?.objectId === id ? null : prev.modelContextMenu,
      portLinks: prev.portModeEnabled ? rebuildPortLinks(next) : sanitizePortLinks(next, prev.portLinks),
    }));
  },

  rotateObject: (id) => {
    const state = get();
    const obj = state.sceneObjects.find((item) => item.instanceId === id);
    if (!obj || attachesToFrameSlot(obj.productId)) return;
    if (state.currentStep !== 1) return;
    const nextRotation = ((obj.rotation + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    if (!state.canPlaceAt(obj.productId, obj.position[0], obj.position[2], nextRotation, id)) return;
    const rotatedFrame: SceneObject = {
      ...obj,
      rotation: nextRotation,
    };
    const next = state.sceneObjects.map((item) => {
      if (item.instanceId === id) {
        return rotatedFrame;
      }
      if (item.attachedToFrameId === id && attachesToFrameSlot(item.productId)) {
        const placement = getAttachedShelfPlacement(rotatedFrame, item);
        return {
          ...item,
          position: [placement.x, placement.y, placement.z] as [number, number, number],
          rotation: placement.rotation,
        };
      }
      return item;
    });
    set((prev) => ({
      ...withHistory(next, prev),
      modelContextMenu: prev.modelContextMenu?.objectId === id ? null : prev.modelContextMenu,
      portLinks: prev.portModeEnabled ? rebuildPortLinks(next) : sanitizePortLinks(next, prev.portLinks),
    }));
  },

  deleteObject: (id) => {
    const state = get();
    const target = state.sceneObjects.find((item) => item.instanceId === id);
    if (!target) return;
    if (!attachesToFrameSlot(target.productId) && state.currentStep !== 1) return;
    if (attachesToFrameSlot(target.productId) && state.currentStep !== 2) return;
    const next = state.sceneObjects.filter((item) => item.instanceId !== id && item.attachedToFrameId !== id);
    set((prev) => {
      const nextGraphics = { ...prev.frameGraphics };
      delete nextGraphics[id];
      const nextSelectedFrames = prev.selectedGraphicFrameIds.filter((frameId) => frameId !== id);
      return {
        ...withHistory(next, prev),
        selectedObjectId: prev.selectedObjectId === id ? null : prev.selectedObjectId,
        frameGraphics: nextGraphics,
        selectedGraphicFrameIds: nextSelectedFrames,
        modelContextMenu: prev.modelContextMenu?.objectId === id ? null : prev.modelContextMenu,
        portLinks: prev.portModeEnabled ? rebuildPortLinks(next) : sanitizePortLinks(next, prev.portLinks),
      };
    });
  },

  duplicateObject: (id, x, z) => {
    const state = get();
    const obj = state.sceneObjects.find((item) => item.instanceId === id);
    if (!obj || attachesToFrameSlot(obj.productId)) return;
    if (state.currentStep !== 1) return;
    get().addObject(obj.productId, x, z, obj.rotation);
  },

  selectObject: (id) => set({ selectedObjectId: id, modelContextMenu: null }),
  openModelContextMenu: (objectId, x, y) =>
    set({
      modelContextMenu: { objectId, x, y },
      selectedObjectId: objectId,
    }),
  closeModelContextMenu: () => set({ modelContextMenu: null }),
  setShelfColor: (objectId, color) =>
    set((state) => {
      const target = state.sceneObjects.find((obj) => obj.instanceId === objectId);
      if (!target || !isShelf(target.productId)) return state;
      const next = state.sceneObjects.map((obj) =>
        obj.instanceId === objectId
          ? {
              ...obj,
              options: {
                ...obj.options,
                shelfColor: color,
              },
            }
          : obj,
      );
      return {
        ...withHistory(next, state),
        modelContextMenu: null,
      };
    }),
  setCountertopColor: (objectId, color) =>
    set((state) => {
      const target = state.sceneObjects.find((obj) => obj.instanceId === objectId);
      if (!target || !isCounterLike(target.productId)) return state;
      const next = state.sceneObjects.map((obj) =>
        obj.instanceId === objectId
          ? {
              ...obj,
              options: {
                ...obj.options,
                countertopColor: color,
              },
            }
          : obj,
      );
      return {
        ...withHistory(next, state),
        modelContextMenu: null,
      };
    }),
  toggleCountertopUsb: (objectId) =>
    set((state) => {
      const target = state.sceneObjects.find((obj) => obj.instanceId === objectId);
      if (!target || !isCounterLike(target.productId)) return state;
      const next = state.sceneObjects.map((obj) =>
        obj.instanceId === objectId
          ? {
              ...obj,
              options: {
                ...obj.options,
                countertopUsb: !(obj.options?.countertopUsb ?? true),
              },
            }
          : obj,
      );
      return {
        ...withHistory(next, state),
        modelContextMenu: null,
      };
    }),
  setStorageDoor: (objectId, hasDoor) =>
    set((state) => {
      const target = state.sceneObjects.find((obj) => obj.instanceId === objectId);
      if (!target || !isStorageLike(target.productId)) return state;
      const next = state.sceneObjects.map((obj) =>
        obj.instanceId === objectId
          ? {
              ...obj,
              options: {
                ...obj.options,
                storageHasDoor: hasDoor,
              },
            }
          : obj,
      );
      return {
        ...withHistory(next, state),
        modelContextMenu: null,
      };
    }),

  toggleGraphicFrameSelection: (id) =>
    set((state) => {
      if (state.selectedGraphicFrameIds.includes(id)) {
        return {
          selectedGraphicFrameIds: state.selectedGraphicFrameIds.filter((frameId) => frameId !== id),
        };
      }
      if (state.selectedGraphicFrameIds.length >= GRAPHIC_SELECTION_LIMIT) {
        return state;
      }
      return {
        selectedGraphicFrameIds: [...state.selectedGraphicFrameIds, id],
      };
    }),
  clearGraphicFrameSelection: () => set({ selectedGraphicFrameIds: [] }),
  applyGraphicToFrames: (assetUrl, assignments) =>
    set((state) => {
      if (assignments.length === 0) return state;
      const assetId = crypto.randomUUID();
      const nextFrameGraphics = { ...state.frameGraphics };
      for (const assignment of assignments) {
        nextFrameGraphics[assignment.frameId] = {
          assetId,
          crop: assignment.crop,
        };
      }
      return {
        graphicsAssets: {
          ...state.graphicsAssets,
          [assetId]: assetUrl,
        },
        frameGraphics: nextFrameGraphics,
      };
    }),

  setStep: (step) =>
    set({
      currentStep: step,
      selectedObjectId: null,
      selectedGraphicFrameIds: [],
      modelContextMenu: null,
      draggedProductId: null,
      placementRotation: 0,
      placementPreview: null,
      placementLastPlacedId: null,
    }),

  startDrag: (productId) =>
    set({
      draggedProductId: productId,
      placementRotation: 0,
      placementPreview: null,
      placementLastPlacedId: null,
      modelContextMenu: null,
    }),
  endDrag: () =>
    set({
      draggedProductId: null,
      placementRotation: 0,
      placementPreview: null,
      placementLastPlacedId: null,
      modelContextMenu: null,
    }),
  rotatePlacement: () =>
    set((state) => ({
      placementRotation:
        ((state.placementRotation + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2),
    })),
  setPlacementPreview: (x, z) =>
    set((state) => {
      const productId = state.draggedProductId;
      if (!productId) return state;
      const snapped = state.portModeEnabled
        ? applyEdgeSnap(productId, x, z, state.placementRotation, state.sceneObjects)
        : snappedXZ(x, z);
      const valid = state.canPlaceAt(productId, snapped.x, snapped.z, state.placementRotation);
      return {
        placementPreview: {
          x: snapped.x,
          z: snapped.z,
          valid,
        },
      };
    }),
  clearPlacementPreview: () => set({ placementPreview: null }),
  undoLastPlacement: () =>
    set((state) => {
      if (!state.placementLastPlacedId) return state;
      const next = state.sceneObjects.filter((obj) => obj.instanceId !== state.placementLastPlacedId);
      return {
        ...withHistory(next, state),
        selectedObjectId:
          state.selectedObjectId === state.placementLastPlacedId ? null : state.selectedObjectId,
        placementLastPlacedId: null,
      };
    }),

  clearScene: () =>
    set((state) => ({
      ...withHistory([], state),
      selectedObjectId: null,
      selectedGraphicFrameIds: [],
      frameGraphics: {},
      graphicsAssets: {},
      modelContextMenu: null,
      portLinks: [],
      boothLegCountOverride: null,
      boothStabilizerCountOverride: null,
      boothLegFootKind: 'pad',
      boothSecurityRiskAccepted: false,
    })),

  setBoothLegCountOverride: (value) =>
    set((state) => {
      const structural = countStructuralFramesForBooth(state.sceneObjects);
      const rec = structural * 2;
      const effective = value === null ? rec : value;
      const meetsRecommended = value === null || effective >= rec;
      return {
        boothLegCountOverride: value,
        boothSecurityRiskAccepted: meetsRecommended ? false : state.boothSecurityRiskAccepted,
      };
    }),

  setBoothStabilizerCountOverride: (value) => set({ boothStabilizerCountOverride: value }),

  setBoothLegFootKind: (kind) => set({ boothLegFootKind: kind }),

  acceptBoothSecurityRisk: () => set({ boothSecurityRiskAccepted: true }),

  undo: () =>
    set((state) => {
      if (state.historyPast.length === 0) return state;
      const previous = state.historyPast[state.historyPast.length - 1];
      const nextPast = state.historyPast.slice(0, -1);
      const nextFuture = [state.sceneObjects, ...state.historyFuture].slice(0, HISTORY_LIMIT);
      return {
        ...state,
        sceneObjects: previous,
        historyPast: nextPast,
        historyFuture: nextFuture,
        canUndo: nextPast.length > 0,
        canRedo: true,
        selectedObjectId: null,
        modelContextMenu: null,
        portLinks: state.portModeEnabled
          ? rebuildPortLinks(previous)
          : sanitizePortLinks(previous, state.portLinks),
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyFuture.length === 0) return state;
      const [next, ...rest] = state.historyFuture;
      const nextPast = [...state.historyPast, state.sceneObjects].slice(-HISTORY_LIMIT);
      return {
        ...state,
        sceneObjects: next,
        historyFuture: rest,
        historyPast: nextPast,
        canUndo: true,
        canRedo: rest.length > 0,
        selectedObjectId: null,
        modelContextMenu: null,
        portLinks: state.portModeEnabled ? rebuildPortLinks(next) : sanitizePortLinks(next, state.portLinks),
      };
    }),

  togglePortMode: () =>
    set((state) => {
      const nextEnabled = !state.portModeEnabled;
      return {
        portModeEnabled: nextEnabled,
        portLinks: nextEnabled ? rebuildPortLinks(state.sceneObjects) : state.portLinks,
      };
    }),

  getFrame96Objects: () =>
    get().sceneObjects.filter((obj) => ['frame-96', 'frame-counter-96'].includes(obj.productId)),

  getOccupiedSlots: (frameId, attachMode: FrameAttachMode = 'front-face') => {
    if (attachMode === 'top-edge') {
      return getOccupiedTopEdgeRailIndices(frameId, get().sceneObjects);
    }
    return get()
      .sceneObjects.filter(
        (obj) => obj.attachedToFrameId === frameId && typeof obj.shelfSlotIndex === 'number',
      )
      .filter((obj) => getFrameAttachMode(obj.productId) === 'front-face')
      .map((obj) => obj.shelfSlotIndex as number);
  },

  canPlaceAt: (productId, x, z, rotation, excludeId) => {
    const product = PRODUCT_BY_ID[productId];
    if (!product || attachesToFrameSlot(productId)) return true;
    const footprint = getFootprint(productId, rotation);
    if (!isWithinBounds(x, z, footprint.width, footprint.depth)) return false;
    const nextBox = { x, z, width: footprint.width, depth: footprint.depth };
    const excludeIds = Array.isArray(excludeId) ? new Set(excludeId) : new Set(excludeId ? [excludeId] : []);
    return get()
      .sceneObjects.filter((obj) => !excludeIds.has(obj.instanceId) && !attachesToFrameSlot(obj.productId))
      .every((obj) => {
        const fp = getFootprint(obj.productId, obj.rotation);
        const box = {
          x: obj.position[0],
          z: obj.position[2],
          width: fp.width,
          depth: fp.depth,
        };
        return !intersectsXZ(nextBox, box);
      });
  },
}));

export const getStepProducts = (step: WizardStep) => PRODUCTS.filter((product) => product.step === step);
