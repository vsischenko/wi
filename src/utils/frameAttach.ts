import { PRODUCT_BY_ID } from '../data/products';
import type { FrameAttachMode, Product, SceneObject } from '../types';

const TOP_RAIL_DIVISIONS = 3;

export function getFrameAttachMode(productId: string): FrameAttachMode {
  return PRODUCT_BY_ID[productId]?.frameAttachMode ?? 'front-face';
}

/** Horizontal offset multipliers along frame width (local X), from center. */
export function topEdgeAlongFractions(slotCount: number): number[] {
  if (slotCount <= 1) return [0];
  if (slotCount === 2) return [-0.32, 0.32];
  if (slotCount === 3) return [-0.38, 0, 0.38];
  return Array.from({ length: slotCount }, (_, i) => {
    const t = slotCount === 1 ? 0 : (i / (slotCount - 1)) * 2 - 1;
    return t * 0.38;
  });
}

export function computeTopEdgeWorldPosition(
  frame: SceneObject,
  frameProduct: Product,
  slotProduct: Product,
  slotIndex: number,
): { x: number; y: number; z: number; rotation: number } {
  const n = slotProduct.topEdgeSlotCount ?? TOP_RAIL_DIVISIONS;
  const fr = topEdgeAlongFractions(n);
  const idx = Math.min(Math.max(0, slotIndex), fr.length - 1);
  const along = fr[idx] ?? 0;
  const halfW = frameProduct.dimensions.width / 2;
  const rot = frame.rotation;
  const rx = Math.cos(rot);
  const rz = -Math.sin(rot);
  const fwdX = Math.sin(rot);
  const fwdZ = Math.cos(rot);
  const alongWorldX = rx * along * halfW;
  const alongWorldZ = rz * along * halfW;
  const frontOff = frameProduct.dimensions.depth / 2 + slotProduct.dimensions.depth / 2 + 0.5;
  const px = frame.position[0] + alongWorldX + fwdX * frontOff;
  const pz = frame.position[2] + alongWorldZ + fwdZ * frontOff;
  const py =
    frame.position[1] + frameProduct.dimensions.height / 2 - slotProduct.dimensions.height / 2;
  return { x: px, y: py, z: pz, rotation: frame.rotation };
}

/** Slot indices 0..TOP_RAIL_DIVISIONS-1 occupied on top rail (for collision with spots). */
export function getOccupiedTopEdgeRailIndices(
  frameId: string,
  sceneObjects: SceneObject[],
): number[] {
  const used = new Set<number>();
  for (const obj of sceneObjects) {
    if (obj.attachedToFrameId !== frameId || obj.shelfSlotIndex === undefined) continue;
    if (getFrameAttachMode(obj.productId) !== 'top-edge') continue;
    const p = PRODUCT_BY_ID[obj.productId];
    if (p.topEdgeSpan === 'full') {
      for (let i = 0; i < TOP_RAIL_DIVISIONS; i += 1) used.add(i);
    } else {
      used.add(obj.shelfSlotIndex);
    }
  }
  return [...used].sort((a, b) => a - b);
}
