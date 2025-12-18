/**
 * Shared types for Articles page components
 */
import type { Product } from '../../services/api';
import type { LabelTemplate, MatchResult } from '../../types/template.types';

export interface ArticlesState {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedArticles: Set<string>;
  setSelectedArticles: (articles: Set<string>) => void;
  page: number;
  setPage: (page: number | ((p: number) => number)) => void;
  itemsPerPage: number;
  setItemsPerPage: (items: number) => void;
  autoRefresh: boolean;
  setAutoRefresh: (refresh: boolean) => void;
  showQrCodes: boolean;
  setShowQrCodes: (show: boolean) => void;
}

export interface ArticlesStats {
  total?: number;
  withImages?: number;
  verified?: number;
}

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmUnsafe?: boolean;
  onConfirm: () => void;
}

export interface ArticlesHeaderProps {
  autoRefresh: boolean;
  setAutoRefresh: (refresh: boolean) => void;
  showQrCodes: boolean;
  setShowQrCodes: (show: boolean) => void;
  selectedCount: number;
  onExport: () => void;
  onGenerateLabels: () => void;
  isGenerating: boolean;
}

export interface ArticlesStatsProps {
  stats: ArticlesStats | undefined;
  selectedCount: number;
  onSelectAll: () => void;
}

export interface ArticlesSearchProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  itemsPerPage: number;
  setItemsPerPage: (items: number) => void;
  setPage: (page: number) => void;
}

export interface ArticlesTableProps {
  articles: Product[];
  isLoading: boolean;
  error: Error | null;
  selectedArticles: Set<string>;
  showQrCodes: boolean;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onEdit: (article: Product) => void;
  onDelete: (id: string) => void;
  onGenerateLabel: (articleId: string) => void;
  isGenerating: boolean;
}

export interface ArticlesBulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onDelete: () => void;
  onExport: () => void;
  onGenerateLabels: () => void;
  isGenerating: boolean;
}

export interface ArticlesTemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  templates: LabelTemplate[];
  selectedTemplateId: string;
  setSelectedTemplateId: (id: string) => void;
  selectedCount: number;
  onGenerate: () => void;
  isGenerating: boolean;
}

export interface ArticlesPaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}
