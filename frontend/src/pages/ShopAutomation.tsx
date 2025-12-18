/**
 * Shop Automation Page
 * Start automation jobs by entering a shop URL
 */

import axios from 'axios';
import { Package, Play, Settings, ShoppingCart, Zap } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '../store/uiStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AutomationConfig {
  shopUrl: string;
  name: string;
  maxProducts: number;
  followPagination: boolean;
  templateId: string;
  extractFields: string[];
}

export default function ShopAutomation() {
  const navigate = useNavigate();
  const { showToast } = useUiStore();
  const [config, setConfig] = useState<AutomationConfig>({
    shopUrl: '',
    name: '',
    maxProducts: 50,
    followPagination: true,
    templateId: 'standard-label',
    extractFields: ['articleNumber', 'price', 'staffelpreise'],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Normalize URL: Add https:// if missing
      let normalizedUrl = config.shopUrl.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      // console.log('🚀 Starting automation for:', normalizedUrl);

      const response = await axios.post(`${API_URL}/api/automation/start-simple`, {
        shopUrl: normalizedUrl,
        templateId: config.templateId,
        name: config.name || `Shop Crawl: ${new URL(normalizedUrl).hostname}`,
        maxProducts: config.maxProducts,
        followPagination: config.followPagination,
        extractFields: config.extractFields,
      });

      const jobId = response.data.jobId;
      // console.log('✅ Automation job started:', jobId);
      showToast({ type: 'success', message: 'Automation-Job erfolgreich gestartet!' });

      // Redirect to JobMonitor
      navigate(`/jobs/${jobId}`);
    } catch (err: any) {
      console.error('❌ Failed to start automation:', err);
      showToast({ type: 'error', message: err.response?.data?.error || err.message || 'Fehler beim Starten der Automation' });
      setError(err.response?.data?.error || err.message || 'Fehler beim Starten der Automation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-blue-100 rounded-lg">
            <ShoppingCart className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Shop Automation</h1>
            <p className="text-gray-600">Automatisch alle Artikel von einem Online-Shop importieren</p>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
          <Package className="w-6 h-6 text-blue-600 mb-2" />
          <h3 className="font-semibold text-blue-900">Produkte Crawlen</h3>
          <p className="text-sm text-blue-700">Alle Artikel automatisch erfassen</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <Zap className="w-6 h-6 text-green-600 mb-2" />
          <h3 className="font-semibold text-green-900">OCR Verarbeitung</h3>
          <p className="text-sm text-green-700">Artikelnr., Preis & Staffelpreise</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
          <Settings className="w-6 h-6 text-purple-600 mb-2" />
          <h3 className="font-semibold text-purple-900">Labels Generieren</h3>
          <p className="text-sm text-purple-700">QR-Codes & Druckvorlagen</p>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="card space-y-6">
        <h2 className="text-xl font-bold text-gray-900">Automation Konfiguration</h2>

        {/* Shop URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Shop URL *
          </label>
          <input
            type="text"
            required
            placeholder="shop.firmenich.de"
            value={config.shopUrl}
            onChange={(e) => setConfig({ ...config, shopUrl: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-sm text-gray-500 mt-1">
            Die URL des Online-Shops (https:// wird automatisch hinzugefügt)
          </p>
        </div>

        {/* Job Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Job Name (optional)
          </label>
          <input
            type="text"
            placeholder="z.B. Firmenich Produktkatalog 2025"
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Advanced Settings */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Erweiterte Einstellungen
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Max Products */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximale Produkte
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={config.maxProducts}
                onChange={(e) => setConfig({ ...config, maxProducts: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Max. Anzahl zu importierender Produkte (empfohlen: 2000 für shop.firmenich.de)</p>
            </div>

            {/* Template */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Label Template
              </label>
              <select
                value={config.templateId}
                onChange={(e) => setConfig({ ...config, templateId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="standard-label">Standard Label</option>
                <option value="compact-label">Kompakt Label</option>
                <option value="detailed-label">Detailliert Label</option>
                <option value="custom-label">Benutzerdefiniert</option>
              </select>
            </div>
          </div>

          {/* Follow Pagination */}
          <div className="mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.followPagination}
                onChange={(e) => setConfig({ ...config, followPagination: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Seitennummerierung folgen (empfohlen)
              </span>
            </label>
            <p className="text-xs text-gray-500 ml-6">
              Automatisch alle Seiten durchsuchen, um alle Produkte zu erfassen
            </p>
          </div>

          {/* Extract Fields */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zu extrahierende Felder
            </label>
            <div className="space-y-2">
              {[
                { value: 'articleNumber', label: 'Artikelnummer' },
                { value: 'price', label: 'Preis' },
                { value: 'staffelpreise', label: 'Staffelpreise' },
                { value: 'productName', label: 'Produktname' },
                { value: 'productImage', label: 'Produktbild' },
                { value: 'description', label: 'Beschreibung' },
              ].map((field) => (
                <label key={field.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.extractFields.includes(field.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setConfig({
                          ...config,
                          extractFields: [...config.extractFields, field.value],
                        });
                      } else {
                        setConfig({
                          ...config,
                          extractFields: config.extractFields.filter((f) => f !== field.value),
                        });
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{field.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading || !config.shopUrl}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Automation startet...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Automation Starten
              </>
            )}
          </button>
        </div>
      </form>

      {/* What Happens Next */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-3">Was passiert als nächstes?</h3>
        <ol className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="font-semibold">1.</span>
            <span>Der Crawler durchsucht automatisch alle Produktseiten</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">2.</span>
            <span>Screenshots werden von jedem Produkt erstellt</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">3.</span>
            <span>OCR extrahiert Artikelnummer, Preis und Staffelpreise</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">4.</span>
            <span>QR-Codes werden generiert</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">5.</span>
            <span>Druckfertige Labels werden erstellt</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">6.</span>
            <span>Du siehst Live-Updates in Echtzeit! ✨</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
