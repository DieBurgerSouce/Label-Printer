import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { usePrintStore } from '../store/printStore';
import { useUiStore } from '../store/uiStore';
import { printApi } from '../services/api';
import FormatSelector, {
  type PaperFormat,
} from '../components/PrintConfigurator/FormatSelector';
import GridConfigurator from '../components/PrintConfigurator/GridConfigurator';
import PrintPreview from '../components/PrintConfigurator/PrintPreview';
import PrintTemplateSelector from '../components/PrintConfigurator/PrintTemplateSelector';

export default function PrintSetup() {
  const { layout, setPaperFormat, setGridConfig } = usePrintStore();
  const { showToast } = useUiStore();

  const [previewUrl, setPreviewUrl] = useState<string>();
  const [customWidth, setCustomWidth] = useState(210);
  const [customHeight, setCustomHeight] = useState(297);

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

      console.log('📤 Sending preview request:', requestData);
      console.log('📊 Current layout state:', layout);

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
        message: 'Preview generated successfully',
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.error || 'Failed to generate preview',
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
        message: 'PDF downloaded successfully',
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
        message: 'Please select labels from the Label Library first',
      });
      return;
    }
    generatePreviewMutation.mutate();
  };

  const handleDownloadPdf = () => {
    // ⚠️ Warning for large batches
    if (layout.labelIds.length > 100) {
      const confirmed = window.confirm(
        `⚠️ You are about to generate a PDF with ${layout.labelIds.length} labels.\n\n` +
        `This may take several minutes and could use significant memory.\n\n` +
        `Estimated time: ${Math.ceil(layout.labelIds.length / 20)} minutes\n\n` +
        `Continue?`
      );

      if (!confirmed) {
        return;
      }

      showToast({
        type: 'info',
        message: `Generating large PDF (${layout.labelIds.length} labels). Please be patient...`,
      });
    }

    downloadPdfMutation.mutate();
  };

  const handlePrint = async () => {
    // ✅ FIX: Generate and print actual PDF, not preview PNG!
    if (layout.labelIds.length === 0) {
      showToast({
        type: 'warning',
        message: 'No labels selected for printing',
      });
      return;
    }

    // ⚠️ Warning for large batches
    if (layout.labelIds.length > 100) {
      const confirmed = window.confirm(
        `⚠️ You are about to print ${layout.labelIds.length} labels.\n\n` +
        `Generating the PDF may take several minutes.\n\n` +
        `Estimated time: ${Math.ceil(layout.labelIds.length / 20)} minutes\n\n` +
        `Continue?`
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      const estimatedTime = layout.labelIds.length > 100
        ? ` This may take ${Math.ceil(layout.labelIds.length / 20)} minutes.`
        : ' This may take a moment.';

      showToast({
        type: 'info',
        message: `Generating PDF for ${layout.labelIds.length} labels...${estimatedTime}`,
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
              message: 'Print dialog opened. PDF ready for printing.',
            });
          } catch (error) {
            console.error('Print failed:', error);
            // Fallback: Open PDF in new tab for manual printing
            window.open(url, '_blank');
            showToast({
              type: 'info',
              message: 'PDF opened in new tab. Use Ctrl+P to print.',
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
      message: 'Configuration reset to defaults',
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
          <h1 className="text-3xl font-bold text-gray-900">Print Setup</h1>
          <p className="text-gray-600 mt-1">
            Configure your print layout and generate PDFs
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleResetConfig}
            className="btn-secondary flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Labels Info */}
      <div className="card bg-primary-50 border-2 border-primary-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-primary-900">Selected Labels</h3>
            <p className="text-sm text-primary-700 mt-1">
              {layout.labelIds.length === 0 ? (
                <>No labels selected. Go to Label Library to select labels.</>
              ) : (
                <>
                  {layout.labelIds.length} label{layout.labelIds.length !== 1 ? 's' : ''}{' '}
                  ready to print
                </>
              )}
            </p>
          </div>
          {layout.labelIds.length > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-900">
                {layout.labelIds.length}
              </p>
              <p className="text-xs text-primary-700">
                ~{Math.ceil(layout.labelIds.length / (layout.gridLayout.columns * layout.gridLayout.rows))}{' '}
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
            <GridConfigurator
              config={flatGridConfig}
              onConfigChange={handleGridConfigChange}
            />
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
        <h3 className="font-semibold text-gray-900 mb-3">Configuration Summary</h3>
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
            <span className="text-gray-600">Labels/Page:</span>
            <span className="ml-2 font-medium text-gray-900">
              {layout.gridLayout.columns * layout.gridLayout.rows}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Pages:</span>
            <span className="ml-2 font-medium text-gray-900">
              {Math.ceil(
                layout.labelIds.length / (layout.gridLayout.columns * layout.gridLayout.rows)
              ) || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
