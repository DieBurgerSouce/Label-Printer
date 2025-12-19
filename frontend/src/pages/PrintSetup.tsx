import { useMutation } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import FormatSelector, { type PaperFormat } from '../components/PrintConfigurator/FormatSelector';
import GridConfigurator from '../components/PrintConfigurator/GridConfigurator';
import PrintPreview from '../components/PrintConfigurator/PrintPreview';
import PrintTemplateSelector from '../components/PrintConfigurator/PrintTemplateSelector';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { printApi } from '../services/api';
import { usePrintStore } from '../store/printStore';
import { useUiStore } from '../store/uiStore';

export default function PrintSetup() {
  const { layout, setPaperFormat, setGridConfig } = usePrintStore();
  const { showToast } = useUiStore();

  const [previewUrl, setPreviewUrl] = useState<string>();
  const [customWidth, setCustomWidth] = useState(210);
  const [customHeight, setCustomHeight] = useState(297);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // Generate Preview Mutation
  const generatePreviewMutation = useMutation({
    mutationFn: async () => {
      const requestData = {
        labelIds: layout.labelIds,
        format: layout.paperFormat.type === 'Custom' ? 'A4' : layout.paperFormat.type,
        gridConfig: {
          columns: layout.gridLayout.columns,
          rows: layout.gridLayout.rows,
          marginTop: layout.gridLayout.margins.top,
          marginBottom: layout.gridLayout.margins.bottom,
          marginLeft: layout.gridLayout.margins.left,
          marginRight: layout.gridLayout.margins.right,
          spacing: layout.gridLayout.spacing,
        },
        outputFormat: 'png',
        customWidth: layout.paperFormat.type === 'Custom' ? customWidth : undefined,
        customHeight: layout.paperFormat.type === 'Custom' ? customHeight : undefined,
      };

      // console.log('📤 Sending preview request:', requestData);
      // console.log('📊 Current layout state:', layout);

      const response = await printApi.preview(requestData);
      return response.data;
    },
    onSuccess: (data: any) => {
      // Create blob URL for preview
      if (data.previewUrl) {
        // If it's a base64 data URL, use it directly
        if (data.previewUrl.startsWith('data:')) {
          setPreviewUrl(data.previewUrl);
        } else {
          // Otherwise convert to blob URL (for future binary responses)
          const blob = new Blob([data.previewUrl], { type: 'image/png' });
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        }
      }
      showToast({
        type: 'success',
        message: 'Vorschau erfolgreich erstellt',
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.error || 'Fehler bei der Vorschau',
      });
    },
  });

  // Download PDF Mutation
  const downloadPdfMutation = useMutation({
    mutationFn: async () => {
      const blob = await printApi.export({
        labelIds: layout.labelIds,
        format: layout.paperFormat.type === 'Custom' ? 'A4' : layout.paperFormat.type,
        gridConfig: {
          columns: layout.gridLayout.columns,
          rows: layout.gridLayout.rows,
          marginTop: layout.gridLayout.margins.top,
          marginBottom: layout.gridLayout.margins.bottom,
          marginLeft: layout.gridLayout.margins.left,
          marginRight: layout.gridLayout.margins.right,
          spacing: layout.gridLayout.spacing,
        },
        customWidth: layout.paperFormat.type === 'Custom' ? customWidth : undefined,
        customHeight: layout.paperFormat.type === 'Custom' ? customHeight : undefined,
      });
      return blob;
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `labels-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast({
        type: 'success',
        message: 'PDF erfolgreich heruntergeladen',
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.error || 'Failed to download PDF',
      });
    },
  });

  const handleFormatChange = (format: PaperFormat) => {
    setPaperFormat({ type: format });
    setPreviewUrl(undefined); // Clear preview when format changes
  };

  const handleGridConfigChange = (updates: {
    columns?: number;
    rows?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    spacing?: number;
  }) => {
    // Map flat structure to nested margins structure
    const gridUpdate: any = {};

    if (updates.columns !== undefined) gridUpdate.columns = updates.columns;
    if (updates.rows !== undefined) gridUpdate.rows = updates.rows;
    if (updates.spacing !== undefined) gridUpdate.spacing = updates.spacing;

    if (
      updates.marginTop !== undefined ||
      updates.marginBottom !== undefined ||
      updates.marginLeft !== undefined ||
      updates.marginRight !== undefined
    ) {
      gridUpdate.margins = {
        top: updates.marginTop ?? layout.gridLayout.margins.top,
        bottom: updates.marginBottom ?? layout.gridLayout.margins.bottom,
        left: updates.marginLeft ?? layout.gridLayout.margins.left,
        right: updates.marginRight ?? layout.gridLayout.margins.right,
      };
    }

    setGridConfig(gridUpdate);
    setPreviewUrl(undefined); // Clear preview when config changes
  };

  const handleCustomSizeChange = (width: number, height: number) => {
    setCustomWidth(width);
    setCustomHeight(height);
    setPaperFormat({ width, height });
    setPreviewUrl(undefined);
  };

  const handleGeneratePreview = () => {
    if (layout.labelIds.length === 0) {
      showToast({
        type: 'warning',
        message: 'Bitte wählen Sie zuerst Labels aus der Bibliothek',
      });
      return;
    }
    generatePreviewMutation.mutate();
  };

  const handleDownloadPdf = () => {
    // ⚠️ Warning for large batches
    if (layout.labelIds.length > 100) {
      setConfirmDialog({
        isOpen: true,
        title: 'Großes PDF generieren?',
        description: `Sie sind dabei ein PDF mit ${layout.labelIds.length} Labels zu generieren. Dies kann einige Minuten dauern. Geschätzte Zeit: ${Math.ceil(layout.labelIds.length / 20)} Minuten. Fortfahren?`,
        onConfirm: () => {
          showToast({
            type: 'info',
            message: `Generiere großes PDF (${layout.labelIds.length} Labels). Bitte warten...`,
          });
          downloadPdfMutation.mutate();
        },
      });
      return;
    }

    downloadPdfMutation.mutate();
  };

  const handlePrint = async () => {
    // ✅ FIX: Generate and print actual PDF, not preview PNG!
    if (layout.labelIds.length === 0) {
      showToast({
        type: 'warning',
        message: 'Keine Labels zum Drucken ausgewählt',
      });
      return;
    }

    // ⚠️ Warning for large batches
    if (layout.labelIds.length > 100) {
      setConfirmDialog({
        isOpen: true,
        title: 'Drucken starten?',
        description: `Sie drucken ${layout.labelIds.length} Labels. Das Generieren kann einige Minuten dauern. Geschätzte Zeit: ${Math.ceil(layout.labelIds.length / 20)} Minuten. Fortfahren?`,
        onConfirm: () => executePrint(),
      });
      return;
    }

    executePrint();
  };

  const executePrint = async () => {
    try {
      const estimatedTime =
        layout.labelIds.length > 100
          ? ` This may take ${Math.ceil(layout.labelIds.length / 20)} minutes.`
          : ' This may take a moment.';

      showToast({
        type: 'info',
        message: `Generiere PDF für ${layout.labelIds.length} Labels...${estimatedTime}`,
      });

      // Generate full PDF
      const blob = await printApi.export({
        labelIds: layout.labelIds,
        format: layout.paperFormat.type === 'Custom' ? 'A4' : layout.paperFormat.type,
        gridConfig: {
          columns: layout.gridLayout.columns,
          rows: layout.gridLayout.rows,
          marginTop: layout.gridLayout.margins.top,
          marginBottom: layout.gridLayout.margins.bottom,
          marginLeft: layout.gridLayout.margins.left,
          marginRight: layout.gridLayout.margins.right,
          spacing: layout.gridLayout.spacing,
        },
        customWidth: layout.paperFormat.type === 'Custom' ? customWidth : undefined,
        customHeight: layout.paperFormat.type === 'Custom' ? customHeight : undefined,
      });

      // ✅ FIX: Use iframe for reliable printing
      const url = window.URL.createObjectURL(blob);

      // Create hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);

      // Wait for PDF to load in iframe, then print
      iframe.onload = () => {
        setTimeout(() => {
          try {
            // Focus iframe and trigger print
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();

            // Show success message
            showToast({
              type: 'success',
              message: 'Druck-Dialog geöffnet',
            });
          } catch (error) {
            console.error('Print failed:', error);
            // Fallback: Open PDF in new tab for manual printing
            window.open(url, '_blank');
            showToast({
              type: 'info',
              message: 'PDF in neuem Tab geöffnet. Benutzen Sie Strg+P zum Drucken.',
            });
          }

          // Cleanup after printing
          setTimeout(() => {
            document.body.removeChild(iframe);
            window.URL.revokeObjectURL(url);
          }, 1000);
        }, 500); // Small delay to ensure PDF is fully loaded
      };

      // Fallback if iframe doesn't load
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
          // Open in new tab as fallback
          window.open(url, '_blank');
          showToast({
            type: 'info',
            message: 'PDF opened in new tab. Use Ctrl+P to print.',
          });

          // Cleanup URL later
          setTimeout(() => {
            window.URL.revokeObjectURL(url);
          }, 60000);
        }
      }, 10000); // 10 second timeout
    } catch (error: any) {
      showToast({
        type: 'error',
        message: error.response?.data?.error || 'Failed to generate PDF for printing',
      });
    }
  };

  const handleResetConfig = () => {
    // ✅ Match printStore defaults: 2×3 = 6 labels/page
    setGridConfig({
      columns: 2,
      rows: 3,
      spacing: 5,
      margins: {
        top: 10,
        bottom: 10,
        left: 10,
        right: 10,
      },
    });
    setPaperFormat({ type: 'A4', width: 210, height: 297, orientation: 'portrait' });
    setPreviewUrl(undefined);
    showToast({
      type: 'info',
      message: 'Einstellungen zurückgesetzt',
    });
  };

  // Flatten grid config for the GridConfigurator component
  const flatGridConfig = {
    columns: layout.gridLayout.columns,
    rows: layout.gridLayout.rows,
    marginTop: layout.gridLayout.margins.top,
    marginBottom: layout.gridLayout.margins.bottom,
    marginLeft: layout.gridLayout.margins.left,
    marginRight: layout.gridLayout.margins.right,
    spacing: layout.gridLayout.spacing,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Druck-Einstellungen</h1>
          <p className="text-gray-600 mt-1">Druck-Layout konfigurieren und PDF generieren</p>
        </div>

        <div className="flex gap-3">
          <button onClick={handleResetConfig} className="btn-secondary flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Zurücksetzen
          </button>
        </div>
      </div>

      {/* Labels Info */}
      <div className="card bg-primary-50 border-2 border-primary-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-primary-900">Ausgewählte Labels</h3>
            <p className="text-sm text-primary-700 mt-1">
              {layout.labelIds.length === 0 ? (
                <>Keine Labels ausgewählt. Gehen Sie zur Label-Bibliothek.</>
              ) : (
                <>
                  {layout.labelIds.length} Label{layout.labelIds.length !== 1 ? 's' : ''} bereit zum
                  Drucken
                </>
              )}
            </p>
          </div>
          {layout.labelIds.length > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-900">{layout.labelIds.length}</p>
              <p className="text-xs text-primary-700">
                ~
                {Math.ceil(
                  layout.labelIds.length / (layout.gridLayout.columns * layout.gridLayout.rows)
                )}{' '}
                pages
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Print Template Selector */}
      <PrintTemplateSelector />

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Configuration */}
        <div className="space-y-6">
          {/* Format Selector */}
          <div className="card">
            <FormatSelector
              selectedFormat={layout.paperFormat.type}
              onFormatChange={handleFormatChange}
              customWidth={customWidth}
              customHeight={customHeight}
              onCustomSizeChange={handleCustomSizeChange}
            />
          </div>

          {/* Grid Configurator */}
          <div className="card">
            <GridConfigurator config={flatGridConfig} onConfigChange={handleGridConfigChange} />
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="card">
          <PrintPreview
            previewUrl={previewUrl}
            isGenerating={generatePreviewMutation.isPending}
            onGenerate={handleGeneratePreview}
            onDownload={handleDownloadPdf}
            onPrint={handlePrint}
            format={layout.paperFormat.type}
            totalPages={Math.ceil(
              layout.labelIds.length / (layout.gridLayout.columns * layout.gridLayout.rows)
            )}
          />
        </div>
      </div>

      {/* Configuration Summary */}
      <div className="card bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-3">Zusammenfassung</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Format:</span>
            <span className="ml-2 font-medium text-gray-900">
              {layout.paperFormat.type}
              {layout.paperFormat.type === 'Custom' && ` (${customWidth}×${customHeight}mm)`}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Grid:</span>
            <span className="ml-2 font-medium text-gray-900">
              {layout.gridLayout.columns}×{layout.gridLayout.rows}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Labels/Seite:</span>
            <span className="ml-2 font-medium text-gray-900">
              {layout.gridLayout.columns * layout.gridLayout.rows}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Seiten Gesamt:</span>
            <span className="ml-2 font-medium text-gray-900">
              {Math.ceil(
                layout.labelIds.length / (layout.gridLayout.columns * layout.gridLayout.rows)
              ) || 0}
            </span>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
      />
    </div>
  );
}
