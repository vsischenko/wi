import { useEffect } from 'react';
import { PRODUCT_BY_ID } from '../data/products';
import { useWizardStore } from '../store/useWizardStore';

/** Categories that show a right-click options menu in steps 2–3. */
export const MODEL_CONTEXT_MENU_CATEGORIES = [
  'shelf',
  'hangable',
  'counter',
  'frame-counter',
  'storage',
  'closet',
] as const;

export const modelContextMenuEligible = (category: string) =>
  (MODEL_CONTEXT_MENU_CATEGORIES as readonly string[]).includes(category);

export const ModelContextMenu = () => {
  const menu = useWizardStore((s) => s.modelContextMenu);
  const currentStep = useWizardStore((s) => s.currentStep);
  const sceneObjects = useWizardStore((s) => s.sceneObjects);
  const closeMenu = useWizardStore((s) => s.closeModelContextMenu);
  const deleteObject = useWizardStore((s) => s.deleteObject);
  const setShelfColor = useWizardStore((s) => s.setShelfColor);
  const setCountertopColor = useWizardStore((s) => s.setCountertopColor);
  const toggleCountertopUsb = useWizardStore((s) => s.toggleCountertopUsb);
  const setStorageDoor = useWizardStore((s) => s.setStorageDoor);
  const setTvMuted = useWizardStore((s) => s.setTvMuted);
  const setTvVolume = useWizardStore((s) => s.setTvVolume);

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
  if (!modelContextMenuEligible(product.category)) return null;

  const showRemoveFromFrame =
    currentStep === 2 &&
    !!object.attachedToFrameId &&
    (product.category === 'shelf' || product.category === 'hangable');

  return (
    <div
      className="shelf-menu"
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="shelf-menu-title">{product.name}</div>
      {product.category === 'shelf' && (
        <>
          <button type="button" onClick={() => setShelfColor(object.instanceId, 'white')}>
            Color: White
          </button>
          <button type="button" onClick={() => setShelfColor(object.instanceId, 'black')}>
            Color: Black
          </button>
          <button type="button" onClick={() => setShelfColor(object.instanceId, 'wood')}>
            Color: Wood
          </button>
        </>
      )}
      {['counter', 'frame-counter'].includes(product.category) && (
        <>
          <button type="button" onClick={() => setCountertopColor(object.instanceId, 'white')}>
            Top: White
          </button>
          <button type="button" onClick={() => setCountertopColor(object.instanceId, 'black')}>
            Top: Black
          </button>
          <button type="button" onClick={() => setCountertopColor(object.instanceId, 'wood')}>
            Top: Wood
          </button>
          <button type="button" onClick={() => toggleCountertopUsb(object.instanceId)}>
            USB: {object.options?.countertopUsb ?? true ? 'ON' : 'OFF'}
          </button>
        </>
      )}
      {['storage', 'closet'].includes(product.category) && (
        <>
          <button type="button" onClick={() => setStorageDoor(object.instanceId, true)}>
            Door: YES
          </button>
          <button type="button" onClick={() => setStorageDoor(object.instanceId, false)}>
            Door: NO
          </button>
        </>
      )}
      {(object.productId === 'tv-19' || object.productId === 'tv-96-16x9') && (
        <>
          <button
            type="button"
            onClick={() => setTvMuted(object.instanceId, !(object.options?.tvMuted ?? true))}
          >
            Sound: {object.options?.tvMuted ?? true ? 'OFF' : 'ON'}
          </button>
          <label className="shelf-menu-field">
            <span>Volume: {Math.round((object.options?.tvVolume ?? 0.6) * 100)}%</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round((object.options?.tvVolume ?? 0.6) * 100)}
              onChange={(event) => setTvVolume(object.instanceId, Number(event.target.value) / 100)}
            />
          </label>
        </>
      )}
      {showRemoveFromFrame && (
        <button type="button" className="shelf-menu-danger" onClick={() => deleteObject(object.instanceId)}>
          Remove from frame
        </button>
      )}
    </div>
  );
};
