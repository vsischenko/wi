import { useEffect } from 'react';
import { PRODUCT_BY_ID } from '../data/products';
import { useWizardStore } from '../store/useWizardStore';

export const ModelContextMenu = () => {
  const menu = useWizardStore((s) => s.modelContextMenu);
  const sceneObjects = useWizardStore((s) => s.sceneObjects);
  const closeMenu = useWizardStore((s) => s.closeModelContextMenu);
  const setShelfColor = useWizardStore((s) => s.setShelfColor);
  const setCountertopColor = useWizardStore((s) => s.setCountertopColor);
  const toggleCountertopUsb = useWizardStore((s) => s.toggleCountertopUsb);
  const setStorageDoor = useWizardStore((s) => s.setStorageDoor);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = () => closeMenu();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [closeMenu, menu]);

  if (!menu) return null;
  const object = sceneObjects.find((item) => item.instanceId === menu.objectId);
  if (!object) return null;
  const product = PRODUCT_BY_ID[object.productId];

  return (
    <div
      className="shelf-menu"
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="shelf-menu-title">{product.name} options</div>
      {product.category === 'shelf' && (
        <>
          <button onClick={() => setShelfColor(object.instanceId, 'white')}>Color: White</button>
          <button onClick={() => setShelfColor(object.instanceId, 'black')}>Color: Black</button>
          <button onClick={() => setShelfColor(object.instanceId, 'wood')}>Color: Wood</button>
        </>
      )}
      {['counter', 'frame-counter'].includes(product.category) && (
        <>
          <button onClick={() => setCountertopColor(object.instanceId, 'white')}>Top: White</button>
          <button onClick={() => setCountertopColor(object.instanceId, 'black')}>Top: Black</button>
          <button onClick={() => setCountertopColor(object.instanceId, 'wood')}>Top: Wood</button>
          <button onClick={() => toggleCountertopUsb(object.instanceId)}>
            USB: {object.options?.countertopUsb ?? true ? 'ON' : 'OFF'}
          </button>
        </>
      )}
      {['storage', 'closet'].includes(product.category) && (
        <>
          <button onClick={() => setStorageDoor(object.instanceId, true)}>Door: YES</button>
          <button onClick={() => setStorageDoor(object.instanceId, false)}>Door: NO</button>
        </>
      )}
    </div>
  );
};
