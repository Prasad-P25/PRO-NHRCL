import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Shield, Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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

import settingsService, { type RoleWithCount, type CreateRoleData } from '@/services/settings.service';

// Available permissions
const PERMISSION_MODULES = [
  {
    key: 'audits',
    label: 'Audits',
    permissions: ['view', 'create', 'edit', 'submit', 'approve'],
  },
  {
    key: 'capa',
    label: 'CAPA',
    permissions: ['view', 'manage', 'respond', 'verify'],
  },
  {
    key: 'kpi',
    label: 'KPI',
    permissions: ['view', 'edit'],
  },
  {
    key: 'reports',
    label: 'Reports',
    permissions: ['view', 'export'],
  },
  {
    key: 'maturity',
    label: 'Maturity Assessment',
    permissions: ['view', 'create', 'edit'],
  },
  {
    key: 'users',
    label: 'Users',
    permissions: ['view', 'manage'],
  },
  {
    key: 'settings',
    label: 'Settings',
    permissions: ['view', 'manage'],
  },
];

export function RoleManagementPage() {
  const queryClient = useQueryClient();

  const [showDialog, setShowDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithCount | null>(null);
  const [roleName, setRoleName] = useState('');
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [deleteRoleId, setDeleteRoleId] = useState<number | null>(null);

  // Fetch roles
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => settingsService.getRoles(),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateRoleData) => settingsService.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowDialog(false);
      resetForm();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateRoleData> }) =>
      settingsService.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowDialog(false);
      setEditingRole(null);
      resetForm();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => settingsService.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setDeleteRoleId(null);
    },
  });

  const resetForm = () => {
    setRoleName('');
    setPermissions({});
  };

  const handleOpenCreate = () => {
    setEditingRole(null);
    resetForm();
    setShowDialog(true);
  };

  const handleOpenEdit = (role: RoleWithCount) => {
    setEditingRole(role);
    setRoleName(role.name);
    // Parse permissions - handle both object format and "all" boolean
    if (role.permissions && typeof role.permissions === 'object') {
      const perms = role.permissions as Record<string, string[] | boolean>;
      if ('all' in perms && perms.all === true) {
        // Super admin with all permissions
        const allPerms: Record<string, string[]> = {};
        PERMISSION_MODULES.forEach((mod) => {
          allPerms[mod.key] = [...mod.permissions];
        });
        setPermissions(allPerms);
      } else {
        setPermissions(role.permissions as Record<string, string[]>);
      }
    } else {
      setPermissions({});
    }
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!roleName.trim()) return;

    const data: CreateRoleData = {
      name: roleName.trim(),
      permissions,
    };

    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const togglePermission = (module: string, permission: string) => {
    setPermissions((prev) => {
      const modulePerms = prev[module] || [];
      if (modulePerms.includes(permission)) {
        const newPerms = modulePerms.filter((p) => p !== permission);
        if (newPerms.length === 0) {
          const { [module]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [module]: newPerms };
      } else {
        return { ...prev, [module]: [...modulePerms, permission] };
      }
    });
  };

  const toggleAllModulePermissions = (module: string, allPerms: string[]) => {
    setPermissions((prev) => {
      const modulePerms = prev[module] || [];
      if (modulePerms.length === allPerms.length) {
        const { [module]: _, ...rest } = prev;
        return rest;
      } else {
        return { ...prev, [module]: [...allPerms] };
      }
    });
  };

  const roles = rolesData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Role Management</h1>
          <p className="text-muted-foreground">Manage user roles and permissions</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Role
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {roles.reduce((sum, r) => sum + r.userCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{role.userCount} users</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions &&
                        typeof role.permissions === 'object' &&
                        'all' in role.permissions &&
                        (role.permissions as Record<string, string[] | boolean>).all === true ? (
                          <Badge variant="default">All Permissions</Badge>
                        ) : (
                          Object.entries(role.permissions || {}).map(([mod, perms]) =>
                            Array.isArray(perms) ? (
                              <Badge key={mod} variant="secondary" className="text-xs">
                                {mod}: {perms.length}
                              </Badge>
                            ) : null
                          )
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(role)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {role.userCount === 0 && role.id > 6 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteRoleId(role.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {roles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No roles found
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Add New Role'}</DialogTitle>
            <DialogDescription>
              {editingRole ? 'Update role permissions' : 'Create a new role with specific permissions'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Role Name *</Label>
              <Input
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g., Safety Officer"
              />
            </div>

            <div className="space-y-4">
              <Label>Permissions</Label>
              {PERMISSION_MODULES.map((mod) => (
                <Card key={mod.key}>
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{mod.label}</CardTitle>
                      <Checkbox
                        checked={(permissions[mod.key]?.length || 0) === mod.permissions.length}
                        onCheckedChange={() =>
                          toggleAllModulePermissions(mod.key, mod.permissions)
                        }
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="flex flex-wrap gap-4">
                      {mod.permissions.map((perm) => (
                        <div key={perm} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${mod.key}-${perm}`}
                            checked={permissions[mod.key]?.includes(perm) || false}
                            onCheckedChange={() => togglePermission(mod.key, perm)}
                          />
                          <label
                            htmlFor={`${mod.key}-${perm}`}
                            className="text-sm capitalize cursor-pointer"
                          >
                            {perm}
                          </label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                : editingRole
                  ? 'Update'
                  : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteRoleId !== null} onOpenChange={() => setDeleteRoleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this role? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRoleId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteRoleId && deleteMutation.mutate(deleteRoleId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RoleManagementPage;
