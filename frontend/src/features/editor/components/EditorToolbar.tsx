import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Product } from '@/services/api';
import { Download, Eye, FileText, Maximize2, Printer, Save, ZoomIn, ZoomOut } from 'lucide-react';
import type { LabelTemplate } from '../types';

interface EditorToolbarProps {
  template: LabelTemplate;
  onNameChange: (name: string) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  zoomLevels: number[];
  previewMode: boolean;
  onTogglePreviewMode: () => void;
  onPrintTemplate: () => void;
  onConvertToRenderingTemplate: () => void;
  onExportPdf: () => void;
  onSave: () => void;
  previewArticle: Product | null;
}

export function EditorToolbar({
  template,
  onNameChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  zoomLevels,
  previewMode,
  onTogglePreviewMode,
  onPrintTemplate,
  onConvertToRenderingTemplate,
  onExportPdf,
  onSave,
  previewArticle,
}: EditorToolbarProps) {
  return (
    <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <Input
          type="text"
          value={template.name}
          onChange={(e) => onNameChange(e.target.value)}
          className="text-xl font-bold border-none focus-visible:ring-1 focus-visible:ring-primary w-[300px] px-0 h-auto"
          placeholder="Template Name"
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200">
          <Button
            variant="ghost"
            size="icon"
            onClick={onZoomOut}
            disabled={zoom === zoomLevels[0]}
            className="h-8 w-8 hover:bg-gray-200"
            title="Verkleinern"
          >
            <ZoomOut className="w-4 h-4 text-gray-700" />
          </Button>

          <div className="px-2 py-1 bg-white rounded border border-gray-200 min-w-[60px] text-center">
            <span className="text-sm font-medium text-gray-900">{Math.round(zoom * 100)}%</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onZoomIn}
            disabled={zoom === zoomLevels[zoomLevels.length - 1]}
            className="h-8 w-8 hover:bg-gray-200"
            title="Vergrößern"
          >
            <ZoomIn className="w-4 h-4 text-gray-700" />
          </Button>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={onFitToScreen}
            className="h-8 w-8 hover:bg-gray-200"
            title="An Fenster anpassen (100%)"
          >
            <Maximize2 className="w-4 h-4 text-gray-700" />
          </Button>
        </div>

        <Button
          variant={previewMode ? 'default' : 'secondary'}
          onClick={onTogglePreviewMode}
          className="gap-2"
        >
          <Eye className="w-4 h-4" />
          {previewMode ? 'Bearbeiten' : 'Vorschau'}
        </Button>

        {template.printLayoutId && (
          <Button
            onClick={onPrintTemplate}
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
          >
            <Printer className="w-4 h-4" />
            Druckvorschau
          </Button>
        )}

        {/* Integration Buttons */}
        <Button
          onClick={onConvertToRenderingTemplate}
          className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
          title="Konvertiert dieses Label-Template zu einem Rendering-Template für PDF-Generation"
        >
          <FileText className="w-4 h-4" />
          Template
        </Button>

        {previewArticle && (
          <Button
            onClick={onExportPdf}
            className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
            title="Exportiert das Template als PDF mit den aktuellen Artikel-Daten"
          >
            <Download className="w-4 h-4" />
            PDF
          </Button>
        )}

        <Button onClick={onSave} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Save className="w-4 h-4" />
          Speichern
        </Button>
      </div>
    </div>
  );
}
