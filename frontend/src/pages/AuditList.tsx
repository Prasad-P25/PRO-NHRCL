import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Edit, Trash2, Loader2, RefreshCw, FileDown } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [exportingId, setExportingId] = useState<number | null>(null);

  const handleExportWord = async (auditId: number) => {
    setExportingId(auditId);
    try {
      await auditService.exportToWord(auditId);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export audit. Please try again.');
    } finally {
      setExportingId(null);
    }
  };

  const { data: auditsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['audits', statusFilter],
    queryFn: async () => {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const response = await auditService.getAudits(params);
      return response.data;
    },
  });

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
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading audits...</p>
        </div>
      </div>
    );
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audits</h1>
          <p className="text-muted-foreground">
            Manage and track safety audits across all packages
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
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
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
                          <Button variant="ghost" size="icon">
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
  );
}
