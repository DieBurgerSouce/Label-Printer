/**
 * Print Templates Page
 * Manages print layout templates (separate from label templates)
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Upload, Star } from 'lucide-react';
import { printApi } from '../services/api';
import { useUiStore } from '../store/uiStore';
import TemplateGrid from '../components/TemplateManager/TemplateGrid';
import TemplateEditor from '../components/TemplateManager/TemplateEditor';
import { type Template } from '../components/TemplateManager/TemplateCard';

export default function PrintTemplates() {
  const { showToast } = useUiStore();
  const queryClient = useQueryClient();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template>();

  // Fetch templates from backend
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['printTemplates'],
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
        message: editingTemplate ? 'Template aktualisiert' : 'Template erstellt',
      });
      queryClient.invalidateQueries({ queryKey: ['printTemplates'] });
      setIsEditorOpen(false);
      setEditingTemplate(undefined);
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.error || 'Fehler beim Speichern des Templates',
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => printApi.deleteTemplate(id),
    onSuccess: () => {
      showToast({
        type: 'success',
        message: 'Template gelöscht',
      });
      queryClient.invalidateQueries({ queryKey: ['printTemplates'] });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.error || 'Fehler beim Löschen des Templates',
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
    if (confirm('Möchten Sie dieses Template wirklich löschen?')) {
      deleteTemplateMutation.mutate(id);
    }
  };

  const handleDuplicateTemplate = (template: Template) => {
    const duplicate = {
      ...template,
      id: `template-${Date.now()}`,
      name: `${template.name} (Kopie)`,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    saveTemplateMutation.mutate(duplicate);
  };

  const handlePreviewTemplate = (template: Template) => {
    showToast({
      type: 'info',
      message: `Vorschau für ${template.name} kommt bald`,
    });
  };

  const handleSetDefault = (id: string) => {
    const template = templates?.find((t) => t.id === id);
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
    const exportFileDefaultName = `print-templates-${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    showToast({
      type: 'success',
      message: 'Templates exportiert',
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
              message: `${importedTemplates.length} Templates importiert`,
            });
          } catch (error) {
            showToast({
              type: 'error',
              message: 'Fehler beim Importieren der Templates',
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
          <h1 className="text-3xl font-bold text-gray-900">Druck-Templates</h1>
          <p className="text-gray-600 mt-1">
            Verwalten Sie Ihre Drucklayout-Templates für verschiedene Papierformate
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
          {(templates?.length || 0) > 0 && (
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
            Neues Template
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card border-l-4 border-primary-500">
          <p className="text-sm text-gray-600">Gesamt Templates</p>
          <p className="text-3xl font-bold text-gray-900">{templates?.length || 0}</p>
        </div>
        <div className="card border-l-4 border-yellow-500">
          <p className="text-sm text-gray-600">Standard-Template</p>
          <p className="text-3xl font-bold text-gray-900">
            {templates?.filter((t) => t.isDefault)?.length || 0}
          </p>
        </div>
        <div className="card border-l-4 border-green-500">
          <p className="text-sm text-gray-600">Zuletzt erstellt</p>
          <p className="text-sm font-medium text-gray-900 mt-2">
            {(templates?.length || 0) > 0
              ? new Date(
                  templates[templates.length - 1]?.createdAt || Date.now()
                ).toLocaleDateString('de-DE')
              : '-'}
          </p>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Druck-Templates</h2>
        {isLoading ? (
          <div className="card text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 mt-4">Lade Templates...</p>
          </div>
        ) : (templates?.length || 0) > 0 ? (
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
        ) : (
          <div className="card bg-blue-50 border-2 border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <Star className="w-5 h-5" />
              Erste Schritte mit Druck-Templates
            </h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>
                <strong>1. Template erstellen:</strong> Klicken Sie auf "Neues Template" um Ihr
                erstes Drucklayout zu entwerfen.
              </p>
              <p>
                <strong>2. Design anpassen:</strong> Passen Sie Schriften, Farben, Rahmen und
                Abstände an Ihre Marke an.
              </p>
              <p>
                <strong>3. Als Standard setzen:</strong> Markieren Sie Ihr meist-genutztes Template
                als Standard für schnellen Zugriff.
              </p>
              <p>
                <strong>4. Import/Export:</strong> Teilen Sie Templates zwischen Systemen oder
                sichern Sie Ihre Designs.
              </p>
            </div>
          </div>
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
    </div>
  );
}
