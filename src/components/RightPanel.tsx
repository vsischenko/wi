import { useMemo } from 'react';
import { PRODUCT_BY_ID } from '../data/products';
import { getStepProducts, useWizardStore } from '../store/useWizardStore';

const STEP_META = {
  1: {
    name: 'Structure',
    description: 'Place frames, counters, and storage units on the scene.',
  },
  2: {
    name: 'Shelves',
    description: 'Attach shelves to Frame 96 walls.',
  },
} as const;

export const RightPanel = () => {
  const currentStep = useWizardStore((s) => s.currentStep);
  const setStep = useWizardStore((s) => s.setStep);
  const startDrag = useWizardStore((s) => s.startDrag);
  const sceneObjects = useWizardStore((s) => s.sceneObjects);
  const frames = useWizardStore((s) => s.getFrame96Objects());

  const products = useMemo(() => getStepProducts(currentStep), [currentStep]);
  const canGoNext = sceneObjects.some((obj) => PRODUCT_BY_ID[obj.productId].step === 1);
  const noFramesInStep2 = currentStep === 2 && frames.length === 0;

  return (
    <aside className="right-panel">
      <div className="step-card">
        <div className="step-title">Step {currentStep}/2 - {STEP_META[currentStep].name}</div>
        <div className="step-description">{STEP_META[currentStep].description}</div>
      </div>

      {noFramesInStep2 && (
        <div className="warning">
          No Frame 96 walls on the scene. Go back to add some, or click Finish.
        </div>
      )}

      <div className="product-list">
        {products.map((product) => (
          <button
            key={product.id}
            className="product-card"
            onMouseDown={() => startDrag(product.id)}
            title="Press and drag into a viewport"
          >
            <div className="product-name">{product.name}</div>
            <div className="product-meta">
              {product.dimensions.width} x {product.dimensions.height} x {product.dimensions.depth} cm
            </div>
          </button>
        ))}
      </div>

      <div className="panel-nav">
        <button disabled={currentStep === 1} onClick={() => setStep(1)}>
          Back
        </button>
        {currentStep === 1 ? (
          <button disabled={!canGoNext} onClick={() => setStep(2)}>
            Next Step
          </button>
        ) : (
          <button onClick={() => window.alert('Prototype: finish summary can be added next.')}>
            Finish
          </button>
        )}
      </div>
    </aside>
  );
};
