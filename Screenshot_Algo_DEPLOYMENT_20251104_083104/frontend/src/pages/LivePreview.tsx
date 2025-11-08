/**
 * Live Preview Page
 * Interactive canvas for label positioning and preview
 */
import { useState } from 'react';
import { Canvas, ZoomControls, Ruler } from '../components/PreviewCanvas';
import { ExportOptions, ProgressTracker } from '../components/ExportSettings';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { KeyboardShortcutsList } from '../components/KeyboardShortcutsList';
import { useUiStore } from '../store/uiStore';
import { usePrintStore } from '../store/printStore';
import { useLabelStore } from '../store/labelStore';
import { batchExportService } from '../services/batchExportService';
import { bulkPrintService } from '../services/bulkPrintService';
import { Download, Eye, Grid3x3, Ruler as RulerIcon, Keyboard, Settings, Printer } from 'lucide-react';
import type { ExportConfig, ExportJob } from '../components/ExportSettings';

export const LivePreview = () => {
  const { showGrid, showRulers, toggleGrid, toggleRulers, showModal, showToast } = useUiStore();
  const { layout } = usePrintStore();
  const { labels, selectedLabels: selectedLabelIds } = useLabelStore();
  useKeyboardShortcuts();

  const [isExporting, setIsExporting] = useState(false);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const selectedLabels = labels.filter(label => selectedLabelIds.includes(label.id));

  const showShortcutsHelp = () => {
    showModal({
      title: 'Keyboard Shortcuts',
      content: <KeyboardShortcutsList />,
    });
  };

  const handleExport = async (config: ExportConfig) => {
    if (selectedLabels.length === 0) {
      showToast({
        type: 'warning',
        message: 'No labels selected for export',
      });
      return;
    }

    setIsExporting(true);
    setShowExportOptions(false);

    try {
      await batchExportService.exportBatch({
        labels: selectedLabels,
        config,
        onProgress: (jobs) => {
          setExportJobs(jobs);
        },
        onComplete: (results) => {
          const successCount = results.filter(r => r.success).length;
          showToast({
            type: 'success',
            message: `Successfully exported ${successCount} of ${results.length} labels`,
          });
          setIsExporting(false);
        },
        onError: (error) => {
          showToast({
            type: 'error',
            message: `Export failed: ${error.message}`,
          });
          setIsExporting(false);
        },
      });
    } catch (error) {
      console.error('Export error:', error);
      setIsExporting(false);
    }
  };

  const handleBulkPrint = async (action: 'download' | 'print') => {
    if (selectedLabels.length === 0) {
      showToast({
        type: 'warning',
        message: 'Keine Labels ausgewählt'
      });
      return;
    }

    setIsPrinting(true);

    try {
      const result = await bulkPrintService.exportAsPDF({
        labelIds: selectedLabels.map(l => l.id),
        layout,
        action
      });

      if (result.success) {
        showToast({
          type: 'success',
          message: `✅ ${result.labelCount} Labels ${action === 'download' ? 'heruntergeladen' : 'zum Drucken vorbereitet'}!`
        });
      } else {
        showToast({
          type: 'error',
          message: `❌ Fehler: ${result.error}`
        });
      }
    } catch (error) {
      console.error(`Bulk print ${action} error:`, error);
      showToast({
        type: 'error',
        message: `❌ Fehler beim ${action === 'download' ? 'Download' : 'Drucken'}`
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const canvasWidth = 800;
  const canvasHeight = 600;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Live Preview</h1>
        <p className="text-gray-600 mt-2">
          Interactive canvas with drag & drop positioning
        </p>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2 text-gray-700 mb-1">
            <Eye className="w-5 h-5" />
            <span className="font-medium">Layout</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {layout?.paperFormat.type || 'Not Set'}
          </p>
          <p className="text-sm text-gray-500">
            {layout?.gridLayout.columns}×{layout?.gridLayout.rows} Grid
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2 text-gray-700 mb-1">
            <Download className="w-5 h-5" />
            <span className="font-medium">Selected Labels</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {selectedLabels?.length || 0}
          </p>
          <p className="text-sm text-gray-500">
            Ready for export
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2 text-gray-700 mb-1">
            <Settings className="w-5 h-5" />
            <span className="font-medium">DPI</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {layout?.settings.dpi || 300}
          </p>
          <p className="text-sm text-gray-500">
            Print quality
          </p>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Canvas */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-lg p-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <ZoomControls />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleGrid}
                  className={`p-2 rounded ${
                    showGrid
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Toggle Grid (Ctrl+G)"
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>

                <button
                  onClick={toggleRulers}
                  className={`p-2 rounded ${
                    showRulers
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Toggle Rulers (Ctrl+R)"
                >
                  <RulerIcon className="w-5 h-5" />
                </button>

                <div className="w-px h-6 bg-gray-300" />

                <button
                  onClick={showShortcutsHelp}
                  className="p-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                  title="Keyboard Shortcuts (?)"
                >
                  <Keyboard className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Canvas with Rulers */}
            <div className="relative">
              {showRulers && (
                <>
                  {/* Top ruler */}
                  <div className="ml-6">
                    <Ruler orientation="horizontal" length={canvasWidth} />
                  </div>

                  {/* Left ruler */}
                  <div className="absolute top-6 left-0">
                    <Ruler orientation="vertical" length={canvasHeight} />
                  </div>
                </>
              )}

              {/* Canvas */}
              <div className={`${showRulers ? 'ml-6 mt-6' : ''} overflow-auto max-h-[calc(100vh-400px)]`}>
                <Canvas
                  width={canvasWidth}
                  height={canvasHeight}
                  showGrid={showGrid}
                  showRulers={showRulers}
                />
              </div>
            </div>

            {/* Canvas Help */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <strong>Tip:</strong> Drag labels to reposition, click to select, use mouse wheel to zoom, use keyboard shortcuts for quick actions
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar - Quick Actions & Info */}
        <div className="space-y-6">
          {/* Export Progress or Options */}
          {isExporting || exportJobs.length > 0 ? (
            <ProgressTracker
              jobs={exportJobs}
              onCancel={() => {
                batchExportService.cancel();
                setIsExporting(false);
              }}
            />
          ) : showExportOptions ? (
            <ExportOptions
              onExport={handleExport}
              isExporting={isExporting}
            />
          ) : (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Options</h3>

              <div className="space-y-3">
                <button
                  onClick={() => setShowExportOptions(true)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isExporting || isPrinting}
                >
                  <Download className="w-4 h-4" />
                  Konfigurieren & Export
                </button>

                {/* NEW: Bulk Print Button */}
                <button
                  onClick={() => handleBulkPrint('print')}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={selectedLabels.length === 0 || isPrinting || isExporting}
                >
                  <Printer className="w-4 h-4" />
                  {isPrinting ? 'Druckt...' : `${selectedLabels.length} Labels drucken (PDF)`}
                </button>

                {/* NEW: Download PDF Button */}
                <button
                  onClick={() => handleBulkPrint('download')}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={selectedLabels.length === 0 || isPrinting || isExporting}
                >
                  <Download className="w-4 h-4" />
                  {isPrinting ? 'Lädt...' : 'PDF herunterladen'}
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                {selectedLabels.length} Label{selectedLabels.length !== 1 ? 's' : ''} ausgewählt
              </p>
            </div>
          )}

          {/* Quick Tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Quick Tips</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Mouse wheel to zoom (up to 500%)</li>
              <li>• Ctrl + Plus/Minus to zoom</li>
              <li>• Ctrl + G to toggle grid</li>
              <li>• Escape to deselect</li>
              <li>• ? for all shortcuts</li>
            </ul>
          </div>

          {/* Settings Preview */}
          {layout && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Settings</h3>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600">Format:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {layout.paperFormat.type}
                  </span>
                </div>

                <div>
                  <span className="text-gray-600">Dimensions:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {layout.paperFormat.width} × {layout.paperFormat.height} mm
                  </span>
                </div>

                <div>
                  <span className="text-gray-600">Grid:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {layout.gridLayout.columns} × {layout.gridLayout.rows}
                  </span>
                </div>

                <div>
                  <span className="text-gray-600">Spacing:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {layout.gridLayout.spacing} mm
                  </span>
                </div>

                <div>
                  <span className="text-gray-600">Cut Marks:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {layout.settings.showCutMarks ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
