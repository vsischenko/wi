import { PRODUCT_BY_ID } from '../data/products';
import type { SceneObject } from '../types';

/** Frames, frame-counter, arch — used for legs / stabilizer recommendations (counters excluded). */
export function countStructuralFramesForBooth(sceneObjects: SceneObject[]): number {
  return sceneObjects.filter((obj) => {
    const p = PRODUCT_BY_ID[obj.productId];
    return p && ['frame', 'frame-counter', 'arch'].includes(p.category);
  }).length;
}

export function recommendedLegCount(structuralCount: number): number {
  return structuralCount * 2;
}

export function recommendedStabilizerCount(structuralCount: number): number {
  if (structuralCount <= 0) return 0;
  return Math.ceil(structuralCount / 2);
}
