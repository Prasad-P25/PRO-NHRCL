import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ListPageSkeleton } from '@/components/ui/skeleton';
import api from '@/services/api';

interface ProjectMetric {
  id: number;
  code: string;
  name: string;
  totalAudits: number;
  avgCompliance: string;
  approvedAudits: number;
  totalCapas: number;
  openCapas: number;
  overdueCapas: number;
  packageCount: number;
}

interface ComparisonData {
  projects: ProjectMetric[];
  complianceTrend: Record<string, { month: string; compliance: string }[]>;
  ncByProject: { code: string; name: string; count: number }[];
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export function ProjectDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['project-comparison'],
    queryFn: async () => {
      const response = await api.get('/dashboard/project-comparison');
      return response.data.data as ComparisonData;
    },
  });

  if (isLoading) {
    return <ListPageSkeleton />;
  }

  const projects = data?.projects || [];
  const ncData = data?.ncByProject || [];

  // Prepare compliance comparison data
  const complianceData = projects.map((p) => ({
    name: p.code,
    compliance: parseFloat(p.avgCompliance),
    audits: p.totalAudits,
  }));

  // Prepare CAPA comparison data
  const capaData = projects.map((p) => ({
    name: p.code,
    open: p.openCapas,
    overdue: p.overdueCapas,
    total: p.totalCapas,
  }));

  // Calculate totals
  const totalAudits = projects.reduce((sum, p) => sum + p.totalAudits, 0);
  const avgCompliance = projects.length > 0
    ? (projects.reduce((sum, p) => sum + parseFloat(p.avgCompliance), 0) / projects.length).toFixed(1)
    : '0';
  const totalOpenCapas = projects.reduce((sum, p) => sum + p.openCapas, 0);
  const totalOverdueCapas = projects.reduce((sum, p) => sum + p.overdueCapas, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Project Comparison Dashboard</h1>
        <p className="text-muted-foreground">
          Compare performance metrics across all projects
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{projects.length}</div>
            <p className="text-sm text-muted-foreground">
              Active projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Audits</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalAudits}</div>
            <p className="text-sm text-muted-foreground">
              Across all projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Compliance</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{avgCompliance}%</div>
            <p className="text-sm text-muted-foreground">
              Overall average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open CAPAs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {totalOpenCapas}
              {totalOverdueCapas > 0 && (
                <span className="text-lg text-red-600 ml-2">
                  ({totalOverdueCapas} overdue)
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Requiring attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Compliance Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance by Project</CardTitle>
            <CardDescription>Average compliance percentage per project</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={complianceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, 'Compliance']}
                />
                <Bar dataKey="compliance" name="Compliance %">
                  {complianceData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* CAPA Status by Project */}
        <Card>
          <CardHeader>
            <CardTitle>CAPA Status by Project</CardTitle>
            <CardDescription>Open and overdue CAPAs per project</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={capaData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="open" name="Open" fill="#f59e0b" />
                <Bar dataKey="overdue" name="Overdue" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* NC Distribution */}
      {ncData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Non-Conformances by Project</CardTitle>
            <CardDescription>Distribution of open NCs across projects</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ncData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="code" type="category" width={60} />
                <Tooltip
                  formatter={(value: number) => [value, 'NCs']}
                  labelFormatter={(label) => ncData.find((d) => d.code === label)?.name || label}
                />
                <Bar dataKey="count" name="NCs" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Project Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Project Metrics Summary</CardTitle>
          <CardDescription>Detailed metrics for each project</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Project</th>
                  <th className="text-center py-3 px-2">Packages</th>
                  <th className="text-center py-3 px-2">Audits</th>
                  <th className="text-center py-3 px-2">Compliance</th>
                  <th className="text-center py-3 px-2">Total CAPAs</th>
                  <th className="text-center py-3 px-2">Open</th>
                  <th className="text-center py-3 px-2">Overdue</th>
                  <th className="text-center py-3 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => {
                  const compliance = parseFloat(project.avgCompliance);
                  const hasOverdue = project.overdueCapas > 0;
                  return (
                    <tr key={project.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div className="font-medium">{project.code}</div>
                        <div className="text-sm text-muted-foreground">{project.name}</div>
                      </td>
                      <td className="text-center py-3 px-2">{project.packageCount}</td>
                      <td className="text-center py-3 px-2">{project.totalAudits}</td>
                      <td className="text-center py-3 px-2">
                        <span className={`font-medium ${
                          compliance >= 80 ? 'text-green-600' :
                          compliance >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {project.avgCompliance}%
                        </span>
                      </td>
                      <td className="text-center py-3 px-2">{project.totalCapas}</td>
                      <td className="text-center py-3 px-2">
                        <span className={project.openCapas > 0 ? 'text-orange-600 font-medium' : ''}>
                          {project.openCapas}
                        </span>
                      </td>
                      <td className="text-center py-3 px-2">
                        <span className={hasOverdue ? 'text-red-600 font-medium' : ''}>
                          {project.overdueCapas}
                        </span>
                      </td>
                      <td className="text-center py-3 px-2">
                        {hasOverdue ? (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <Clock className="h-4 w-4" />
                            Action Needed
                          </span>
                        ) : compliance >= 80 ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Good
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-yellow-600">
                            <AlertTriangle className="h-4 w-4" />
                            Monitor
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProjectDashboardPage;
