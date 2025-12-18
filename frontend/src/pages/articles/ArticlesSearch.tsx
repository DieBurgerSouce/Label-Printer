/**
 * Articles Search Component
 * Search input, items per page selector, and filter button
 */
import { Filter, Search } from 'lucide-react';
import type { ArticlesSearchProps } from './types';

export default function ArticlesSearch({
  searchTerm,
  setSearchTerm,
  itemsPerPage,
  setItemsPerPage,
  setPage,
}: ArticlesSearchProps) {
  return (
    <div className="card">
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Suche nach Artikelnummer, Name oder Beschreibung..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Items per page selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Artikel pro Seite:</label>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setPage(1); // Reset to first page when changing items per page
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
            <option value={2000}>Alle (Max 2000)</option>
          </select>
        </div>

        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filter
        </button>
      </div>
    </div>
  );
}
