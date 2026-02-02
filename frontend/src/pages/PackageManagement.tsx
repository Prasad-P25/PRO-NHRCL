import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit,
  Package as PackageIcon,
  MapPin,
  Building2,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

import settingsService from '@/services/settings.service';
import type { Package } from '@/types';

interface PackageFormData {
  code: string;
  name: string;
  location?: string;
  description?: string;
  contractorName?: string;
  status?: 'Active' | 'Inactive';
}

export function PackageManagementPage() {
  const queryClient = useQueryClient();

  const [showDialog, setShowDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [formData, setFormData] = useState<PackageFormData>({
    code: '',
    name: '',
  });

  // Fetch packages
  const { data: packagesData, isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => settingsService.getPackages(),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: PackageFormData) => settingsService.createPackage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      setShowDialog(false);
      setFormData({ code: '', name: '' });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PackageFormData> }) =>
      settingsService.updatePackage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      setShowDialog(false);
      setEditingPackage(null);
      setFormData({ code: '', name: '' });
    },
  });

  const handleOpenCreate = () => {
    setEditingPackage(null);
    setFormData({ code: '', name: '' });
    setShowDialog(true);
  };

  const handleOpenEdit = (pkg: Package) => {
    setEditingPackage(pkg);
    setFormData({
      code: pkg.code,
      name: pkg.name,
      location: pkg.location ?? undefined,
      description: pkg.description ?? undefined,
      contractorName: pkg.contractorName ?? undefined,
      status: pkg.status,
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (editingPackage) {
      updateMutation.mutate({
        id: editingPackage.id,
        data: formData,
      });
    } else {
      if (!formData.code || !formData.name) return;
      createMutation.mutate(formData);
    }
  };

  const handleToggleStatus = (pkg: Package) => {
    updateMutation.mutate({
      id: pkg.id,
      data: { status: pkg.status === 'Active' ? 'Inactive' : 'Active' },
    });
  };

  // Stats
  const packages = packagesData?.data || [];
  const stats = {
    total: packages.length,
    active: packages.filter((p) => p.status === 'Active').length,
    inactive: packages.filter((p) => p.status === 'Inactive').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Package Management</h1>
          <p className="text-muted-foreground">Manage construction packages and contractors</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Package
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Packages</CardTitle>
            <PackageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <MapPin className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.inactive}</div>
          </CardContent>
        </Card>
      </div>

      {/* Packages Table */}
      <Card>
        <CardHeader>
          <CardTitle>Packages</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-medium">{pkg.code}</TableCell>
                    <TableCell>{pkg.name}</TableCell>
                    <TableCell>{pkg.location || '-'}</TableCell>
                    <TableCell>{pkg.contractorName || '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={pkg.status === 'Active' ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => handleToggleStatus(pkg)}
                      >
                        {pkg.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(pkg)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {packages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No packages found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPackage ? 'Edit Package' : 'Add New Package'}</DialogTitle>
            <DialogDescription>
              {editingPackage ? 'Update package details' : 'Create a new construction package'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Package Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., C1"
                  disabled={!!editingPackage}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status || 'Active'}
                  onValueChange={(v) =>
                    setFormData({ ...formData, status: v as 'Active' | 'Inactive' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Package Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Vadodara Corridor"
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Vadodara, Gujarat"
              />
            </div>
            <div className="space-y-2">
              <Label>Contractor Name</Label>
              <Input
                value={formData.contractorName || ''}
                onChange={(e) => setFormData({ ...formData, contractorName: e.target.value })}
                placeholder="e.g., L&T Construction"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Package description..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingPackage
                  ? 'Update'
                  : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PackageManagementPage;
