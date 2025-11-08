import TemplateCard, { type Template } from './TemplateCard';

interface TemplateGridProps {
  templates: Template[];
  selectedId?: string;
  onSelectTemplate: (id: string) => void;
  onEditTemplate: (template: Template) => void;
  onDeleteTemplate: (id: string) => void;
  onDuplicateTemplate: (template: Template) => void;
  onPreviewTemplate: (template: Template) => void;
  onSetDefault: (id: string) => void;
}

export default function TemplateGrid({
  templates,
  selectedId,
  onSelectTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
  onPreviewTemplate,
  onSetDefault,
}: TemplateGridProps) {
  if (templates.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">No templates found</p>
        <p className="text-sm text-gray-400 mt-2">Create your first template to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          selected={selectedId === template.id}
          onSelect={() => onSelectTemplate(template.id)}
          onEdit={() => onEditTemplate(template)}
          onDelete={() => onDeleteTemplate(template.id)}
          onDuplicate={() => onDuplicateTemplate(template)}
          onPreview={() => onPreviewTemplate(template)}
          onSetDefault={() => onSetDefault(template.id)}
        />
      ))}
    </div>
  );
}
