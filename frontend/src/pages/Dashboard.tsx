import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Package, Printer, ShoppingCart, Tags, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { excelApi, labelApi } from '../services/api';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  className?: string; // Replace color with className for flexibility
  iconClassName?: string;
  link?: string;
}

function StatsCard({ title, value, icon: Icon, className, iconClassName, link }: StatsCardProps) {
  const content = (
    <Card className={`hover:shadow-md transition-all cursor-pointer ${className}`}>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <div className={`p-3 rounded-full bg-primary/10 ${iconClassName}`}>
          <Icon className="w-6 h-6" />
        </div>
      </CardContent>
    </Card>
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
      iconClassName: "text-blue-500 bg-blue-50",
      link: '/labels',
    },
    {
      title: 'Products',
      value: (excelStats?.data as any)?.totalProducts || 0,
      icon: FileSpreadsheet,
      iconClassName: "text-green-500 bg-green-50",
      link: '/excel',
    },
    {
      title: 'Print Jobs',
      value: 0, // TODO: Implement print job tracking
      icon: Printer,
      iconClassName: "text-purple-500 bg-purple-50",
      link: '/print',
    },
    {
      title: 'This Month',
      value: (labelStats?.data as any)?.thisMonth || 0,
      icon: TrendingUp,
      iconClassName: "text-orange-500 bg-orange-50",
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
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage your store effectively</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/automation">
              <Button variant="outline" className="h-auto w-full flex-col p-6 items-start gap-2 hover:border-blue-500 hover:bg-blue-50">
                <ShoppingCart className="w-8 h-8 text-blue-600 mb-2" />
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-lg">Shop Automation</span>
                  <span className="text-xs text-muted-foreground whitespace-normal text-left">Automatisch alle Artikel importieren</span>
                </div>
              </Button>
            </Link>

            <Link to="/articles">
              <Button variant="outline" className="h-auto w-full flex-col p-6 items-start gap-2 hover:border-green-500 hover:bg-green-50">
                <Package className="w-8 h-8 text-green-600 mb-2" />
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-lg">Artikel Verwalten</span>
                  <span className="text-xs text-muted-foreground whitespace-normal text-left">Gecrawlte Artikel anzeigen & bearbeiten</span>
                </div>
              </Button>
            </Link>

            <Link to="/labels">
              <Button variant="outline" className="h-auto w-full flex-col p-6 items-start gap-2 hover:border-primary hover:bg-primary/5">
                <Tags className="w-8 h-8 text-primary mb-2" />
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-lg">Create Label</span>
                  <span className="text-xs text-muted-foreground whitespace-normal text-left">Extract from screenshot or create manually</span>
                </div>
              </Button>
            </Link>

            <Link to="/excel">
              <Button variant="outline" className="h-auto w-full flex-col p-6 items-start gap-2 hover:border-green-500 hover:bg-green-50">
                <FileSpreadsheet className="w-8 h-8 text-green-600 mb-2" />
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-lg">Import Excel</span>
                  <span className="text-xs text-muted-foreground whitespace-normal text-left">Upload product descriptions from Excel</span>
                </div>
              </Button>
            </Link>

             <Link to="/print">
              <Button variant="outline" className="h-auto w-full flex-col p-6 items-start gap-2 hover:border-purple-500 hover:bg-purple-50">
                <Printer className="w-8 h-8 text-purple-600 mb-2" />
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-lg">Print Setup</span>
                  <span className="text-xs text-muted-foreground whitespace-normal text-left">Configure and export print layouts</span>
                </div>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(loadingLabels || loadingExcel) ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <p className="text-muted-foreground">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
