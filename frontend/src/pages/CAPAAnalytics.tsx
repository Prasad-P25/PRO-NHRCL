import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Clock,
  TrendingUp,
  Calendar,
  Package,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { format } from 'date-fns';

import { useAppStore } from '@/store/appStore';
import { ProjectGuard } from '@/components/ProjectGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ListPageSkeleton } from '@/components/ui/skeleton';
import api from '@/services/api';

interface AnalyticsData {
  statusBreakdown: Record<string, number>;
  overdueAnalysis: {
    overdue: number;
    dueThisWeek: number;
    onTrack: number;
    closed: number;
  };
  byPackage: {
    packageCode: string;
    packageName: string;
    total: number;
    open: number;
    inProgress: number;
    closed: number;
  }[];
  monthlyTrend: {
    month: string;
    created: number;
    closed: number;
  }[];
  avgClosureDays: string;
  topOverdue: {
    id: number;
    capaNumber: string;
    finding: string;
    targetDate: string;
    status: string;
    packageCode: string;
    daysOverdue: number;
  }[];
}

const STATUS_COLORS = {
  Open: '#f59e0b',
  'In Progress': '#3b82f6',
  Closed: '#22c55e',
};

export function CAPAAnalyticsPage() {
  const currentProject = useAppStore((state) => state.currentProject);

  const { data, isLoading } = useQuery({
    queryKey: ['capa-analytics', currentProject?.id],
    queryFn: async () => {
      const response = await api.get('/capa/analytics');
      return response.data.data as AnalyticsData;
    },
    enabled: !!currentProject,
  });

  if (isLoading) {
    return <ListPageSkeleton />;
  }

  const statusData = Object.entries(data?.statusBreakdown || {}).map(([name, value]) => ({
    name,
    value,
    color: STATUS_COLORS[name as keyof typeof STATUS_COLORS] || '#94a3b8',
  }));

  const overdueData = [
    { name: 'Overdue', value: data?.overdueAnalysis.overdue || 0, color: '#ef4444' },
    { name: 'Due This Week', value: data?.overdueAnalysis.dueThisWeek || 0, color: '#f97316' },
    { name: 'On Track', value: data?.overdueAnalysis.onTrack || 0, color: '#22c55e' },
  ].filter((d) => d.value > 0);

  const totalCapas = Object.values(data?.statusBreakdown || {}).reduce((a, b) => a + b, 0);
  const closureRate = totalCapas > 0
    ? ((data?.statusBreakdown.Closed || 0) / totalCapas * 100).toFixed(1)
    : '0';

  return (
    <ProjectGuard>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">CAPA Analytics</h1>
          <p className="text-muted-foreground">
            Corrective and Preventive Action analysis for {currentProject?.name}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total CAPAs</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalCapas}</div>
              <p className="text-sm text-muted-foreground">
                All time records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <Clock className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {data?.overdueAnalysis.overdue || 0}
              </div>
              <p className="text-sm text-muted-foreground">
                Require immediate attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Closure Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{closureRate}%</div>
              <p className="text-sm text-muted-foreground">
                Of all CAPAs closed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Closure Time</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{data?.avgClosureDays || '0'}</div>
              <p className="text-sm text-muted-foreground">
                Days to close
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
              <CardDescription>CAPA status breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Overdue Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline Analysis</CardTitle>
              <CardDescription>CAPA deadlines status</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={overdueData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {overdueData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Trend</CardTitle>
            <CardDescription>CAPAs created vs closed over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data?.monthlyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="created"
                  name="Created"
                  stroke="#f59e0b"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="closed"
                  name="Closed"
                  stroke="#22c55e"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By Package */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              CAPAs by Package
            </CardTitle>
            <CardDescription>Distribution across packages</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.byPackage || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="packageCode" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="open" name="Open" stackId="a" fill="#f59e0b" />
                <Bar dataKey="inProgress" name="In Progress" stackId="a" fill="#3b82f6" />
                <Bar dataKey="closed" name="Closed" stackId="a" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Overdue CAPAs */}
        {(data?.topOverdue?.length || 0) > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Most Overdue CAPAs
              </CardTitle>
              <CardDescription className="text-red-700">
                CAPAs requiring immediate attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data?.topOverdue.map((capa) => (
                  <div
                    key={capa.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{capa.capaNumber}</span>
                        <Badge variant="outline">{capa.packageCode}</Badge>
                        <Badge variant="secondary">{capa.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {capa.finding}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-red-600 font-bold">
                        {capa.daysOverdue} days overdue
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Due: {format(new Date(capa.targetDate), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ProjectGuard>
  );
}

export default CAPAAnalyticsPage;
