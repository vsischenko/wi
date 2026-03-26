import { useWizardStore } from '../store/useWizardStore';

export const Toolbar = () => {
  const undo = useWizardStore((s) => s.undo);
  const redo = useWizardStore((s) => s.redo);
  const clearScene = useWizardStore((s) => s.clearScene);
  const canUndo = useWizardStore((s) => s.canUndo);
  const canRedo = useWizardStore((s) => s.canRedo);

  return (
    <div className="toolbar">
      <button onClick={undo} disabled={!canUndo}>
        Undo
      </button>
      <button onClick={redo} disabled={!canRedo}>
        Redo
      </button>
      <button onClick={clearScene}>Clear</button>
    </div>
  );
};
