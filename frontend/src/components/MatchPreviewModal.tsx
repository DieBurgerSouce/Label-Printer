/**
 * Match Preview Modal
 * Shows which articles will be matched with which templates before label generation
 */

import { CheckCircle, AlertTriangle, Tag, X } from 'lucide-react';
import type { MatchResult } from '../types/template.types';

interface MatchPreviewModalProps {
  matchResult: MatchResult;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function MatchPreviewModal({
  matchResult,
  isLoading,
  onConfirm,
  onCancel,
}: MatchPreviewModalProps) {
  const hasMatches = matchResult.matched.length > 0;
  const hasSkipped = matchResult.skipped.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-blue-600" />
            Label-Generierung Vorschau
          </h2>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex gap-6">
            {hasMatches && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-gray-700">
                  <strong className="text-green-600">{matchResult.matched.length}</strong> Artikel
                  matched
                </span>
              </div>
            )}
            {hasSkipped && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <span className="text-gray-700">
                  <strong className="text-orange-600">{matchResult.skipped.length}</strong> Artikel
                  übersprungen
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Matched Articles */}
          {hasMatches && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Werden generiert ({matchResult.matched.length})
              </h3>
              <div className="space-y-2">
                {matchResult.matched.map((match) => (
                  <div
                    key={match.articleId}
                    className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        {match.articleNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>→</span>
                      <span className="font-medium text-green-700">{match.templateName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skipped Articles */}
          {hasSkipped && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Werden übersprungen ({matchResult.skipped.length})
              </h3>
              <div className="space-y-2">
                {matchResult.skipped.map((skip) => (
                  <div
                    key={skip.articleId}
                    className="p-3 bg-orange-50 border border-orange-200 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        {skip.articleNumber}
                      </span>
                      <span className="text-sm text-orange-700">{skip.reason}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Info Box */}
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 <strong>Tipp:</strong> Erstelle Templates mit Regeln für diese Artikel oder
                  wähle sie manuell im Template-Selector aus.
                </p>
              </div>
            </div>
          )}

          {/* No Matches */}
          {!hasMatches && hasSkipped && (
            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
              <AlertTriangle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
              <p className="text-lg font-semibold text-yellow-900 mb-2">
                Keine Artikel konnten gematched werden
              </p>
              <p className="text-sm text-yellow-800">
                Bitte erstelle Templates mit passenden Regeln oder verwende die manuelle Auswahl.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {hasMatches ? (
              <span>
                Es werden <strong>{matchResult.matched.length}</strong> Labels generiert
                {hasSkipped && ` (${matchResult.skipped.length} übersprungen)`}
              </span>
            ) : (
              <span className="text-orange-600">Keine Labels können generiert werden</span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={onConfirm}
              disabled={!hasMatches || isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generiere...
                </>
              ) : (
                <>
                  <Tag className="w-5 h-5" />
                  {matchResult.matched.length} Labels generieren
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
