import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Printer, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '../store/uiStore';

export default function Templates() {
  const { showToast } = useUiStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch label templates from backend API
  const { data: labelTemplatesData, isLoading } = useQuery({
    queryKey: ['labelTemplates'],
    queryFn: async () => {
      const response = await fetch(`${window.location.origin}/api/label-templates`);
      const data = await response.json();
      return data;
    },
    refetchOnWindowFocus: true, // Reload when window gets focus
  });

  const labelTemplates = (labelTemplatesData?.templates || []) as any[];

  const handleDeleteLabelTemplate = async (id: string) => {
    if (confirm('Möchten Sie dieses Label-Template wirklich löschen?')) {
      try {
        const response = await fetch(`${window.location.origin}/api/label-templates/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete template');
        }

        // Invalidate query to reload templates
        queryClient.invalidateQueries({ queryKey: ['labelTemplates'] });

        showToast({
          type: 'success',
          message: 'Template gelöscht',
        });
      } catch (error) {
        console.error('Error deleting template:', error);
        showToast({
          type: 'error',
          message: 'Fehler beim Löschen des Templates',
        });
      }
    }
  };

  const handleEditLabelTemplate = async (id: string) => {
    // Load template data and navigate to editor
    try {
      const response = await fetch(`${window.location.origin}/api/label-templates/${id}`);
      const data = await response.json();

      if (data.success && data.template) {
        // Store template in sessionStorage for editing
        sessionStorage.setItem('editingTemplate', JSON.stringify(data.template));
        navigate('/labeltemplate');
      } else {
        showToast({
          type: 'error',
          message: 'Template konnte nicht geladen werden',
        });
      }
    } catch (error) {
      console.error('Error loading template:', error);
      showToast({
        type: 'error',
        message: 'Fehler beim Laden des Templates',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Label-Templates</h1>
          <p className="text-gray-600 mt-1">
            Erstellen und verwalten Sie Ihre individuellen Label-Templates
          </p>
        </div>

        <button
          onClick={() => navigate('/labeltemplate')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Neues Template
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card border-l-4 border-blue-500">
          <p className="text-sm text-gray-600">Gesamt Templates</p>
          <p className="text-3xl font-bold text-gray-900">{labelTemplates.length}</p>
        </div>
        <div className="card border-l-4 border-green-500">
          <p className="text-sm text-gray-600">Mit Drucklayout</p>
          <p className="text-3xl font-bold text-gray-900">
            {labelTemplates.filter(t => t.printLayoutId).length}
          </p>
        </div>
        <div className="card border-l-4 border-purple-500">
          <p className="text-sm text-gray-600">Mit Auto-Match</p>
          <p className="text-3xl font-bold text-gray-900">
            {labelTemplates.filter(t => t.autoMatchEnabled).length}
          </p>
        </div>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="card text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 mt-4">Lade Templates...</p>
        </div>
      ) : labelTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {labelTemplates.map((template) => (
            <div key={template.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg">{template.name}</h3>
                    {template.printLayoutName && (
                      <p className="text-sm text-gray-600 mt-1">
                        📄 {template.printLayoutName}
                      </p>
                    )}
                    {template.autoMatchEnabled && (
                      <p className="text-xs text-purple-600 mt-1">
                        🤖 Auto-Match aktiviert
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-gray-100 rounded p-3 mb-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Größe:</span>
                      <p className="font-medium">{template.width} × {template.height} px</p>
                    </div>
                    {template.widthMm && template.heightMm && (
                      <div>
                        <span className="text-gray-600">Druck:</span>
                        <p className="font-medium">{template.widthMm.toFixed(1)} × {template.heightMm.toFixed(1)} mm</p>
                      </div>
                    )}
                    <div className="col-span-2">
                      <span className="text-gray-600">Elemente:</span>
                      <p className="font-medium">{template.elements?.length || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditLabelTemplate(template.id)}
                      className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center justify-center gap-2"
                      title="Template bearbeiten"
                    >
                      <Edit className="w-4 h-4" />
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDeleteLabelTemplate(template.id)}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                      title="Template löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {template.printLayoutId ? (
                    <button
                      onClick={() => navigate(`/print?templateId=${template.id}`)}
                      className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4" />
                      Druckvorschau
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        showToast({
                          type: 'info',
                          message: 'Bitte wählen Sie zuerst ein Drucklayout im Editor aus!',
                        });
                        handleEditLabelTemplate(template.id);
                      }}
                      className="w-full px-3 py-2 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4" />
                      Drucklayout fehlt
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card bg-blue-50 border-2 border-blue-200 text-center py-12">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-blue-900 mb-2">
              Noch keine Templates vorhanden
            </h3>
            <p className="text-blue-800 mb-6">
              Erstellen Sie Ihr erstes Label-Template, um loszulegen!
            </p>
            <button
              onClick={() => navigate('/labeltemplate')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Erstes Template erstellen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
