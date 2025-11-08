/**
 * Label Generation Modal
 * Allows user to generate labels from selected articles
 */

import { useState } from 'react';
import { X, FileText, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import type { Product } from '../services/api';
import { labelApi } from '../services/api';

interface LabelGenerationModalProps {
  articles: Product[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function LabelGenerationModal({
  articles,
  isOpen,
  onClose,
  onSuccess
}: LabelGenerationModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('standard-label');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setProgress({ current: 0, total: articles.length });

    try {
      // Generate labels for each article
      let successCount = 0;
      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        setProgress({ current: i + 1, total: articles.length });

        try {
          await labelApi.generateFromArticle(article.id, selectedTemplate);
          successCount++;
        } catch (err) {
          console.error(`Failed to generate label for ${article.articleNumber}:`, err);
        }
      }

      if (successCount === 0) {
        throw new Error('Keine Labels konnten generiert werden');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Label-Generierung fehlgeschlagen');
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[500px] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <h2 className="text-xl font-bold">Labels Generieren</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="hover:bg-white/20 p-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Article Count */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900">
              {articles.length} Artikel ausgewählt
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Es wird für jeden Artikel ein Label generiert
            </p>
          </div>

          {/* Template Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Label-Template
            </label>
            <select
              value={selectedTemplate}
              onChange={e => setSelectedTemplate(e.target.value)}
              disabled={isGenerating}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="standard-label">Standard Label</option>
              <option value="compact-label">Kompakt Label</option>
              <option value="detailed-label">Detailliertes Label</option>
              <option value="qr-code-label">QR-Code Label</option>
            </select>
          </div>

          {/* Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Fortschritt</span>
                <span className="text-gray-600">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Labels erfolgreich generiert!</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50"
          >
            {success ? 'Schließen' : 'Abbrechen'}
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || success}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Generiere...
              </>
            ) : success ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Fertig
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Generieren
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
