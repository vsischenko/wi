import { useMemo } from 'react';
import { PRODUCTS } from '../data/products';
import { useWizardStore } from '../store/useWizardStore';

const STEP_NAMES: Record<1 | 2, string> = {
  1: 'Structure',
  2: 'Shelves',
};

export const StatusBar = () => {
  const currentStep = useWizardStore((s) => s.currentStep);
  const sceneObjects = useWizardStore((s) => s.sceneObjects);

  const shelfCount = useMemo(
    () =>
      sceneObjects.filter((obj) =>
        PRODUCTS.find((p) => p.id === obj.productId && p.category === 'shelf'),
      ).length,
    [sceneObjects],
  );

  return (
    <div className="statusbar">
      <span>Objects: {sceneObjects.length}</span>
      <span>Shelves: {shelfCount}</span>
      <span>Step: {currentStep}/2 - {STEP_NAMES[currentStep]}</span>
    </div>
  );
};
