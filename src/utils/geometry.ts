import { PRODUCT_BY_ID } from '../data/products';
import { GRID_STEP, SCENE_DEPTH, SCENE_WIDTH } from './constants';
import type { SceneObject } from '../types';

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
  if (productId === 'arch-96') {
    // Arch module should use the same floor footprint as a standard vertical frame.
    const frame96 = PRODUCT_BY_ID['frame-96'];
    return {
      width: frame96.dimensions.width,
      depth: frame96.dimensions.depth,
    };
  }
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

const SNAP_EDGE_THRESHOLD = 18;
const SNAP_ALIGN_THRESHOLD = 30;
const SNAP_PRODUCTS = new Set(['frame-96', 'frame-48', 'frame-22', 'frame-counter-96', 'arch-96']);
const T_CONNECT_ALIGN_THRESHOLD = 40;

const intervalDistance = (aMin: number, aMax: number, bMin: number, bMax: number) => {
  if (aMax < bMin) return bMin - aMax;
  if (bMax < aMin) return aMin - bMax;
  return 0;
};

export const applyEdgeSnap = (
  productId: string,
  x: number,
  z: number,
  rotation: number,
  objects: SceneObject[],
  excludeId?: string,
) => {
  if (!SNAP_PRODUCTS.has(productId)) return { x, z };

  const rotationIndex = ((Math.round(rotation / (Math.PI / 2)) % 4) + 4) % 4;
  const footprint = getFootprint(productId, rotation);
  const candidate = {
    minX: x - footprint.width / 2,
    maxX: x + footprint.width / 2,
    minZ: z - footprint.depth / 2,
    maxZ: z + footprint.depth / 2,
  };

  let bestScore = Number.POSITIVE_INFINITY;
  let bestX = x;
  let bestZ = z;
  let bestCornerScore = Number.POSITIVE_INFINITY;
  let bestCornerX = x;
  let bestCornerZ = z;

  const consider = (nextX: number, nextZ: number, score: number) => {
    if (score < bestScore) {
      bestScore = score;
      bestX = nextX;
      bestZ = nextZ;
    }
  };
  const considerCorner = (nextX: number, nextZ: number, score: number) => {
    if (score < bestCornerScore) {
      bestCornerScore = score;
      bestCornerX = nextX;
      bestCornerZ = nextZ;
    }
  };

  for (const object of objects) {
    if (object.instanceId === excludeId || !SNAP_PRODUCTS.has(object.productId)) continue;
    const otherRotationIndex = ((Math.round(object.rotation / (Math.PI / 2)) % 4) + 4) % 4;
    const isParallel = rotationIndex % 2 === otherRotationIndex % 2;

    const fp = getFootprint(object.productId, object.rotation);
    const box = {
      centerX: object.position[0],
      centerZ: object.position[2],
      minX: object.position[0] - fp.width / 2,
      maxX: object.position[0] + fp.width / 2,
      minZ: object.position[2] - fp.depth / 2,
      maxZ: object.position[2] + fp.depth / 2,
    };

    if (isParallel) {
      // Frames facing along +/-Z: left/right side lines are X edges.
      if (rotationIndex % 2 === 0) {
        const alignZShift = box.centerZ - z;
        if (Math.abs(alignZShift) <= SNAP_ALIGN_THRESHOLD) {
          const sx1 = box.minX - candidate.maxX;
          const sx2 = box.maxX - candidate.minX;
          if (Math.abs(sx1) <= SNAP_EDGE_THRESHOLD) {
            consider(x + sx1, z + alignZShift, Math.abs(sx1) + Math.abs(alignZShift) * 0.4);
          }
          if (Math.abs(sx2) <= SNAP_EDGE_THRESHOLD) {
            consider(x + sx2, z + alignZShift, Math.abs(sx2) + Math.abs(alignZShift) * 0.4);
          }
        }
        continue;
      }

      // Frames facing along +/-X: left/right side lines are Z edges.
      const alignXShift = box.centerX - x;
      if (Math.abs(alignXShift) <= SNAP_ALIGN_THRESHOLD) {
        const sz1 = box.minZ - candidate.maxZ;
        const sz2 = box.maxZ - candidate.minZ;
        if (Math.abs(sz1) <= SNAP_EDGE_THRESHOLD) {
          consider(x + alignXShift, z + sz1, Math.abs(sz1) + Math.abs(alignXShift) * 0.4);
        }
        if (Math.abs(sz2) <= SNAP_EDGE_THRESHOLD) {
          consider(x + alignXShift, z + sz2, Math.abs(sz2) + Math.abs(alignXShift) * 0.4);
        }
      }
      continue;
    }

    // Perpendicular L-corner snap: align one X edge and one Z edge simultaneously.
    const xShifts = [
      box.minX - candidate.minX,
      box.minX - candidate.maxX,
      box.maxX - candidate.minX,
      box.maxX - candidate.maxX,
    ];
    const zShifts = [
      box.minZ - candidate.minZ,
      box.minZ - candidate.maxZ,
      box.maxZ - candidate.minZ,
      box.maxZ - candidate.maxZ,
    ];

    let cornerFoundForObject = false;
    for (const sx of xShifts) {
      if (Math.abs(sx) > SNAP_EDGE_THRESHOLD) continue;
      for (const sz of zShifts) {
        if (Math.abs(sz) > SNAP_EDGE_THRESHOLD) continue;
        cornerFoundForObject = true;
        considerCorner(x + sx, z + sz, Math.abs(sx) + Math.abs(sz));
      }
    }

    // If angle corner is available, keep strict corner behavior for this pair
    // and don't let T-junction scoring introduce side offset.
    if (cornerFoundForObject) continue;

    // Perpendicular T-junction snap: frame end connects to side face.
    const sxCandidates = [box.minX - candidate.maxX, box.maxX - candidate.minX];
    for (const sx of sxCandidates) {
      if (Math.abs(sx) > SNAP_EDGE_THRESHOLD) continue;
      const zDist = intervalDistance(candidate.minZ, candidate.maxZ, box.minZ, box.maxZ);
      if (zDist <= T_CONNECT_ALIGN_THRESHOLD) {
        consider(x + sx, z, Math.abs(sx) + zDist * 0.6);
      }
    }

    const szCandidates = [box.minZ - candidate.maxZ, box.maxZ - candidate.minZ];
    for (const sz of szCandidates) {
      if (Math.abs(sz) > SNAP_EDGE_THRESHOLD) continue;
      const xDist = intervalDistance(candidate.minX, candidate.maxX, box.minX, box.maxX);
      if (xDist <= T_CONNECT_ALIGN_THRESHOLD) {
        consider(x, z + sz, Math.abs(sz) + xDist * 0.6);
      }
    }
  }

  // Corner-to-corner has absolute priority for 90-degree frame connections.
  if (Number.isFinite(bestCornerScore)) {
    return {
      x: bestCornerX,
      z: bestCornerZ,
    };
  }

  if (!Number.isFinite(bestScore)) {
    return {
      x: snapToGrid(x),
      z: snapToGrid(z),
    };
  }

  return {
    // Keep exact edge-to-edge coordinates; snapping to 5cm here creates visible gaps.
    x: bestX,
    z: bestZ,
  };
};
