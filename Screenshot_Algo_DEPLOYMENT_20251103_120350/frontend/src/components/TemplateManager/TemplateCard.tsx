import { Eye, Edit, Trash2, Copy, Star } from 'lucide-react';

export interface Template {
  id: string;
  name: string;
  description?: string;
  type: 'minimal' | 'standard' | 'extended' | 'custom';
  preview?: string;
  isDefault?: boolean;
  settings: {
    fontSize: number;
    fontFamily: string;
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    padding: number;
  };
  fields: Array<{
    name: string;
    type: 'text' | 'price' | 'image' | 'barcode' | 'qrcode';
    visible: boolean;
    fontSize?: number;
    position?: { x: number; y: number };
  }>;
  createdAt?: string;
  updatedAt?: string;
}

interface TemplateCardProps {
  template: Template;
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onPreview?: () => void;
  onSetDefault?: () => void;
}

export default function TemplateCard({
  template,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onPreview,
  onSetDefault,
}: TemplateCardProps) {
  const typeColors: Record<string, string> = {
    minimal: 'bg-blue-100 text-blue-700',
    standard: 'bg-green-100 text-green-700',
    extended: 'bg-purple-100 text-purple-700',
    custom: 'bg-orange-100 text-orange-700',
  };

  const typeLabels: Record<string, string> = {
    minimal: 'Minimal',
    standard: 'Standard',
    extended: 'Extended',
    custom: 'Custom',
  };

  return (
    <div
      onClick={onSelect}
      className={`card cursor-pointer transition-all hover:shadow-lg ${
        selected ? 'ring-2 ring-primary-500 border-primary-500' : ''
      }`}
    >
      {/* Preview */}
      <div className="relative h-32 bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
        {template.preview ? (
          <img
            src={template.preview}
            alt={template.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-gray-400 text-sm">No Preview</div>
        )}

        {/* Default Badge */}
        {template.isDefault && (
          <div className="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            <Star className="w-3 h-3 fill-current" />
            Default
          </div>
        )}

        {/* Type Badge */}
        <div
          className={`absolute bottom-2 left-2 px-2 py-1 rounded text-xs font-medium ${
            typeColors[template.type]
          }`}
        >
          {typeLabels[template.type]}
        </div>
      </div>

      {/* Info */}
      <div className="space-y-2">
        <div>
          <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
          {template.description && (
            <p className="text-sm text-gray-600 line-clamp-2 mt-1">
              {template.description}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-3 text-xs text-gray-500">
          <span>{template.fields.filter((f) => f.visible).length} fields</span>
          <span>•</span>
          <span>{template.settings.fontSize}px font</span>
        </div>

        {/* Actions */}
        <div className="flex gap-1 pt-2 border-t border-gray-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview?.();
            }}
            className="flex-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors flex items-center justify-center gap-1"
            title="Preview"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            className="flex-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors flex items-center justify-center gap-1"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate?.();
            }}
            className="flex-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors flex items-center justify-center gap-1"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          {!template.isDefault ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSetDefault?.();
                }}
                className="flex-1 px-3 py-1.5 text-sm text-yellow-600 hover:bg-yellow-50 rounded transition-colors flex items-center justify-center gap-1"
                title="Set as Default"
              >
                <Star className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
                className="flex-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors flex items-center justify-center gap-1"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
