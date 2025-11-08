import { type PriceLabel } from '../../store/labelStore';
import LabelCard from './LabelCard';

interface LabelGridProps {
  labels: PriceLabel[];
  selectedIds: string[];
  onSelectLabel: (id: string) => void;
  onEditLabel: (label: PriceLabel) => void;
  onDeleteLabel: (id: string) => void;
  onViewLabel: (label: PriceLabel) => void;
  onPrintLabel: (label: PriceLabel) => void;
}

export default function LabelGrid({
  labels,
  selectedIds,
  onSelectLabel,
  onEditLabel,
  onDeleteLabel,
  onViewLabel,
  onPrintLabel,
}: LabelGridProps) {
  if (labels.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500 text-lg">No labels found</p>
        <p className="text-gray-400 text-sm mt-2">
          Create your first label to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {labels.map((label) => (
        <LabelCard
          key={label.id}
          label={label}
          selected={selectedIds.includes(label.id)}
          onSelect={() => onSelectLabel(label.id)}
          onEdit={() => onEditLabel(label)}
          onDelete={() => onDeleteLabel(label.id)}
          onView={() => onViewLabel(label)}
          onPrint={() => onPrintLabel(label)}
        />
      ))}
    </div>
  );
}
