import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Toast from './Toast';
import { useUiStore } from '../../store/uiStore';

export default function Layout() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        <Header />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
      <Toast />
    </div>
  );
}
