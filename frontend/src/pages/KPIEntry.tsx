import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Save,
  TrendingUp,
  TrendingDown,
  Info,
  Building2,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { ProjectGuard } from '@/components/ProjectGuard';
import { ListPageSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { kpiService, type KPIIndicator, type CreateKPIEntryForm } from '@/services/kpi.service';
import { auditService } from '@/services/audit.service';

const months = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

interface EntryFormData {
  [indicatorId: number]: {
    targetValue: string;
    actualValue: string;
    manHoursWorked: string;
    incidentsCount: string;
    remarks: string;
  };
}

export function KPIEntryPage() {
  const queryClient = useQueryClient();
  const currentProject = useAppStore((state) => state.currentProject);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [formData, setFormData] = useState<EntryFormData>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Fetch packages
  const { data: packages = [], isLoading: packagesLoading } = useQuery({
    queryKey: ['packages', currentProject?.id],
    queryFn: async () => {
      const response = await auditService.getPackages();
      return response.data;
    },
  });

  // Fetch indicators
  const { data: indicators = [], isLoading: indicatorsLoading } = useQuery({
    queryKey: ['kpiIndicators'],
    queryFn: async () => {
      const response = await kpiService.getIndicators();
      return response.data;
    },
  });

  // Fetch existing entries for selected package/period
  const { data: existingEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['kpiEntries', selectedPackage, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!selectedPackage) return [];
      const response = await kpiService.getEntries({
        packageId: parseInt(selectedPackage),
        periodMonth: selectedMonth,
        periodYear: selectedYear,
      });
      return response.data;
    },
    enabled: !!selectedPackage,
  });

  // Initialize form data when entries load
  useEffect(() => {
    if (indicators.length > 0) {
      const initialData: EntryFormData = {};
      indicators.forEach((indicator) => {
        const existingEntry = existingEntries.find((e) => e.indicatorId === indicator.id);
        initialData[indicator.id] = {
          targetValue: existingEntry?.targetValue?.toString() || '',
          actualValue: existingEntry?.actualValue?.toString() || '',
          manHoursWorked: existingEntry?.manHoursWorked?.toString() || '',
          incidentsCount: existingEntry?.incidentsCount?.toString() || '',
          remarks: existingEntry?.remarks || '',
        };
      });
      setFormData(initialData);
    }
  }, [indicators, existingEntries]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (entries: CreateKPIEntryForm[]) => {
      return kpiService.saveEntries(entries);
    },
    onSuccess: () => {
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ['kpiEntries'] });
    },
  });

  const updateField = (indicatorId: number, field: keyof EntryFormData[number], value: string) => {
    setFormData((prev) => ({
      ...prev,
      [indicatorId]: {
        ...prev[indicatorId],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!selectedPackage) return;

    const entries: CreateKPIEntryForm[] = indicators
      .filter((indicator) => {
        const data = formData[indicator.id];
        return data && (data.targetValue || data.actualValue);
      })
      .map((indicator) => {
        const data = formData[indicator.id];
        return {
          packageId: parseInt(selectedPackage),
          indicatorId: indicator.id,
          periodMonth: selectedMonth,
          periodYear: selectedYear,
          targetValue: data.targetValue ? parseFloat(data.targetValue) : undefined,
          actualValue: data.actualValue ? parseFloat(data.actualValue) : undefined,
          manHoursWorked: data.manHoursWorked ? parseInt(data.manHoursWorked) : undefined,
          incidentsCount: data.incidentsCount ? parseInt(data.incidentsCount) : undefined,
          remarks: data.remarks || undefined,
        };
      });

    if (entries.length > 0) {
      saveMutation.mutate(entries);
    }
  };

  const leadingIndicators = indicators.filter((i) => i.type === 'Leading');
  const laggingIndicators = indicators.filter((i) => i.type === 'Lagging');

  const isLoading = packagesLoading || indicatorsLoading;

  if (isLoading) {
    return <ListPageSkeleton />;
  }

  const renderIndicatorTable = (indicatorList: KPIIndicator[], type: 'Leading' | 'Lagging') => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[300px]">Indicator</TableHead>
          <TableHead className="w-[100px]">Unit</TableHead>
          <TableHead className="w-[100px]">Benchmark</TableHead>
          <TableHead className="w-[120px]">Target</TableHead>
          <TableHead className="w-[120px]">Actual</TableHead>
          {type === 'Lagging' && (
            <>
              <TableHead className="w-[120px]">Man-Hours</TableHead>
              <TableHead className="w-[100px]">Incidents</TableHead>
            </>
          )}
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {indicatorList.map((indicator) => {
          const data = formData[indicator.id] || {
            targetValue: '',
            actualValue: '',
            manHoursWorked: '',
            incidentsCount: '',
            remarks: '',
          };
          const actual = parseFloat(data.actualValue) || 0;
          const benchmark = indicator.benchmarkValue || 0;
          const target = parseFloat(data.targetValue) || benchmark;

          let status: 'good' | 'warning' | 'bad' | 'none' = 'none';
          if (data.actualValue) {
            if (indicator.name.includes('LTIFR') || indicator.name.includes('Fatality') || indicator.name.includes('Severity')) {
              // Lower is better
              status = actual <= target ? 'good' : actual <= target * 1.2 ? 'warning' : 'bad';
            } else {
              // Higher is better
              status = actual >= target ? 'good' : actual >= target * 0.8 ? 'warning' : 'bad';
            }
          }

          return (
            <TableRow key={indicator.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{indicator.name}</span>
                  {indicator.definition && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{indicator.definition}</p>
                          {indicator.formula && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Formula: {indicator.formula}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{indicator.category}</div>
              </TableCell>
              <TableCell className="text-muted-foreground">{indicator.unit || '-'}</TableCell>
              <TableCell className="text-muted-foreground">
                {indicator.benchmarkValue ?? '-'}
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={data.targetValue}
                  onChange={(e) => updateField(indicator.id, 'targetValue', e.target.value)}
                  className="w-24"
                  placeholder="-"
                  disabled={!selectedPackage}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={data.actualValue}
                  onChange={(e) => updateField(indicator.id, 'actualValue', e.target.value)}
                  className="w-24"
                  placeholder="-"
                  disabled={!selectedPackage}
                />
              </TableCell>
              {type === 'Lagging' && (
                <>
                  <TableCell>
                    <Input
                      type="number"
                      value={data.manHoursWorked}
                      onChange={(e) => updateField(indicator.id, 'manHoursWorked', e.target.value)}
                      className="w-28"
                      placeholder="-"
                      disabled={!selectedPackage}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={data.incidentsCount}
                      onChange={(e) => updateField(indicator.id, 'incidentsCount', e.target.value)}
                      className="w-20"
                      placeholder="-"
                      disabled={!selectedPackage}
                    />
                  </TableCell>
                </>
              )}
              <TableCell>
                {status === 'good' && (
                  <Badge variant="compliant" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    On Track
                  </Badge>
                )}
                {status === 'warning' && (
                  <Badge variant="pending" className="gap-1">
                    <TrendingDown className="h-3 w-3" />
                    Warning
                  </Badge>
                )}
                {status === 'bad' && (
                  <Badge variant="destructive" className="gap-1">
                    <TrendingDown className="h-3 w-3" />
                    Below Target
                  </Badge>
                )}
                {status === 'none' && <span className="text-muted-foreground">-</span>}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <ProjectGuard>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">KPI Entry</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {currentProject?.name || 'Select a project'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-sm text-muted-foreground">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={!selectedPackage || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save All
          </Button>
        </div>
      </div>

      {/* Selection Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Period</CardTitle>
          <CardDescription>Choose a package and reporting period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label>Package</Label>
              <Select value={selectedPackage} onValueChange={setSelectedPackage}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id.toString()}>
                      {pkg.code} - {pkg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(v) => setSelectedMonth(parseInt(v))}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {entriesLoading && (
              <div className="flex items-end pb-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedPackage ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a package to enter KPI data
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="leading">
          <TabsList>
            <TabsTrigger value="leading" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Leading Indicators ({leadingIndicators.length})
            </TabsTrigger>
            <TabsTrigger value="lagging" className="gap-2">
              <TrendingDown className="h-4 w-4" />
              Lagging Indicators ({laggingIndicators.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leading">
            <Card>
              <CardHeader>
                <CardTitle>Leading Indicators</CardTitle>
                <CardDescription>
                  Proactive measures that predict future safety performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderIndicatorTable(leadingIndicators, 'Leading')}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lagging">
            <Card>
              <CardHeader>
                <CardTitle>Lagging Indicators</CardTitle>
                <CardDescription>
                  Reactive measures based on past incidents and outcomes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderIndicatorTable(laggingIndicators, 'Lagging')}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
    </ProjectGuard>
  );
}
