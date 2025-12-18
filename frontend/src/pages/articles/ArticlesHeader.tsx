/**
 * Articles Header Component
 * Title and action buttons for the Articles page
 */
import { Download, Package, QrCode, RefreshCw, Tag } from 'lucide-react';
import type { ArticlesHeaderProps } from './types';

export default function ArticlesHeader({
  autoRefresh,
  setAutoRefresh,
  showQrCodes,
  setShowQrCodes,
  selectedCount,
  onExport,
  onGenerateLabels,
  isGenerating,
}: ArticlesHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-green-100 rounded-lg">
          <Package className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Artikel</h1>
          <p className="text-gray-600">Gecrawlte Produkte verwalten und Labels generieren</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-all ${
            autoRefresh
              ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
              : 'bg-white border-gray-300 hover:bg-gray-50'
          }`}
          title={autoRefresh ? 'Auto-Refresh ist an (5 Sek.)' : 'Auto-Refresh ist aus'}
        >
          <RefreshCw className={`w-5 h-5 ${autoRefresh ? 'animate-spin' : ''}`} />
          {autoRefresh ? 'Auto-Refresh' : 'Manuell'}
        </button>
        <button
          onClick={() => setShowQrCodes(!showQrCodes)}
          className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${
            showQrCodes
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-gray-300'
          } hover:bg-gray-50`}
          title={showQrCodes ? 'QR-Codes ausblenden' : 'QR-Codes anzeigen'}
        >
          <QrCode className="w-5 h-5" />
          QR-Codes
        </button>
        <button
          onClick={onExport}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          {selectedCount > 0 ? `Export (${selectedCount})` : 'Export Alle'}
        </button>
        <button
          onClick={onGenerateLabels}
          disabled={selectedCount === 0 || isGenerating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generiere...
            </>
          ) : (
            <>
              <Tag className="w-5 h-5" />
              Labels Generieren ({selectedCount})
            </>
          )}
        </button>
      </div>
    </div>
  );
}
