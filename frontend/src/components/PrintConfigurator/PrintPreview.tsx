import { Eye, Download, Printer, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';

interface PrintPreviewProps {
  previewUrl?: string;
  isGenerating?: boolean;
  onGenerate?: () => void;
  onDownload?: () => void;
  onPrint?: () => void;
  format?: string;
  totalPages?: number;
}

export default function PrintPreview({
  previewUrl,
  isGenerating,
  onGenerate,
  onDownload,
  onPrint,
  format = 'A4',
  totalPages = 1,
}: PrintPreviewProps) {
  const [zoom, setZoom] = useState(100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Print Preview
          </h3>
          {previewUrl && (
            <p className="text-sm text-gray-600 mt-1">
              {format} · {totalPages} page{totalPages !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {!previewUrl && (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="btn-primary flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Generate Preview
                </>
              )}
            </button>
          )}

          {previewUrl && (
            <>
              <button
                onClick={onDownload}
                className="btn-secondary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button onClick={onPrint} className="btn-primary flex items-center gap-2">
                <Printer className="w-4 h-4" />
                Print
              </button>
            </>
          )}
        </div>
      </div>

      {/* Preview Area */}
      <div className="border-2 border-gray-300 rounded-lg bg-gray-100 overflow-hidden">
        {!previewUrl ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Eye className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">No preview available</p>
            <p className="text-sm mt-1">
              Click "Generate Preview" to see your print layout
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Zoom Controls */}
            <div className="absolute top-4 right-4 z-10 flex gap-2 bg-white rounded-lg shadow-lg p-2">
              <button
                onClick={() => setZoom((z) => Math.max(25, z - 25))}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-3 py-2 text-sm font-medium">{zoom}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(200, z + 25))}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Preview Image */}
            <div className="overflow-auto max-h-[600px] p-8">
              <div
                className="mx-auto bg-white shadow-2xl"
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.2s',
                }}
              >
                <img
                  src={previewUrl}
                  alt="Print Preview"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview Info */}
      {previewUrl && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-sm text-gray-600">Format</p>
            <p className="text-lg font-semibold text-gray-900">{format}</p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-gray-600">Pages</p>
            <p className="text-lg font-semibold text-gray-900">{totalPages}</p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-gray-600">Zoom</p>
            <p className="text-lg font-semibold text-gray-900">{zoom}%</p>
          </div>
        </div>
      )}
    </div>
  );
}
