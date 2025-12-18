import {
    Eye,
    FileSpreadsheet,
    LayoutDashboard,
    Layout as LayoutIcon,
    Package,
    Printer,
    Settings,
    Tags,
    X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useUiStore } from '../../store/uiStore';

const navigation = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Label Bibliothek', to: '/labels', icon: Tags },
  { name: 'Artikel Verwaltung', to: '/articles', icon: Package },
  { name: 'Excel Import', to: '/excel-import', icon: FileSpreadsheet },
  { name: 'Druck Setup', to: '/print-setup', icon: Printer },
  { name: 'Live Vorschau', to: '/preview', icon: Eye },
  { name: 'Label Templates', to: '/templates', icon: LayoutIcon },
  { name: 'Druck Templates', to: '/print-templates', icon: Printer },
  { name: 'Einstellungen', to: '/settings', icon: Settings },
];

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useUiStore();

  if (!sidebarOpen) return null;

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 bg-gray-900/50 lg:hidden z-40"
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className="fixed top-0 left-0 z-50 h-screen w-64 bg-white border-r border-gray-200 transition-transform">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-primary-600">Label Printer</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Version 1.0.0
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
