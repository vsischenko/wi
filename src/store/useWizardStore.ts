import { create } from 'zustand';
import { PRODUCTS, PRODUCT_BY_ID } from '../data/products';
import type { SceneObject, WizardStep } from '../types';
import { GHOST_SHELF_POSITIONS } from '../utils/constants';
import { getFootprint, intersectsXZ, isWithinBounds, snappedXZ } from '../utils/geometry';

const HISTORY_LIMIT = 30;

interface WizardState {
  currentStep: WizardStep;
  sceneObjects: SceneObject[];
  selectedObjectId: string | null;
  draggedProductId: string | null;
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
  setStep: (step: WizardStep) => void;
  startDrag: (productId: string) => void;
  endDrag: () => void;
  clearScene: () => void;
  undo: () => void;
  redo: () => void;
  getFrame96Objects: () => SceneObject[];
  getOccupiedSlots: (frameId: string) => number[];
  canPlaceAt: (productId: string, x: number, z: number, rotation: number, excludeId?: string) => boolean;
}

const isShelf = (productId: string) => PRODUCT_BY_ID[productId].category === 'shelf';

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

export const useWizardStore = create<WizardState>((set, get) => ({
  currentStep: 1,
  sceneObjects: [],
  selectedObjectId: null,
  draggedProductId: null,
  canUndo: false,
  canRedo: false,
  historyPast: [],
  historyFuture: [],

  addObject: (productId, x, z, rotation = 0) => {
    const product = PRODUCT_BY_ID[productId];
    if (!product || product.step !== 1) return null;
    const { x: sx, z: sz } = snappedXZ(x, z);
    if (!get().canPlaceAt(productId, sx, sz, rotation)) return null;
    const next: SceneObject = {
      instanceId: uniqueId(),
      productId,
      position: [sx, product.dimensions.height / 2, sz],
      rotation,
    };
    set((state) => ({
      ...withHistory([...state.sceneObjects, next], state),
      selectedObjectId: next.instanceId,
    }));
    return next.instanceId;
  },

  addShelfToFrame: (productId, frameId, slotIndex) => {
    const frame = get().sceneObjects.find((obj) => obj.instanceId === frameId);
    const shelf = PRODUCT_BY_ID[productId];
    if (!frame || !shelf || shelf.category !== 'shelf') return;
    const occupied = get().getOccupiedSlots(frameId);
    if (occupied.includes(slotIndex)) return;
    const frameProduct = PRODUCT_BY_ID[frame.productId];
    if (!shelf.attachableTo?.includes(frame.productId)) return;

    const frameFrontOffset = frameProduct.dimensions.depth / 2 + shelf.dimensions.depth / 2;
    const x = frame.position[0] + Math.sin(frame.rotation) * frameFrontOffset;
    const z = frame.position[2] + Math.cos(frame.rotation) * frameFrontOffset;

    const next: SceneObject = {
      instanceId: uniqueId(),
      productId,
      position: [x, GHOST_SHELF_POSITIONS[slotIndex], z],
      rotation: frame.rotation,
      attachedToFrameId: frameId,
      shelfSlotIndex: slotIndex,
    };
    set((state) => ({
      ...withHistory([...state.sceneObjects, next], state),
      selectedObjectId: next.instanceId,
    }));
  },

  moveObject: (id, x, z) => {
    const state = get();
    const obj = state.sceneObjects.find((item) => item.instanceId === id);
    if (!obj) return;
    if (state.currentStep === 2 && !isShelf(obj.productId)) return;
    const { x: sx, z: sz } = snappedXZ(x, z);
    if (!state.canPlaceAt(obj.productId, sx, sz, obj.rotation, id)) return;
    const next = state.sceneObjects.map((item) =>
      item.instanceId === id ? { ...item, position: [sx, item.position[1], sz] as [number, number, number] } : item,
    );
    set((prev) => withHistory(next, prev));
  },

  rotateObject: (id) => {
    const state = get();
    const obj = state.sceneObjects.find((item) => item.instanceId === id);
    if (!obj || isShelf(obj.productId)) return;
    if (state.currentStep === 2) return;
    const nextRotation = ((obj.rotation + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    if (!state.canPlaceAt(obj.productId, obj.position[0], obj.position[2], nextRotation, id)) return;
    const next = state.sceneObjects.map((item) =>
      item.instanceId === id ? { ...item, rotation: nextRotation } : item,
    );
    set((prev) => withHistory(next, prev));
  },

  deleteObject: (id) => {
    const state = get();
    const target = state.sceneObjects.find((item) => item.instanceId === id);
    if (!target) return;
    if (state.currentStep === 2 && !isShelf(target.productId)) return;
    const next = state.sceneObjects.filter((item) => item.instanceId !== id && item.attachedToFrameId !== id);
    set((prev) => ({
      ...withHistory(next, prev),
      selectedObjectId: prev.selectedObjectId === id ? null : prev.selectedObjectId,
    }));
  },

  duplicateObject: (id, x, z) => {
    const state = get();
    const obj = state.sceneObjects.find((item) => item.instanceId === id);
    if (!obj || isShelf(obj.productId)) return;
    get().addObject(obj.productId, x, z, obj.rotation);
  },

  selectObject: (id) => set({ selectedObjectId: id }),

  setStep: (step) => set({ currentStep: step, selectedObjectId: null, draggedProductId: null }),

  startDrag: (productId) => set({ draggedProductId: productId }),
  endDrag: () => set({ draggedProductId: null }),

  clearScene: () =>
    set((state) => ({
      ...withHistory([], state),
      selectedObjectId: null,
    })),

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
      };
    }),

  getFrame96Objects: () =>
    get().sceneObjects.filter((obj) => ['frame-96', 'frame-counter-96'].includes(obj.productId)),

  getOccupiedSlots: (frameId) =>
    get()
      .sceneObjects.filter((obj) => obj.attachedToFrameId === frameId && typeof obj.shelfSlotIndex === 'number')
      .map((obj) => obj.shelfSlotIndex as number),

  canPlaceAt: (productId, x, z, rotation, excludeId) => {
    const product = PRODUCT_BY_ID[productId];
    if (!product || product.category === 'shelf') return true;
    const footprint = getFootprint(productId, rotation);
    if (!isWithinBounds(x, z, footprint.width, footprint.depth)) return false;
    const nextBox = { x, z, width: footprint.width, depth: footprint.depth };
    return get()
      .sceneObjects.filter((obj) => obj.instanceId !== excludeId && !isShelf(obj.productId))
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
