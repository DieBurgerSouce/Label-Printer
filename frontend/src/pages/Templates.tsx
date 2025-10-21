import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Upload, Star, Edit, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { printApi } from '../services/api';
import { useUiStore } from '../store/uiStore';
import TemplateGrid from '../components/TemplateManager/TemplateGrid';
import TemplateEditor from '../components/TemplateManager/TemplateEditor';
import { type Template } from '../components/TemplateManager/TemplateCard';

export default function Templates() {
  const { showToast } = useUiStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template>();
  const [labelTemplates, setLabelTemplates] = useState<any[]>([]);

  // Fetch templates from backend
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => printApi.getTemplates(),
  });

  const templates = (templatesData?.data || []) as Template[];

  // Load label templates from localStorage
  useEffect(() => {
    const loadLabelTemplates = () => {
      const saved = localStorage.getItem('labelTemplates');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setLabelTemplates(parsed);
        } catch (error) {
          console.error('Error loading label templates:', error);
        }
      }
    };

    loadLabelTemplates();

    // Reload when window gets focus (in case templates were saved in another tab)
    window.addEventListener('focus', loadLabelTemplates);
    return () => window.removeEventListener('focus', loadLabelTemplates);
  }, []);

  // Create/Update template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: (template: Partial<Template>) => {
      if (template.id) {
        // Update existing template
        return printApi.addTemplate(template);
      } else {
        // Create new template
        return printApi.addTemplate({
          ...template,
          id: `template-${Date.now()}`,
          createdAt: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      showToast({
        type: 'success',
        message: editingTemplate ? 'Template updated' : 'Template created',
      });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsEditorOpen(false);
      setEditingTemplate(undefined);
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.error || 'Failed to save template',
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => printApi.addTemplate({ id, deleted: true }),
    onSuccess: () => {
      showToast({
        type: 'success',
        message: 'Template deleted',
      });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.error || 'Failed to delete template',
      });
    },
  });

  const handleNewTemplate = () => {
    setEditingTemplate(undefined);
    setIsEditorOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setIsEditorOpen(true);
  };

  const handleDeleteTemplate = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      deleteTemplateMutation.mutate(id);
    }
  };

  const handleDuplicateTemplate = (template: Template) => {
    const duplicate = {
      ...template,
      id: `template-${Date.now()}`,
      name: `${template.name} (Copy)`,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    saveTemplateMutation.mutate(duplicate);
  };

  const handlePreviewTemplate = (template: Template) => {
    showToast({
      type: 'info',
      message: `Preview for ${template.name} coming soon`,
    });
  };

  const handleSetDefault = (id: string) => {
    const template = templates.find((t) => t.id === id);
    if (template) {
      saveTemplateMutation.mutate({
        ...template,
        isDefault: true,
      });
    }
  };

  const handleSaveTemplate = (templateData: Partial<Template>) => {
    saveTemplateMutation.mutate(templateData);
  };

  const handleExportTemplates = () => {
    const dataStr = JSON.stringify(templates, null, 2);
    const dataUri =
      'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `templates-${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    showToast({
      type: 'success',
      message: 'Templates exported',
    });
  };

  const handleImportTemplates = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const importedTemplates = JSON.parse(event.target?.result as string);
            // Save each template
            importedTemplates.forEach((template: Template) => {
              saveTemplateMutation.mutate({
                ...template,
                id: `template-${Date.now()}-${Math.random()}`,
              });
            });
            showToast({
              type: 'success',
              message: `Imported ${importedTemplates.length} templates`,
            });
          } catch (error) {
            showToast({
              type: 'error',
              message: 'Failed to import templates',
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleDeleteLabelTemplate = (id: string) => {
    if (confirm('Möchten Sie dieses Label-Template wirklich löschen?')) {
      const updated = labelTemplates.filter(t => t.id !== id);
      localStorage.setItem('labelTemplates', JSON.stringify(updated));
      setLabelTemplates(updated);
      showToast({
        type: 'success',
        message: 'Template gelöscht',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
          <p className="text-gray-600 mt-1">
            Verwalten Sie Ihre Label-Templates und Designs
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleImportTemplates}
            className="btn-secondary flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            Import
          </button>
          {templates.length > 0 && (
            <button
              onClick={handleExportTemplates}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Export
            </button>
          )}
          <button onClick={handleNewTemplate} className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            New Template
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card border-l-4 border-blue-500">
          <p className="text-sm text-gray-600">Label-Templates</p>
          <p className="text-3xl font-bold text-gray-900">{labelTemplates.length}</p>
        </div>
        <div className="card border-l-4 border-primary-500">
          <p className="text-sm text-gray-600">Print-Templates</p>
          <p className="text-3xl font-bold text-gray-900">{templates.length}</p>
        </div>
        <div className="card border-l-4 border-yellow-500">
          <p className="text-sm text-gray-600">Default</p>
          <p className="text-3xl font-bold text-gray-900">
            {templates.filter((t) => t.isDefault).length}
          </p>
        </div>
        <div className="card border-l-4 border-green-500">
          <p className="text-sm text-gray-600">Gesamt</p>
          <p className="text-3xl font-bold text-gray-900">
            {labelTemplates.length + templates.length}
          </p>
        </div>
      </div>

      {/* Label Templates from localStorage */}
      {labelTemplates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Label-Templates</h2>
            <button
              onClick={() => navigate('/labeltemplate')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Neues Label-Template
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {labelTemplates.map((template) => (
              <div key={template.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">{template.name}</h3>
                      {template.printLayoutName && (
                        <p className="text-sm text-gray-600 mt-1">
                          {template.printLayoutName}
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
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          // Load template and navigate to editor
                          navigate('/labeltemplate');
                          // Template will be loaded automatically
                        }}
                        className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center justify-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDeleteLabelTemplate(template.id)}
                        className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Löschen
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        if (!template.printLayoutId) {
                          alert('Bitte wählen Sie zuerst ein Drucklayout im Editor aus!');
                          navigate('/labeltemplate');
                        } else {
                          navigate(`/print?templateId=${template.id}`);
                        }
                      }}
                      className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4" />
                      Druckvorschau
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Print Templates */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Print-Templates</h2>
        {isLoading ? (
          <div className="card text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 mt-4">Loading templates...</p>
          </div>
        ) : (
          <TemplateGrid
            templates={templates}
            selectedId={selectedTemplateId}
            onSelectTemplate={setSelectedTemplateId}
            onEditTemplate={handleEditTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onDuplicateTemplate={handleDuplicateTemplate}
            onPreviewTemplate={handlePreviewTemplate}
            onSetDefault={handleSetDefault}
          />
        )}
      </div>

      {/* Template Editor Modal */}
      <TemplateEditor
        template={editingTemplate}
        isOpen={isEditorOpen}
        onSave={handleSaveTemplate}
        onCancel={() => {
          setIsEditorOpen(false);
          setEditingTemplate(undefined);
        }}
      />

      {/* Quick Start Guide */}
      {templates.length === 0 && !isLoading && (
        <div className="card bg-blue-50 border-2 border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Star className="w-5 h-5" />
            Getting Started with Templates
          </h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>
              <strong>1. Create a Template:</strong> Click "New Template" to design your
              first label template.
            </p>
            <p>
              <strong>2. Customize Styling:</strong> Adjust fonts, colors, borders, and
              padding to match your brand.
            </p>
            <p>
              <strong>3. Set Default:</strong> Mark your most-used template as default for
              quick access.
            </p>
            <p>
              <strong>4. Import/Export:</strong> Share templates between systems or backup
              your designs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
