import { useMemo, useState } from 'react';
import { PRODUCT_BY_ID } from '../data/products';
import { ProductPreview3D } from './ProductPreview3D';
import { GraphicsEditorModal } from './graphics/GraphicsEditorModal';
import { getStepProducts, useWizardStore } from '../store/useWizardStore';
import { getGraphicSurfaceSizeCm } from '../utils/graphics';

const STEP_META = {
  1: {
    name: 'Quick add product',
    description: 'Quickly add frames, counters, and storage units on the scene.',
  },
  2: {
    name: 'Edit Product',
    description: 'Select a frame and edit it by attaching shelves.',
  },
  3: {
    name: 'Viewer mode',
    description: 'Select advertising surfaces and preview/apply graphics.',
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

export const RightPanel = () => {
  const currentStep = useWizardStore((s) => s.currentStep);
  const setStep = useWizardStore((s) => s.setStep);
  const startDrag = useWizardStore((s) => s.startDrag);
  const endDrag = useWizardStore((s) => s.endDrag);
  const selectObject = useWizardStore((s) => s.selectObject);
  const setShelfColor = useWizardStore((s) => s.setShelfColor);
  const setCountertopColor = useWizardStore((s) => s.setCountertopColor);
  const toggleCountertopUsb = useWizardStore((s) => s.toggleCountertopUsb);
  const draggedProductId = useWizardStore((s) => s.draggedProductId);
  const sceneObjects = useWizardStore((s) => s.sceneObjects);
  const selectedObjectId = useWizardStore((s) => s.selectedObjectId);
  const selectedGraphicFrameIds = useWizardStore((s) => s.selectedGraphicFrameIds);
  const clearGraphicFrameSelection = useWizardStore((s) => s.clearGraphicFrameSelection);
  const getOccupiedSlots = useWizardStore((s) => s.getOccupiedSlots);
  const frameGraphics = useWizardStore((s) => s.frameGraphics);
  const [graphicsModalOpen, setGraphicsModalOpen] = useState(false);
  const [estimateHidden, setEstimateHidden] = useState(true);
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
  const shelfProducts = useMemo(() => getStepProducts(2), []);
  const filteredStructureProducts = useMemo(() => {
    if (catalogTab === 'favorites') {
      return structureProducts.filter((product) => favoriteProductIds.includes(product.id));
    }
    return structureProducts.filter((product) => getCatalogTabForProduct(product.id) === catalogTab);
  }, [catalogTab, favoriteProductIds, structureProducts]);
  const canGoNext = sceneObjects.some((obj) => PRODUCT_BY_ID[obj.productId].step === 1);
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
  const installedShelves = useMemo(
    () =>
      selectedFrameObject
        ? sceneObjects.filter(
            (obj) =>
              obj.attachedToFrameId === selectedFrameObject.instanceId &&
              PRODUCT_BY_ID[obj.productId].category === 'shelf',
          )
        : [],
    [sceneObjects, selectedFrameObject],
  );
  const selectedFrameOccupiedSlots = useMemo(
    () => (selectedFrameObject ? getOccupiedSlots(selectedFrameObject.instanceId) : []),
    [getOccupiedSlots, selectedFrameObject],
  );
  const selectedShelfForFrame = useMemo(() => {
    if (!selectedObject || PRODUCT_BY_ID[selectedObject.productId].category !== 'shelf') return null;
    if (!selectedFrameObject) return null;
    if (selectedObject.attachedToFrameId !== selectedFrameObject.instanceId) return null;
    return selectedObject;
  }, [selectedFrameObject, selectedObject]);
  const selectedCounterObject = useMemo(() => {
    if (!selectedObject) return null;
    const category = PRODUCT_BY_ID[selectedObject.productId].category;
    return ['counter', 'frame-counter'].includes(category) ? selectedObject : null;
  }, [selectedObject]);
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
      .filter(([productId]) => PRODUCT_BY_ID[productId].category !== 'shelf')
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
      .filter(([productId]) => PRODUCT_BY_ID[productId].category === 'shelf')
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
            1. Quick add product
          </button>
          <button
            className={currentStep === 2 ? 'active' : ''}
            onClick={() => setStep(2)}
            disabled={!canGoNext}
            title={!canGoNext ? 'Add at least one structure product first' : undefined}
          >
            2. Edit Product
          </button>
          <button className={currentStep === 3 ? 'active' : ''} onClick={() => setStep(3)}>
            3. Viewer mode
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
          <div className="graphics-step-panel">
            {selectedFrameObject ? (
              <>
                <div className="graphics-step-help">
                  Selected frame: <strong>{PRODUCT_BY_ID[selectedFrameObject.productId].name}</strong>. Choose shelf
                  type, then click free green slot on this frame.
                </div>
                <div className="graphics-step-meta">
                  Slots used: {selectedFrameOccupiedSlots.length}/{3}
                </div>
                <div className="installed-list">
                  <div className="installed-title">Installed</div>
                  {installedShelves.length === 0 ? (
                    <div className="installed-empty">No shelves installed yet.</div>
                  ) : (
                    installedShelves.map((shelf) => (
                      <button
                        key={shelf.instanceId}
                        className={`installed-item ${selectedObjectId === shelf.instanceId ? 'active' : ''}`}
                        onClick={() => selectObject(shelf.instanceId)}
                      >
                        <span>{PRODUCT_BY_ID[shelf.productId].name}</span>
                        <span>{shelfColorLabel(shelf.options?.shelfColor)}</span>
                      </button>
                    ))
                  )}
                </div>
                {selectedShelfForFrame && (
                  <div className="option-row">
                    <div className="installed-title">Shelf Color</div>
                    <div className="option-buttons">
                      {(['white', 'black', 'wood'] as const).map((color) => (
                        <button
                          key={color}
                          className={selectedShelfForFrame.options?.shelfColor === color ? 'active' : ''}
                          onClick={() => setShelfColor(selectedShelfForFrame.instanceId, color)}
                        >
                          {shelfColorLabel(color)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="product-list">
                  {shelfProducts.map((product) => (
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
                      title="Select shelf and place it on selected frame"
                    >
                      <div className="product-card-content">
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
                  ))}
                </div>
              </>
            ) : (
              <div className="graphics-step-help">
                Select a <strong>Frame 96</strong> or <strong>Frame Counter 96</strong> on scene to configure shelves
                for it.
              </div>
            )}
            {selectedCounterObject && (
              <div className="option-row">
                <div className="installed-title">Countertop</div>
                <div className="option-buttons">
                  <button
                    className={(selectedCounterObject.options?.countertopUsb ?? true) ? 'active' : ''}
                    onClick={() => {
                      if (!(selectedCounterObject.options?.countertopUsb ?? true)) {
                        toggleCountertopUsb(selectedCounterObject.instanceId);
                      }
                    }}
                  >
                    Top with USB
                  </button>
                  <button
                    className={!(selectedCounterObject.options?.countertopUsb ?? true) ? 'active' : ''}
                    onClick={() => {
                      if (selectedCounterObject.options?.countertopUsb ?? true) {
                        toggleCountertopUsb(selectedCounterObject.instanceId);
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
                      className={selectedCounterObject.options?.countertopColor === color ? 'active' : ''}
                      onClick={() => setCountertopColor(selectedCounterObject.instanceId, color)}
                    >
                      {countertopColorLabel(color)}
                    </button>
                  ))}
                </div>
              </div>
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
              ? 'Shelf mode is active. Click a free green slot on selected frame to place shelf. Esc exits shelf mode.'
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
    </aside>
  );
};
