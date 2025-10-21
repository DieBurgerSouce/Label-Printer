import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface Modal {
  id: string;
  title: string;
  content: React.ReactNode;
  onClose?: () => void;
}

interface UiState {
  // Toasts
  toasts: Toast[];

  // Modals
  modals: Modal[];

  // Loading states
  globalLoading: boolean;

  // Sidebar
  sidebarOpen: boolean;

  // Canvas & Preview
  zoom: number;
  showGrid: boolean;
  showRulers: boolean;

  // Actions
  showToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  showModal: (modal: Omit<Modal, 'id'>) => void;
  closeModal: (id: string) => void;
  setGlobalLoading: (loading: boolean) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  toggleRulers: () => void;
}

export const useUiStore = create<UiState>()(
  devtools(
    (set) => ({
      // Initial state
      toasts: [],
      modals: [],
      globalLoading: false,
      sidebarOpen: true,
      zoom: 1,
      showGrid: true,
      showRulers: true,

      // Actions
      showToast: (toast) => {
        const id = Math.random().toString(36).substring(7);
        const newToast = { ...toast, id };

        set((state) => ({
          toasts: [...state.toasts, newToast],
        }));

        // Auto-remove after duration
        const duration = toast.duration || 5000;
        setTimeout(() => {
          set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
          }));
        }, duration);
      },

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      showModal: (modal) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({
          modals: [...state.modals, { ...modal, id }],
        }));
      },

      closeModal: (id) =>
        set((state) => ({
          modals: state.modals.filter((m) => m.id !== id),
        })),

      setGlobalLoading: (loading) => set({ globalLoading: loading }),

      toggleSidebar: () =>
        set((state) => ({
          sidebarOpen: !state.sidebarOpen,
        })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setZoom: (zoom) => set({ zoom }),

      toggleGrid: () =>
        set((state) => ({
          showGrid: !state.showGrid,
        })),

      toggleRulers: () =>
        set((state) => ({
          showRulers: !state.showRulers,
        })),
    }),
    { name: 'UiStore' }
  )
);
