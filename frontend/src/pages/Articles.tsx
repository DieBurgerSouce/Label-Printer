/**
 * Articles Page
 * Display and manage crawled products before generating labels
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Download, Tag, Search, Filter, Edit, Trash2, CheckSquare, Square, QrCode, ExternalLink, RefreshCw, FileText } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { articlesApi, labelApi, type Product, getImageUrl } from '../services/api';
import { useUiStore } from '../store/uiStore';
import ArticleEditModal from '../components/ArticleEditModal';
import MatchPreviewModal from '../components/MatchPreviewModal';
import { matchArticlesWithTemplates } from '../utils/templateMatcher';
import type { MatchResult, LabelTemplate } from '../types/template.types';

export default function Articles() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useUiStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showQrCodes, setShowQrCodes] = useState(true);
  const [editingArticle, setEditingArticle] = useState<Product | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Label Generation States
  const [availableTemplates, setAvailableTemplates] = useState<LabelTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Auto-Matching States
  const [matchResult, setMatchResult] = useState<MatchResult>({ matched: [], skipped: [] });
  const [showMatchPreview, setShowMatchPreview] = useState(false);

  // Load available templates from localStorage
  useEffect(() => {
    const loadTemplates = () => {
      try {
        const saved = localStorage.getItem('labelTemplates');
        if (saved) {
          const templates: LabelTemplate[] = JSON.parse(saved);
          setAvailableTemplates(templates);
          // Auto-select first template with print layout
          const defaultTemplate = templates.find(t => t.printLayoutId);
          if (defaultTemplate && !selectedTemplateId) {
            setSelectedTemplateId(defaultTemplate.id);
          }
        }
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    };

    loadTemplates();
    // Reload when window gets focus (in case templates were saved in another tab)
    window.addEventListener('focus', loadTemplates);
    return () => window.removeEventListener('focus', loadTemplates);
  }, [selectedTemplateId]);

  // Auto-refresh products every 5 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['articles-stats'] });
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, queryClient]);

  // Fetch products
  const { data: productsResponse, isLoading, error } = useQuery({
    queryKey: ['articles', { page, limit: 50, search: searchTerm }],
    queryFn: () => articlesApi.getAll({ page, limit: 50, search: searchTerm, published: true }),
    refetchInterval: autoRefresh ? 5000 : false, // Refetch every 5 seconds if auto-refresh is on
  });

  const articles = productsResponse?.data || [];
  const totalProducts = productsResponse?.pagination.total || 0;

  // Fetch stats
  const { data: statsResponse } = useQuery({
    queryKey: ['articles-stats'],
    queryFn: () => articlesApi.getStats(),
  });

  const stats = statsResponse?.data;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: articlesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['articles-stats'] });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: articlesApi.bulkDelete,
    onSuccess: () => {
      setSelectedArticles(new Set());
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['articles-stats'] });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (article: Product) => articlesApi.update(article.id, article),
    onSuccess: () => {
      setIsEditModalOpen(false);
      setEditingArticle(null);
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['articles-stats'] });
    },
  });

  // Label generation mutation (manual template selection)
  const generateLabelsMutation = useMutation({
    mutationFn: async ({ articleIds, templateId }: { articleIds: string[]; templateId: string }) => {
      const results = await Promise.allSettled(
        articleIds.map(articleId => labelApi.generateFromArticle(articleId, templateId))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return { successful, failed, total: articleIds.length };
    },
    onSuccess: (data) => {
      showToast({
        type: 'success',
        message: `✅ ${data.successful} Label${data.successful !== 1 ? 's' : ''} erfolgreich generiert!${data.failed > 0 ? ` (${data.failed} fehlgeschlagen)` : ''}`,
        duration: 5000,
      });
      setSelectedArticles(new Set());
      setShowTemplateSelector(false);
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
    onError: (error: Error) => {
      showToast({
        type: 'error',
        message: `❌ Fehler beim Generieren der Labels: ${error.message}`,
        duration: 7000,
      });
    },
  });

  // Auto-matched label generation mutation
  const generateMatchedLabelsMutation = useMutation({
    mutationFn: async (result: MatchResult) => {
      const results = await Promise.allSettled(
        result.matched.map(match =>
          labelApi.generateFromArticle(match.articleId, match.templateId)
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return {
        successful,
        failed,
        skipped: result.skipped.length,
        total: result.matched.length + result.skipped.length
      };
    },
    onSuccess: (data) => {
      const messages = [];
      if (data.successful > 0) {
        messages.push(`✅ ${data.successful} Label${data.successful !== 1 ? 's' : ''} erfolgreich generiert!`);
      }
      if (data.skipped > 0) {
        messages.push(`⚠️ ${data.skipped} Artikel übersprungen`);
      }
      if (data.failed > 0) {
        messages.push(`❌ ${data.failed} fehlgeschlagen`);
      }

      showToast({
        type: data.successful > 0 ? 'success' : 'warning',
        message: messages.join(' '),
        duration: 7000,
      });

      setSelectedArticles(new Set());
      setShowMatchPreview(false);
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
    onError: (error: Error) => {
      showToast({
        type: 'error',
        message: `❌ Fehler beim Generieren der Labels: ${error.message}`,
        duration: 7000,
      });
    },
  });

  const toggleSelectAll = () => {
    if (selectedArticles.size === articles.length) {
      setSelectedArticles(new Set());
    } else {
      setSelectedArticles(new Set(articles.map((a: Product) => a.id)));
    }
  };

  const toggleSelectArticle = (id: string) => {
    const newSelected = new Set(selectedArticles);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedArticles(newSelected);
  };

  const exportToExcel = async () => {
    try {
      const ids = selectedArticles.size > 0 ? Array.from(selectedArticles) : undefined;
      const blob = await articlesApi.export(ids, 'csv') as Blob;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `artikel-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export fehlgeschlagen!');
    }
  };

  const handleGenerateLabelsClick = () => {
    if (selectedArticles.size === 0) {
      showToast({
        type: 'warning',
        message: 'Bitte wähle mindestens einen Artikel aus!',
      });
      return;
    }

    // Check if templates are available
    if (availableTemplates.length === 0) {
      showToast({
        type: 'warning',
        message: 'Keine Templates gefunden! Bitte erstelle zuerst ein Label-Template.',
      });
      navigate('/labeltemplate');
      return;
    }

    // Check if auto-match templates exist
    const autoMatchTemplates = availableTemplates.filter(t => t.autoMatchEnabled && t.rules?.enabled);

    if (autoMatchTemplates.length === 0) {
      // Fallback: Show manual template selector
      setShowTemplateSelector(true);
      return;
    }

    // Auto-Matching: Match articles with templates
    const selectedArticleObjects = articles.filter(a => selectedArticles.has(a.id));
    const result = matchArticlesWithTemplates(selectedArticleObjects, availableTemplates);

    setMatchResult(result);
    setShowMatchPreview(true);
  };

  const handleGenerateLabels = () => {
    if (!selectedTemplateId) {
      showToast({
        type: 'warning',
        message: 'Bitte wähle ein Template aus!',
      });
      return;
    }

    generateLabelsMutation.mutate({
      articleIds: Array.from(selectedArticles),
      templateId: selectedTemplateId,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Möchten Sie diesen Artikel wirklich löschen?')) {
      deleteMutation.mutate(id);
      selectedArticles.delete(id);
      setSelectedArticles(new Set(selectedArticles));
    }
  };

  const handleBulkDelete = () => {
    if (selectedArticles.size === 0) return;
    if (confirm(`Möchten Sie ${selectedArticles.size} Artikel wirklich löschen?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedArticles));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
            onClick={exportToExcel}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            {selectedArticles.size > 0 ? `Export (${selectedArticles.size})` : 'Export Alle'}
          </button>
          <button
            onClick={handleGenerateLabelsClick}
            disabled={selectedArticles.size === 0 || generateLabelsMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generateLabelsMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generiere...
              </>
            ) : (
              <>
                <Tag className="w-5 h-5" />
                Labels Generieren ({selectedArticles.size})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-600">Gesamt Artikel</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.total || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Ausgewählt</p>
          <p className="text-2xl font-bold text-blue-600">{selectedArticles.size}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Mit Bildern</p>
          <p className="text-2xl font-bold text-green-600">
            {stats?.withImages || 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Verifiziert</p>
          <p className="text-2xl font-bold text-purple-600">{stats?.verified || 0}</p>
        </div>
      </div>

      {/* Search & Filter */}
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
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filter
          </button>
        </div>
      </div>

      {/* Articles Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            <p>Fehler beim Laden der Artikel</p>
          </div>
        ) : articles.length === 0 ? (
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-300 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={toggleSelectAll}
                      className="hover:bg-gray-100 p-1 rounded"
                    >
                      {selectedArticles.size === articles.length ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Artikelnummer
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Bild
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Produktname
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Beschreibung
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Preis
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Staffelpreise
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Shop URL
                  </th>
                  {showQrCodes && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      QR-Code
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {articles.map((article: Product) => (
                  <tr
                    key={article.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      selectedArticles.has(article.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleSelectArticle(article.id)}
                        className="hover:bg-gray-100 p-1 rounded"
                      >
                        {selectedArticles.has(article.id) ? (
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
                          console.error('Failed to load image:', article.imageUrl, 'Full URL:', getImageUrl(article.imageUrl));
                          e.currentTarget.src = 'https://via.placeholder.com/64?text=No+Image';
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 max-w-xs truncate">{article.productName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600 max-w-xs truncate">
                        {article.description || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {typeof article.price === 'number' && article.price > 0 ? (
                        <span className="font-semibold text-gray-900">
                          {article.price.toFixed(2)} {article.currency}
                        </span>
                      ) : (
                        <span className="text-gray-500 text-sm">
                          {(article.tieredPrices && article.tieredPrices.length > 0) ||
                           (article.tieredPricesText && article.tieredPricesText.trim()) ?
                            'Siehe Staffelpreise' :
                            '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {article.tieredPricesText && article.tieredPricesText.trim() ? (
                        <div className="text-sm text-gray-600 whitespace-pre-line font-mono">
                          {article.tieredPricesText}
                        </div>
                      ) : article.tieredPrices && Array.isArray(article.tieredPrices) && article.tieredPrices.length > 0 ? (
                        <div className="text-sm text-gray-600">
                          {article.tieredPrices.map((tier: { quantity: number; price: number }, i: number) => (
                            <div key={i}>
                              {tier.quantity}+: {typeof tier.price === 'number' ? tier.price.toFixed(2) : '-'} {article.currency}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">
                          {article.price && article.price > 0 ?
                            'Siehe Basispreis' :
                            '-'}
                        </span>
                      )}
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
                          onClick={() => {
                            setSelectedArticles(new Set([article.id]));
                            handleGenerateLabelsClick();
                          }}
                          className="p-2 hover:bg-blue-50 rounded"
                          title="Label generieren"
                          disabled={generateLabelsMutation.isPending}
                        >
                          <Tag className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingArticle(article);
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 hover:bg-gray-100 rounded"
                          title="Bearbeiten"
                        >
                          <Edit className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(article.id)}
                          className="p-2 hover:bg-red-50 rounded"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {productsResponse && productsResponse.pagination.totalPages > 1 && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Seite {page} von {productsResponse.pagination.totalPages} ({totalProducts} Artikel)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={productsResponse.pagination.page <= 1}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Zurück
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={productsResponse.pagination.page >= productsResponse.pagination.totalPages}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Weiter
            </button>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedArticles.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 flex items-center gap-4 z-50">
          <span className="text-sm font-medium text-gray-700">
            {selectedArticles.size} Artikel ausgewählt
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedArticles(new Set())}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Auswahl aufheben
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Löschen
            </button>
            <button
              onClick={exportToExcel}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={handleGenerateLabelsClick}
              disabled={generateLabelsMutation.isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              {generateLabelsMutation.isPending ? (
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
      )}

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              Template auswählen
            </h2>

            <p className="text-gray-600 mb-6">
              Wähle ein Template für die {selectedArticles.size} ausgewählten Artikel.
            </p>

            {availableTemplates.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-yellow-800 text-sm">
                  ⚠️ Keine Templates gefunden. Bitte erstelle zuerst ein Label-Template.
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                {availableTemplates.map((template) => (
                  <label
                    key={template.id}
                    className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-blue-50 ${
                      selectedTemplateId === template.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      value={template.id}
                      checked={selectedTemplateId === template.id}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{template.name}</div>
                      {template.printLayoutName && (
                        <div className="text-sm text-gray-600 mt-1">
                          📄 {template.printLayoutName}
                        </div>
                      )}
                      {!template.printLayoutId && (
                        <div className="text-sm text-orange-600 mt-1">
                          ⚠️ Kein Drucklayout ausgewählt
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowTemplateSelector(false);
                  setSelectedTemplateId('');
                }}
                disabled={generateLabelsMutation.isPending}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={() => navigate('/labeltemplate')}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Neues Template erstellen
              </button>
              <button
                onClick={handleGenerateLabels}
                disabled={!selectedTemplateId || generateLabelsMutation.isPending || availableTemplates.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {generateLabelsMutation.isPending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generiere {selectedArticles.size} Labels...
                  </>
                ) : (
                  <>
                    <Tag className="w-5 h-5" />
                    {selectedArticles.size} Labels generieren
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Preview Modal */}
      {showMatchPreview && (
        <MatchPreviewModal
          matchResult={matchResult}
          isLoading={generateMatchedLabelsMutation.isPending}
          onConfirm={() => generateMatchedLabelsMutation.mutate(matchResult)}
          onCancel={() => {
            setShowMatchPreview(false);
            setMatchResult({ matched: [], skipped: [] });
          }}
        />
      )}

      {/* Edit Modal */}
      <ArticleEditModal
        article={editingArticle}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingArticle(null);
        }}
        onSave={(updatedArticle) => updateMutation.mutate(updatedArticle)}
      />
    </div>
  );
}
