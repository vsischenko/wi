import { useEffect } from 'react';
import { useWizardStore } from '../store/useWizardStore';

export const useKeyboardShortcuts = () => {
  const selectedObjectId = useWizardStore((s) => s.selectedObjectId);
  const deleteObject = useWizardStore((s) => s.deleteObject);
  const undo = useWizardStore((s) => s.undo);
  const redo = useWizardStore((s) => s.redo);
  const draggedProductId = useWizardStore((s) => s.draggedProductId);
  const endDrag = useWizardStore((s) => s.endDrag);
  const undoLastPlacement = useWizardStore((s) => s.undoLastPlacement);
  const selectObject = useWizardStore((s) => s.selectObject);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (draggedProductId) {
          // Placement mode: Delete removes the most recently placed object.
          event.preventDefault();
          undoLastPlacement();
          return;
        }
        if (selectedObjectId) {
          deleteObject(selectedObjectId);
        }
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        redo();
      }
      if (event.key === 'Escape') {
        if (draggedProductId) {
          // Placement mode: Escape always exits placement mode.
          endDrag();
          return;
        }
        if (selectedObjectId) {
          selectObject(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    deleteObject,
    draggedProductId,
    endDrag,
    redo,
    selectObject,
    selectedObjectId,
    undo,
    undoLastPlacement,
  ]);

  // Global right-click handler for ghost rotation.
  // Uses window-level contextmenu so it fires regardless of what's under the cursor in the 3D scene.
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      const state = useWizardStore.getState();
      if (!state.draggedProductId) return;
      event.preventDefault();
      state.rotatePlacement();
      const preview = useWizardStore.getState().placementPreview;
      if (preview) {
        useWizardStore.getState().setPlacementPreview(preview.x, preview.z);
      }
    };
    window.addEventListener('contextmenu', onContextMenu);
    return () => window.removeEventListener('contextmenu', onContextMenu);
  }, []);
};
