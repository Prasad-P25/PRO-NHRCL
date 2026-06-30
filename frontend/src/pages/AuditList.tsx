import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Search, Eye, Edit, Trash2, Loader2, RefreshCw, FileDown, Building2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/hooks/use-toast';
import { ProjectGuard } from '@/components/ProjectGuard';
import { ListPageSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { auditService } from '@/services/audit.service';
import { formatDate } from '@/lib/utils';
import type { AuditStatus } from '@/types';

const statusOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'Draft', label: 'Draft' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Pending Review', label: 'Pending Review' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Closed', label: 'Closed' },
];

export function AuditListPage() {
  const currentProject = useAppStore((state) => state.currentProject);
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const location = useLocation();

  // Route-aware variants: /audits/my (current user's audits) and
  // /audits/pending (awaiting review) actually filter, not just relabel.
  const variant = location.pathname.endsWith('/my')
    ? 'my'
    : location.pathname.endsWith('/pending')
    ? 'pending'
    : 'all';
  const pageTitle = variant === 'my' ? 'My Audits' : variant === 'pending' ? 'Pending Review' : 'Audits';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(variant === 'pending' ? 'Pending Review' : 'all');
  const [exportingId, setExportingId] = useState<number | null>(null);

  const handleExportWord = async (auditId: number) => {
    setExportingId(auditId);
    try {
      await auditService.exportToWord(auditId);
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export audit. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setExportingId(null);
    }
  };

  const myAuditorId = variant === 'my' ? (currentUser as any)?.id : undefined;

  const { data: auditsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['audits', statusFilter, myAuditorId, currentProject?.id],
    queryFn: async () => {
      const params: { status?: string; auditorId?: number } = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (myAuditorId) params.auditorId = myAuditorId;
      const response = await auditService.getAudits(params);
      return response.data;
    },
    enabled: !!currentProject,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => auditService.deleteAudit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      toast({ title: 'Audit deleted', description: 'The draft audit has been removed.' });
    },
    onError: (err: any) => {
      toast({
        title: 'Delete failed',
        description: err?.response?.data?.message || 'Could not delete the audit.',
        variant: 'destructive',
      });
    },
  });

  const handleDelete = (auditId: number, auditNumber: string) => {
    if (window.confirm(`Delete draft audit ${auditNumber}? This cannot be undone.`)) {
      deleteMutation.mutate(auditId);
    }
  };

  const audits = auditsData || [];

  const filteredAudits = audits.filter((audit) => {
    const matchesSearch =
      audit.auditNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      audit.package?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || audit.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeVariant = (status: AuditStatus) => {
    switch (status) {
      case 'Approved':
        return 'compliant';
      case 'Pending Review':
        return 'pending';
      case 'In Progress':
        return 'inProgress';
      case 'Rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return <ListPageSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load audits</CardTitle>
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

  return (
    <ProjectGuard>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{pageTitle}</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {currentProject?.name || 'Select a project'}
            </p>
          </div>
          <Button asChild>
          <Link to="/audits/new">
            <Plus className="mr-2 h-4 w-4" />
            New Audit
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search audits..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Audit Number</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Auditor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Compliance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAudits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No audits found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAudits.map((audit) => (
                  <TableRow key={audit.id}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/audits/${audit.id}`}
                        className="hover:underline text-primary"
                      >
                        {audit.auditNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{audit.package?.code}</div>
                        <div className="text-sm text-muted-foreground">
                          {audit.package?.name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{audit.auditType}</TableCell>
                    <TableCell>{audit.auditor?.name || '-'}</TableCell>
                    <TableCell>{formatDate(audit.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(audit.status)}>
                        {audit.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {audit.compliancePercentage ? (
                        <span
                          className={
                            audit.compliancePercentage >= 90
                              ? 'text-compliant'
                              : audit.compliancePercentage >= 75
                              ? 'text-pending'
                              : 'text-non-compliant'
                          }
                        >
                          {audit.compliancePercentage}%
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/audits/${audit.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {(audit.status === 'Draft' || audit.status === 'In Progress') && (
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/audits/${audit.id}/execute`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                        {audit.status !== 'Draft' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleExportWord(audit.id)}
                            disabled={exportingId === audit.id}
                            title="Export to Word"
                          >
                            {exportingId === audit.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileDown className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {audit.status === 'Draft' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(audit.id, audit.auditNumber)}
                            disabled={deleteMutation.isPending}
                            title="Delete draft audit"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </ProjectGuard>
  );
}
