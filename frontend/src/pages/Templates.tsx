import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Upload, Star } from 'lucide-react';
import { printApi } from '../services/api';
import { useUiStore } from '../store/uiStore';
import TemplateGrid from '../components/TemplateManager/TemplateGrid';
import TemplateEditor from '../components/TemplateManager/TemplateEditor';
import { type Template } from '../components/TemplateManager/TemplateCard';

export default function Templates() {
  const { showToast } = useUiStore();
  const queryClient = useQueryClient();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template>();

  // Fetch templates
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => printApi.getTemplates(),
  });

  const templates = (templatesData?.data || []) as Template[];

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
          <p className="text-gray-600 mt-1">
            Manage your label templates and designs
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
        <div className="card border-l-4 border-primary-500">
          <p className="text-sm text-gray-600">Total Templates</p>
          <p className="text-3xl font-bold text-gray-900">{templates.length}</p>
        </div>
        <div className="card border-l-4 border-yellow-500">
          <p className="text-sm text-gray-600">Default</p>
          <p className="text-3xl font-bold text-gray-900">
            {templates.filter((t) => t.isDefault).length}
          </p>
        </div>
        <div className="card border-l-4 border-green-500">
          <p className="text-sm text-gray-600">Standard</p>
          <p className="text-3xl font-bold text-gray-900">
            {templates.filter((t) => t.type === 'standard').length}
          </p>
        </div>
        <div className="card border-l-4 border-purple-500">
          <p className="text-sm text-gray-600">Custom</p>
          <p className="text-3xl font-bold text-gray-900">
            {templates.filter((t) => t.type === 'custom').length}
          </p>
        </div>
      </div>

      {/* Template Grid */}
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
