import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format as formatDate } from 'date-fns';
import {
  Plus,
  Eye,
  Trash2,
  ClipboardList,
  AlertCircle,
  Building2,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

import { useAppStore } from '@/store/appStore';
import { ProjectGuard } from '@/components/ProjectGuard';
import maturityService from '@/services/maturity.service';
import api from '@/services/api';
import type { Package } from '@/types';

export function MaturityListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentProject = useAppStore((state) => state.currentProject);

  const [selectedPackageId, setSelectedPackageId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newPackageId, setNewPackageId] = useState<string>('');
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Fetch packages
  const { data: packagesData } = useQuery({
    queryKey: ['packages', currentProject?.id],
    queryFn: async () => {
      const response = await api.get('/packages');
      return response.data.data as Package[];
    },
  });

  // Fetch assessments
  const { data: assessmentsData, isLoading } = useQuery({
    queryKey: ['maturity-assessments', selectedPackageId, selectedStatus, currentProject?.id],
    queryFn: () =>
      maturityService.getAll({
        packageId: selectedPackageId !== 'all' ? parseInt(selectedPackageId) : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
      }),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: { packageId: number; assessmentDate: string }) =>
      maturityService.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['maturity-assessments'] });
      setShowNewDialog(false);
      navigate(`/maturity/${response.data.id}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => maturityService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maturity-assessments'] });
      setDeleteId(null);
    },
  });

  const handleCreate = () => {
    if (!newPackageId) return;
    createMutation.mutate({
      packageId: parseInt(newPackageId),
      assessmentDate: newDate,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      Draft: 'outline',
      'In Progress': 'secondary',
      Completed: 'default',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const getScoreColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'text-muted-foreground';
    if (score >= 4) return 'text-green-600';
    if (score >= 3) return 'text-yellow-600';
    if (score >= 2) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'Not Assessed';
    if (score >= 4.5) return 'Optimized';
    if (score >= 3.5) return 'Managed';
    if (score >= 2.5) return 'Defined';
    if (score >= 1.5) return 'Developing';
    return 'Initial';
  };

  // Calculate stats
  const stats = assessmentsData?.data
    ? {
        total: assessmentsData.data.length,
        draft: assessmentsData.data.filter((a) => a.status === 'Draft').length,
        completed: assessmentsData.data.filter((a) => a.status === 'Completed').length,
        avgScore:
          assessmentsData.data.filter((a) => a.overallScore !== null).length > 0
            ? (
                assessmentsData.data
                  .filter((a) => a.overallScore !== null)
                  .reduce((sum, a) => sum + (a.overallScore || 0), 0) /
                assessmentsData.data.filter((a) => a.overallScore !== null).length
              ).toFixed(1)
            : null,
      }
    : null;

  return (
    <ProjectGuard>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Safety Maturity Assessment</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {currentProject?.name || 'Select a project'}
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Assessment
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assessments</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.draft}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Maturity Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(stats.avgScore ? parseFloat(stats.avgScore) : null)}`}>
                {stats.avgScore ? `${stats.avgScore}/5` : '-'}
              </div>
              <p className="text-xs text-muted-foreground">
                {getScoreLabel(stats.avgScore ? parseFloat(stats.avgScore) : null)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
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
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assessments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Assessments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  <TableHead>Assessment Date</TableHead>
                  <TableHead>Assessor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Maturity Score</TableHead>
                  <TableHead className="text-center">Level</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessmentsData?.data?.map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{assessment.packageCode}</div>
                        <div className="text-sm text-muted-foreground">
                          {assessment.packageName}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {assessment.assessmentDate
                        ? formatDate(new Date(assessment.assessmentDate), 'dd MMM yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>{assessment.assessorName || '-'}</TableCell>
                    <TableCell>{getStatusBadge(assessment.status)}</TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold ${getScoreColor(assessment.overallScore)}`}>
                        {assessment.overallScore != null
                          ? `${assessment.overallScore.toFixed(1)}/5`
                          : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-sm ${getScoreColor(assessment.overallScore)}`}>
                        {getScoreLabel(assessment.overallScore ?? null)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/maturity/${assessment.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {assessment.status === 'Draft' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(assessment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!assessmentsData?.data || assessmentsData.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No assessments found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Assessment Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Maturity Assessment</DialogTitle>
            <DialogDescription>
              Start a new safety maturity assessment for a package
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Package *</Label>
              <Select value={newPackageId} onValueChange={setNewPackageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent>
                  {packagesData?.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id.toString()}>
                      {pkg.code} - {pkg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assessment Date</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newPackageId || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Assessment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Assessment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this assessment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3 text-yellow-800">
            <AlertCircle className="h-5 w-5" />
            <span>Only draft assessments can be deleted.</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </ProjectGuard>
  );
}

export default MaturityListPage;
