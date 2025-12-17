/**
 * Keyboard Shortcuts Hook
 * Provides global keyboard shortcuts for the application
 */
import { useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '../store/uiStore';
import { usePrintStore } from '../store/printStore';
import { useLabelStore } from '../store/labelStore';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export const useKeyboardShortcuts = () => {
  const navigate = useNavigate();
  const { setZoom, toggleGrid, toggleRulers, showToast } = useUiStore();
  const { resetLayout } = usePrintStore();
  const { clearSelection } = useLabelStore();

  // Memoize shortcuts array to prevent recreation on every render
  const shortcuts: ShortcutConfig[] = useMemo(() => [
    // Navigation
    {
      key: 'd',
      ctrl: true,
      action: () => navigate('/'),
      description: 'Go to Dashboard',
    },
    {
      key: 'l',
      ctrl: true,
      action: () => navigate('/labels'),
      description: 'Go to Label Library',
    },
    {
      key: 'e',
      ctrl: true,
      action: () => navigate('/excel'),
      description: 'Go to Excel Import',
    },
    {
      key: 'p',
      ctrl: true,
      action: () => navigate('/print'),
      description: 'Go to Print Setup',
    },

    // Canvas Controls
    {
      key: '+',
      ctrl: true,
      action: () => {
        const currentZoom = useUiStore.getState().zoom;
        const newZoom = Math.min(currentZoom + 0.25, 2);
        setZoom(newZoom);
      },
      description: 'Zoom In',
    },
    {
      key: '-',
      ctrl: true,
      action: () => {
        const currentZoom = useUiStore.getState().zoom;
        const newZoom = Math.max(currentZoom - 0.25, 0.25);
        setZoom(newZoom);
      },
      description: 'Zoom Out',
    },
    {
      key: '0',
      ctrl: true,
      action: () => setZoom(1),
      description: 'Reset Zoom',
    },

    // View Controls
    {
      key: 'g',
      ctrl: true,
      action: () => toggleGrid(),
      description: 'Toggle Grid',
    },
    {
      key: 'r',
      ctrl: true,
      action: () => toggleRulers(),
      description: 'Toggle Rulers',
    },

    // Selection
    {
      key: 'Escape',
      action: () => clearSelection(),
      description: 'Clear Selection',
    },
    {
      key: 'a',
      ctrl: true,
      action: (e?: KeyboardEvent) => {
        e?.preventDefault();
        const { selectAll } = useLabelStore.getState();
        selectAll();
      },
      description: 'Select All',
    },

    // Print Layout
    {
      key: 'r',
      ctrl: true,
      shift: true,
      action: () => {
        resetLayout();
        showToast({
          type: 'success',
          message: 'Print layout reset to defaults',
        });
      },
      description: 'Reset Print Layout',
    },

    // Help
    {
      key: '?',
      shift: true,
      action: () => {
        showToast({
          type: 'info',
          message: 'Keyboard shortcuts help coming soon!',
          duration: 3000,
        });
      },
      description: 'Show Keyboard Shortcuts Help',
    },
  ], [navigate, setZoom, toggleGrid, toggleRulers, showToast, resetLayout, clearSelection]);

  // Memoize the key handler to prevent unnecessary re-registrations
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Find matching shortcut
    const shortcut = shortcuts.find(s => {
      const keyMatch = s.key.toLowerCase() === e.key.toLowerCase();
      const ctrlMatch = s.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
      const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = s.alt ? e.altKey : !e.altKey;

      return keyMatch && ctrlMatch && shiftMatch && altMatch;
    });

    if (shortcut) {
      e.preventDefault();
      shortcut.action();
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    shortcuts,
  };
};

// Export the shortcut config type for use in the shortcuts list component
export type { ShortcutConfig };
