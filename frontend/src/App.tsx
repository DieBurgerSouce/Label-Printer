import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from './components/common/ErrorBoundary';
import Layout from './components/common/Layout';
import { STALE_TIMES } from './lib/queryConfig';

// Initialize i18n (must be imported early)
import './i18n';

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
  </div>
);

// Lazy-loaded page components for code-splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LabelLibrary = lazy(() => import('./pages/LabelLibrary'));
const ExcelImport = lazy(() => import('./pages/ExcelImport'));
const ExcelImportNew = lazy(() => import('./pages/ExcelImportNew'));
const PrintSetup = lazy(() => import('./pages/PrintSetup'));
const PrintPreview = lazy(() => import('./pages/PrintPreview'));
const Templates = lazy(() => import('./pages/Templates'));
const PrintTemplates = lazy(() => import('./pages/PrintTemplates'));
const Settings = lazy(() => import('./pages/Settings'));
const LivePreview = lazy(() =>
  import('./pages/LivePreview').then((m) => ({ default: m.LivePreview }))
);
const JobMonitor = lazy(() => import('./pages/JobMonitor'));
const ShopAutomation = lazy(() => import('./pages/ShopAutomation'));
const Articles = lazy(() => import('./pages/Articles'));
const LabelTemplateEditor = lazy(() => import('./pages/LabelTemplateEditor'));
const RenderingTemplates = lazy(() => import('./pages/RenderingTemplates'));
const RenderingTemplateEditor = lazy(() => import('./pages/RenderingTemplateEditor'));

// Create React Query client - Version 2.1.0
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: STALE_TIMES.LABELS, // Default to 30 seconds
      gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes
    },
    mutations: {
      retry: 0, // Don't retry failed mutations
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="automation" element={<ShopAutomation />} />
                <Route path="articles" element={<Articles />} />
                <Route path="labels" element={<LabelLibrary />} />
                <Route path="labeltemplate" element={<LabelTemplateEditor />} />
                <Route path="excel" element={<ExcelImport />} />
                <Route path="excel-import" element={<ExcelImportNew />} />
                <Route path="print-setup" element={<PrintSetup />} />
                <Route path="print" element={<PrintPreview />} />
                <Route path="preview" element={<LivePreview />} />
                <Route path="templates" element={<Templates />} />
                <Route path="rendering-templates" element={<RenderingTemplates />} />
                <Route path="rendering-template-editor" element={<RenderingTemplateEditor />} />
                <Route path="print-templates" element={<PrintTemplates />} />
                <Route path="settings" element={<Settings />} />
                <Route path="jobs/:jobId" element={<JobMonitor />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
