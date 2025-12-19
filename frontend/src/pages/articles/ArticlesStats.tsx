/**
 * Articles Stats Component
 * Displays statistics cards for articles
 */
import type { ArticlesStatsProps } from './types';

export default function ArticlesStats({ stats, selectedCount, onSelectAll }: ArticlesStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="card">
        <p className="text-sm text-gray-600">Gesamt Artikel</p>
        <p className="text-2xl font-bold text-gray-900">{stats?.total || 0}</p>
      </div>
      <div className="card relative">
        <p className="text-sm text-gray-600">Ausgewahlt</p>
        <p className="text-2xl font-bold text-blue-600">{selectedCount}</p>
        <button
          onClick={onSelectAll}
          className="absolute top-2 right-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          title="Alle Artikel aus der Datenbank auswahlen (bis zu 2000)"
        >
          Alle wahlen
        </button>
      </div>
      <div className="card">
        <p className="text-sm text-gray-600">Mit Bildern</p>
        <p className="text-2xl font-bold text-green-600">{stats?.withImages || 0}</p>
      </div>
      <div className="card">
        <p className="text-sm text-gray-600">Verifiziert</p>
        <p className="text-2xl font-bold text-purple-600">{stats?.verified || 0}</p>
      </div>
    </div>
  );
}
