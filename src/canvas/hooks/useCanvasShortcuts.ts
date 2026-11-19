import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/canvas/store/useWorkspaceStore';

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable
  );
}

export function useCanvasShortcuts(): { isSpacePanning: boolean } {
  const undo = useWorkspaceStore((s) => s.undo);
  const redo = useWorkspaceStore((s) => s.redo);
  const deleteSelectedElements = useWorkspaceStore((s) => s.deleteSelectedElements);
  const selectAllNodes = useWorkspaceStore((s) => s.selectAllNodes);
  const saveNow = useWorkspaceStore((s) => s.saveNow);

  const [isSpacePanning, setIsSpacePanning] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) return;

      const isMod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        setIsSpacePanning(true);
        return;
      }

      if (isMod && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if ((isMod && key === 'z' && event.shiftKey) || (isMod && key === 'y')) {
        event.preventDefault();
        redo();
        return;
      }

      if (isMod && key === 'a') {
        event.preventDefault();
        selectAllNodes();
        return;
      }

      if (isMod && key === 's') {
        event.preventDefault();
        void saveNow();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelectedElements();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setIsSpacePanning(false);
      }
    };

    const handleBlur = () => {
      setIsSpacePanning(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [undo, redo, deleteSelectedElements, selectAllNodes, saveNow]);

  return { isSpacePanning };
}
