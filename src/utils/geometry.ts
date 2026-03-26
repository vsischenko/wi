import { PRODUCT_BY_ID } from '../data/products';
import { GRID_STEP, SCENE_DEPTH, SCENE_WIDTH } from './constants';

export interface Footprint {
  width: number;
  depth: number;
}

export const snapToGrid = (value: number) =>
  Math.round(value / GRID_STEP) * GRID_STEP;

export const snappedXZ = (x: number, z: number) => ({
  x: snapToGrid(x),
  z: snapToGrid(z),
});

export const getFootprint = (productId: string, rotation: number): Footprint => {
  const product = PRODUCT_BY_ID[productId];
  const quarterTurns = Math.round(rotation / (Math.PI / 2)) % 2;
  const isSwapped = quarterTurns !== 0;
  return {
    width: isSwapped ? product.dimensions.depth : product.dimensions.width,
    depth: isSwapped ? product.dimensions.width : product.dimensions.depth,
  };
};

export const isWithinBounds = (
  x: number,
  z: number,
  width: number,
  depth: number,
) => {
  const halfW = SCENE_WIDTH / 2;
  const halfD = SCENE_DEPTH / 2;
  return (
    x - width / 2 >= -halfW &&
    x + width / 2 <= halfW &&
    z - depth / 2 >= -halfD &&
    z + depth / 2 <= halfD
  );
};

export const intersectsXZ = (
  a: { x: number; z: number; width: number; depth: number },
  b: { x: number; z: number; width: number; depth: number },
) =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
  Math.abs(a.z - b.z) < (a.depth + b.depth) / 2;
