import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface QRCodeSettings {
  enabled: boolean;
  position: { x: number; y: number }; // Position on label in mm
  size: number; // Size in mm
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'; // Low, Medium, Quality, High
}

export interface PriceLabel {
  id: string;
  articleNumber: string;
  productName: string;
  description?: string;
  priceInfo: {
    price: number;
    currency: string;
    unit?: string;
    staffelpreise?: Array<{ quantity: number; price: number }>;
  };
  imageData?: string; // base64
  templateType: 'minimal' | 'standard' | 'extended' | 'custom';
  createdAt: Date;
  updatedAt?: Date;
  tags?: string[];
  category?: string;

  // QR-Code Feature
  shopUrl?: string; // URL to product shop page
  qrCode?: QRCodeSettings; // QR-Code configuration
}

interface LabelState {
  // Data
  labels: PriceLabel[];
  selectedLabels: string[];
  currentLabel: PriceLabel | null;

  // UI State
  viewMode: 'grid' | 'list';
  filterCategory?: string;
  searchQuery: string;

  // Actions
  setLabels: (labels: PriceLabel[]) => void;
  addLabel: (label: PriceLabel) => void;
  updateLabel: (id: string, updates: Partial<PriceLabel>) => void;
  removeLabel: (id: string) => void;

  // Selection
  selectLabel: (id: string) => void;
  deselectLabel: (id: string) => void;
  toggleLabelSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;

  // UI
  setViewMode: (mode: 'grid' | 'list') => void;
  setFilterCategory: (category?: string) => void;
  setSearchQuery: (query: string) => void;
  setCurrentLabel: (label: PriceLabel | null) => void;
}

export const useLabelStore = create<LabelState>()(
  devtools(
    (set) => ({
      // Initial state
      labels: [],
      selectedLabels: [],
      currentLabel: null,
      viewMode: 'grid',
      searchQuery: '',

      // Actions
      setLabels: (labels) => set({ labels }),

      addLabel: (label) =>
        set((state) => ({
          labels: [label, ...state.labels],
        })),

      updateLabel: (id, updates) =>
        set((state) => ({
          labels: state.labels.map((label) =>
            label.id === id ? { ...label, ...updates, updatedAt: new Date() } : label
          ),
        })),

      removeLabel: (id) =>
        set((state) => ({
          labels: state.labels.filter((label) => label.id !== id),
          selectedLabels: state.selectedLabels.filter((selectedId) => selectedId !== id),
        })),

      // Selection
      selectLabel: (id) =>
        set((state) => ({
          selectedLabels: state.selectedLabels.includes(id)
            ? state.selectedLabels
            : [...state.selectedLabels, id],
        })),

      deselectLabel: (id) =>
        set((state) => ({
          selectedLabels: state.selectedLabels.filter((selectedId) => selectedId !== id),
        })),

      toggleLabelSelection: (id) =>
        set((state) => ({
          selectedLabels: state.selectedLabels.includes(id)
            ? state.selectedLabels.filter((selectedId) => selectedId !== id)
            : [...state.selectedLabels, id],
        })),

      clearSelection: () => set({ selectedLabels: [] }),

      selectAll: () =>
        set((state) => ({
          selectedLabels: state.labels.map((label) => label.id),
        })),

      // UI
      setViewMode: (mode) => set({ viewMode: mode }),
      setFilterCategory: (category) => set({ filterCategory: category }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setCurrentLabel: (label) => set({ currentLabel: label }),
    }),
    { name: 'LabelStore' }
  )
);
