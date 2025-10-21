/**
 * Keyboard Shortcuts List Component
 * Shows all available shortcuts
 */
import { useKeyboardShortcuts, type ShortcutConfig } from '../hooks/useKeyboardShortcuts';

export const KeyboardShortcutsList = () => {
  const { shortcuts } = useKeyboardShortcuts();

  const formatShortcut = (shortcut: ShortcutConfig) => {
    const parts = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key.toUpperCase());
    return parts.join(' + ');
  };

  const categories = {
    'Navigation': shortcuts.filter(s => s.description.includes('Go to')),
    'Canvas Controls': shortcuts.filter(s => s.description.includes('Zoom') || s.description.includes('Reset Zoom')),
    'View Controls': shortcuts.filter(s => s.description.includes('Toggle')),
    'Selection': shortcuts.filter(s => s.description.includes('Selection') || s.description.includes('Select All')),
    'Print': shortcuts.filter(s => s.description.includes('Print') || s.description.includes('Reset Print')),
    'Help': shortcuts.filter(s => s.description.includes('Help')),
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Keyboard Shortcuts</h2>

      {Object.entries(categories).map(([category, items]) => (
        items.length > 0 && (
          <div key={category} className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-700">{category}</h3>
            <div className="space-y-1">
              {items.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 px-4 bg-gray-50 rounded"
                >
                  <span className="text-sm text-gray-700">{shortcut.description}</span>
                  <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-white border border-gray-300 rounded shadow-sm">
                    {formatShortcut(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
};
