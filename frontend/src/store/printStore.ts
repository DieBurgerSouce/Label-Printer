import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface PaperFormat {
  type: 'A3' | 'A4' | 'A5' | 'Letter' | 'Custom';
  width: number; // mm
  height: number; // mm
  orientation: 'portrait' | 'landscape';
}

export interface GridConfig {
  columns: number;
  rows: number;
  spacing: number; // mm
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface PrintLayout {
  labelIds: string[];
  paperFormat: PaperFormat;
  gridLayout: GridConfig;
  settings: {
    showCutMarks: boolean;
    showBorders: boolean;
    labelScale: 'fit' | 'fill' | 'custom';
    dpi: number;
  };
}

interface PrintState {
  // Layout configuration
  layout: PrintLayout;
  previewImage?: string;

  // UI State
  isGeneratingPreview: boolean;
  isExporting: boolean;

  // Actions
  setLayout: (layout: Partial<PrintLayout>) => void;
  setPaperFormat: (format: Partial<PaperFormat>) => void;
  setGridConfig: (grid: Partial<GridConfig>) => void;
  setSettings: (settings: Partial<PrintLayout['settings']>) => void;
  addLabelToLayout: (labelId: string) => void;
  removeLabelFromLayout: (labelId: string) => void;
  clearLayout: () => void;
  resetLayout: () => void;
  setPreviewImage: (image?: string) => void;
  setIsGeneratingPreview: (value: boolean) => void;
  setIsExporting: (value: boolean) => void;
}

const defaultLayout: PrintLayout = {
  labelIds: [],
  paperFormat: {
    type: 'A4',
    width: 210,
    height: 297,
    orientation: 'portrait',
  },
  gridLayout: {
    columns: 2,
    rows: 3,
    spacing: 5,
    margins: {
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    },
  },
  settings: {
    showCutMarks: true,
    showBorders: false,
    labelScale: 'fit',
    dpi: 300,
  },
};

export const usePrintStore = create<PrintState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        layout: defaultLayout,
        previewImage: undefined,
        isGeneratingPreview: false,
        isExporting: false,

        // Actions
        setLayout: (layout) =>
          set((state) => ({
            layout: { ...state.layout, ...layout },
          })),

        setPaperFormat: (format) =>
          set((state) => ({
            layout: {
              ...state.layout,
              paperFormat: { ...state.layout.paperFormat, ...format },
            },
          })),

        setGridConfig: (grid) =>
          set((state) => ({
            layout: {
              ...state.layout,
              gridLayout: { ...state.layout.gridLayout, ...grid },
            },
          })),

        setSettings: (settings) =>
          set((state) => ({
            layout: {
              ...state.layout,
              settings: { ...state.layout.settings, ...settings },
            },
          })),

        addLabelToLayout: (labelId) =>
          set((state) => ({
            layout: {
              ...state.layout,
              labelIds: [...state.layout.labelIds, labelId],
            },
          })),

        removeLabelFromLayout: (labelId) =>
          set((state) => ({
            layout: {
              ...state.layout,
              labelIds: state.layout.labelIds.filter((id) => id !== labelId),
            },
          })),

        clearLayout: () =>
          set((state) => ({
            layout: { ...state.layout, labelIds: [] },
          })),

        resetLayout: () => set({ layout: defaultLayout }),

        setPreviewImage: (image) => set({ previewImage: image }),
        setIsGeneratingPreview: (value) => set({ isGeneratingPreview: value }),
        setIsExporting: (value) => set({ isExporting: value }),
      }),
      {
        name: 'print-layout-storage', // localStorage key
        partialize: (state) => ({
          layout: state.layout, // Only persist the layout, not UI state
        }),
      }
    ),
    { name: 'PrintStore' }
  )
);
