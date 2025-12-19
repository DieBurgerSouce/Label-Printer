/**
 * Articles Table Component
 * Main table displaying articles with selection, QR codes, and actions
 */
import { CheckSquare, Edit, ExternalLink, Package, Square, Tag, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl, type Product } from '../../services/api';
import type { ArticlesTableProps } from './types';

export default function ArticlesTable({
  articles,
  isLoading,
  error,
  selectedArticles,
  showQrCodes,
  onToggleSelectAll,
  onToggleSelect,
  onEdit,
  onDelete,
  onGenerateLabel,
  isGenerating,
}: ArticlesTableProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="card overflow-hidden">
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card overflow-hidden">
        <div className="text-center py-12 text-red-600">
          <p>Fehler beim Laden der Artikel</p>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="card overflow-hidden">
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">Keine Artikel gefunden</p>
          <p className="text-gray-400 text-sm mb-4">
            Starte eine Shop Automation, um Artikel zu crawlen
          </p>
          <button
            onClick={() => navigate('/automation')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Shop Automation Starten
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-300 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left">
                <button onClick={onToggleSelectAll} className="hover:bg-gray-100 p-1 rounded">
                  {selectedArticles.size === articles.length && articles.length > 0 ? (
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Artikelnummer
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Bild</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Produktname
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Beschreibung
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Preis</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Staffelpreise
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Shop URL</th>
              {showQrCodes && (
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">QR-Code</th>
              )}
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {articles.map((article: Product) => (
              <ArticleRow
                key={article.id}
                article={article}
                isSelected={selectedArticles.has(article.id)}
                showQrCodes={showQrCodes}
                onToggleSelect={onToggleSelect}
                onEdit={onEdit}
                onDelete={onDelete}
                onGenerateLabel={onGenerateLabel}
                isGenerating={isGenerating}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ArticleRowProps {
  article: Product;
  isSelected: boolean;
  showQrCodes: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (article: Product) => void;
  onDelete: (id: string) => void;
  onGenerateLabel: (articleId: string) => void;
  isGenerating: boolean;
}

function ArticleRow({
  article,
  isSelected,
  showQrCodes,
  onToggleSelect,
  onEdit,
  onDelete,
  onGenerateLabel,
  isGenerating,
}: ArticleRowProps) {
  return (
    <tr className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
      <td className="px-4 py-3">
        <button
          onClick={() => onToggleSelect(article.id)}
          className="hover:bg-gray-100 p-1 rounded"
        >
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-blue-600" />
          ) : (
            <Square className="w-5 h-5 text-gray-400" />
          )}
        </button>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-sm font-semibold text-gray-900">
          {article.articleNumber}
        </span>
      </td>
      <td className="px-4 py-3">
        <img
          src={getImageUrl(article.imageUrl || article.thumbnailUrl)}
          alt={article.productName}
          className="w-16 h-16 object-cover rounded border border-gray-200"
          onError={(e) => {
            e.currentTarget.src = 'https://via.placeholder.com/64?text=No+Image';
          }}
        />
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900 max-w-xs truncate">{article.productName}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-gray-600 max-w-xs truncate">{article.description || '-'}</p>
      </td>
      <td className="px-4 py-3">
        <PriceCell article={article} />
      </td>
      <td className="px-4 py-3">
        <TieredPricesCell article={article} />
      </td>
      <td className="px-4 py-3">
        {article.sourceUrl ? (
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="max-w-xs truncate">{article.sourceUrl}</span>
          </a>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      {showQrCodes && (
        <td className="px-4 py-3">
          {article.sourceUrl ? (
            <div className="flex items-center justify-center">
              <div className="bg-white p-2 border border-gray-200 rounded-lg">
                <QRCodeSVG
                  value={article.sourceUrl}
                  size={64}
                  level="M"
                  includeMargin={false}
                  fgColor="#1e293b"
                />
              </div>
            </div>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={() => onGenerateLabel(article.id)}
            className="p-2 hover:bg-blue-50 rounded"
            title="Label generieren"
            disabled={isGenerating}
          >
            <Tag className="w-4 h-4 text-blue-600" />
          </button>
          <button
            onClick={() => onEdit(article)}
            className="p-2 hover:bg-gray-100 rounded"
            title="Bearbeiten"
          >
            <Edit className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => onDelete(article.id)}
            className="p-2 hover:bg-red-50 rounded"
            title="Loschen"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function PriceCell({ article }: { article: Product }) {
  if (typeof article.price === 'number' && article.price > 0) {
    return (
      <span className="font-semibold text-gray-900">
        {article.price.toFixed(2)} {article.currency}
      </span>
    );
  }

  const text = (article.tieredPricesText || '').toLowerCase();
  if (text.includes('auf anfrage') || text.includes('preis auf anfrage')) {
    return <span className="text-sm text-orange-600 font-medium">Auf Anfrage</span>;
  }

  if (
    (article.tieredPrices && article.tieredPrices.length > 0) ||
    (article.tieredPricesText && article.tieredPricesText.trim())
  ) {
    return <span className="text-gray-500 text-sm">Siehe Staffelpreise</span>;
  }

  return <span className="text-gray-500 text-sm">-</span>;
}

function TieredPricesCell({ article }: { article: Product }) {
  // Prioritize structured tieredPrices over OCR text
  if (
    article.tieredPrices &&
    Array.isArray(article.tieredPrices) &&
    article.tieredPrices.length > 0
  ) {
    return (
      <div className="text-sm text-gray-600">
        {article.tieredPrices.map(
          (tier: { quantity: number; price: number | string }, i: number) => {
            const price = typeof tier.price === 'string' ? parseFloat(tier.price) : tier.price;
            return (
              <div key={i}>
                {i === 0 ? `Bis ${tier.quantity}` : `Ab ${tier.quantity}`}:{' '}
                {price ? price.toFixed(2) : '-'} {article.currency}
              </div>
            );
          }
        )}
      </div>
    );
  }

  if (article.tieredPricesText && article.tieredPricesText.trim()) {
    const text = article.tieredPricesText.toLowerCase();

    // Handle "Preis auf Anfrage" / "Auf Anfrage" specially
    if (text.includes('auf anfrage') || text.includes('preis auf anfrage')) {
      return <span className="text-sm text-gray-500">Siehe Basispreis</span>;
    }

    // Clean up OCR text - remove obvious garbage
    const cleanText = article.tieredPricesText
      .split('\n')
      .filter(
        (line) =>
          // Keep lines that contain price patterns
          (line.includes('\u20AC') || line.includes('EUR') || /\d+[,\.]\d+/.test(line)) &&
          // Remove obvious garbage
          !line.includes('\u00A9') &&
          !line.includes('Service') &&
          !line.includes('Hilfe') &&
          !line.includes('Goooe') &&
          !line.includes('eingeben')
      )
      .join('\n');

    if (cleanText) {
      return <div className="text-sm text-gray-600 whitespace-pre-line font-mono">{cleanText}</div>;
    }

    return <span className="text-gray-500 text-sm">OCR-Fehler</span>;
  }

  return (
    <span className="text-gray-500 text-sm">
      {article.price && article.price > 0 ? 'Siehe Basispreis' : '-'}
    </span>
  );
}
