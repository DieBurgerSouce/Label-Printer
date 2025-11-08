import { useState } from 'react';
import { X, Save, Eye } from 'lucide-react';
import { type Template } from './TemplateCard';

interface TemplateEditorProps {
  template?: Template;
  onSave: (template: Partial<Template>) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export default function TemplateEditor({
  template,
  onSave,
  onCancel,
  isOpen,
}: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [type, setType] = useState<Template['type']>(template?.type || 'standard');
  const [fontSize, setFontSize] = useState(template?.settings.fontSize || 12);
  const [fontFamily, setFontFamily] = useState(
    template?.settings.fontFamily || 'Arial'
  );
  const [backgroundColor, setBackgroundColor] = useState(
    template?.settings.backgroundColor || '#ffffff'
  );
  const [borderColor, setBorderColor] = useState(
    template?.settings.borderColor || '#000000'
  );
  const [borderWidth, setBorderWidth] = useState(
    template?.settings.borderWidth || 1
  );
  const [padding, setPadding] = useState(template?.settings.padding || 10);

  const handleSave = () => {
    const templateData: Partial<Template> = {
      id: template?.id,
      name,
      description,
      type,
      settings: {
        fontSize,
        fontFamily,
        backgroundColor,
        borderColor,
        borderWidth,
        padding,
      },
      fields: template?.fields || [],
    };
    onSave(templateData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {template ? 'Edit Template' : 'New Template'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Basic Information</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input w-full"
                placeholder="e.g., Standard Price Label"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input w-full"
                rows={3}
                placeholder="Describe this template..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Template['type'])}
                className="input w-full"
              >
                <option value="minimal">Minimal</option>
                <option value="standard">Standard</option>
                <option value="extended">Extended</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          {/* Styling */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900">Styling</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Font Size (px)
                </label>
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="input w-full"
                  min="8"
                  max="72"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Font Family
                </label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="input w-full"
                >
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Verdana">Verdana</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Background Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="input flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Border Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="input flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Border Width (px)
                </label>
                <input
                  type="number"
                  value={borderWidth}
                  onChange={(e) => setBorderWidth(Number(e.target.value))}
                  className="input w-full"
                  min="0"
                  max="10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Padding (mm)
                </label>
                <input
                  type="number"
                  value={padding}
                  onChange={(e) => setPadding(Number(e.target.value))}
                  className="input w-full"
                  min="0"
                  max="50"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Preview
            </h3>
            <div
              className="border-2 rounded-lg p-4 flex items-center justify-center h-32"
              style={{
                backgroundColor,
                borderColor,
                borderWidth: `${borderWidth}px`,
                fontFamily,
                fontSize: `${fontSize}px`,
                padding: `${padding}mm`,
              }}
            >
              <div className="text-center">
                <div className="font-bold">Sample Label</div>
                <div className="text-2xl font-bold mt-1">€12.99</div>
                <div className="text-sm mt-1">Art. 12345</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {template ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
