import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Trash2, RefreshCw } from 'lucide-react';
import { excelApi } from '../services/api';
import { useUiStore } from '../store/uiStore';
import UploadZone from '../components/ExcelImporter/UploadZone';
import PreviewTable from '../components/ExcelImporter/PreviewTable';

export default function ExcelImport() {
  const { showToast } = useUiStore();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<any>(null);

  // Fetch current stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['excelStats'],
    queryFn: () => excelApi.getStats(),
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => excelApi.upload(file, setUploadProgress),
    onSuccess: (data) => {
      setUploadResult(data.data);
      showToast({
        type: 'success',
        message: `Successfully imported ${data.data?.successfulProducts || 0} products`,
      });
      refetchStats();
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.error || 'Failed to upload Excel file',
      });
    },
  });

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: () => excelApi.clearCache(),
    onSuccess: () => {
      showToast({
        type: 'success',
        message: 'Cache cleared successfully',
      });
      setUploadResult(null);
      refetchStats();
    },
    onError: () => {
      showToast({
        type: 'error',
        message: 'Failed to clear cache',
      });
    },
  });

  const handleFileSelect = (file: File) => {
    setUploadProgress(0);
    uploadMutation.mutate(file);
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await excelApi.downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product-import-template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast({
        type: 'success',
        message: 'Template downloaded',
      });
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to download template',
      });
    }
  };

  const handleExport = async () => {
    try {
      const blob = await excelApi.exportExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-export-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast({
        type: 'success',
        message: 'Products exported',
      });
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to export products',
      });
    }
  };

  const handleClearCache = () => {
    if (confirm('Are you sure you want to clear all imported products?')) {
      clearCacheMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Excel Import</h1>
          <p className="text-gray-600 mt-1">Import product descriptions from Excel files</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDownloadTemplate}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download Template
          </button>
          {stats?.data && (stats?.data as any).totalProducts > 0 && (
            <>
              <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export All
              </button>
              <button
                onClick={handleClearCache}
                className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2"
                disabled={clearCacheMutation.isPending}
              >
                <Trash2 className="w-5 h-5" />
                Clear Cache
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats?.data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card border-l-4 border-primary-500">
            <p className="text-sm text-gray-600">Total Products</p>
            <p className="text-3xl font-bold text-gray-900">
              {(stats.data as any).totalProducts || 0}
            </p>
          </div>
          <div className="card border-l-4 border-green-500">
            <p className="text-sm text-gray-600">Cached</p>
            <p className="text-3xl font-bold text-gray-900">{(stats.data as any).cached || 0}</p>
          </div>
          <div className="card border-l-4 border-blue-500">
            <p className="text-sm text-gray-600">Categories</p>
            <p className="text-3xl font-bold text-gray-900">
              {(stats.data as any).categories || 0}
            </p>
          </div>
          <div className="card border-l-4 border-purple-500">
            <p className="text-sm text-gray-600">Last Import</p>
            <p className="text-lg font-semibold text-gray-900">
              {(stats.data as any).lastImport
                ? new Date((stats.data as any).lastImport).toLocaleDateString()
                : '-'}
            </p>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <UploadZone
        onFileSelect={handleFileSelect}
        isUploading={uploadMutation.isPending}
        uploadProgress={uploadProgress}
      />

      {/* Upload Result */}
      {uploadResult && (
        <PreviewTable
          products={[]}
          totalRows={uploadResult.totalRows || 0}
          successCount={uploadResult.successfulProducts || 0}
          errorCount={uploadResult.errors?.length || 0}
          warningCount={uploadResult.warnings?.length || 0}
        />
      )}

      {/* Instructions */}
      <div className="card bg-blue-50 border-2 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-3">📋 Import Instructions</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>
            <strong>1. Download Template:</strong> Click "Download Template" to get the Excel
            template with the correct column structure.
          </p>
          <p>
            <strong>2. Fill in Data:</strong> Add your product information. Required columns:
            Article Number, Description.
          </p>
          <p>
            <strong>3. Upload File:</strong> Drag and drop or click to upload your completed Excel
            file.
          </p>
          <p>
            <strong>4. Review Results:</strong> Check the import summary and fix any errors if
            needed.
          </p>
        </div>
      </div>

      {/* Error/Warning Messages */}
      {uploadResult?.errors && uploadResult.errors.length > 0 && (
        <div className="card bg-red-50 border-2 border-red-200">
          <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Errors ({uploadResult.errors.length})
          </h3>
          <div className="space-y-1">
            {uploadResult.errors.slice(0, 10).map((error: string, index: number) => (
              <p key={index} className="text-sm text-red-800">
                • {error}
              </p>
            ))}
            {uploadResult.errors.length > 10 && (
              <p className="text-sm text-red-700 font-medium mt-2">
                ... and {uploadResult.errors.length - 10} more errors
              </p>
            )}
          </div>
        </div>
      )}

      {uploadResult?.warnings && uploadResult.warnings.length > 0 && (
        <div className="card bg-yellow-50 border-2 border-yellow-200">
          <h3 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Warnings ({uploadResult.warnings.length})
          </h3>
          <div className="space-y-1">
            {uploadResult.warnings.slice(0, 10).map((warning: string, index: number) => (
              <p key={index} className="text-sm text-yellow-800">
                • {warning}
              </p>
            ))}
            {uploadResult.warnings.length > 10 && (
              <p className="text-sm text-yellow-700 font-medium mt-2">
                ... and {uploadResult.warnings.length - 10} more warnings
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
