/**
 * Custom hook for keyboard shortcuts on the projections page.
 *
 * Shortcuts:
 * - Escape: Reset all controls to defaults
 * - ?: Show keyboard shortcuts help
 */

import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
  onReset?: () => void;
  onShowHelp?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs (except Escape)
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isInputField && event.key !== 'Escape') {
        return;
      }

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          handlers.onReset?.();
          break;
        case '?':
          // Only trigger if not in an input field
          if (!isInputField) {
            event.preventDefault();
            handlers.onShowHelp?.();
          }
          break;
      }
    },
    [handlers]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
