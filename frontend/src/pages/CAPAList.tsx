import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Edit,
  XCircle,
  Building2,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { ProjectGuard } from '@/components/ProjectGuard';
import { ListPageSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { capaService, type CAPA, type UpdateCAPAForm } from '@/services/capa.service';
import { auditService } from '@/services/audit.service';
import { formatDate } from '@/lib/utils';

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'Open', label: 'Open' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Closed', label: 'Closed' },
];

// Get initial status filter based on route
function getInitialStatusFilter(pathname: string): string {
  if (pathname === '/capa/open') return 'Open';
  if (pathname === '/capa/overdue') return 'all'; // We'll handle overdue separately
  return 'all';
}

// Get page title based on route
function getPageTitle(pathname: string): { title: string; description: string } {
  if (pathname === '/capa/open') {
    return { title: 'Open CAPAs', description: 'View and manage open Corrective and Preventive Actions' };
  }
  if (pathname === '/capa/my') {
    return { title: 'My CAPAs', description: 'CAPAs assigned to you' };
  }
  if (pathname === '/capa/overdue') {
    return { title: 'Overdue CAPAs', description: 'CAPAs past their target date' };
  }
  return { title: 'CAPA Management', description: 'Track and manage Corrective and Preventive Actions' };
}

export function CAPAListPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const currentProject = useAppStore((state) => state.currentProject);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => getInitialStatusFilter(location.pathname));
  const [packageFilter, setPackageFilter] = useState('all');
  const [selectedCAPA, setSelectedCAPA] = useState<CAPA | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [verificationRemarks, setVerificationRemarks] = useState('');
  const [editForm, setEditForm] = useState<UpdateCAPAForm>({});

  // Reset filters when route changes
  useEffect(() => {
    setSearchTerm('');
    setStatusFilter(getInitialStatusFilter(location.pathname));
    setPackageFilter('all');
  }, [location.pathname]);

  // Fetch CAPAs
  const { data: capaData, isLoading, isError, refetch } = useQuery({
    queryKey: ['capas', statusFilter, packageFilter, currentProject?.id],
    queryFn: async () => {
      const params: { status?: string; packageId?: number } = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (packageFilter !== 'all') params.packageId = parseInt(packageFilter);
      const response = await capaService.getAll(params);
      return response.data;
    },
    enabled: !!currentProject,
  });

  // Fetch packages for filter
  const { data: packagesData = [] } = useQuery({
    queryKey: ['packages'],
    queryFn: async () => {
      const response = await auditService.getPackages();
      return response.data;
    },
  });
  const packages = Array.isArray(packagesData) ? packagesData : [];

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateCAPAForm }) => {
      return capaService.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capas'] });
      setIsEditMode(false);
      setIsDetailOpen(false);
    },
  });

  // Close mutation
  const closeMutation = useMutation({
    mutationFn: async ({ id, remarks }: { id: number; remarks?: string }) => {
      return capaService.close(id, remarks);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capas'] });
      setIsCloseDialogOpen(false);
      setVerificationRemarks('');
    },
  });

  const capas = capaData || [];
  const pageInfo = getPageTitle(location.pathname);
  const isOverduePage = location.pathname === '/capa/overdue';

  const filteredCAPAs = capas.filter((capa) => {
    // Filter overdue CAPAs for the overdue page
    if (isOverduePage) {
      if (capa.status === 'Closed') return false;
      if (!capa.targetDate || new Date(capa.targetDate) >= new Date()) return false;
    }

    const search = searchTerm.toLowerCase();
    const matchesSearch =
      capa.capaNumber.toLowerCase().includes(search) ||
      capa.auditNumber.toLowerCase().includes(search) ||
      capa.findingDescription.toLowerCase().includes(search) ||
      capa.packageCode.toLowerCase().includes(search) ||
      capa.packageName?.toLowerCase().includes(search) ||
      (capa.responsiblePerson?.toLowerCase().includes(search) ?? false) ||
      (capa.responsibleDept?.toLowerCase().includes(search) ?? false);
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Open':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Open
          </Badge>
        );
      case 'In Progress':
        return (
          <Badge variant="pending" className="gap-1">
            <Clock className="h-3 w-3" />
            In Progress
          </Badge>
        );
      case 'Closed':
        return (
          <Badge variant="compliant" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Closed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const isOverdue = (targetDate?: string) => {
    if (!targetDate) return false;
    return new Date(targetDate) < new Date();
  };

  const openDetail = (capa: CAPA) => {
    setSelectedCAPA(capa);
    setEditForm({
      rootCause: capa.rootCause || '',
      correctiveAction: capa.correctiveAction || '',
      preventiveAction: capa.preventiveAction || '',
      responsiblePerson: capa.responsiblePerson || '',
      responsibleDept: capa.responsibleDept || '',
      targetDate: capa.targetDate?.split('T')[0] || '',
      status: capa.status,
    });
    setIsEditMode(false);
    setIsDetailOpen(true);
  };

  const handleSave = () => {
    if (!selectedCAPA) return;
    updateMutation.mutate({ id: selectedCAPA.id, data: editForm });
  };

  const openCloseDialog = (capa: CAPA) => {
    setSelectedCAPA(capa);
    setVerificationRemarks('');
    setIsCloseDialogOpen(true);
  };

  const handleClose = () => {
    if (!selectedCAPA) return;
    closeMutation.mutate({ id: selectedCAPA.id, remarks: verificationRemarks });
  };

  if (isLoading) {
    return <ListPageSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load CAPAs</CardTitle>
            <CardDescription>Unable to connect to the server.</CardDescription>
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
          <h1 className="text-3xl font-bold">{pageInfo.title}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {currentProject?.name || 'Select a project'}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {capas.filter((c) => c.status === 'Open').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pending">
              {capas.filter((c) => c.status === 'In Progress').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {capas.filter((c) => c.status !== 'Closed' && isOverdue(c.targetDate)).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-compliant">
              {capas.filter((c) => c.status === 'Closed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by CAPA #, person, finding..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={packageFilter} onValueChange={setPackageFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Package" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Packages</SelectItem>
                  {packages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id.toString()}>
                      {pkg.code}
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
                <TableHead>CAPA #</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Audit</TableHead>
                <TableHead>Finding</TableHead>
                <TableHead>Responsible</TableHead>
                <TableHead>Target Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCAPAs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No CAPAs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCAPAs.map((capa) => (
                  <TableRow key={capa.id}>
                    <TableCell className="font-medium">{capa.capaNumber}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{capa.packageCode}</div>
                        <div className="text-xs text-muted-foreground">{capa.packageName}</div>
                      </div>
                    </TableCell>
                    <TableCell>{capa.auditNumber}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="truncate" title={capa.findingDescription}>
                        {capa.findingDescription}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{capa.responsiblePerson || '-'}</div>
                        <div className="text-xs text-muted-foreground">
                          {capa.responsibleDept || ''}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {capa.targetDate ? (
                        <span
                          className={
                            capa.status !== 'Closed' && isOverdue(capa.targetDate)
                              ? 'text-destructive font-medium'
                              : ''
                          }
                        >
                          {formatDate(capa.targetDate)}
                          {capa.status !== 'Closed' && isOverdue(capa.targetDate) && (
                            <span className="block text-xs">Overdue</span>
                          )}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(capa.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDetail(capa)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {capa.status !== 'Closed' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                openDetail(capa);
                                setIsEditMode(true);
                              }}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openCloseDialog(capa)}
                              title="Close CAPA"
                            >
                              <XCircle className="h-4 w-4 text-compliant" />
                            </Button>
                          </>
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

      {/* Detail/Edit Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCAPA?.capaNumber} {isEditMode && '- Edit'}
            </DialogTitle>
            <DialogDescription>
              {selectedCAPA?.packageCode} - {selectedCAPA?.auditNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedCAPA && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 bg-muted/50">
                <h4 className="font-medium mb-2">Finding</h4>
                <p className="text-sm">{selectedCAPA.auditPoint}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedCAPA.findingDescription}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Responsible Person</Label>
                  {isEditMode ? (
                    <Input
                      value={editForm.responsiblePerson || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, responsiblePerson: e.target.value })
                      }
                    />
                  ) : (
                    <p className="text-sm">{selectedCAPA.responsiblePerson || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  {isEditMode ? (
                    <Input
                      value={editForm.responsibleDept || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, responsibleDept: e.target.value })
                      }
                    />
                  ) : (
                    <p className="text-sm">{selectedCAPA.responsibleDept || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Target Date</Label>
                  {isEditMode ? (
                    <Input
                      type="date"
                      value={editForm.targetDate || ''}
                      onChange={(e) => setEditForm({ ...editForm, targetDate: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">
                      {selectedCAPA.targetDate ? formatDate(selectedCAPA.targetDate) : '-'}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  {isEditMode ? (
                    <Select
                      value={editForm.status}
                      onValueChange={(value) =>
                        setEditForm({ ...editForm, status: value as 'Open' | 'In Progress' | 'Closed' })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    getStatusBadge(selectedCAPA.status)
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Root Cause</Label>
                {isEditMode ? (
                  <Textarea
                    value={editForm.rootCause || ''}
                    onChange={(e) => setEditForm({ ...editForm, rootCause: e.target.value })}
                    placeholder="Describe the root cause..."
                  />
                ) : (
                  <p className="text-sm">{selectedCAPA.rootCause || '-'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Corrective Action</Label>
                {isEditMode ? (
                  <Textarea
                    value={editForm.correctiveAction || ''}
                    onChange={(e) => setEditForm({ ...editForm, correctiveAction: e.target.value })}
                    placeholder="Describe corrective actions taken..."
                  />
                ) : (
                  <p className="text-sm">{selectedCAPA.correctiveAction || '-'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Preventive Action</Label>
                {isEditMode ? (
                  <Textarea
                    value={editForm.preventiveAction || ''}
                    onChange={(e) => setEditForm({ ...editForm, preventiveAction: e.target.value })}
                    placeholder="Describe preventive measures..."
                  />
                ) : (
                  <p className="text-sm">{selectedCAPA.preventiveAction || '-'}</p>
                )}
              </div>

              {selectedCAPA.status === 'Closed' && (
                <div className="rounded-lg border p-4 bg-compliant/10">
                  <h4 className="font-medium mb-2">Closure Details</h4>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">Closed on:</span>{' '}
                      {selectedCAPA.closedDate ? formatDate(selectedCAPA.closedDate) : '-'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Verified by:</span>{' '}
                      {selectedCAPA.verifierName || '-'}
                    </p>
                    {selectedCAPA.verificationRemarks && (
                      <p>
                        <span className="text-muted-foreground">Remarks:</span>{' '}
                        {selectedCAPA.verificationRemarks}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {isEditMode ? (
              <>
                <Button variant="outline" onClick={() => setIsEditMode(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                  Close
                </Button>
                {selectedCAPA?.status !== 'Closed' && (
                  <Button onClick={() => setIsEditMode(true)}>Edit</Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close CAPA Dialog */}
      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close CAPA</DialogTitle>
            <DialogDescription>
              Are you sure you want to close {selectedCAPA?.capaNumber}? This action confirms that
              the corrective and preventive actions have been implemented and verified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Verification Remarks</Label>
              <Textarea
                value={verificationRemarks}
                onChange={(e) => setVerificationRemarks(e.target.value)}
                placeholder="Enter verification remarks (optional)..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleClose} disabled={closeMutation.isPending}>
              {closeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Close CAPA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </ProjectGuard>
  );
}
