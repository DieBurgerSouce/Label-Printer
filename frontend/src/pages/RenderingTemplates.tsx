/**
 * Rendering Templates List Page
 * Shows all server-side rendering templates from /api/templates
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, FileText, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { renderingTemplateApi } from '../services/api';
import { useUiStore } from '../store/uiStore';

export default function RenderingTemplates() {
  const { showToast } = useUiStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch rendering templates from backend API
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['renderingTemplates'],
    queryFn: async () => {
      const response = await renderingTemplateApi.list();
      return response;
    },
    refetchOnWindowFocus: true,
  });

  const templates = ((templatesData?.data as any)?.templates || []) as any[];

  const handleDelete = async (id: string) => {
    if (confirm('Möchten Sie dieses Rendering-Template wirklich löschen?')) {
      try {
        await renderingTemplateApi.delete(id);

        queryClient.invalidateQueries({ queryKey: ['renderingTemplates'] });

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

  const handleEdit = (id: string) => {
    navigate(`/rendering-template-editor?id=${id}`);
  };

  const handleCreate = () => {
    navigate('/rendering-template-editor');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rendering Templates</h1>
          <p className="text-gray-600 mt-1">
            Erstellen und verwalten Sie Server-Side Rendering Templates für PDFs und Bilder
          </p>
        </div>

        <button
          onClick={handleCreate}
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
          <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
        </div>

        <div className="card border-l-4 border-green-500">
          <p className="text-sm text-gray-600">Bereit zum Rendern</p>
          <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
        </div>

        <div className="card border-l-4 border-purple-500">
          <p className="text-sm text-gray-600">Template-Engine</p>
          <p className="text-2xl font-bold text-gray-900">Server-Side</p>
        </div>
      </div>

      {/* Templates List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Templates</h2>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Templates werden geladen...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">Noch keine Templates erstellt</p>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Erstes Template erstellen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template: any) => (
              <div
                key={template.id}
                className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                    <p className="text-sm text-gray-600">
                      {template.description || 'Keine Beschreibung'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Größe:</span>
                    <span className="font-medium">
                      {template.dimensions?.width || 400} × {template.dimensions?.height || 300} px
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">DPI:</span>
                    <span className="font-medium">{template.dimensions?.dpi || 300}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Layers:</span>
                    <span className="font-medium">{template.layers?.length || 0}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Version:</span>
                    <span className="font-medium">{template.version || '1.0.0'}</span>
                  </div>

                  {template.updatedAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Zuletzt bearbeitet:</span>
                      <span className="font-medium">
                        {new Date(template.updatedAt).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(template.id)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm"
                  >
                    <Edit className="w-4 h-4" />
                    Bearbeiten
                  </button>

                  <button
                    onClick={() => handleDelete(template.id)}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Über Rendering Templates</h3>
        <p className="text-sm text-blue-800">
          Rendering Templates werden server-seitig verarbeitet und können in hochwertige PDFs und
          Bilder umgewandelt werden. Sie unterstützen Layer-basiertes Design und sind optimiert für
          Batch-Verarbeitung und Druckvorbereitung.
        </p>
      </div>
    </div>
  );
}
