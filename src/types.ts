export type WizardStep = 1 | 2 | 3;

export type ProductCategory =
  | 'frame'
  | 'frame-counter'
  | 'arch'
  | 'counter'
  | 'storage'
  | 'closet'
  | 'shelf'
  | 'hangable';

/** Step 2 catalog grouping in the right panel */
export type BoothCatalogGroup = 'advised' | 'nice';

export type BoothLegFootKind = 'pad' | 'single' | 'double';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  step: WizardStep;
  /** Step 2: which subsection lists this product */
  boothCatalogGroup?: BoothCatalogGroup;
  dimensions: { width: number; height: number; depth: number };
  priceEur: number;
  weightKg: number;
  color: string;
  accentColor?: string;
  hasSupportBars?: boolean;
  thumbnailUrl: string;
  attachableTo?: string[];
  description?: string;
}

export interface SceneObject {
  instanceId: string;
  productId: string;
  position: [number, number, number];
  rotation: number;
  attachedToFrameId?: string;
  shelfSlotIndex?: number;
  options?: {
    shelfColor?: 'white' | 'black' | 'wood';
    countertopColor?: 'white' | 'black' | 'wood';
    countertopUsb?: boolean;
    storageHasDoor?: boolean;
  };
}

export interface GraphicCrop {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}
