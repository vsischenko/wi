import { PRODUCT_BY_ID } from '../data/products';

export const isGraphicSurfaceProduct = (productId: string) => {
  const product = PRODUCT_BY_ID[productId];
  if (!product) return false;
  return !!product.accentColor || product.category === 'arch';
};

export const getGraphicSurfaceSizeCm = (productId: string) => {
  const product = PRODUCT_BY_ID[productId];
  if (!product) return { width: 0, height: 0 };
  if (product.category === 'arch') {
    const frame96 = PRODUCT_BY_ID['frame-96'];
    return {
      width: frame96.dimensions.width * 0.9,
      height: frame96.dimensions.height * 0.9,
    };
  }
  return {
    width: product.dimensions.width * 0.9,
    height: product.dimensions.height * 0.9,
  };
};
