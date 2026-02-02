import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  Loader2,
  RefreshCw,
  ClipboardCheck,
  FileText,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { dashboardService } from '@/services/dashboard.service';
import { kpiService, type KPISummary, type OverallKPI } from '@/services/kpi.service';
import { KPIGauge } from '@/components/ui/kpi-gauge';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from 'recharts';

// Color palette
const COLORS = {
  primary: 'hsl(var(--primary))',
  compliant: '#22C55E',
  nonCompliant: '#EF4444',
  pending: '#F59E0B',
  inProgress: '#3B82F6',
  closed: '#6B7280',
};

const CAPA_COLORS = ['#F59E0B', '#3B82F6', '#22C55E'];
const PACKAGE_COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

export function DashboardPage() {
  const navigate = useNavigate();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [showPackageDetail, setShowPackageDetail] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await dashboardService.getOverview();
      return response.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch KPI summary for gauges
  const { data: kpiData } = useQuery({
    queryKey: ['kpiSummary'],
    queryFn: async () => {
      const response = await kpiService.getSummary();
      return {
        summary: response.data || [],
        overallKPI: response.overallKPI || null
      };
    },
    refetchInterval: 60000,
  });

  const kpiSummary = kpiData?.summary || [];
  const overallKPI: OverallKPI | null = kpiData?.overallKPI || null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load dashboard</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : 'Unable to connect to the server'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => refetch()} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No data available</CardTitle>
            <CardDescription>
              Run the database seed to populate initial data.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { stats, capaStatus, auditStatus: _auditStatus, packageCompliance, complianceTrend, ncByCategory, recentAudits, recentActivity } = data;

  // Prepare CAPA pie chart data
  const capaChartData = capaStatus ? [
    { name: 'Open', value: capaStatus['Open'] || 0, color: CAPA_COLORS[0] },
    { name: 'In Progress', value: capaStatus['In Progress'] || 0, color: CAPA_COLORS[1] },
    { name: 'Closed', value: capaStatus['Closed'] || 0, color: CAPA_COLORS[2] },
  ].filter(d => d.value > 0) : [];

  // Prepare package comparison data
  const packageChartData = packageCompliance.map((pkg, index) => ({
    name: pkg.packageCode,
    compliance: parseFloat(pkg.compliancePercentage as any),
    ncs: pkg.totalNCs || 0,
    audits: pkg.auditCount || 0,
    fill: PACKAGE_COLORS[index % PACKAGE_COLORS.length],
  }));

  // Selected package data for drill-down
  const selectedPkgData = selectedPackage
    ? packageCompliance.find(p => p.packageCode === selectedPackage)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Safety performance overview</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/reports')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overall Compliance</CardTitle>
            <CheckCircle className="h-4 w-4 text-compliant" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overallCompliance}%</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {stats.complianceChange > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-compliant" />
                  <span className="text-compliant">+{stats.complianceChange}%</span>
                </>
              ) : stats.complianceChange < 0 ? (
                <>
                  <TrendingDown className="h-3 w-3 text-non-compliant" />
                  <span className="text-non-compliant">{stats.complianceChange}%</span>
                </>
              ) : (
                <span>No change</span>
              )}
              {' '}from last month
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/audits')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open NCs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-non-compliant" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openNCs}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {stats.ncChange < 0 ? (
                <>
                  <TrendingDown className="h-3 w-3 text-compliant" />
                  <span className="text-compliant">{stats.ncChange}</span>
                </>
              ) : stats.ncChange > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-non-compliant" />
                  <span className="text-non-compliant">+{stats.ncChange}</span>
                </>
              ) : (
                <span>No change</span>
              )}
              {' '}from last month
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/capa?status=overdue')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">CAPA Overdue</CardTitle>
            <Clock className="h-4 w-4 text-pending" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pending">{stats.capaOverdue}</div>
            <p className="text-xs text-muted-foreground">
              Require immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Days Without LTI</CardTitle>
            <Shield className="h-4 w-4 text-compliant" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-compliant">{stats.daysWithoutLTI}</div>
            <p className="text-xs text-muted-foreground">Keep it going!</p>
          </CardContent>
        </Card>
      </div>

      {/* KPI Gauges Section */}
      {kpiSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Key Performance Indicators
            </CardTitle>
            <CardDescription>Current month KPI performance at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {/* Overall Project KPI */}
              {overallKPI && (
                <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-muted/50 to-muted rounded-xl border">
                  <h3 className="text-lg font-semibold mb-4">Overall Project KPI</h3>
                  <div className="relative">
                    <svg width="200" height="130" viewBox="0 0 200 130">
                      {/* Background arc */}
                      <path
                        d={`M 20 110 A 80 80 0 0 1 180 110`}
                        fill="none"
                        stroke="#E5E7EB"
                        strokeWidth="16"
                        strokeLinecap="round"
                      />
                      {/* Value arc */}
                      <path
                        d={`M 20 110 A 80 80 0 0 1 180 110`}
                        fill="none"
                        stroke={
                          overallKPI.score === null ? '#9CA3AF' :
                          overallKPI.score >= 90 ? '#22C55E' :
                          overallKPI.score >= 75 ? '#84CC16' :
                          overallKPI.score >= 60 ? '#F59E0B' : '#EF4444'
                        }
                        strokeWidth="16"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.PI * 80}`}
                        strokeDashoffset={`${Math.PI * 80 * (1 - (overallKPI.score || 0) / 100)}`}
                        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                      />
                      {/* Score text */}
                      <text
                        x="100"
                        y="75"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={overallKPI.score !== null ? '#111827' : '#9CA3AF'}
                        fontSize="36"
                        fontWeight="bold"
                      >
                        {overallKPI.score !== null ? overallKPI.score : '-'}
                      </text>
                      <text
                        x="100"
                        y="100"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#6B7280"
                        fontSize="14"
                      >
                        %
                      </text>
                    </svg>
                  </div>
                  <Badge
                    variant={
                      overallKPI.status === 'Excellent' ? 'default' :
                      overallKPI.status === 'Good' ? 'secondary' :
                      overallKPI.status === 'Fair' ? 'outline' : 'destructive'
                    }
                    className="mt-2 text-sm px-4 py-1"
                  >
                    {overallKPI.status}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    Based on {overallKPI.kpisWithData} of {overallKPI.totalKPIs} KPIs with data
                  </p>
                </div>
              )}
              {/* Leading Indicators */}
              {kpiSummary.filter((k: KPISummary) => k.type === 'Leading').length > 0 && (
                <div>
                  <h3 className="font-semibold mb-1">Leading Indicators</h3>
                  <p className="text-sm text-muted-foreground mb-4">Proactive safety measures</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                    {kpiSummary
                      .filter((k: KPISummary) => k.type === 'Leading')
                      .map((kpi: KPISummary) => (
                        <KPIGauge
                          key={kpi.indicatorId}
                          value={kpi.actualValue}
                          target={kpi.targetValue}
                          max={Math.max(kpi.targetValue * 1.5, kpi.actualValue * 1.2, 100)}
                          label={kpi.name.length > 18 ? kpi.name.substring(0, 16) + '...' : kpi.name}
                          unit={kpi.unit || '%'}
                          size="md"
                          invertColors={kpi.invertColors}
                        />
                      ))}
                  </div>
                </div>
              )}

              {/* Lagging Indicators */}
              {kpiSummary.filter((k: KPISummary) => k.type === 'Lagging').length > 0 && (
                <div>
                  <h3 className="font-semibold mb-1">Lagging Indicators</h3>
                  <p className="text-sm text-muted-foreground mb-4">Outcome-based safety metrics</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                    {kpiSummary
                      .filter((k: KPISummary) => k.type === 'Lagging')
                      .map((kpi: KPISummary) => (
                        <KPIGauge
                          key={kpi.indicatorId}
                          value={kpi.actualValue}
                          target={kpi.targetValue}
                          max={Math.max(kpi.targetValue * 1.5, kpi.actualValue * 1.2, 100)}
                          label={kpi.name.length > 18 ? kpi.name.substring(0, 16) + '...' : kpi.name}
                          unit={kpi.unit || '%'}
                          size="md"
                          invertColors={kpi.invertColors}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Compliance Trend Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Compliance Trend
                </CardTitle>
                <CardDescription>6-month compliance trend with audit counts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={complianceTrend}>
                  <defs>
                    <linearGradient id="colorCompliance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis domain={[0, 100]} className="text-xs" />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg shadow-lg p-3">
                            <p className="font-medium">{label}</p>
                            <p className="text-sm text-muted-foreground">
                              Compliance: <span className="font-medium text-foreground">{payload[0].value}%</span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Audits: <span className="font-medium text-foreground">{(payload[0].payload as any).auditCount}</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="compliance"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    fill="url(#colorCompliance)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Package Comparison Bar Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Package Comparison
                </CardTitle>
                <CardDescription>Compliance percentage by package</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={packageChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} className="text-xs" />
                  <YAxis dataKey="name" type="category" width={40} className="text-xs" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg shadow-lg p-3">
                            <p className="font-medium">{data.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Compliance: <span className="font-medium text-foreground">{data.compliance}%</span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Audits: <span className="font-medium text-foreground">{data.audits}</span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                              NCs: <span className="font-medium text-foreground">{data.ncs}</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="compliance"
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(data) => {
                      setSelectedPackage(data.name);
                      setShowPackageDetail(true);
                    }}
                  >
                    {packageChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* CAPA Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              CAPA Status
            </CardTitle>
            <CardDescription>Distribution of CAPA statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              {capaChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={capaChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      cursor="pointer"
                      onClick={() => navigate('/capa')}
                    >
                      {capaChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background border rounded-lg shadow-lg p-2">
                              <p className="text-sm">
                                {payload[0].name}: <span className="font-medium">{payload[0].value}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No CAPA data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* NC by Category */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Non-Conformances by Category
            </CardTitle>
            <CardDescription>Top categories with highest NCs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              {ncByCategory && ncByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ncByCategory.slice(0, 6)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="code" type="category" width={30} className="text-xs" />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-background border rounded-lg shadow-lg p-3">
                              <p className="font-medium">{data.code} - {data.name}</p>
                              <p className="text-sm text-muted-foreground">
                                NCs: <span className="font-medium text-foreground">{data.count}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" fill={COLORS.nonCompliant} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No NC data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Package Compliance Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Package Compliance</CardTitle>
            <CardDescription>Click on a package to view details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {packageCompliance.map((pkg, index) => (
                <div
                  key={pkg.packageId}
                  className="space-y-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors -mx-2"
                  onClick={() => {
                    setSelectedPackage(pkg.packageCode);
                    setShowPackageDetail(true);
                  }}
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: PACKAGE_COLORS[index % PACKAGE_COLORS.length] }}
                      />
                      <span className="font-medium">{pkg.packageCode}</span>
                    </div>
                    <span className="font-medium">{pkg.compliancePercentage}%</span>
                  </div>
                  <Progress value={parseFloat(pkg.compliancePercentage as any)} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest system activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity && recentActivity.length > 0 ? (
                recentActivity.slice(0, 6).map((activity, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className={`mt-1 p-1.5 rounded-full ${
                      activity.type === 'audit' ? 'bg-blue-100' : 'bg-orange-100'
                    }`}>
                      {activity.type === 'audit' ? (
                        <ClipboardCheck className="h-3 w-3 text-blue-600" />
                      ) : (
                        <FileText className="h-3 w-3 text-orange-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.reference}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {activity.packageCode}
                        </Badge>
                        <span>{activity.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No recent activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Audits */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Audits</CardTitle>
              <CardDescription>Latest audit activities</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/audits')}>
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAudits.slice(0, 5).map((audit) => (
                <div
                  key={audit.id}
                  className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
                  onClick={() => navigate(`/audits/${audit.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium">{audit.auditNumber}</p>
                    <p className="text-xs text-muted-foreground">{audit.package?.code}</p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        audit.status === 'Approved'
                          ? 'default'
                          : audit.status === 'Pending Review'
                          ? 'secondary'
                          : audit.status === 'In Progress'
                          ? 'outline'
                          : 'secondary'
                      }
                      className="text-xs"
                    >
                      {audit.status}
                    </Badge>
                    {audit.compliancePercentage && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {audit.compliancePercentage}%
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Package Detail Dialog */}
      <Dialog open={showPackageDetail} onOpenChange={setShowPackageDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Package Details - {selectedPackage}</DialogTitle>
            <DialogDescription>
              {selectedPkgData?.packageName}
            </DialogDescription>
          </DialogHeader>
          {selectedPkgData && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {selectedPkgData.compliancePercentage}%
                  </div>
                  <div className="text-sm text-muted-foreground">Compliance</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">
                    {selectedPkgData.auditCount || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Audits</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-destructive">
                    {selectedPkgData.totalNCs || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Open NCs</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Compliance Score</div>
                <Progress value={parseFloat(selectedPkgData.compliancePercentage as any)} className="h-3" />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    setShowPackageDetail(false);
                    navigate(`/audits?packageId=${selectedPkgData.packageId}`);
                  }}
                >
                  View Audits
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowPackageDetail(false);
                    navigate(`/reports?packageId=${selectedPkgData.packageId}`);
                  }}
                >
                  View Reports
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
