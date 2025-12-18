/**
 * Articles Pagination Component
 * Pagination controls for the articles table
 */
import type { ArticlesPaginationProps } from './types';

export default function ArticlesPagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: ArticlesPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex justify-between items-center">
      <div className="text-sm text-gray-600">
        Seite {page} von {totalPages} ({totalItems} Artikel)
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Zuruck
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Weiter
        </button>
      </div>
    </div>
  );
}
