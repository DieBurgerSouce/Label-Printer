import { useQuery } from '@tanstack/react-query';
import { CheckSquare, Grid3x3, List, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LabelGenerationModal from '../components/LabelGenerationModal';
import LabelFilter from '../components/LabelManager/LabelFilter';
import LabelGrid from '../components/LabelManager/LabelGrid';
import LabelList from '../components/LabelManager/LabelList';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { labelApi, type Product } from '../services/api';
import { useLabelStore, type PriceLabel } from '../store/labelStore';
import { usePrintStore } from '../store/printStore';
import { useUiStore } from '../store/uiStore';



export default function LabelLibrary() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    viewMode,
    setViewMode,
    selectedLabels,
    selectLabel,
    clearSelection,
  } = useLabelStore();

  const { addLabelToLayout } = usePrintStore();
  const { showToast } = useUiStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  // Label generation modal state
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [articlesToGenerate, setArticlesToGenerate] = useState<Product[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // Check if we have articles from the Articles page
  useEffect(() => {
    const state = location.state as { articles?: Product[] } | null;
    if (state?.articles && state.articles.length > 0) {
      setArticlesToGenerate(state.articles);
      setShowGenerationModal(true);
      // Clear the location state to prevent reopening on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // Fetch labels
  const { data: labelsData, isLoading, refetch } = useQuery({
    queryKey: ['labels', page, searchQuery, selectedCategory, selectedTags],
    queryFn: () =>
      labelApi.getAll({
        page,
        limit: 50,
        search: searchQuery,
        category: selectedCategory,
        tags: selectedTags.join(','),
      }),
  });

  // Ensure labels is always an array - API returns { data: { labels: [], total, page, limit, pages } }
  const labelsResponse: any = labelsData?.data || {};
  const rawLabels = Array.isArray(labelsResponse.labels) ? labelsResponse.labels : [];

  // Map API response to PriceLabel interface (handling dates) - memoized
  const labels: PriceLabel[] = useMemo(
    () =>
      rawLabels.map((l: any) => ({
        ...l,
        createdAt: new Date(l.createdAt),
        updatedAt: l.updatedAt ? new Date(l.updatedAt) : undefined,
        // Ensure priceInfo exists with defaults if missing
        priceInfo: l.priceInfo || { price: 0, currency: 'EUR' },
        templateType: l.templateType || 'standard',
      })),
    [rawLabels]
  );

  const pagination = useMemo(
    () => ({
      total: labelsResponse.total || 0,
      page: labelsResponse.page || 1,
      limit: labelsResponse.limit || 50,
      pages: labelsResponse.pages || 0,
      totalPages: labelsResponse.pages || 0,
    }),
    [labelsResponse.total, labelsResponse.page, labelsResponse.limit, labelsResponse.pages]
  );

  // Extract unique categories and tags from labels - memoized
  const categories = useMemo(
    () => Array.from(new Set(labels.map((l) => l.category).filter(Boolean))),
    [labels]
  );
  const tags = useMemo(
    () => Array.from(new Set(labels.flatMap((l) => l.tags || []))),
    [labels]
  );

  const handleSelectLabel = useCallback(
    (id: string) => {
      selectLabel(id);
    },
    [selectLabel]
  );

  const handleEditLabel = useCallback(
    (label: PriceLabel) => {
      // TODO: Open edit modal
      showToast({
        type: 'info',
        message: `Bearbeiten-Funktion kommt bald für ${label.productName}`,
      });
    },
    [showToast]
  );

  const handleDeleteLabel = useCallback(
    async (id: string) => {
      setConfirmDialog({
        isOpen: true,
        title: 'Label löschen?',
        description:
          'Möchten Sie dieses Label wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
        onConfirm: async () => {
          try {
            await labelApi.delete(id);
            showToast({
              type: 'success',
              message: 'Label erfolgreich gelöscht',
            });
            refetch();
          } catch (error) {
            showToast({
              type: 'error',
              message: 'Fehler beim Löschen des Labels',
            });
          }
        },
      });
    },
    [showToast, refetch]
  );

  const handleViewLabel = useCallback(
    (label: PriceLabel) => {
      // TODO: Open view modal
      showToast({
        type: 'info',
        message: `Viewing ${label.productName}`,
      });
    },
    [showToast]
  );

  const handlePrintLabel = useCallback(
    (label: PriceLabel) => {
      addLabelToLayout(label.id);
      showToast({
        type: 'success',
        message: `${label.productName} zum Drucken hinzugefügt.`,
      });
    },
    [addLabelToLayout, showToast]
  );

  const handleBatchDelete = useCallback(async () => {
    if (selectedLabels.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `${selectedLabels.length} Labels löschen?`,
      description: `Möchten Sie wirklich ${selectedLabels.length} Labels löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      onConfirm: async () => {
        try {
          await labelApi.batch(selectedLabels, 'delete');
          showToast({
            type: 'success',
            message: `${selectedLabels.length} Labels gelöscht`,
          });
          clearSelection();
          refetch();
        } catch (error) {
          showToast({
            type: 'error',
            message: 'Fehler beim Löschen der Labels',
          });
        }
      },
    });
  }, [selectedLabels, showToast, clearSelection, refetch]);

  const handleAddToPrint = useCallback(() => {
    selectedLabels.forEach((id) => addLabelToLayout(id));
    showToast({
      type: 'success',
      message: `${selectedLabels.length} Labels zum Drucken hinzugefügt.`,
    });
    clearSelection();
    // Navigate to print setup after a short delay
    setTimeout(() => navigate('/print-setup'), 1500);
  }, [selectedLabels, addLabelToLayout, showToast, clearSelection, navigate]);

  const handleCreateLabel = useCallback(() => {
    // Navigate to label template editor to create custom label
    navigate('/labeltemplate');
  }, [navigate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Label Bibliothek</h1>
          <p className="text-gray-600 mt-1">
            {pagination?.total || 0} Labels gesamt
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCreateLabel}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Neues Label
          </button>
        </div>
      </div>

      {/* Filters */}
      <LabelFilter
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categories={categories as string[]}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        tags={tags as string[]}
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 flex items-center gap-2 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
              Raster
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 flex items-center gap-2 transition-colors border-l border-gray-300 ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <List className="w-4 h-4" />
              Liste
            </button>
          </div>

          {/* Batch Actions */}
          {selectedLabels.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 border border-primary-200 rounded-lg">
              <CheckSquare className="w-5 h-5 text-primary-700" />
              <span className="text-sm font-medium text-primary-900">
                {selectedLabels.length} ausgewählt
              </span>
              <div className="h-4 w-px bg-primary-300 mx-2" />
              <button
                onClick={handleAddToPrint}
                className="text-sm text-primary-700 hover:text-primary-900 font-medium"
              >
                Drucken
              </button>
              <button
                onClick={handleBatchDelete}
                className="text-sm text-red-700 hover:text-red-900 font-medium flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Löschen
              </button>
              <button
                onClick={clearSelection}
                className="text-sm text-gray-700 hover:text-gray-900 font-medium"
              >
                Leeren
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              // Select all labels on current page
              labels.forEach((label) => selectLabel(label.id));
            }}
            className="text-sm text-gray-700 hover:text-gray-900 font-medium"
          >
            Alle auswählen
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="card text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 mt-4">Lade Labels...</p>
        </div>
      ) : viewMode === 'grid' ? (
        <LabelGrid
          labels={labels}
          selectedIds={selectedLabels}
          onSelectLabel={handleSelectLabel}
          onEditLabel={handleEditLabel}
          onDeleteLabel={handleDeleteLabel}
          onViewLabel={handleViewLabel}
          onPrintLabel={handlePrintLabel}
        />
      ) : (
        <LabelList
          labels={labels}
          selectedIds={selectedLabels}
          onSelectLabel={handleSelectLabel}
          onEditLabel={handleEditLabel}
          onDeleteLabel={handleDeleteLabel}
          onViewLabel={handleViewLabel}
          onPrintLabel={handlePrintLabel}
        />
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between card">
          <div className="text-sm text-gray-600">
            Zeige {((pagination.page - 1) * pagination.limit) + 1} bis{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} von{' '}
            {pagination.total} Labels
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Zurück
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === pagination.totalPages ||
                    (p >= page - 1 && p <= page + 1)
                )
                .map((p, i, arr) => (
                  <div key={p} className="flex items-center gap-1">
                    {i > 0 && arr[i - 1] !== p - 1 && (
                      <span className="px-2 text-gray-400">...</span>
                    )}
                    <button
                      onClick={() => setPage(p)}
                      className={`px-4 py-2 rounded-lg ${
                        page === p
                          ? 'bg-primary-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  </div>
                ))}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Weiter
            </button>
          </div>
        </div>
      )}

      {/* Label Generation Modal */}
      <LabelGenerationModal
        articles={articlesToGenerate}
        isOpen={showGenerationModal}
        onClose={() => {
          setShowGenerationModal(false);
          setArticlesToGenerate([]);
        }}
        onSuccess={() => {
          showToast({ message: 'Labels erfolgreich generiert!', type: 'success' });
          refetch(); // Refresh the labels list
        }}
      />
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmUnsafe={true}
      />
    </div>
  );
}
