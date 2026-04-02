import { useMemo, useState } from 'react';
import { getBoothCatalogProducts, isFrameSlotProductId, PRODUCT_BY_ID } from '../data/products';
import { ProductPreview3D } from './ProductPreview3D';
import { GraphicsEditorModal } from './graphics/GraphicsEditorModal';
import { getStepProducts, useWizardStore } from '../store/useWizardStore';
import type { BoothLegFootKind, WizardStep } from '../types';
import {
  countStructuralFramesForBooth,
  recommendedLegCount,
  recommendedStabilizerCount,
} from '../utils/booth';
import { getGraphicSurfaceSizeCm } from '../utils/graphics';

const STEP_META = {
  1: {
    name: 'Shape your booth',
    description: 'Place frames, arches, counters, and storage on the floor plan.',
  },
  2: {
    name: 'Make it nicer',
    description: 'Security hardware, lighting, and hanging accessories. Green slots show where the selected item can attach.',
  },
  3: {
    name: 'Dressing',
    description: 'Select advertising surfaces and apply graphics.',
  },
} as const;

type CatalogTab = 'favorites' | 'frames' | 'counters' | 'storage' | 'arches';

const CATALOG_TAB_LABELS: Record<CatalogTab, string> = {
  favorites: 'Favorites',
  frames: 'Frames',
  counters: 'Counters',
  storage: 'Storage modules',
  arches: 'Arches',
};

const getCatalogTabForProduct = (productId: string): CatalogTab | null => {
  const category = PRODUCT_BY_ID[productId].category;
  if (category === 'frame') return 'frames';
  if (category === 'counter' || category === 'frame-counter') return 'counters';
  if (category === 'storage' || category === 'closet') return 'storage';
  if (category === 'arch') return 'arches';
  return null;
};

function BoothSecurityModal({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="booth-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="booth-risk-title">
      <div className="booth-modal">
        <div id="booth-risk-title" className="booth-modal__title">
          Booth stability warning
        </div>
        <p className="booth-modal__text">
          Fewer legs than recommended may compromise stand safety. Continuing is at your own risk.
        </p>
        <div className="booth-modal__actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={onConfirm}>
            I understand, continue
          </button>
        </div>
      </div>
    </div>
  );
}

