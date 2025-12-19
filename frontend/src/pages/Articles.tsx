/**
 * Articles Page
 * Display and manage crawled products before generating labels
 *
 * Refactored: Split into smaller components for maintainability
 * Original: 1017 lines -> Now: ~250 lines
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ArticleEditModal from '../components/ArticleEditModal';
import MatchPreviewModal from '../components/MatchPreviewModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { articlesApi, labelApi, type Product } from '../services/api';
import { useUiStore } from '../store/uiStore';
import type { LabelTemplate, MatchResult } from '../types/template.types';
import { matchArticlesWithTemplates } from '../utils/templateMatcher';
import {
  ArticlesBulkActions,
  ArticlesHeader,
  ArticlesPagination,
  ArticlesSearch,
  ArticlesStats,
  ArticlesTable,
  ArticlesTemplateSelector,
  type ConfirmDialogState,
} from './articles';

export default function Articles() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useUiStore();

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showQrCodes, setShowQrCodes] = useState(true);

  // Modal State
  const [editingArticle, setEditingArticle] = useState<Product | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // Label Generation State
  const [availableTemplates, setAvailableTemplates] = useState<LabelTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Auto-Matching State
  const [matchResult, setMatchResult] = useState<MatchResult>({ matched: [], skipped: [] });
  const [showMatchPreview, setShowMatchPreview] = useState(false);

  // Load templates from API
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await fetch(`${window.location.origin}/api/label-templates`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.templates) {
            setAvailableTemplates(data.templates);
            const defaultTemplate = data.templates.find((t: LabelTemplate) => t.printLayoutId);
            if (defaultTemplate) {
              setSelectedTemplateId((prev) => prev || defaultTemplate.id);
            }
          }
        }
      } catch (error) {
        console.error('Error loading templates:', error);
        try {
          const saved = localStorage.getItem('labelTemplates');
          if (saved) {
            setAvailableTemplates(JSON.parse(saved));
          }
        } catch (fallbackError) {
          console.error('Fallback to localStorage failed:', fallbackError);
        }
      }
    };

    loadTemplates();
    window.addEventListener('focus', loadTemplates);
    return () => window.removeEventListener('focus', loadTemplates);
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['articles-stats'] });
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, queryClient]);

  // Fetch articles
  const {
    data: productsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['articles', { page, limit: itemsPerPage, search: searchTerm }],
    queryFn: () =>
      articlesApi.getAll({ page, limit: itemsPerPage, search: searchTerm, published: true }),
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const articles = productsResponse?.data || [];
  const totalProducts = productsResponse?.pagination.total || 0;

  // Fetch stats
  const { data: statsResponse } = useQuery({
    queryKey: ['articles-stats'],
    queryFn: () => articlesApi.getStats(),
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: articlesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['articles-stats'] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: articlesApi.bulkDelete,
    onSuccess: () => {
      setSelectedArticles(new Set());
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['articles-stats'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (article: Product) => articlesApi.update(article.id, article),
    onSuccess: () => {
      setIsEditModalOpen(false);
      setEditingArticle(null);
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['articles-stats'] });
    },
  });

  const generateLabelsMutation = useMutation({
    mutationFn: async ({
      articleIds,
      templateId,
    }: {
      articleIds: string[];
      templateId: string;
    }) => {
      const BATCH_SIZE = 50;
      const results: PromiseSettledResult<unknown>[] = [];

      if (articleIds.length > 100) {
        showToast({
          type: 'info',
          message: `Generiere ${articleIds.length} Labels in Batches...`,
          duration: 3000,
        });
      }

      for (let i = 0; i < articleIds.length; i += BATCH_SIZE) {
        const batch = articleIds.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map((articleId) => labelApi.generateFromArticle(articleId, templateId))
        );
        results.push(...batchResults);
      }

      return {
        successful: results.filter((r) => r.status === 'fulfilled').length,
        failed: results.filter((r) => r.status === 'rejected').length,
        total: articleIds.length,
      };
    },
    onSuccess: (data) => {
      showToast({
        type: 'success',
        message: `${data.successful} Label${data.successful !== 1 ? 's' : ''} erfolgreich generiert!${data.failed > 0 ? ` (${data.failed} fehlgeschlagen)` : ''}`,
        duration: 5000,
      });
      setSelectedArticles(new Set());
      setShowTemplateSelector(false);
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
    onError: (error: Error) => {
      showToast({ type: 'error', message: `Fehler: ${error.message}`, duration: 7000 });
    },
  });

  const generateMatchedLabelsMutation = useMutation({
    mutationFn: async (result: MatchResult) => {
      const results = await Promise.allSettled(
        result.matched.map((match) =>
          labelApi.generateFromArticle(match.articleId, match.templateId)
        )
      );
      return {
        successful: results.filter((r) => r.status === 'fulfilled').length,
        failed: results.filter((r) => r.status === 'rejected').length,
        skipped: result.skipped.length,
        total: result.matched.length + result.skipped.length,
      };
    },
    onSuccess: (data) => {
      const messages = [];
      if (data.successful > 0) messages.push(`${data.successful} Labels generiert!`);
      if (data.skipped > 0) messages.push(`${data.skipped} ubersprungen`);
      if (data.failed > 0) messages.push(`${data.failed} fehlgeschlagen`);
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
      showToast({ type: 'error', message: `Fehler: ${error.message}`, duration: 7000 });
    },
  });

  // Handlers
  const toggleSelectAll = () => {
    setSelectedArticles(
      selectedArticles.size === articles.length
        ? new Set()
        : new Set(articles.map((a: Product) => a.id))
    );
  };

  const selectAllFromDB = async () => {
    try {
      showToast({ type: 'info', message: 'Lade alle Artikel...', duration: 2000 });
      const response = await articlesApi.getAll({ page: 1, limit: 2000, published: true });
      const allIds = (response.data || []).map((a: Product) => a.id);
      setSelectedArticles(new Set(allIds));
      showToast({
        type: 'success',
        message: `${allIds.length} Artikel ausgewahlt!`,
        duration: 3000,
      });
    } catch {
      showToast({ type: 'error', message: 'Fehler beim Laden', duration: 3000 });
    }
  };

  const exportToExcel = async () => {
    try {
      const ids = selectedArticles.size > 0 ? Array.from(selectedArticles) : undefined;
      const blob = (await articlesApi.export(ids, 'csv')) as Blob;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `artikel-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      showToast({ type: 'error', message: 'Export fehlgeschlagen!' });
    }
  };

  const handleGenerateLabelsClick = () => {
    if (selectedArticles.size === 0) {
      showToast({ type: 'warning', message: 'Bitte wahle mindestens einen Artikel!' });
      return;
    }
    if (availableTemplates.length === 0) {
      showToast({ type: 'warning', message: 'Keine Templates gefunden!' });
      navigate('/labeltemplate');
      return;
    }

    const autoMatchTemplates = availableTemplates.filter(
      (t) => t.autoMatchEnabled && t.rules?.enabled
    );
    if (autoMatchTemplates.length === 0) {
      setShowTemplateSelector(true);
      return;
    }

    const selectedArticleObjects = articles.filter((a) => selectedArticles.has(a.id));
    const result = matchArticlesWithTemplates(selectedArticleObjects, availableTemplates);
    setMatchResult(result);
    setShowMatchPreview(true);
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Artikel loschen?',
      description: 'Diese Aktion kann nicht ruckgangig gemacht werden.',
      confirmUnsafe: true,
      onConfirm: () => {
        deleteMutation.mutate(id);
        selectedArticles.delete(id);
        setSelectedArticles(new Set(selectedArticles));
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedArticles.size === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: `${selectedArticles.size} Artikel loschen?`,
      description: 'Diese Aktion kann nicht ruckgangig gemacht werden.',
      confirmUnsafe: true,
      onConfirm: () => bulkDeleteMutation.mutate(Array.from(selectedArticles)),
    });
  };

  return (
    <div className="space-y-6">
      <ArticlesHeader
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        showQrCodes={showQrCodes}
        setShowQrCodes={setShowQrCodes}
        selectedCount={selectedArticles.size}
        onExport={exportToExcel}
        onGenerateLabels={handleGenerateLabelsClick}
        isGenerating={generateLabelsMutation.isPending}
      />

      <ArticlesStats
        stats={statsResponse?.data}
        selectedCount={selectedArticles.size}
        onSelectAll={selectAllFromDB}
      />

      <ArticlesSearch
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        itemsPerPage={itemsPerPage}
        setItemsPerPage={setItemsPerPage}
        setPage={setPage}
      />

      <ArticlesTable
        articles={articles}
        isLoading={isLoading}
        error={error}
        selectedArticles={selectedArticles}
        showQrCodes={showQrCodes}
        onToggleSelectAll={toggleSelectAll}
        onToggleSelect={(id) => {
          const newSelected = new Set(selectedArticles);
          if (newSelected.has(id)) newSelected.delete(id);
          else newSelected.add(id);
          setSelectedArticles(newSelected);
        }}
        onEdit={(article) => {
          setEditingArticle(article);
          setIsEditModalOpen(true);
        }}
        onDelete={handleDelete}
        onGenerateLabel={(articleId) => {
          setSelectedArticles(new Set([articleId]));
          handleGenerateLabelsClick();
        }}
        isGenerating={generateLabelsMutation.isPending}
      />

      {productsResponse && (
        <ArticlesPagination
          page={page}
          totalPages={productsResponse.pagination.totalPages}
          totalItems={totalProducts}
          onPageChange={setPage}
        />
      )}

      <ArticlesBulkActions
        selectedCount={selectedArticles.size}
        onClearSelection={() => setSelectedArticles(new Set())}
        onDelete={handleBulkDelete}
        onExport={exportToExcel}
        onGenerateLabels={handleGenerateLabelsClick}
        isGenerating={generateLabelsMutation.isPending}
      />

      <ArticlesTemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        templates={availableTemplates}
        selectedTemplateId={selectedTemplateId}
        setSelectedTemplateId={setSelectedTemplateId}
        selectedCount={selectedArticles.size}
        onGenerate={() => {
          if (selectedTemplateId) {
            generateLabelsMutation.mutate({
              articleIds: Array.from(selectedArticles),
              templateId: selectedTemplateId,
            });
          }
        }}
        isGenerating={generateLabelsMutation.isPending}
      />

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

      <ArticleEditModal
        article={editingArticle}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingArticle(null);
        }}
        onSave={(updatedArticle) => updateMutation.mutate(updatedArticle)}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmUnsafe={confirmDialog.confirmUnsafe}
      />
    </div>
  );
}
