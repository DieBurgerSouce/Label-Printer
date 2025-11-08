import { Edit, Trash2, Eye, Printer, Check } from 'lucide-react';
import { type PriceLabel } from '../../store/labelStore';

interface LabelListProps {
  labels: PriceLabel[];
  selectedIds: string[];
  onSelectLabel: (id: string) => void;
  onEditLabel: (label: PriceLabel) => void;
  onDeleteLabel: (id: string) => void;
  onViewLabel: (label: PriceLabel) => void;
  onPrintLabel: (label: PriceLabel) => void;
}

export default function LabelList({
  labels,
  selectedIds,
  onSelectLabel,
  onEditLabel,
  onDeleteLabel,
  onViewLabel,
  onPrintLabel,
}: LabelListProps) {
  if (labels.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500 text-lg">No labels found</p>
        <p className="text-gray-400 text-sm mt-2">
          Create your first label to get started
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-12 px-4 py-3"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Preview
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Article #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tags
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {labels.map((label) => (
              <tr
                key={label.id}
                className={`hover:bg-gray-50 transition-colors ${
                  selectedIds.includes(label.id) ? 'bg-primary-50' : ''
                }`}
              >
                {/* Checkbox */}
                <td className="px-4 py-4">
                  <button
                    onClick={() => onSelectLabel(label.id)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedIds.includes(label.id)
                        ? 'bg-primary-600 border-primary-600'
                        : 'border-gray-300 hover:border-primary-500'
                    }`}
                  >
                    {selectedIds.includes(label.id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </button>
                </td>

                {/* Preview */}
                <td className="px-4 py-4">
                  {label.imageData ? (
                    <img
                      src={`data:image/png;base64,${label.imageData}`}
                      alt={label.productName}
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                      <span className="text-gray-400 text-xs">No img</span>
                    </div>
                  )}
                </td>

                {/* Article Number */}
                <td className="px-4 py-4">
                  <span className="text-sm font-mono text-gray-900">
                    {label.articleNumber}
                  </span>
                </td>

                {/* Product Name */}
                <td className="px-4 py-4">
                  <div className="max-w-xs">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {label.productName}
                    </p>
                    {label.description && (
                      <p className="text-sm text-gray-500 truncate">
                        {label.description}
                      </p>
                    )}
                  </div>
                </td>

                {/* Price */}
                <td className="px-4 py-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-primary-600">
                      {label.priceInfo.price.toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {label.priceInfo.currency}
                    </span>
                  </div>
                  {label.priceInfo.staffelpreise && label.priceInfo.staffelpreise.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      {label.priceInfo.staffelpreise.length} Staffelpreise
                    </p>
                  )}
                </td>

                {/* Tags */}
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1">
                    {label.tags?.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {label.tags && label.tags.length > 2 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        +{label.tags.length - 2}
                      </span>
                    )}
                  </div>
                </td>

                {/* Created */}
                <td className="px-4 py-4">
                  <span className="text-sm text-gray-500">
                    {new Date(label.createdAt).toLocaleDateString()}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onViewLabel(label)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEditLabel(label)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onPrintLabel(label)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                      title="Print"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteLabel(label.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
