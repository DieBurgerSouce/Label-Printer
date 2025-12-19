import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Product } from '@/services/api';
import { Trash2 } from 'lucide-react';
import type { LabelElement } from '../types';

interface EditorPropertiesPanelProps {
  selectedElementData: LabelElement;
  hasOverride: (id: string) => boolean;
  onResetOverride: (id: string) => void;
  onDeleteElement: (id: string) => void;
  previewArticle: Product | null;
  onUpdateElement: (id: string, updates: Partial<LabelElement>) => void;
}

export function EditorPropertiesPanel({
  selectedElementData,
  hasOverride,
  onResetOverride,
  onDeleteElement,
  previewArticle,
  onUpdateElement,
}: EditorPropertiesPanelProps) {
  return (
    <div className="w-80 bg-white border-l p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Eigenschaften</h3>
          {hasOverride(selectedElementData.id) && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium">
              Angepasst
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {hasOverride(selectedElementData.id) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onResetOverride(selectedElementData.id)}
              className="px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 hover:text-orange-700 h-auto"
              title="Zurück zu Template-Werten"
            >
              Zurücksetzen
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDeleteElement(selectedElementData.id)}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Info Banner for Article-Specific Overrides */}
      {hasOverride(selectedElementData.id) && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-start gap-2">
            <div className="text-orange-600 mt-0.5">ℹ️</div>
            <div className="flex-1 text-xs text-orange-800">
              <p className="font-semibold mb-1">Artikel-spezifische Anpassung</p>
              <p>
                Diese Änderungen gelten nur für{' '}
                <span className="font-mono font-semibold">{previewArticle?.articleNumber}</span>.
                Das Template bleibt für andere Artikel unverändert.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Content */}
        {selectedElementData.type === 'text' && (
          <div>
            <Label className="mb-1 block text-sm">Überschrift</Label>
            <Input
              type="text"
              value={selectedElementData.content}
              onChange={(e) => onUpdateElement(selectedElementData.id, { content: e.target.value })}
              placeholder="Leer = Produktname | Text eingeben = Individuell"
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 Leer lassen = Produktname inkl.
              {previewArticle && ` (Artikel: ${previewArticle.articleNumber})`}
            </p>
          </div>
        )}

        {selectedElementData.type === 'freeText' && (
          <div>
            <Label className="mb-1 block text-sm">Freier Text</Label>
            <Textarea
              value={selectedElementData.content}
              onChange={(e) => onUpdateElement(selectedElementData.id, { content: e.target.value })}
              rows={3}
              placeholder="z.B. Scannen & im Shop ansehen"
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 exakter Text (keine automatischen Daten)
            </p>
          </div>
        )}

        {/* Position */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="block text-sm mb-1">X</Label>
            <Input
              type="number"
              value={selectedElementData.x}
              onChange={(e) =>
                onUpdateElement(selectedElementData.id, { x: parseInt(e.target.value) })
              }
            />
          </div>
          <div>
            <Label className="block text-sm mb-1">Y</Label>
            <Input
              type="number"
              value={selectedElementData.y}
              onChange={(e) =>
                onUpdateElement(selectedElementData.id, { y: parseInt(e.target.value) })
              }
            />
          </div>
        </div>

        {/* Size */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="block text-sm mb-1">Breite</Label>
            <Input
              type="number"
              value={selectedElementData.width}
              onChange={(e) =>
                onUpdateElement(selectedElementData.id, { width: parseInt(e.target.value) })
              }
            />
          </div>
          <div>
            <Label className="block text-sm mb-1">Höhe</Label>
            <Input
              type="number"
              value={selectedElementData.height}
              onChange={(e) =>
                onUpdateElement(selectedElementData.id, { height: parseInt(e.target.value) })
              }
            />
          </div>
        </div>

        {/* ... (Rest of properties panel logic, sticking to standard inputs/selects for speed and reliability, wrapped in Shadcn components where easy) */}
        {/* Font Settings for generic text elements */}
        {selectedElementData.type !== 'image' &&
          selectedElementData.type !== 'qrCode' &&
          selectedElementData.type !== 'articleNumber' && (
            <>
              <div>
                <Label className="block text-sm mb-1">Schriftgröße</Label>
                <Input
                  type="number"
                  value={selectedElementData.fontSize}
                  onChange={(e) =>
                    onUpdateElement(selectedElementData.id, { fontSize: parseInt(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label className="block text-sm mb-1">Schriftstärke</Label>
                <select
                  value={selectedElementData.fontWeight}
                  onChange={(e) =>
                    onUpdateElement(selectedElementData.id, {
                      fontWeight: e.target.value as 'normal' | 'bold',
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Fett</option>
                </select>
              </div>
              <div>
                <Label className="block text-sm mb-1">Farbe</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={selectedElementData.color}
                    onChange={(e) =>
                      onUpdateElement(selectedElementData.id, { color: e.target.value })
                    }
                    className="w-10 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text" // Hex code input
                    value={selectedElementData.color}
                    onChange={(e) =>
                      onUpdateElement(selectedElementData.id, { color: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="block text-sm mb-1">Ausrichtung</Label>
                <select
                  value={selectedElementData.align}
                  onChange={(e) =>
                    onUpdateElement(selectedElementData.id, {
                      align: e.target.value as 'left' | 'center' | 'right',
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                >
                  <option value="left">Links</option>
                  <option value="center">Zentriert</option>
                  <option value="right">Rechts</option>
                </select>
              </div>
            </>
          )}

        {/* Special Article Number properties */}
        {selectedElementData.type === 'articleNumber' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Label ("Artikelnummer:")</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Schriftgröße</Label>
                  <Input
                    type="number"
                    value={selectedElementData.labelFontSize || selectedElementData.fontSize}
                    onChange={(e) =>
                      onUpdateElement(selectedElementData.id, {
                        labelFontSize: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Farbe</Label>
                  <Input
                    type="color"
                    value={selectedElementData.labelColor || selectedElementData.color}
                    onChange={(e) =>
                      onUpdateElement(selectedElementData.id, { labelColor: e.target.value })
                    }
                    className="h-9"
                  />
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Wert</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Schriftgröße</Label>
                  <Input
                    type="number"
                    value={selectedElementData.fontSize}
                    onChange={(e) =>
                      onUpdateElement(selectedElementData.id, {
                        fontSize: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Farbe</Label>
                  <Input
                    type="color"
                    value={selectedElementData.color}
                    onChange={(e) =>
                      onUpdateElement(selectedElementData.id, { color: e.target.value })
                    }
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