export const RightPanel = () => {
  const currentStep = useWizardStore((s) => s.currentStep);
  const setStep = useWizardStore((s) => s.setStep);
  const startDrag = useWizardStore((s) => s.startDrag);
  const endDrag = useWizardStore((s) => s.endDrag);
  const selectObject = useWizardStore((s) => s.selectObject);
  const deleteObject = useWizardStore((s) => s.deleteObject);
  const setShelfColor = useWizardStore((s) => s.setShelfColor);
  const setCountertopColor = useWizardStore((s) => s.setCountertopColor);
  const toggleCountertopUsb = useWizardStore((s) => s.toggleCountertopUsb);
  const setStorageDoor = useWizardStore((s) => s.setStorageDoor);
  const draggedProductId = useWizardStore((s) => s.draggedProductId);
  const sceneObjects = useWizardStore((s) => s.sceneObjects);
  const selectedObjectId = useWizardStore((s) => s.selectedObjectId);
  const selectedGraphicFrameIds = useWizardStore((s) => s.selectedGraphicFrameIds);
  const clearGraphicFrameSelection = useWizardStore((s) => s.clearGraphicFrameSelection);
  const getOccupiedSlots = useWizardStore((s) => s.getOccupiedSlots);
  const frameGraphics = useWizardStore((s) => s.frameGraphics);
  const boothLegCountOverride = useWizardStore((s) => s.boothLegCountOverride);
  const boothStabilizerCountOverride = useWizardStore((s) => s.boothStabilizerCountOverride);
  const boothLegFootKind = useWizardStore((s) => s.boothLegFootKind);
  const boothSecurityRiskAccepted = useWizardStore((s) => s.boothSecurityRiskAccepted);
  const setBoothLegCountOverride = useWizardStore((s) => s.setBoothLegCountOverride);
  const setBoothStabilizerCountOverride = useWizardStore((s) => s.setBoothStabilizerCountOverride);
  const setBoothLegFootKind = useWizardStore((s) => s.setBoothLegFootKind);
  const acceptBoothSecurityRisk = useWizardStore((s) => s.acceptBoothSecurityRisk);
  const [graphicsModalOpen, setGraphicsModalOpen] = useState(false);
  const [estimateHidden, setEstimateHidden] = useState(true);
  const [legRiskModalOpen, setLegRiskModalOpen] = useState(false);
  const [pendingLegCount, setPendingLegCount] = useState<number | null>(null);
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('frames');
  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([
    'frame-96',
    'counter-100',
    'arch-96',
  ]);
  const frames = useMemo(
    () =>
      sceneObjects.filter((obj) =>
        ['frame-96', 'frame-counter-96'].includes(obj.productId),
      ),
    [sceneObjects],
  );

  const structureProducts = useMemo(() => getStepProducts(1), []);
  const advisedProducts = useMemo(() => getBoothCatalogProducts('advised'), []);
  const niceProducts = useMemo(() => getBoothCatalogProducts('nice'), []);
  const structuralCount = useMemo(() => countStructuralFramesForBooth(sceneObjects), [sceneObjects]);
  const recLegs = useMemo(() => recommendedLegCount(structuralCount), [structuralCount]);
  const recStabilizers = useMemo(() => recommendedStabilizerCount(structuralCount), [structuralCount]);
  const effectiveLegs =
    boothLegCountOverride === null ? recLegs : Math.max(0, boothLegCountOverride);
  const effectiveStabilizers =
    boothStabilizerCountOverride === null ? recStabilizers : Math.max(0, boothStabilizerCountOverride);

  const requestLegCount = (next: number) => {
    const clamped = Math.max(0, next);
    if (clamped >= recLegs || boothSecurityRiskAccepted) {
      setBoothLegCountOverride(clamped === recLegs ? null : clamped);
      return;
    }
    setPendingLegCount(clamped);
    setLegRiskModalOpen(true);
  };

  const confirmLegRisk = () => {
    if (pendingLegCount !== null) {
      acceptBoothSecurityRisk();
      setBoothLegCountOverride(pendingLegCount);
    }
    setLegRiskModalOpen(false);
    setPendingLegCount(null);
  };

  const resetLegsToRecommended = () => {
    setBoothLegCountOverride(null);
  };

  const adjustStabilizers = (delta: number) => {
    const base = effectiveStabilizers;
    const next = Math.max(0, base + delta);
    if (next === recStabilizers) {
      setBoothStabilizerCountOverride(null);
    } else {
      setBoothStabilizerCountOverride(next);
    }
  };

  const filteredStructureProducts = useMemo(() => {
    if (catalogTab === 'favorites') {
      return structureProducts.filter((product) => favoriteProductIds.includes(product.id));
    }
    return structureProducts.filter((product) => getCatalogTabForProduct(product.id) === catalogTab);
  }, [catalogTab, favoriteProductIds, structureProducts]);
  const noFramesInStep2 = currentStep === 2 && frames.length === 0;
  const selectedObject = useMemo(
    () => (selectedObjectId ? sceneObjects.find((obj) => obj.instanceId === selectedObjectId) ?? null : null),
    [sceneObjects, selectedObjectId],
  );
  const selectedFrameObject = useMemo(() => {
    if (currentStep !== 2 || !selectedObjectId) return null;
    const target = sceneObjects.find((obj) => obj.instanceId === selectedObjectId);
    if (!target) return null;
    if (target.attachedToFrameId) {
      return sceneObjects.find((obj) => obj.instanceId === target.attachedToFrameId) ?? null;
    }
    return ['frame-96', 'frame-counter-96'].includes(target.productId) ? target : null;
  }, [currentStep, sceneObjects, selectedObjectId]);
  const installedSlotItems = useMemo(
    () =>
      selectedFrameObject
        ? sceneObjects.filter(
            (obj) =>
              obj.attachedToFrameId === selectedFrameObject.instanceId &&
              isFrameSlotProductId(obj.productId),
          )
        : [],
    [sceneObjects, selectedFrameObject],
  );
  const selectedFrameOccupiedSlots = useMemo(
    () =>
      selectedFrameObject ? getOccupiedSlots(selectedFrameObject.instanceId, 'front-face') : [],
    [getOccupiedSlots, selectedFrameObject],
  );
  const selectedMakeItNicerEditObject = useMemo(() => {
    if (currentStep !== 2 || !selectedObject) return null;
    const cat = PRODUCT_BY_ID[selectedObject.productId].category;
    if (!['shelf', 'hangable', 'counter', 'frame-counter', 'storage', 'closet'].includes(cat)) return null;
    return selectedObject;
  }, [currentStep, selectedObject]);
  const shelfColorLabel = (color: 'white' | 'black' | 'wood' | undefined) =>
    color === 'black' ? 'Black' : color === 'wood' ? 'Wood' : 'White';
  const countertopColorLabel = (color: 'white' | 'black' | 'wood' | undefined) =>
    color === 'black' ? 'Black' : color === 'white' ? 'White' : 'Wood';
  const toggleFavorite = (productId: string) =>
    setFavoriteProductIds((ids) =>
      ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId],
    );
  const pricing = useMemo(() => {
    const qtyByProduct = sceneObjects.reduce<Record<string, number>>((acc, obj) => {
      acc[obj.productId] = (acc[obj.productId] ?? 0) + 1;
      return acc;
    }, {});
    const structureItems = Object.entries(qtyByProduct)
      .filter(([productId]) => !isFrameSlotProductId(productId))
      .map(([productId, qty]) => {
        const product = PRODUCT_BY_ID[productId];
        return {
          id: productId,
          name: product.name,
          qty,
          unitPrice: product.priceEur,
          subtotal: product.priceEur * qty,
        };
      });
    const accessoryItems = Object.entries(qtyByProduct)
      .filter(([productId]) => isFrameSlotProductId(productId))
      .map(([productId, qty]) => {
        const product = PRODUCT_BY_ID[productId];
        return {
          id: productId,
          name: product.name,
          qty,
          unitPrice: product.priceEur,
          subtotal: product.priceEur * qty,
        };
      });
    const graphicsAreaM2 = Object.keys(frameGraphics).reduce((sum, objectId) => {
      const object = sceneObjects.find((obj) => obj.instanceId === objectId);
      if (!object) return sum;
      const surface = getGraphicSurfaceSizeCm(object.productId);
      return sum + (surface.width * surface.height) / 10000;
    }, 0);
    const graphicsPrice = graphicsAreaM2 * 35;
    const structureTotal = structureItems.reduce((sum, item) => sum + item.subtotal, 0);
    const accessoriesTotal = accessoryItems.reduce((sum, item) => sum + item.subtotal, 0);
    return {
      structureItems,
      accessoryItems,
      structureTotal,
      accessoriesTotal,
      graphicsAreaM2,
      graphicsPrice,
      total: structureTotal + accessoriesTotal + graphicsPrice,
    };
  }, [frameGraphics, sceneObjects]);

  return (
    <aside className="right-panel">
      <div className="step-card">
        <div className="mode-tabs">
          <button className={currentStep === 1 ? 'active' : ''} onClick={() => setStep(1)}>
            1. Shape your booth
          </button>
          <button className={currentStep === 2 ? 'active' : ''} onClick={() => setStep(2)}>
            2. Make it nicer
          </button>
          <button className={currentStep === 3 ? 'active' : ''} onClick={() => setStep(3)}>
            3. Dressing
          </button>
        </div>
        <div className="step-flow-nav">
          <button
            type="button"
            className="step-flow-nav__btn"
            disabled={currentStep <= 1}
            onClick={() => setStep((currentStep - 1) as WizardStep)}
          >
            Back
          </button>
          <button
            type="button"
            className="step-flow-nav__btn"
            disabled={currentStep >= 3}
            onClick={() => setStep((currentStep + 1) as WizardStep)}
          >
            Next
          </button>
        </div>
        <div className="step-title">{STEP_META[currentStep].name}</div>
        <div className="step-description">{STEP_META[currentStep].description}</div>
      </div>

      {noFramesInStep2 && (
        <div className="warning">
          No Frame 96 walls on the scene. Add frames in tab 1 first.
        </div>
      )}

      <div className="right-panel-content">
        {currentStep === 1 ? (
          <>
            <div className="catalog-tabs">
              {(Object.keys(CATALOG_TAB_LABELS) as CatalogTab[]).map((tab) => (
                <button
                  key={tab}
                  className={catalogTab === tab ? 'active' : ''}
                  onClick={() => setCatalogTab(tab)}
                >
                  {CATALOG_TAB_LABELS[tab]}
                </button>
              ))}
            </div>
            <div className="product-list">
              {filteredStructureProducts.length === 0 ? (
                <div className="installed-empty">
                  {catalogTab === 'favorites'
                    ? 'No favorites yet. Click the star on product cards.'
                    : 'No products in this category.'}
                </div>
              ) : (
                filteredStructureProducts.map((product) => (
                  <button
                    key={product.id}
                    className={`product-card ${draggedProductId === product.id ? 'selected' : ''}`}
                    onClick={() => {
                      if (draggedProductId === product.id) {
                        endDrag();
                      } else {
                        startDrag(product.id);
                      }
                    }}
                    title="Click to toggle placement mode"
                  >
                    <div className="product-card-content">
                      <div className="product-card-topbar">
                        <span
                          className={`favorite-btn ${favoriteProductIds.includes(product.id) ? 'active' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleFavorite(product.id);
                          }}
                          title="Toggle favorite"
                          role="button"
                          aria-label="Toggle favorite"
                        >
                          ★
                        </span>
                      </div>
                      <div className="product-price-badge">{product.priceEur.toFixed(0)} EUR</div>
                      <ProductPreview3D productId={product.id} />
                      <div>
                        <div className="product-name">{product.name}</div>
                        <div className="product-meta">
                          {product.dimensions.width} x {product.dimensions.height} x {product.dimensions.depth} cm
                        </div>
                        <div className="product-meta">
                          {product.weightKg.toFixed(1)} kg
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : currentStep === 2 ? (
          <div className="graphics-step-panel booth-step">
            <section className="booth-section">
              <div className="booth-section__title">Must have (security)</div>
              <div className="booth-must-block">
                <div className="booth-must-block__label">Legs (8 mm)</div>
                <p className="booth-must-block__hint">
                  Recommended: {recLegs} (2 per frame/arch; counters excluded). Default foot: pad — change type below.
                </p>
                <div className="booth-counter-row">
                  <button type="button" onClick={() => requestLegCount(effectiveLegs - 1)} aria-label="Fewer legs">
                    −
                  </button>
                  <span className="booth-counter-row__value">{effectiveLegs}</span>
                  <button type="button" onClick={() => requestLegCount(effectiveLegs + 1)} aria-label="More legs">
                    +
                  </button>
                  <button type="button" className="booth-linkish" onClick={resetLegsToRecommended}>
                    Use recommended
                  </button>
                </div>
                {effectiveLegs < recLegs ? (
                  <div className="booth-warning-inline">
                    Below recommended. {boothSecurityRiskAccepted ? 'Risk acknowledged for this configuration.' : ''}
                  </div>
                ) : null}
                <div className="booth-foot-kind">
                  <span className="booth-foot-kind__label">Foot type</span>
                  <div className="option-buttons">
                    {(
                      [
                        ['pad', 'Pad'],
                        ['single', 'Single-dir'],
                        ['double', 'Double-dir'],
                      ] as const
                    ).map(([kind, label]) => (
                      <button
                        key={kind}
                        type="button"
                        className={boothLegFootKind === kind ? 'active' : ''}
                        onClick={() => setBoothLegFootKind(kind as BoothLegFootKind)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="booth-must-block">
                <div className="booth-must-block__label">Frame stabilizers (calculated)</div>
                <p className="booth-must-block__hint">
                  Not shown on scene in this prototype. Recommended: {recStabilizers} (simple count from frames).
                </p>
                <div className="booth-counter-row">
                  <button type="button" onClick={() => adjustStabilizers(-1)} aria-label="Fewer stabilizers">
                    −
                  </button>
                  <span className="booth-counter-row__value">{effectiveStabilizers}</span>
                  <button type="button" onClick={() => adjustStabilizers(1)} aria-label="More stabilizers">
                    +
                  </button>
                </div>
              </div>
            </section>

            <section className="booth-section">
              <div className="booth-section__title">Advised to have</div>
              <p className="booth-section__intro">
                Top-mounted lighting only: green markers sit on the <strong>upper edge</strong> of each frame (not on
                the front graphic surface). Click a product, then pick a slot.
              </p>
              <div className="product-list product-list--compact">
                {advisedProducts.map((product) => (
                  <button
                    key={product.id}
                    className={`product-card ${draggedProductId === product.id ? 'selected' : ''}`}
                    onClick={() => {
                      if (draggedProductId === product.id) {
                        endDrag();
                      } else {
                        startDrag(product.id);
                      }
                    }}
                    title="Toggle placement; all compatible frames show slots"
                  >
                    <div className="product-card-content">
                      <div className="product-price-badge">{product.priceEur.toFixed(0)} EUR</div>
                      <ProductPreview3D productId={product.id} />
                      <div>
                        <div className="product-name">{product.name}</div>
                        <div className="product-meta">
                          {product.dimensions.width}×{product.dimensions.height}×{product.dimensions.depth} cm
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="booth-section">
              <div className="booth-section__title">Nice to have</div>
              <p className="booth-section__intro">
                Shelves, display, brochure holders. Select a frame on the scene to inspect what is installed on it.
              </p>
              {selectedFrameObject ? (
                <>
                  <div className="graphics-step-help">
                    Frame: <strong>{PRODUCT_BY_ID[selectedFrameObject.productId].name}</strong>. Slots used:{' '}
                    {selectedFrameOccupiedSlots.length}/3
                  </div>
                  <div className="installed-list">
                    <div className="installed-title">Installed on this frame</div>
                    {installedSlotItems.length === 0 ? (
                      <div className="installed-empty">Nothing attached yet.</div>
                    ) : (
                      installedSlotItems.map((item) => (
                        <button
                          key={item.instanceId}
                          className={`installed-item ${selectedObjectId === item.instanceId ? 'active' : ''}`}
                          onClick={() => selectObject(item.instanceId)}
                        >
                          <span>{PRODUCT_BY_ID[item.productId].name}</span>
                          {PRODUCT_BY_ID[item.productId].category === 'shelf' ? (
                            <span>{shelfColorLabel(item.options?.shelfColor)}</span>
                          ) : (
                            <span>—</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="graphics-step-help">
                  Click a <strong>Frame 96</strong> or <strong>Frame Counter 96</strong> to see attachments for that
                  wall.
                </div>
              )}
              <div className="product-list product-list--compact">
                {niceProducts.map((product) => (
                  <button
                    key={product.id}
                    className={`product-card ${draggedProductId === product.id ? 'selected' : ''}`}
                    onClick={() => {
                      if (draggedProductId === product.id) {
                        endDrag();
                      } else {
                        startDrag(product.id);
                      }
                    }}
                    title="Toggle placement; green slots appear on all compatible frames"
                  >
                    <div className="product-card-content">
                      <div className="product-price-badge">{product.priceEur.toFixed(0)} EUR</div>
                      <ProductPreview3D productId={product.id} />
                      <div>
                        <div className="product-name">{product.name}</div>
                        <div className="product-meta">
                          {product.dimensions.width}×{product.dimensions.height}×{product.dimensions.depth} cm
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {selectedMakeItNicerEditObject && (
              <section className="booth-section">
                <div className="booth-section__title">Selected item options</div>
                <p className="booth-section__intro">
                  {PRODUCT_BY_ID[selectedMakeItNicerEditObject.productId].name}
                </p>
                {PRODUCT_BY_ID[selectedMakeItNicerEditObject.productId].category === 'shelf' && (
                  <div className="option-row">
                    <div className="installed-title">Shelf color</div>
                    <div className="option-buttons">
                      {(['white', 'black', 'wood'] as const).map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={
                            selectedMakeItNicerEditObject.options?.shelfColor === color ? 'active' : ''
                          }
                          onClick={() => setShelfColor(selectedMakeItNicerEditObject.instanceId, color)}
                        >
                          {shelfColorLabel(color)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {['counter', 'frame-counter'].includes(
                  PRODUCT_BY_ID[selectedMakeItNicerEditObject.productId].category,
                ) && (
                  <div className="option-row">
                    <div className="installed-title">Countertop</div>
                    <div className="option-buttons">
                      <button
                        type="button"
                        className={
                          (selectedMakeItNicerEditObject.options?.countertopUsb ?? true) ? 'active' : ''
                        }
                        onClick={() => {
                          if (!(selectedMakeItNicerEditObject.options?.countertopUsb ?? true)) {
                            toggleCountertopUsb(selectedMakeItNicerEditObject.instanceId);
                          }
                        }}
                      >
                        Top with USB
                      </button>
                      <button
                        type="button"
                        className={!(selectedMakeItNicerEditObject.options?.countertopUsb ?? true) ? 'active' : ''}
                        onClick={() => {
                          if (selectedMakeItNicerEditObject.options?.countertopUsb ?? true) {
                            toggleCountertopUsb(selectedMakeItNicerEditObject.instanceId);
                          }
                        }}
                      >
                        Top without USB
                      </button>
                    </div>
                    <div className="option-buttons">
                      {(['white', 'black', 'wood'] as const).map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={
                            selectedMakeItNicerEditObject.options?.countertopColor === color ? 'active' : ''
                          }
                          onClick={() =>
                            setCountertopColor(selectedMakeItNicerEditObject.instanceId, color)
                          }
                        >
                          {countertopColorLabel(color)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {['storage', 'closet'].includes(PRODUCT_BY_ID[selectedMakeItNicerEditObject.productId].category) && (
                  <div className="option-row">
                    <div className="installed-title">Door</div>
                    <div className="option-buttons">
                      <button
                        type="button"
                        className={(selectedMakeItNicerEditObject.options?.storageHasDoor ?? true) ? 'active' : ''}
                        onClick={() => setStorageDoor(selectedMakeItNicerEditObject.instanceId, true)}
                      >
                        Door: yes
                      </button>
                      <button
                        type="button"
                        className={!(selectedMakeItNicerEditObject.options?.storageHasDoor ?? true) ? 'active' : ''}
                        onClick={() => setStorageDoor(selectedMakeItNicerEditObject.instanceId, false)}
                      >
                        Door: no
                      </button>
                    </div>
                  </div>
                )}
                {selectedMakeItNicerEditObject.attachedToFrameId &&
                  ['shelf', 'hangable'].includes(
                    PRODUCT_BY_ID[selectedMakeItNicerEditObject.productId].category,
                  ) && (
                    <div className="option-remove-row">
                      <button
                        type="button"
                        className="remove-from-frame-btn"
                        onClick={() => deleteObject(selectedMakeItNicerEditObject.instanceId)}
                      >
                        Remove from frame
                      </button>
                    </div>
                  )}
              </section>
            )}
          </div>
        ) : (
          <div className="graphics-step-panel">
            <div className="graphics-step-help">
              Click advertising surfaces in desired order (up to 10), then open editor and apply one image.
            </div>
            <div className="graphics-step-meta">Selected frames: {selectedGraphicFrameIds.length}</div>
            <div className="graphics-step-actions">
              <button onClick={() => setGraphicsModalOpen(true)} disabled={selectedGraphicFrameIds.length === 0}>
                Open Graphics Editor
              </button>
              <button onClick={clearGraphicFrameSelection} disabled={selectedGraphicFrameIds.length === 0}>
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {draggedProductId && (
          <div className="placement-hint">
            {currentStep === 2
              ? 'Placement mode: click a free green slot on any compatible frame. Esc exits.'
              : 'Placement mode is active. Click on scene to place product. Right-click rotates ghost by 90 degrees. Del removes last placed object. Esc exits placement mode.'}
          </div>
        )}
      </div>

      <div className="estimate-toggle-row">
        <button onClick={() => setEstimateHidden((v) => !v)}>
          {estimateHidden ? 'Show Estimate' : 'Hide Estimate'}
        </button>
      </div>

      {!estimateHidden && (
        <div className="price-summary">
          <div className="price-title">Price List (EUR)</div>
          <div className="price-section">Structure</div>
          {pricing.structureItems.length === 0 ? (
            <div className="price-empty">No items</div>
          ) : (
            pricing.structureItems.map((item) => (
              <div className="price-row" key={`structure-${item.id}`}>
                <span>{item.name} x{item.qty}</span>
                <span>{item.subtotal.toFixed(2)}</span>
              </div>
            ))
          )}
          <div className="price-subtotal">
            <span>Structure subtotal</span>
            <span>{pricing.structureTotal.toFixed(2)}</span>
          </div>

          <div className="price-section">Accessories</div>
          {pricing.accessoryItems.length === 0 ? (
            <div className="price-empty">No items</div>
          ) : (
            pricing.accessoryItems.map((item) => (
              <div className="price-row" key={`accessory-${item.id}`}>
                <span>{item.name} x{item.qty}</span>
                <span>{item.subtotal.toFixed(2)}</span>
              </div>
            ))
          )}
          <div className="price-subtotal">
            <span>Accessories subtotal</span>
            <span>{pricing.accessoriesTotal.toFixed(2)}</span>
          </div>

          <div className="price-section">Graphics</div>
          <div className="price-row">
            <span>Printed area (m²)</span>
            <span>{pricing.graphicsAreaM2.toFixed(2)}</span>
          </div>
          <div className="price-row">
            <span>35 EUR / m²</span>
            <span>{pricing.graphicsPrice.toFixed(2)}</span>
          </div>

          <div className="price-total">
            <span>Total</span>
            <span>{pricing.total.toFixed(2)} EUR</span>
          </div>
        </div>
      )}
      <GraphicsEditorModal open={graphicsModalOpen} onClose={() => setGraphicsModalOpen(false)} />
      <BoothSecurityModal
        open={legRiskModalOpen}
        onCancel={() => {
          setLegRiskModalOpen(false);
          setPendingLegCount(null);
        }}
        onConfirm={confirmLegRisk}
      />
    </aside>
  );
};
