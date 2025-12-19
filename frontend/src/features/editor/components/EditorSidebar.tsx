import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { DollarSign, Hash, ImageIcon, QrCode, Search, Type, Upload } from 'lucide-react';
// Using relative imports for local types
import type { Product } from '@/services/api';
import type { LabelElement, LabelTemplate, TemplateSettings } from '../types';
// Using absolute import for global data
import TemplateRuleBuilder from '@/components/TemplateRuleBuilder/TemplateRuleBuilder';
import { PRINT_LAYOUTS, pxToMm } from '@/data/printLayouts';
import type { RefObject } from 'react';

interface EditorSidebarProps {
  onAddElement: (type: LabelElement['type']) => void;
  articleSearch: string;
  onArticleSearchChange: (value: string) => void;
  onSearchArticle: () => void;
  searching: boolean;
  previewArticle: Product | null;
  selectedPrintLayoutId: string;
  onPrintLayoutChange: (layoutId: string) => void;
  template: LabelTemplate;
  onUpdateTemplateSetting: <K extends keyof TemplateSettings>(
    key: K,
    value: TemplateSettings[K]
  ) => void;
  onUpdateTemplate: (updates: Partial<LabelTemplate>) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  onBackgroundImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function EditorSidebar({
  onAddElement,
  articleSearch,
  onArticleSearchChange,
  onSearchArticle,
  searching,
  previewArticle,
  selectedPrintLayoutId,
  onPrintLayoutChange,
  template,
  onUpdateTemplateSetting,
  onUpdateTemplate,
  fileInputRef,
  onBackgroundImageUpload,
}: EditorSidebarProps) {
  return (
    <div className="w-64 bg-white border-r p-4 overflow-y-auto h-full scrollbar-thin">
      <h3 className="font-semibold text-gray-900 mb-3">Elemente hinzufügen</h3>

      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => onAddElement('text')}
        >
          <Type className="w-4 h-4 mr-2" />
          Überschrift
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => onAddElement('freeText')}
        >
          <Type className="w-4 h-4 mr-2" />
          Text
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => onAddElement('articleNumber')}
        >
          <Hash className="w-4 h-4 mr-2" />
          Artikelnummer
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => onAddElement('price')}
        >
          <DollarSign className="w-4 h-4 mr-2" />
          Preis
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => onAddElement('priceTable')}
        >
          <DollarSign className="w-4 h-4 mr-2" />
          Staffelpreise-Tabelle
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => onAddElement('description')}
        >
          <Type className="w-4 h-4 mr-2" />
          Beschreibung
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => onAddElement('image')}
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          Produktbild
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => onAddElement('qrCode')}
        >
          <QrCode className="w-4 h-4 mr-2" />
          QR-Code
        </Button>
      </div>

      <Separator className="my-6" />

      {/* Preview with Real Data */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Live-Vorschau</h3>
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            💡 <strong>Tipp:</strong> Gib eine Artikelnummer ein, um echte Produktdaten anzuzeigen.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Artikelnummer</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={articleSearch}
              onChange={(e) => onArticleSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchArticle()}
              placeholder="z.B. 3806"
              className="flex-1"
              disabled={searching}
            />
            <Button
              onClick={onSearchArticle}
              disabled={searching || !articleSearch.trim()}
              size="icon"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>

          {previewArticle && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
              <p className="font-semibold text-green-900">✓ {previewArticle.productName}</p>
              <p className="text-green-700">Artikel: {previewArticle.articleNumber}</p>
            </div>
          )}
        </div>
      </div>

      <Separator className="my-6" />

      {/* Label Size */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Label-Größe</h3>

        <div className="space-y-3">
          <div>
            <Label className="mb-1 block">Drucklayout</Label>
            {/* Native select because Shadcn Select might be tricker with optgroups in quick draft */}
            <select
              value={selectedPrintLayoutId}
              onChange={(e) => onPrintLayoutChange(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm bg-background"
            >
              <option value="">Benutzerdefiniert</option>
              <optgroup label="Standard-Etiketten">
                {PRINT_LAYOUTS.filter((l) => l.category === 'standard').map((layout) => (
                  <option key={layout.id} value={layout.id}>
                    {layout.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="A4 Raster">
                {PRINT_LAYOUTS.filter((l) => l.category === 'grid-a4').map((layout) => (
                  <option key={layout.id} value={layout.id}>
                    {layout.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="A3 Raster">
                {PRINT_LAYOUTS.filter((l) => l.category === 'grid-a3').map((layout) => (
                  <option key={layout.id} value={layout.id}>
                    {layout.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Manual Size Inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs mb-1 block">
                Breite {template.widthMm ? `(${template.widthMm.toFixed(1)}mm)` : '(px)'}
              </Label>
              <Input
                type="number"
                value={template.width}
                onChange={(e) => {
                  const newWidth = parseInt(e.target.value);
                  onUpdateTemplate({
                    width: newWidth,
                    widthMm: selectedPrintLayoutId ? pxToMm(newWidth) : undefined,
                  });
                }}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">
                Höhe {template.heightMm ? `(${template.heightMm.toFixed(1)}mm)` : '(px)'}
              </Label>
              <Input
                type="number"
                value={template.height}
                onChange={(e) => {
                  const newHeight = parseInt(e.target.value);
                  onUpdateTemplate({
                    height: newHeight,
                    heightMm: selectedPrintLayoutId ? pxToMm(newHeight) : undefined,
                  });
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Template Settings */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Einstellungen</h3>

        <div className="space-y-4">
          <div>
            <Label className="mb-1 block text-sm">Hintergrundfarbe</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={template.settings.backgroundColor}
                onChange={(e) => onUpdateTemplateSetting('backgroundColor', e.target.value)}
                className="w-10 h-10 p-1 rounded cursor-pointer"
              />
              <Input
                type="text"
                value={template.settings.backgroundColor}
                onChange={(e) => onUpdateTemplateSetting('backgroundColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-sm">Hintergrundbild</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onBackgroundImageUpload}
              className="hidden"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Hochladen
              </Button>
              {template.settings.backgroundImage && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => onUpdateTemplateSetting('backgroundImage', undefined)}
                >
                  ×
                </Button>
              )}
            </div>
            {template.settings.backgroundImage && (
              <div className="mt-2">
                <Label className="text-xs mb-1 block">
                  Deckkraft: {Math.round(template.settings.backgroundImageOpacity * 100)}%
                </Label>
                <Input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={template.settings.backgroundImageOpacity}
                  onChange={(e) =>
                    onUpdateTemplateSetting('backgroundImageOpacity', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
            )}
          </div>

          <div>
            <Label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={template.settings.borderEnabled}
                onChange={(e) => onUpdateTemplateSetting('borderEnabled', e.target.checked)}
                className="rounded border-gray-300"
              />
              Rahmen anzeigen
            </Label>

            {template.settings.borderEnabled && (
              <div className="ml-6 space-y-2 border-l-2 pl-3 border-gray-100">
                <div>
                  <Input
                    type="color"
                    value={template.settings.borderColor}
                    onChange={(e) => onUpdateTemplateSetting('borderColor', e.target.value)}
                    className="w-full h-8 p-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Breite</Label>
                    <Input
                      type="number"
                      value={template.settings.borderWidth}
                      onChange={(e) =>
                        onUpdateTemplateSetting('borderWidth', parseInt(e.target.value))
                      }
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Rundung</Label>
                    <Input
                      type="number"
                      value={template.settings.borderRadius}
                      onChange={(e) =>
                        onUpdateTemplateSetting('borderRadius', parseInt(e.target.value))
                      }
                      className="h-8"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Template Rules Section */}
      <div>
        <TemplateRuleBuilder
          rule={template.rules}
          onChange={(newRule) =>
            onUpdateTemplate({
              rules: newRule,
              autoMatchEnabled: newRule.enabled,
            })
          }
        />
      </div>
    </div>
  );
}
