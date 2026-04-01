import { useMemo } from 'react';
import { PRODUCT_BY_ID } from '../data/products';
import { useWizardStore } from '../store/useWizardStore';
import { getGraphicSurfaceSizeCm } from '../utils/graphics';

export const StatusBar = () => {
  const sceneObjects = useWizardStore((s) => s.sceneObjects);
  const frameGraphics = useWizardStore((s) => s.frameGraphics);

  const frameCount = useMemo(
    () =>
      sceneObjects.filter((obj) =>
        ['frame', 'frame-counter', 'arch'].includes(PRODUCT_BY_ID[obj.productId].category),
      ).length,
    [sceneObjects],
  );

  const supportBarsUsed = useMemo(
    () =>
      sceneObjects.filter((obj) => {
        const product = PRODUCT_BY_ID[obj.productId];
        if (product.category !== 'shelf' || !obj.attachedToFrameId) return false;
        const frame = sceneObjects.find((item) => item.instanceId === obj.attachedToFrameId);
        if (!frame) return false;
        return !!PRODUCT_BY_ID[frame.productId].hasSupportBars;
      }).length * 2,
    [sceneObjects],
  );

  const graphicsAreaM2 = useMemo(
    () =>
      Object.keys(frameGraphics).reduce((sum, objectId) => {
        const object = sceneObjects.find((obj) => obj.instanceId === objectId);
        if (!object) return sum;
        const surface = getGraphicSurfaceSizeCm(object.productId);
        return sum + (surface.width * surface.height) / 10000;
      }, 0),
    [frameGraphics, sceneObjects],
  );

  const totalPriceEur = useMemo(() => {
    const objectsTotal = sceneObjects.reduce((sum, obj) => sum + PRODUCT_BY_ID[obj.productId].priceEur, 0);
    const graphicsTotal = graphicsAreaM2 * 35;
    return objectsTotal + graphicsTotal;
  }, [graphicsAreaM2, sceneObjects]);

  return (
    <div className="statusbar">
      <span>Frames: {frameCount}</span>
      <span>Support bars: {supportBarsUsed}</span>
      <span>Graphics: {graphicsAreaM2.toFixed(2)} m2</span>
      <span>Total: {totalPriceEur.toFixed(2)} EUR</span>
    </div>
  );
};
