/**
 * Articles Bulk Actions Component
 * Fixed bottom action bar for bulk operations
 */
import { Download, Tag, Trash2 } from 'lucide-react';
import type { ArticlesBulkActionsProps } from './types';

export default function ArticlesBulkActions({
  selectedCount,
  onClearSelection,
  onDelete,
  onExport,
  onGenerateLabels,
  isGenerating,
}: ArticlesBulkActionsProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 flex items-center gap-4 z-50">
      <span className="text-sm font-medium text-gray-700">{selectedCount} Artikel ausgewahlt</span>
      <div className="flex gap-2">
        <button
          onClick={onClearSelection}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Auswahl aufheben
        </button>
        <button
          onClick={onDelete}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Loschen
        </button>
        <button
          onClick={onExport}
          className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
        <button
          onClick={onGenerateLabels}
          disabled={isGenerating}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generiere...
            </>
          ) : (
            <>
              <Tag className="w-4 h-4" />
              Labels Generieren
            </>
          )}
        </button>
      </div>
    </div>
  );
}
