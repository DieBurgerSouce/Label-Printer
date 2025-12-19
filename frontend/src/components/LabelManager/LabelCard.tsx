import { memo } from 'react';
import { Edit, Trash2, Eye, Printer } from 'lucide-react';
import { type PriceLabel } from '../../store/labelStore';

interface LabelCardProps {
  label: PriceLabel;
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  onPrint?: () => void;
}

function LabelCard({
  label,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
  onView,
  onPrint,
}: LabelCardProps) {
  return (
    <div
      className={`card relative cursor-pointer transition-all hover:shadow-lg ${
        selected ? 'ring-2 ring-primary-500' : ''
      }`}
      onClick={onSelect}
    >
      {/* Selection indicator */}
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}

      {/* Thumbnail */}
      {label.imageData ? (
        <img
          src={`data:image/png;base64,${label.imageData}`}
          alt={label.productName}
          className="w-full h-48 object-cover rounded-lg mb-4"
        />
      ) : (
        <div className="w-full h-48 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
          <span className="text-gray-400 text-sm">No image</span>
        </div>
      )}

      {/* Info */}
      <div className="space-y-2">
        <div>
          <p className="text-xs text-gray-500">Article #{label.articleNumber}</p>
          <h3 className="font-semibold text-gray-900 truncate">{label.productName}</h3>
        </div>

        {label.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{label.description}</p>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-primary-600">
            {label.priceInfo.price.toFixed(2)}
          </span>
          <span className="text-sm text-gray-500">{label.priceInfo.currency}</span>
          {label.priceInfo.unit && (
            <span className="text-xs text-gray-400">/ {label.priceInfo.unit}</span>
          )}
        </div>

        {/* Staffelpreise */}
        {label.priceInfo.staffelpreise && label.priceInfo.staffelpreise.length > 0 && (
          <div className="text-xs text-gray-500">
            {label.priceInfo.staffelpreise.length} Staffelpreise
          </div>
        )}

        {/* Tags */}
        {label.tags && label.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {label.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                {tag}
              </span>
            ))}
            {label.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                +{label.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className="mt-4 pt-4 border-t border-gray-200 flex gap-2"
        role="group"
        aria-label="Label actions"
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onView?.();
          }}
          className="flex-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-1"
          title="View"
          aria-label={`View label for ${label.productName}`}
        >
          <Eye className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          className="flex-1 px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors flex items-center justify-center gap-1"
          title="Edit"
          aria-label={`Edit label for ${label.productName}`}
        >
          <Edit className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrint?.();
          }}
          className="flex-1 px-3 py-2 text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors flex items-center justify-center gap-1"
          title="Print"
          aria-label={`Print label for ${label.productName}`}
        >
          <Printer className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          className="flex-1 px-3 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors flex items-center justify-center gap-1"
          title="Delete"
          aria-label={`Delete label for ${label.productName}`}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Metadata */}
      <div className="mt-2 text-xs text-gray-400 text-center">
        Created {new Date(label.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders in lists
export default memo(LabelCard);
