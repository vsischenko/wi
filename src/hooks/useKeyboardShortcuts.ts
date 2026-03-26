import { useEffect } from 'react';
import { useWizardStore } from '../store/useWizardStore';

export const useKeyboardShortcuts = () => {
  const selectedObjectId = useWizardStore((s) => s.selectedObjectId);
  const deleteObject = useWizardStore((s) => s.deleteObject);
  const undo = useWizardStore((s) => s.undo);
  const redo = useWizardStore((s) => s.redo);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedObjectId) {
        deleteObject(selectedObjectId);
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteObject, redo, selectedObjectId, undo]);
};
