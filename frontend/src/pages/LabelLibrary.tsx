import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Grid3x3, List, Plus, Trash2, CheckSquare } from 'lucide-react';
import { useLabelStore } from '../store/labelStore';
import { usePrintStore } from '../store/printStore';
import { useUiStore } from '../store/uiStore';
import { labelApi, type Product } from '../services/api';
import LabelGrid from '../components/LabelManager/LabelGrid';
import LabelList from '../components/LabelManager/LabelList';
import LabelFilter from '../components/LabelManager/LabelFilter';
import LabelGenerationModal from '../components/LabelGenerationModal';

export default function LabelLibrary() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    viewMode,
    setViewMode,
    selectedLabels,
    selectLabel,
    clearSelection,
    selectAll,
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

  // Ensure labels is always an array
  const labels = Array.isArray(labelsData?.data) ? labelsData.data : [];
  const pagination = labelsData?.pagination;

  // Extract unique categories and tags from labels
  const categories = Array.from(
    new Set(labels.map((l: any) => l.category).filter(Boolean))
  );
  const tags = Array.from(
    new Set(labels.flatMap((l: any) => l.tags || []))
  );

  const handleSelectLabel = (id: string) => {
    selectLabel(id);
  };

  const handleEditLabel = (label: any) => {
    // TODO: Open edit modal
    showToast({
      type: 'info',
      message: `Edit functionality coming soon for ${label.productName}`,
    });
  };

  const handleDeleteLabel = async (id: string) => {
    if (!confirm('Are you sure you want to delete this label?')) return;

    try {
      await labelApi.delete(id);
      showToast({
        type: 'success',
        message: 'Label deleted successfully',
      });
      refetch();
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to delete label',
      });
    }
  };

  const handleViewLabel = (label: any) => {
    // TODO: Open view modal
    showToast({
      type: 'info',
      message: `Viewing ${label.productName}`,
    });
  };

  const handlePrintLabel = (label: any) => {
    addLabelToLayout(label.id);
    showToast({
      type: 'success',
      message: `${label.productName} added to print layout`,
    });
  };

  const handleBatchDelete = async () => {
    if (selectedLabels.length === 0) return;
    if (!confirm(`Delete ${selectedLabels.length} selected labels?`)) return;

    try {
      await labelApi.batch(selectedLabels, 'delete');
      showToast({
        type: 'success',
        message: `${selectedLabels.length} labels deleted`,
      });
      clearSelection();
      refetch();
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to delete labels',
      });
    }
  };

  const handleAddToPrint = () => {
    selectedLabels.forEach((id) => addLabelToLayout(id));
    showToast({
      type: 'success',
      message: `${selectedLabels.length} labels added to print layout`,
    });
    clearSelection();
  };

  const handleCreateLabel = () => {
    // Navigate to label template editor to create custom label
    navigate('/labeltemplate');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Label Library</h1>
          <p className="text-gray-600 mt-1">
            {pagination?.total || 0} labels total
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCreateLabel}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Label
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
              Grid
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
              List
            </button>
          </div>

          {/* Batch Actions */}
          {selectedLabels.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 border border-primary-200 rounded-lg">
              <CheckSquare className="w-5 h-5 text-primary-700" />
              <span className="text-sm font-medium text-primary-900">
                {selectedLabels.length} selected
              </span>
              <div className="h-4 w-px bg-primary-300 mx-2" />
              <button
                onClick={handleAddToPrint}
                className="text-sm text-primary-700 hover:text-primary-900 font-medium"
              >
                Add to Print
              </button>
              <button
                onClick={handleBatchDelete}
                className="text-sm text-red-700 hover:text-red-900 font-medium flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={clearSelection}
                className="text-sm text-gray-700 hover:text-gray-900 font-medium"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => selectAll()}
            className="text-sm text-gray-700 hover:text-gray-900 font-medium"
          >
            Select All
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="card text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 mt-4">Loading labels...</p>
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
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} labels
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
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
              Next
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
    </div>
  );
}
