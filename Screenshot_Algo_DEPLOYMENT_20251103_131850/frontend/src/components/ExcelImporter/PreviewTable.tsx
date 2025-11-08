import { Check, X, AlertCircle } from 'lucide-react';

interface ProductPreview {
  articleNumber: string;
  description: string;
  additionalInfo?: string;
  category?: string;
  status: 'success' | 'warning' | 'error';
  message?: string;
}

interface PreviewTableProps {
  products: ProductPreview[];
  totalRows: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
}

export default function PreviewTable({
  products,
  totalRows,
  successCount,
  errorCount,
  warningCount,
}: PreviewTableProps) {
  const getStatusIcon = (status: ProductPreview['status']) => {
    switch (status) {
      case 'success':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'error':
        return <X className="w-4 h-4 text-red-600" />;
    }
  };

  const getStatusBg = (status: ProductPreview['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-50';
      case 'warning':
        return 'bg-yellow-50';
      case 'error':
        return 'bg-red-50';
    }
  };

  return (
    <div className="card space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Total Rows</p>
          <p className="text-2xl font-bold text-gray-900">{totalRows}</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-green-700">Success</p>
          <p className="text-2xl font-bold text-green-900">{successCount}</p>
        </div>
        <div className="p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-700">Warnings</p>
          <p className="text-2xl font-bold text-yellow-900">{warningCount}</p>
        </div>
        <div className="p-4 bg-red-50 rounded-lg">
          <p className="text-sm text-red-700">Errors</p>
          <p className="text-2xl font-bold text-red-900">{errorCount}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-12 px-4 py-3"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Article #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Additional Info
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product, index) => (
              <tr key={index} className={getStatusBg(product.status)}>
                <td className="px-4 py-3 text-center">{getStatusIcon(product.status)}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-sm">{product.articleNumber}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm">{product.description}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600">{product.additionalInfo || '-'}</span>
                </td>
                <td className="px-4 py-3">
                  {product.category && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {product.category}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {product.message && (
                    <span className="text-xs text-gray-600">{product.message}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {products.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No products to preview
        </div>
      )}
    </div>
  );
}
