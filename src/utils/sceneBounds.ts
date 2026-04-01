import { PRODUCT_BY_ID } from '../data/products';
import type { SceneObject } from '../types';
import { getFootprint } from './geometry';

export interface SceneBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerY: number;
  centerZ: number;
  width: number;
  height: number;
  depth: number;
}

export const getSceneBounds = (objects: SceneObject[]): SceneBounds | null => {
  if (objects.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const object of objects) {
    const product = PRODUCT_BY_ID[object.productId];
    if (!product) continue;

    const footprint = getFootprint(object.productId, object.rotation);
    const halfW = footprint.width / 2;
    const halfD = footprint.depth / 2;
    const halfH = product.dimensions.height / 2;

    const x = object.position[0];
    const y = object.position[1];
    const z = object.position[2];

    minX = Math.min(minX, x - halfW);
    maxX = Math.max(maxX, x + halfW);
    minY = Math.min(minY, y - halfH);
    maxY = Math.max(maxY, y + halfH);
    minZ = Math.min(minZ, z - halfD);
    maxZ = Math.max(maxZ, z + halfD);
  }

  if (!Number.isFinite(minX)) return null;

  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    depth: Math.max(1, maxZ - minZ),
  };
};
