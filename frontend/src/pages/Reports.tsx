import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format as formatDate } from 'date-fns';
import {
  FileText,
  Download,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  BarChart3,
  Activity,
  FileSpreadsheet,
  Clock,
  Calendar,
  Play,
  Pause,
  Trash2,
  Plus,
  History,
  RefreshCw,
  Building2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

import { useAppStore } from '@/store/appStore';
import { ProjectGuard } from '@/components/ProjectGuard';
import reportService, { type ReportFilters } from '@/services/report.service';
import scheduledReportService, {
  type ScheduledReport,
  type CreateScheduledReportData,
} from '@/services/scheduled-report.service';
import { exportReport, type ExportFormat, type ExportColumn } from '@/lib/export';
import api from '@/services/api';
import type { Package } from '@/types';

const REPORT_TYPES = [
  { value: 'compliance', label: 'Compliance Summary' },
  { value: 'ncs', label: 'Non-Conformances' },
  { value: 'capa', label: 'CAPA Status' },
  { value: 'trends', label: 'Trend Analysis' },
  { value: 'comparison', label: 'Package Comparison' },
  { value: 'kpi', label: 'KPI Report' },
];

const SCHEDULE_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function ReportsPage() {
  const queryClient = useQueryClient();
  const currentProject = useAppStore((state) => state.currentProject);
  const [activeTab, setActiveTab] = useState('compliance');
  const [filters, setFilters] = useState<ReportFilters>({});
  const [selectedPackageId, setSelectedPackageId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [kpiMonth, setKpiMonth] = useState<number>(new Date().getMonth() + 1);
  const [kpiYear, setKpiYear] = useState<number>(new Date().getFullYear());

  // Scheduled reports state
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledReport | null>(null);
  const [scheduleForm, setScheduleForm] = useState<CreateScheduledReportData>({
    name: '',
    reportType: 'compliance',
    format: 'pdf',
    scheduleType: 'weekly',
    scheduleDay: 1,
    scheduleTime: '08:00',
    recipients: [],
    isActive: true,
  });

  // Fetch packages for filter
  const { data: packagesData } = useQuery({
    queryKey: ['packages', currentProject?.id],
    queryFn: async () => {
      const response = await api.get('/packages');
      return response.data.data as Package[];
    },
  });

  // Update filters when selection changes
  useEffect(() => {
    const newFilters: ReportFilters = {};
    if (selectedPackageId !== 'all') {
      newFilters.packageId = parseInt(selectedPackageId);
    }
    if (startDate) {
      newFilters.startDate = startDate;
    }
    if (endDate) {
      newFilters.endDate = endDate;
    }
    setFilters(newFilters);
  }, [selectedPackageId, startDate, endDate]);

  // Compliance Summary query
  const { data: complianceData, isLoading: complianceLoading } = useQuery({
    queryKey: ['compliance-summary', filters, currentProject?.id],
    queryFn: () => reportService.getComplianceSummary(filters),
    enabled: activeTab === 'compliance',
  });

  // NC Summary query
  const { data: ncData, isLoading: ncLoading } = useQuery({
    queryKey: ['nc-summary', filters, currentProject?.id],
    queryFn: () => reportService.getNCsSummary(filters),
    enabled: activeTab === 'ncs',
  });

  // CAPA Status query
  const { data: capaData, isLoading: capaLoading } = useQuery({
    queryKey: ['capa-status', filters, currentProject?.id],
    queryFn: () => reportService.getCAPAStatus(filters),
    enabled: activeTab === 'capa',
  });

  // Trend Analysis query
  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['trend-analysis', filters, currentProject?.id],
    queryFn: () => reportService.getTrendAnalysis({ ...filters, months: 12 }),
    enabled: activeTab === 'trends',
  });

  // Package Comparison query
  const { data: comparisonData, isLoading: comparisonLoading } = useQuery({
    queryKey: ['package-comparison', currentProject?.id],
    queryFn: () => reportService.getPackageComparison(),
    enabled: activeTab === 'comparison',
  });

  // KPI Report query
  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ['kpi-report', selectedPackageId, kpiMonth, kpiYear, currentProject?.id],
    queryFn: () =>
      reportService.getKPISummary({
        packageId: selectedPackageId !== 'all' ? parseInt(selectedPackageId) : undefined,
        periodMonth: kpiMonth,
        periodYear: kpiYear,
      }),
    enabled: activeTab === 'kpi',
  });

  // Scheduled reports query
  const { data: scheduledReportsData, isLoading: scheduledLoading } = useQuery({
    queryKey: ['scheduled-reports'],
    queryFn: () => scheduledReportService.getAll(),
    enabled: activeTab === 'scheduled',
  });

  // Report history query
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['report-history'],
    queryFn: () => scheduledReportService.getHistory(),
    enabled: activeTab === 'scheduled',
  });

  // Create scheduled report mutation
  const createScheduleMutation = useMutation({
    mutationFn: (data: CreateScheduledReportData) => scheduledReportService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      setShowScheduleDialog(false);
      resetScheduleForm();
    },
  });

  // Update scheduled report mutation
  const updateScheduleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateScheduledReportData> }) =>
      scheduledReportService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      setShowScheduleDialog(false);
      setEditingSchedule(null);
      resetScheduleForm();
    },
  });

  // Delete scheduled report mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: (id: number) => scheduledReportService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: (id: number) => scheduledReportService.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
    },
  });

  // Run now mutation
  const runNowMutation = useMutation({
    mutationFn: (id: number) => scheduledReportService.runNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      queryClient.invalidateQueries({ queryKey: ['report-history'] });
    },
  });

  // Helper functions for scheduled reports
  const resetScheduleForm = () => {
    setScheduleForm({
      name: '',
      reportType: 'compliance',
      format: 'pdf',
      scheduleType: 'weekly',
      scheduleDay: 1,
      scheduleTime: '08:00',
      recipients: [],
      isActive: true,
    });
  };

  const openEditDialog = (schedule: ScheduledReport) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      name: schedule.name,
      reportType: schedule.reportType,
      format: schedule.format,
      scheduleType: schedule.scheduleType,
      scheduleDay: schedule.scheduleDay || undefined,
      scheduleTime: schedule.scheduleTime,
      recipients: schedule.recipients,
      isActive: schedule.isActive,
    });
    setShowScheduleDialog(true);
  };

  const handleScheduleSubmit = () => {
    if (editingSchedule) {
      updateScheduleMutation.mutate({ id: editingSchedule.id, data: scheduleForm });
    } else {
      createScheduleMutation.mutate(scheduleForm);
    }
  };

  const getScheduleDescription = (schedule: ScheduledReport) => {
    const time = schedule.scheduleTime?.substring(0, 5) || '08:00';
    switch (schedule.scheduleType) {
      case 'daily':
        return `Daily at ${time}`;
      case 'weekly':
        const day = DAYS_OF_WEEK.find((d) => d.value === schedule.scheduleDay)?.label || 'Monday';
        return `Every ${day} at ${time}`;
      case 'monthly':
        return `Day ${schedule.scheduleDay || 1} of each month at ${time}`;
      default:
        return schedule.scheduleType;
    }
  };

  // Export handlers
  const handleExport = (format: ExportFormat) => {
    switch (activeTab) {
      case 'compliance':
        exportComplianceReport(format);
        break;
      case 'ncs':
        exportNCReport(format);
        break;
      case 'capa':
        exportCAPAReport(format);
        break;
      case 'trends':
        exportTrendReport(format);
        break;
      case 'comparison':
        exportComparisonReport(format);
        break;
      case 'kpi':
        exportKPIReport(format);
        break;
    }
  };

  const exportComplianceReport = (format: ExportFormat) => {
    if (!complianceData?.data) return;
    const columns: ExportColumn[] = [
      { header: 'Package Code', key: 'packageCode', width: 12 },
      { header: 'Package Name', key: 'packageName', width: 25 },
      { header: 'Total Audits', key: 'totalAudits', width: 12 },
      { header: 'Avg Compliance %', key: 'avgCompliance', width: 15 },
      { header: 'Total Compliant', key: 'totalCompliant', width: 15 },
      { header: 'Total NC', key: 'totalNC', width: 10 },
      { header: 'Total NA', key: 'totalNA', width: 10 },
    ];
    exportReport(format, {
      title: 'Compliance Summary Report',
      subtitle: getFilterDescription(),
      columns,
      data: complianceData.data,
      filename: 'compliance_summary',
    });
  };

  const exportNCReport = (format: ExportFormat) => {
    if (!ncData?.data) return;
    const columns: ExportColumn[] = [
      { header: 'Audit #', key: 'auditNumber', width: 15 },
      { header: 'Package', key: 'packageCode', width: 10 },
      { header: 'Category', key: 'categoryName', width: 20 },
      { header: 'Audit Point', key: 'auditPoint', width: 40 },
      { header: 'Risk', key: 'riskRating', width: 10 },
      { header: 'Priority', key: 'priority', width: 8 },
    ];
    exportReport(format, {
      title: 'Non-Conformance Report',
      subtitle: getFilterDescription(),
      columns,
      data: ncData.data,
      filename: 'nc_report',
    });
  };

  const exportCAPAReport = (format: ExportFormat) => {
    if (!capaData?.data) return;
    const statusData = Object.entries(capaData.data.statusCounts).map(([status, count]) => ({
      status,
      count,
    }));
    statusData.push({ status: 'Overdue', count: capaData.data.overdue });
    const columns: ExportColumn[] = [
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Count', key: 'count', width: 15 },
    ];
    exportReport(format, {
      title: 'CAPA Status Report',
      subtitle: getFilterDescription(),
      columns,
      data: statusData,
      filename: 'capa_status',
    });
  };

  const exportTrendReport = (format: ExportFormat) => {
    if (!trendData?.data) return;
    const columns: ExportColumn[] = [
      { header: 'Month', key: 'monthFormatted', width: 15 },
      { header: 'Avg Compliance %', key: 'avgCompliance', width: 15 },
      { header: 'Total NCs', key: 'totalNCs', width: 12 },
      { header: 'Audit Count', key: 'auditCount', width: 12 },
    ];
    const data = trendData.data.map((item) => ({
      ...item,
      monthFormatted: formatDate(new Date(item.month), 'MMM yyyy'),
    }));
    exportReport(format, {
      title: 'Trend Analysis Report',
      subtitle: getFilterDescription(),
      columns,
      data,
      filename: 'trend_analysis',
    });
  };

  const exportComparisonReport = (format: ExportFormat) => {
    if (!comparisonData?.data) return;
    const columns: ExportColumn[] = [
      { header: 'Package Code', key: 'packageCode', width: 12 },
      { header: 'Package Name', key: 'packageName', width: 25 },
      { header: 'Total Audits', key: 'totalAudits', width: 12 },
      { header: 'Avg Compliance %', key: 'avgCompliance', width: 15 },
      { header: 'Total NCs', key: 'totalNCs', width: 10 },
      { header: 'Open CAPAs', key: 'openCAPAs', width: 12 },
    ];
    exportReport(format, {
      title: 'Package Comparison Report',
      columns,
      data: comparisonData.data,
      filename: 'package_comparison',
    });
  };

  const exportKPIReport = (format: ExportFormat) => {
    if (!kpiData?.data) return;
    const allData = [
      ...kpiData.data.leadingIndicators.map((ind) => ({
        type: 'Leading',
        name: ind.name,
        target: ind.target,
        actual: ind.actual,
        unit: ind.unit,
      })),
      ...kpiData.data.laggingIndicators.map((ind) => ({
        type: 'Lagging',
        name: ind.name,
        target: ind.benchmark,
        actual: ind.value,
        unit: ind.unit,
      })),
    ];
    const columns: ExportColumn[] = [
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Indicator', key: 'name', width: 30 },
      { header: 'Target/Benchmark', key: 'target', width: 15 },
      { header: 'Actual', key: 'actual', width: 12 },
      { header: 'Unit', key: 'unit', width: 10 },
    ];
    exportReport(format, {
      title: 'KPI Report',
      subtitle: `Period: ${formatDate(new Date(kpiYear, kpiMonth - 1), 'MMMM yyyy')}`,
      columns,
      data: allData,
      filename: 'kpi_report',
    });
  };

  const getFilterDescription = () => {
    const parts: string[] = [];
    if (selectedPackageId !== 'all') {
      const pkg = packagesData?.find((p) => p.id === parseInt(selectedPackageId));
      if (pkg) parts.push(`Package: ${pkg.name}`);
    }
    if (startDate) parts.push(`From: ${startDate}`);
    if (endDate) parts.push(`To: ${endDate}`);
    return parts.length > 0 ? parts.join(' | ') : undefined;
  };

  // Calculate compliance stats
  const complianceStats = complianceData?.data
    ? {
        totalAudits: complianceData.data.reduce((sum, item) => sum + item.totalAudits, 0),
        avgCompliance:
          complianceData.data.length > 0
            ? (
                complianceData.data.reduce((sum, item) => sum + parseFloat(item.avgCompliance), 0) /
                complianceData.data.length
              ).toFixed(1)
            : '0',
        totalNCs: complianceData.data.reduce((sum, item) => sum + item.totalNC, 0),
      }
    : null;

  // Render risk badge
  const getRiskBadge = (risk: string | null) => {
    if (!risk) return <Badge variant="outline">-</Badge>;
    const variants: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
      Critical: 'destructive',
      Major: 'default',
      Minor: 'secondary',
      Observation: 'outline',
    };
    return <Badge variant={variants[risk] || 'outline'}>{risk}</Badge>;
  };

  return (
    <ProjectGuard>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {currentProject?.name || 'Select a project'}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('pdf')}>
              <FileText className="mr-2 h-4 w-4" />
              Export as PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('excel')}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export as Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Package</Label>
              <Select value={selectedPackageId} onValueChange={setSelectedPackageId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Packages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Packages</SelectItem>
                  {packagesData?.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id.toString()}>
                      {pkg.code} - {pkg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            {activeTab === 'kpi' && (
              <div className="space-y-2">
                <Label>Period</Label>
                <div className="flex gap-2">
                  <Select value={kpiMonth.toString()} onValueChange={(v) => setKpiMonth(parseInt(v))}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {formatDate(new Date(2024, i), 'MMM')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={kpiYear.toString()} onValueChange={(v) => setKpiYear(parseInt(v))}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() - i;
                        return (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="compliance">
            <CheckCircle className="mr-2 h-4 w-4" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="ncs">
            <AlertTriangle className="mr-2 h-4 w-4" />
            NCs
          </TabsTrigger>
          <TabsTrigger value="capa">
            <Activity className="mr-2 h-4 w-4" />
            CAPA
          </TabsTrigger>
          <TabsTrigger value="trends">
            <TrendingUp className="mr-2 h-4 w-4" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="comparison">
            <BarChart3 className="mr-2 h-4 w-4" />
            Comparison
          </TabsTrigger>
          <TabsTrigger value="kpi">
            <Activity className="mr-2 h-4 w-4" />
            KPI
          </TabsTrigger>
          <TabsTrigger value="scheduled">
            <Clock className="mr-2 h-4 w-4" />
            Scheduled
          </TabsTrigger>
        </TabsList>

        {/* Compliance Summary Tab */}
        <TabsContent value="compliance" className="space-y-4">
          {complianceStats && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Audits</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{complianceStats.totalAudits}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Compliance</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{complianceStats.avgCompliance}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total NCs</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{complianceStats.totalNCs}</div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Package-wise Compliance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {complianceLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Package Code</TableHead>
                      <TableHead>Package Name</TableHead>
                      <TableHead className="text-right">Total Audits</TableHead>
                      <TableHead className="text-right">Avg Compliance</TableHead>
                      <TableHead className="text-right">Compliant</TableHead>
                      <TableHead className="text-right">NC</TableHead>
                      <TableHead className="text-right">NA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complianceData?.data?.map((item) => (
                      <TableRow key={item.packageCode}>
                        <TableCell className="font-medium">{item.packageCode}</TableCell>
                        <TableCell>{item.packageName}</TableCell>
                        <TableCell className="text-right">{item.totalAudits}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              parseFloat(item.avgCompliance) >= 80
                                ? 'default'
                                : parseFloat(item.avgCompliance) >= 60
                                  ? 'secondary'
                                  : 'destructive'
                            }
                          >
                            {item.avgCompliance}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{item.totalCompliant}</TableCell>
                        <TableCell className="text-right">{item.totalNC}</TableCell>
                        <TableCell className="text-right">{item.totalNA}</TableCell>
                      </TableRow>
                    ))}
                    {(!complianceData?.data || complianceData.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NCs Tab */}
        <TabsContent value="ncs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Non-Conformance Details</CardTitle>
            </CardHeader>
            <CardContent>
              {ncLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Audit #</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="max-w-[300px]">Audit Point</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ncData?.data?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.auditNumber}</TableCell>
                        <TableCell>{item.packageCode}</TableCell>
                        <TableCell>{item.categoryName}</TableCell>
                        <TableCell className="max-w-[300px] truncate" title={item.auditPoint}>
                          {item.auditPoint}
                        </TableCell>
                        <TableCell>{getRiskBadge(item.riskRating)}</TableCell>
                        <TableCell>
                          <Badge variant={item.priority === 'P1' ? 'destructive' : 'secondary'}>
                            {item.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(new Date(item.createdAt), 'dd MMM yyyy')}</TableCell>
                      </TableRow>
                    ))}
                    {(!ncData?.data || ncData.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No non-conformances found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CAPA Status Tab */}
        <TabsContent value="capa" className="space-y-4">
          {capaData?.data && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Open</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {capaData.data.statusCounts['Open'] || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">
                    {capaData.data.statusCounts['In Progress'] || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{capaData.data.overdue}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Closed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {capaData.data.statusCounts['Closed'] || 0}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>CAPA Status Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {capaLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Open', count: capaData?.data?.statusCounts['Open'] || 0 },
                        { name: 'In Progress', count: capaData?.data?.statusCounts['In Progress'] || 0 },
                        { name: 'Pending Verification', count: capaData?.data?.statusCounts['Pending Verification'] || 0 },
                        { name: 'Overdue', count: capaData?.data?.overdue || 0 },
                        { name: 'Closed', count: capaData?.data?.statusCounts['Closed'] || 0 },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {trendLoading ? (
                  <div className="flex justify-center py-8">Loading...</div>
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trendData?.data?.map((item) => ({
                          ...item,
                          month: formatDate(new Date(item.month), 'MMM yy'),
                          compliance: parseFloat(item.avgCompliance),
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="compliance"
                          name="Compliance %"
                          stroke="#22c55e"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>NC Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {trendLoading ? (
                  <div className="flex justify-center py-8">Loading...</div>
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={trendData?.data?.map((item) => ({
                          ...item,
                          month: formatDate(new Date(item.month), 'MMM yy'),
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="totalNCs" name="Non-Conformances" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Trend Data</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Avg Compliance</TableHead>
                    <TableHead className="text-right">Total NCs</TableHead>
                    <TableHead className="text-right">Audit Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trendData?.data?.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatDate(new Date(item.month), 'MMMM yyyy')}</TableCell>
                      <TableCell className="text-right">{item.avgCompliance}%</TableCell>
                      <TableCell className="text-right">{item.totalNCs}</TableCell>
                      <TableCell className="text-right">{item.auditCount}</TableCell>
                    </TableRow>
                  ))}
                  {(!trendData?.data || trendData.data.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No trend data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Package Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Package Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              {comparisonLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : (
                <>
                  <div className="h-[300px] mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonData?.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="packageCode" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="avgCompliance" name="Compliance %" fill="#22c55e" />
                        <Bar dataKey="totalNCs" name="Total NCs" fill="#ef4444" />
                        <Bar dataKey="openCAPAs" name="Open CAPAs" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Package Code</TableHead>
                        <TableHead>Package Name</TableHead>
                        <TableHead className="text-right">Total Audits</TableHead>
                        <TableHead className="text-right">Avg Compliance</TableHead>
                        <TableHead className="text-right">Total NCs</TableHead>
                        <TableHead className="text-right">Open CAPAs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonData?.data?.map((item) => (
                        <TableRow key={item.packageId}>
                          <TableCell className="font-medium">{item.packageCode}</TableCell>
                          <TableCell>{item.packageName}</TableCell>
                          <TableCell className="text-right">{item.totalAudits}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                parseFloat(item.avgCompliance) >= 80
                                  ? 'default'
                                  : parseFloat(item.avgCompliance) >= 60
                                    ? 'secondary'
                                    : 'destructive'
                              }
                            >
                              {item.avgCompliance}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.totalNCs}</TableCell>
                          <TableCell className="text-right">{item.openCAPAs}</TableCell>
                        </TableRow>
                      ))}
                      {(!comparisonData?.data || comparisonData.data.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No packages found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* KPI Tab */}
        <TabsContent value="kpi" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Leading Indicators</CardTitle>
              </CardHeader>
              <CardContent>
                {kpiLoading ? (
                  <div className="flex justify-center py-8">Loading...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicator</TableHead>
                        <TableHead className="text-right">Target</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">Unit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kpiData?.data?.leadingIndicators?.map((ind, index) => (
                        <TableRow key={index}>
                          <TableCell>{ind.name}</TableCell>
                          <TableCell className="text-right">{ind.target}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                ind.actual >= ind.target ? 'default' : 'destructive'
                              }
                            >
                              {ind.actual}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{ind.unit}</TableCell>
                        </TableRow>
                      ))}
                      {(!kpiData?.data?.leadingIndicators ||
                        kpiData.data.leadingIndicators.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                            No leading indicators data
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lagging Indicators</CardTitle>
              </CardHeader>
              <CardContent>
                {kpiLoading ? (
                  <div className="flex justify-center py-8">Loading...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicator</TableHead>
                        <TableHead className="text-right">Benchmark</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="text-right">Unit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kpiData?.data?.laggingIndicators?.map((ind, index) => (
                        <TableRow key={index}>
                          <TableCell>{ind.name}</TableCell>
                          <TableCell className="text-right">{ind.benchmark}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                ind.value <= ind.benchmark ? 'default' : 'destructive'
                              }
                            >
                              {ind.value}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{ind.unit}</TableCell>
                        </TableRow>
                      ))}
                      {(!kpiData?.data?.laggingIndicators ||
                        kpiData.data.laggingIndicators.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                            No lagging indicators data
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Scheduled Reports Tab */}
        <TabsContent value="scheduled" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Scheduled Reports</h3>
              <p className="text-sm text-muted-foreground">
                Configure automated report generation and delivery
              </p>
            </div>
            <Button
              onClick={() => {
                resetScheduleForm();
                setEditingSchedule(null);
                setShowScheduleDialog(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Schedule
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Active Schedules
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scheduledLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Report Type</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Last Run</TableHead>
                      <TableHead>Next Run</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduledReportsData?.data?.map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-medium">{schedule.name}</TableCell>
                        <TableCell>
                          {REPORT_TYPES.find((t) => t.value === schedule.reportType)?.label ||
                            schedule.reportType}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{schedule.format.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>{getScheduleDescription(schedule)}</TableCell>
                        <TableCell>
                          {schedule.lastRunAt
                            ? formatDate(new Date(schedule.lastRunAt), 'dd MMM yyyy HH:mm')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {schedule.nextRunAt
                            ? formatDate(new Date(schedule.nextRunAt), 'dd MMM yyyy HH:mm')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={schedule.isActive ? 'default' : 'secondary'}>
                            {schedule.isActive ? 'Active' : 'Paused'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => runNowMutation.mutate(schedule.id)}
                              disabled={runNowMutation.isPending}
                              title="Run Now"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleActiveMutation.mutate(schedule.id)}
                              disabled={toggleActiveMutation.isPending}
                              title={schedule.isActive ? 'Pause' : 'Resume'}
                            >
                              {schedule.isActive ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(schedule)}
                              title="Edit"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this schedule?')) {
                                  deleteScheduleMutation.mutate(schedule.id);
                                }
                              }}
                              disabled={deleteScheduleMutation.isPending}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!scheduledReportsData?.data ||
                      scheduledReportsData.data.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No scheduled reports configured
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Report Generation History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Generated By</TableHead>
                      <TableHead>Generated At</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData?.data?.slice(0, 20).map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          {report.name}
                          {report.scheduleName && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (from: {report.scheduleName})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {REPORT_TYPES.find((t) => t.value === report.reportType)?.label ||
                            report.reportType}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{report.format.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>{report.generatorName || '-'}</TableCell>
                        <TableCell>
                          {formatDate(new Date(report.createdAt), 'dd MMM yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              report.status === 'completed'
                                ? 'default'
                                : report.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {report.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!historyData?.data || historyData.data.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No report history available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'Edit Scheduled Report' : 'New Scheduled Report'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Schedule Name</Label>
              <Input
                value={scheduleForm.name}
                onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                placeholder="Weekly Compliance Report"
              />
            </div>

            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select
                value={scheduleForm.reportType}
                onValueChange={(v) => setScheduleForm({ ...scheduleForm, reportType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <Select
                value={scheduleForm.format}
                onValueChange={(v) =>
                  setScheduleForm({ ...scheduleForm, format: v as 'pdf' | 'excel' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Schedule Type</Label>
              <Select
                value={scheduleForm.scheduleType}
                onValueChange={(v) =>
                  setScheduleForm({
                    ...scheduleForm,
                    scheduleType: v as 'daily' | 'weekly' | 'monthly',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {scheduleForm.scheduleType === 'weekly' && (
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <Select
                  value={scheduleForm.scheduleDay?.toString() || '1'}
                  onValueChange={(v) =>
                    setScheduleForm({ ...scheduleForm, scheduleDay: parseInt(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scheduleForm.scheduleType === 'monthly' && (
              <div className="space-y-2">
                <Label>Day of Month</Label>
                <Select
                  value={scheduleForm.scheduleDay?.toString() || '1'}
                  onValueChange={(v) =>
                    setScheduleForm({ ...scheduleForm, scheduleDay: parseInt(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={scheduleForm.scheduleTime || '08:00'}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduleTime: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleScheduleSubmit}
              disabled={
                !scheduleForm.name ||
                createScheduleMutation.isPending ||
                updateScheduleMutation.isPending
              }
            >
              {editingSchedule ? 'Update' : 'Create'} Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </ProjectGuard>
  );
}

export default ReportsPage;
