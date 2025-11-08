import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Tags, FileSpreadsheet, Printer, TrendingUp, ShoppingCart, Package } from 'lucide-react';
import { labelApi, excelApi } from '../services/api';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  link?: string;
}

function StatsCard({ title, value, icon: Icon, color, link }: StatsCardProps) {
  const content = (
    <div className={`card hover:shadow-lg transition-shadow cursor-pointer border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <div className={`p-4 rounded-lg ${color.replace('border-', 'bg-').replace('-500', '-100')}`}>
          <Icon className={`w-8 h-8 ${color.replace('border-', 'text-')}`} />
        </div>
      </div>
    </div>
  );

  return link ? <Link to={link}>{content}</Link> : content;
}

export default function Dashboard() {
  // Fetch label stats
  const { data: labelStats, isLoading: loadingLabels } = useQuery({
    queryKey: ['labelStats'],
    queryFn: () => labelApi.getStats(),
  });

  // Fetch Excel stats
  const { data: excelStats, isLoading: loadingExcel } = useQuery({
    queryKey: ['excelStats'],
    queryFn: () => excelApi.getStats(),
  });

  const stats = [
    {
      title: 'Total Labels',
      value: (labelStats?.data as any)?.totalLabels || 0,
      icon: Tags,
      color: 'border-primary-500',
      link: '/labels',
    },
    {
      title: 'Products',
      value: (excelStats?.data as any)?.totalProducts || 0,
      icon: FileSpreadsheet,
      color: 'border-green-500',
      link: '/excel',
    },
    {
      title: 'Print Jobs',
      value: 0, // TODO: Implement print job tracking
      icon: Printer,
      color: 'border-purple-500',
      link: '/print',
    },
    {
      title: 'This Month',
      value: (labelStats?.data as any)?.thisMonth || 0,
      icon: TrendingUp,
      color: 'border-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome to your label management system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <StatsCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/automation"
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <ShoppingCart className="w-8 h-8 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold mb-1">Shop Automation</h3>
            <p className="text-sm text-gray-600">Automatisch alle Artikel importieren</p>
          </Link>

          <Link
            to="/articles"
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all group"
          >
            <Package className="w-8 h-8 text-green-600 mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold mb-1">Artikel Verwalten</h3>
            <p className="text-sm text-gray-600">Gecrawlte Artikel anzeigen & bearbeiten</p>
          </Link>

          <Link
            to="/labels"
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all"
          >
            <Tags className="w-8 h-8 text-primary-600 mb-2" />
            <h3 className="font-semibold mb-1">Create Label</h3>
            <p className="text-sm text-gray-600">Extract from screenshot or create manually</p>
          </Link>

          <Link
            to="/excel"
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all"
          >
            <FileSpreadsheet className="w-8 h-8 text-green-600 mb-2" />
            <h3 className="font-semibold mb-1">Import Excel</h3>
            <p className="text-sm text-gray-600">Upload product descriptions from Excel</p>
          </Link>

          <Link
            to="/print"
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all"
          >
            <Printer className="w-8 h-8 text-purple-600 mb-2" />
            <h3 className="font-semibold mb-1">Print Setup</h3>
            <p className="text-sm text-gray-600">Configure and export print layouts</p>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {(loadingLabels || loadingExcel) ? (
            <p className="text-gray-500">Loading...</p>
          ) : (
            <p className="text-gray-500">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
