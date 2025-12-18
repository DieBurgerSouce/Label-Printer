/**
 * Articles Template Selector Component
 * Modal for selecting a template for label generation
 */
import { FileText, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ArticlesTemplateSelectorProps } from './types';

export default function ArticlesTemplateSelector({
  isOpen,
  onClose,
  templates,
  selectedTemplateId,
  setSelectedTemplateId,
  selectedCount,
  onGenerate,
  isGenerating,
}: ArticlesTemplateSelectorProps) {
  const navigate = useNavigate();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" />
          Template auswahlen
        </h2>

        <p className="text-gray-600 mb-6">
          Wahle ein Template fur die {selectedCount} ausgewahlten Artikel.
        </p>

        {templates.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 text-sm">
              Keine Templates gefunden. Bitte erstelle zuerst ein Label-Template.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
            {templates.map((template) => (
              <label
                key={template.id}
                className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-blue-50 ${
                  selectedTemplateId === template.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  value={template.id}
                  checked={selectedTemplateId === template.id}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{template.name}</div>
                  {template.printLayoutName && (
                    <div className="text-sm text-gray-600 mt-1">
                      {template.printLayoutName}
                    </div>
                  )}
                  {!template.printLayoutId && (
                    <div className="text-sm text-orange-600 mt-1">
                      Kein Drucklayout ausgewahlt
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={() => {
              onClose();
              setSelectedTemplateId('');
            }}
            disabled={isGenerating}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={() => navigate('/labeltemplate')}
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Neues Template erstellen
          </button>
          <button
            onClick={onGenerate}
            disabled={!selectedTemplateId || isGenerating || templates.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generiere {selectedCount} Labels...
              </>
            ) : (
              <>
                <Tag className="w-5 h-5" />
                {selectedCount} Labels generieren
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
