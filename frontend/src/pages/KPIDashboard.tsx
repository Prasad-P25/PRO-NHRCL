import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Building2,
  Activity,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';

import { useAppStore } from '@/store/appStore';
import { ProjectGuard } from '@/components/ProjectGuard';
import { ListPageSkeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/services/api';

interface TrendData {
  month: number;
  year: number;
  monthLabel: string;
  target: number | null;
  actual: number | null;
  manHours: number;
  incidents: number;
}

interface IndicatorTrend {
  id: number;
  name: string;
  type: 'Leading' | 'Lagging';
  unit?: string;
  benchmarkValue?: number;
  data: TrendData[];
}

export function KPIDashboardPage() {
  const currentProject = useAppStore((state) => state.currentProject);
  const [timeRange, setTimeRange] = useState<string>('12');

  // Fetch KPI trends
  const { data: trendsData, isLoading } = useQuery({
    queryKey: ['kpi-trends', currentProject?.id, timeRange],
    queryFn: async () => {
      const params: Record<string, string> = { months: timeRange };
      const response = await api.get('/kpi/trends', { params });
      return response.data.data as IndicatorTrend[];
    },
    enabled: !!currentProject,
  });

  // Fetch KPI summary for current status
  const { data: summaryData } = useQuery({
    queryKey: ['kpi-summary', currentProject?.id],
    queryFn: async () => {
      const response = await api.get('/kpi/summary');
      return response.data;
    },
    enabled: !!currentProject,
  });

  if (isLoading) {
    return <ListPageSkeleton />;
  }

  const leadingIndicators = trendsData?.filter((i) => i.type === 'Leading') || [];
  const laggingIndicators = trendsData?.filter((i) => i.type === 'Lagging') || [];

  // Calculate alerts (KPIs below target)
  const alerts = summaryData?.data?.filter((kpi: any) => {
    if (kpi.actualValue === null) return false;
    const isLowerBetter = kpi.invertColors;
    if (isLowerBetter) {
      return kpi.actualValue > (kpi.targetValue || kpi.benchmarkValue || 0);
    }
    return kpi.actualValue < (kpi.targetValue || kpi.benchmarkValue || 0) * 0.9;
  }) || [];

  const getStatusColor = (indicator: IndicatorTrend) => {
    const lastData = indicator.data[indicator.data.length - 1];
    if (!lastData?.actual) return 'text-muted-foreground';

    const isLowerBetter = indicator.name.includes('LTIFR') ||
      indicator.name.includes('Fatality') ||
      indicator.name.includes('Incident');

    const target = lastData.target || indicator.benchmarkValue || 0;

    if (isLowerBetter) {
      return lastData.actual <= target ? 'text-green-600' : 'text-red-600';
    }
    return lastData.actual >= target ? 'text-green-600' : 'text-red-600';
  };

  const renderTrendChart = (indicator: IndicatorTrend) => {
    const hasData = indicator.data.some((d) => d.actual !== null);
    if (!hasData) {
      return (
        <div className="flex items-center justify-center h-[200px] text-muted-foreground">
          No data available
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={indicator.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {indicator.benchmarkValue && (
            <ReferenceLine
              y={indicator.benchmarkValue}
              stroke="#888"
              strokeDasharray="5 5"
              label={{ value: 'Benchmark', position: 'right', fontSize: 10 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="target"
            stroke="#3b82f6"
            strokeDasharray="5 5"
            name="Target"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#22c55e"
            strokeWidth={2}
            name="Actual"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <ProjectGuard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">KPI Dashboard</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {currentProject?.name || 'Select a project'}
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
                <SelectItem value="24">Last 24 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Overall Score & Alerts */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall KPI Score</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {summaryData?.overallKPI?.score ?? '-'}%
              </div>
              <Badge
                variant={
                  summaryData?.overallKPI?.status === 'Excellent' ? 'default' :
                  summaryData?.overallKPI?.status === 'Good' ? 'secondary' :
                  summaryData?.overallKPI?.status === 'Fair' ? 'outline' :
                  'destructive'
                }
                className="mt-2"
              >
                {summaryData?.overallKPI?.status || 'No Data'}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">KPIs on Target</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {(summaryData?.overallKPI?.kpisWithData || 0) - alerts.length}
                <span className="text-lg text-muted-foreground">
                  /{summaryData?.overallKPI?.kpisWithData || 0}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                with data this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {alerts.length}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                KPIs below target
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts List */}
        {alerts.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                KPI Alerts
              </CardTitle>
              <CardDescription className="text-red-700">
                The following KPIs are below their target values
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alerts.map((alert: any) => (
                  <div key={alert.indicatorId} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div>
                      <span className="font-medium">{alert.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">({alert.type})</span>
                    </div>
                    <div className="text-right">
                      <span className="text-red-600 font-medium">{alert.actualValue}</span>
                      <span className="text-muted-foreground mx-2">vs target</span>
                      <span className="text-green-600">{alert.targetValue || alert.benchmarkValue}</span>
                      {alert.unit && <span className="text-muted-foreground ml-1">{alert.unit}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trend Charts */}
        <Tabs defaultValue="leading">
          <TabsList>
            <TabsTrigger value="leading" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Leading ({leadingIndicators.length})
            </TabsTrigger>
            <TabsTrigger value="lagging" className="gap-2">
              <TrendingDown className="h-4 w-4" />
              Lagging ({laggingIndicators.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leading" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {leadingIndicators.map((indicator) => (
                <Card key={indicator.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{indicator.name}</CardTitle>
                      <span className={`text-sm font-medium ${getStatusColor(indicator)}`}>
                        {indicator.data[indicator.data.length - 1]?.actual ?? '-'}
                        {indicator.unit && ` ${indicator.unit}`}
                      </span>
                    </div>
                    {indicator.benchmarkValue && (
                      <CardDescription>
                        Benchmark: {indicator.benchmarkValue} {indicator.unit}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {renderTrendChart(indicator)}
                  </CardContent>
                </Card>
              ))}
              {leadingIndicators.length === 0 && (
                <Card className="col-span-2">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No leading indicator data available
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="lagging" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {laggingIndicators.map((indicator) => (
                <Card key={indicator.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{indicator.name}</CardTitle>
                      <span className={`text-sm font-medium ${getStatusColor(indicator)}`}>
                        {indicator.data[indicator.data.length - 1]?.actual ?? '-'}
                        {indicator.unit && ` ${indicator.unit}`}
                      </span>
                    </div>
                    {indicator.benchmarkValue && (
                      <CardDescription>
                        Benchmark: {indicator.benchmarkValue} {indicator.unit}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {renderTrendChart(indicator)}
                  </CardContent>
                </Card>
              ))}
              {laggingIndicators.length === 0 && (
                <Card className="col-span-2">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No lagging indicator data available
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ProjectGuard>
  );
}

export default KPIDashboardPage;
