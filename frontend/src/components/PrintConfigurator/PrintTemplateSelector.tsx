import { useQuery } from '@tanstack/react-query';
import { FileText, Check } from 'lucide-react';
import { printApi } from '../../services/api';
import { usePrintStore } from '../../store/printStore';
import type { PrintLayout } from '../../store/printStore';

interface PrintTemplate {
  id: string;
  name: string;
  description: string;
  paperFormat: PrintLayout['paperFormat'];
  gridLayout: PrintLayout['gridLayout'];
  settings: PrintLayout['settings'];
}

export default function PrintTemplateSelector() {
  const { layout, setLayout } = usePrintStore();

  // Fetch print templates
  const { data: response, isLoading } = useQuery({
    queryKey: ['print-templates'],
    queryFn: printApi.getTemplates,
  });

  const templates: PrintTemplate[] = response?.data || [];

  const handleSelectTemplate = (template: PrintTemplate) => {
    console.log('📋 Applying print template:', template.name);
    setLayout({
      paperFormat: template.paperFormat,
      gridLayout: template.gridLayout,
      settings: template.settings,
    });
  };

  // Check if a template matches the current layout
  const isTemplateActive = (template: PrintTemplate): boolean => {
    return (
      template.paperFormat.type === layout.paperFormat.type &&
      template.gridLayout.columns === layout.gridLayout.columns &&
      template.gridLayout.rows === layout.gridLayout.rows
    );
  };

  if (isLoading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Print Templates</h3>
        <div className="text-center py-8 text-gray-500">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">Print Templates</h3>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Wähle ein vordefiniertes Layout oder konfiguriere manuell unten
      </p>

      {templates.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Keine Print Templates gefunden</p>
          <p className="text-xs mt-2">Verwende die manuelle Konfiguration</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((template) => {
            const isActive = isTemplateActive(template);
            return (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className={`
                  relative p-4 rounded-lg border-2 text-left transition-all
                  ${
                    isActive
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white hover:border-primary-300'
                  }
                `}
              >
                {isActive && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-5 h-5 text-primary-600" />
                  </div>
                )}

                <div className="pr-6">
                  <h4
                    className={`font-semibold mb-1 ${
                      isActive ? 'text-primary-900' : 'text-gray-900'
                    }`}
                  >
                    {template.name}
                  </h4>
                  <p className="text-xs text-gray-600 mb-2">
                    {template.description}
                  </p>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>📄 {template.paperFormat.type}</span>
                    <span>
                      📊 {template.gridLayout.columns}×{template.gridLayout.rows}
                    </span>
                    <span className="font-medium text-primary-600">
                      {template.gridLayout.columns * template.gridLayout.rows} Labels/Seite
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Current Configuration Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-600 mb-2">Aktuelles Layout:</p>
        <div className="flex gap-4 text-sm">
          <span className="font-medium text-gray-900">
            {layout.paperFormat.type} {layout.gridLayout.columns}×{layout.gridLayout.rows}
          </span>
          <span className="text-gray-600">
            ({layout.gridLayout.columns * layout.gridLayout.rows} Labels/Seite)
          </span>
        </div>
      </div>
    </div>
  );
}
