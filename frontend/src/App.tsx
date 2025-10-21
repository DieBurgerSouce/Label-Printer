import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/common/Layout';
import Dashboard from './pages/Dashboard';
import LabelLibrary from './pages/LabelLibrary';
import ExcelImport from './pages/ExcelImport';
import PrintSetup from './pages/PrintSetup';
import Templates from './pages/Templates';
import Settings from './pages/Settings';
import { LivePreview } from './pages/LivePreview';
import JobMonitor from './pages/JobMonitor';
import ShopAutomation from './pages/ShopAutomation';
import Articles from './pages/Articles';
import LabelTemplateEditor from './pages/LabelTemplateEditor';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="automation" element={<ShopAutomation />} />
            <Route path="articles" element={<Articles />} />
            <Route path="labels" element={<LabelLibrary />} />
            <Route path="labeltemplate" element={<LabelTemplateEditor />} />
            <Route path="excel" element={<ExcelImport />} />
            <Route path="print" element={<PrintSetup />} />
            <Route path="preview" element={<LivePreview />} />
            <Route path="templates" element={<Templates />} />
            <Route path="settings" element={<Settings />} />
            <Route path="jobs/:jobId" element={<JobMonitor />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
