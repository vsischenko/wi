export type WizardStep = 1 | 2;

export type ProductCategory =
  | 'frame'
  | 'frame-counter'
  | 'counter'
  | 'storage'
  | 'closet'
  | 'shelf';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  step: WizardStep;
  dimensions: { width: number; height: number; depth: number };
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
}
