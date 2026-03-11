import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Save,
  Users,
  Settings,
  UserPlus,
  Trash2,
  Star,
  Search,
  Package as PackageIcon,
  Plus,
  Edit,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import projectService, { UpdateProjectData, ProjectUser } from '@/services/project.service';
import settingsService from '@/services/settings.service';
import api from '@/services/api';
import type { Package, ApiResponse } from '@/types';

interface PackageFormData {
  code: string;
  name: string;
  location?: string;
  description?: string;
  contractorName?: string;
  status?: 'Active' | 'Inactive';
}

export function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projectId = parseInt(id || '0');

  // General settings state
  const [formData, setFormData] = useState<UpdateProjectData>({
    name: '',
    description: '',
    clientName: '',
    location: '',
    startDate: '',
    endDate: '',
    status: 'Active',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // User management state
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userToRemove, setUserToRemove] = useState<ProjectUser | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  // Package management state
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [packageFormData, setPackageFormData] = useState<PackageFormData>({
    code: '',
    name: '',
  });
  const [packageError, setPackageError] = useState<string | null>(null);
  const [packageSuccess, setPackageSuccess] = useState<string | null>(null);

  // Fetch project data
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.getProject(projectId),
    enabled: projectId > 0,
  });

  // Fetch project users
  const { data: projectUsers, isLoading: usersLoading } = useQuery({
    queryKey: ['project-users', projectId],
    queryFn: () => projectService.getProjectUsers(projectId),
    enabled: projectId > 0,
  });

  // Fetch all users for the add dialog
  const { data: allUsersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => settingsService.getUsers({ pageSize: 100 }),
  });

  // Fetch packages for this project
  const { data: packagesData, isLoading: packagesLoading } = useQuery({
    queryKey: ['packages', projectId],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Package[]>>('/packages', {
        headers: { 'X-Project-Id': projectId.toString() },
      });
      return response.data.data;
    },
    enabled: projectId > 0,
  });

  // Update form when project loads
  useEffect(() => {
    if (project) {
      const status = project.status === 'Deleted' ? 'Inactive' : project.status;
      setFormData({
        name: project.name,
        description: project.description || '',
        clientName: project.clientName || '',
        location: project.location || '',
        startDate: project.startDate ? project.startDate.split('T')[0] : '',
        endDate: project.endDate ? project.endDate.split('T')[0] : '',
        status: status as 'Active' | 'Inactive' | 'Completed',
      });
    }
  }, [project]);

  // Get users not already assigned to this project
  const availableUsers = allUsersData?.data?.filter(
    (user) => !projectUsers?.some((pu) => pu.userId === user.id)
  ) || [];

  // Filter users by search term
  const filteredUsers = projectUsers?.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.roleName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Update project mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateProjectData) => projectService.updateProject(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setErrors({ _success: 'Project updated successfully' });
      setTimeout(() => setErrors({}), 3000);
    },
    onError: (error: any) => {
      if (error.response?.data?.errors) {
        const fieldErrors: Record<string, string> = {};
        error.response.data.errors.forEach((err: any) => {
          fieldErrors[err.path] = err.msg;
        });
        setErrors(fieldErrors);
      } else {
        setErrors({ _general: error.response?.data?.message || 'Failed to update project' });
      }
    },
  });

  // User mutations
  const assignMutation = useMutation({
    mutationFn: (userId: number) => projectService.assignUser(projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-users', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setShowAddDialog(false);
      setSelectedUserId('');
      setUserError(null);
    },
    onError: (err: any) => {
      setUserError(err.response?.data?.message || 'Failed to assign user');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: number) => projectService.removeUser(projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-users', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setShowRemoveDialog(false);
      setUserToRemove(null);
      setUserError(null);
    },
    onError: (err: any) => {
      setUserError(err.response?.data?.message || 'Failed to remove user');
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (userId: number) => projectService.setDefaultProject(projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-users', projectId] });
    },
  });

  // Package mutations
  const createPackageMutation = useMutation({
    mutationFn: async (data: PackageFormData) => {
      const response = await api.post<ApiResponse<Package>>('/packages', data, {
        headers: { 'X-Project-Id': projectId.toString() },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setShowPackageDialog(false);
      setPackageFormData({ code: '', name: '' });
      setPackageError(null);
      setPackageSuccess('Package created successfully');
      setTimeout(() => setPackageSuccess(null), 3000);
    },
    onError: (err: any) => {
      setPackageError(err.response?.data?.message || 'Failed to create package');
    },
  });

  const updatePackageMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PackageFormData> }) => {
      await api.put(`/packages/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages', projectId] });
      setShowPackageDialog(false);
      setEditingPackage(null);
      setPackageFormData({ code: '', name: '' });
      setPackageError(null);
      setPackageSuccess('Package updated successfully');
      setTimeout(() => setPackageSuccess(null), 3000);
    },
    onError: (err: any) => {
      setPackageError(err.response?.data?.message || 'Failed to update package');
    },
  });

  // Handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleStatusChange = (value: string) => {
    setFormData((prev) => ({ ...prev, status: value as 'Active' | 'Inactive' | 'Completed' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) {
      newErrors.name = 'Project name is required';
    }
    if (formData.startDate && formData.endDate) {
      if (new Date(formData.endDate) < new Date(formData.startDate)) {
        newErrors.endDate = 'End date must be after start date';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const dataToSubmit: UpdateProjectData = {
        ...formData,
        description: formData.description || undefined,
        clientName: formData.clientName || undefined,
        location: formData.location || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
      };
      updateMutation.mutate(dataToSubmit);
    }
  };

  const handleAddUser = () => {
    if (selectedUserId) {
      assignMutation.mutate(parseInt(selectedUserId));
    }
  };

  const handleRemoveUser = (user: ProjectUser) => {
    setUserToRemove(user);
    setShowRemoveDialog(true);
    setUserError(null);
  };

  const confirmRemove = () => {
    if (userToRemove) {
      removeMutation.mutate(userToRemove.userId);
    }
  };

  const handleSetDefault = (userId: number) => {
    setDefaultMutation.mutate(userId);
  };

  // Package handlers
  const handleOpenCreatePackage = () => {
    setEditingPackage(null);
    setPackageFormData({ code: '', name: '' });
    setPackageError(null);
    setShowPackageDialog(true);
  };

  const handleOpenEditPackage = (pkg: Package) => {
    setEditingPackage(pkg);
    setPackageFormData({
      code: pkg.code,
      name: pkg.name,
      location: pkg.location ?? undefined,
      description: pkg.description ?? undefined,
      contractorName: pkg.contractorName ?? undefined,
      status: pkg.status,
    });
    setPackageError(null);
    setShowPackageDialog(true);
  };

  const handlePackageFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setPackageFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePackageSubmit = () => {
    if (!packageFormData.code || !packageFormData.name) {
      setPackageError('Code and Name are required');
      return;
    }

    if (editingPackage) {
      updatePackageMutation.mutate({
        id: editingPackage.id,
        data: packageFormData,
      });
    } else {
      createPackageMutation.mutate(packageFormData);
    }
  };

  const handleTogglePackageStatus = (pkg: Package) => {
    updatePackageMutation.mutate({
      id: pkg.id,
      data: { status: pkg.status === 'Active' ? 'Inactive' : 'Active' },
    });
  };

  const isLoading = projectLoading || usersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Project Not Found</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Project Settings</h1>
          <p className="text-muted-foreground">
            {project.name} ({project.code})
          </p>
        </div>
        <Badge variant={project.status === 'Active' ? 'default' : 'secondary'}>
          {project.status}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="packages" className="gap-2">
            <PackageIcon className="h-4 w-4" />
            Packages ({packagesData?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users ({projectUsers?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general">
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>Project Details</CardTitle>
                <CardDescription>
                  Update the project information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {errors._general && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    {errors._general}
                  </div>
                )}
                {errors._success && (
                  <div className="text-sm text-green-700 bg-green-100 p-3 rounded-md">
                    {errors._success}
                  </div>
                )}

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="code">Project Code</Label>
                    <Input id="code" value={project.code} disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground">Code cannot be changed</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={handleStatusChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">
                    Project Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input
                      id="clientName"
                      name="clientName"
                      value={formData.clientName}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      name="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={handleChange}
                      className={errors.endDate ? 'border-destructive' : ''}
                    />
                    {errors.endDate && <p className="text-sm text-destructive">{errors.endDate}</p>}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* Packages Tab */}
        <TabsContent value="packages">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Project Packages</CardTitle>
                  <CardDescription>
                    Manage construction packages (sites) for this project
                  </CardDescription>
                </div>
                <Button onClick={handleOpenCreatePackage}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Package
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {packageSuccess && (
                <div className="text-sm text-green-700 bg-green-100 p-3 rounded-md mb-4">
                  {packageSuccess}
                </div>
              )}
              {packagesLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : !packagesData || packagesData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <PackageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No packages yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add construction packages to this project
                  </p>
                  <Button onClick={handleOpenCreatePackage}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Package
                  </Button>
                </div>
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
                    {packagesData.map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-medium">{pkg.code}</TableCell>
                        <TableCell>{pkg.name}</TableCell>
                        <TableCell>{pkg.location || '-'}</TableCell>
                        <TableCell>{pkg.contractorName || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={pkg.status === 'Active' ? 'default' : 'secondary'}
                            className="cursor-pointer"
                            onClick={() => handleTogglePackageStatus(pkg)}
                          >
                            {pkg.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditPackage(pkg)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Project Users</CardTitle>
                  <CardDescription>
                    Manage who has access to this project
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Button onClick={() => { setShowAddDialog(true); setUserError(null); }}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No users assigned</h3>
                  <p className="text-muted-foreground mb-4">
                    Add users to give them access to this project
                  </p>
                  <Button onClick={() => setShowAddDialog(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-center">Default Project</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.roleName}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {user.isDefault ? (
                            <Badge variant="default" className="bg-amber-500">
                              <Star className="h-3 w-3 mr-1" />
                              Default
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetDefault(user.userId)}
                              disabled={setDefaultMutation.isPending}
                            >
                              Set as Default
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveUser(user)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User to Project</DialogTitle>
            <DialogDescription>
              Select a user to give them access to {project.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {userError && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {userError}
              </div>
            )}
            <div className="space-y-2">
              <Label>Select User</Label>
              {availableUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All users are already assigned to this project
                </p>
              ) : (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span>{user.name}</span>
                          <span className="text-muted-foreground">({user.role.name})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={!selectedUserId || assignMutation.isPending}
            >
              {assignMutation.isPending ? 'Adding...' : 'Add User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove User Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {userToRemove?.name} from {project.name}?
              They will lose access to all project data.
            </DialogDescription>
          </DialogHeader>
          {userError && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {userError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemove}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? 'Removing...' : 'Remove User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Package Dialog */}
      <Dialog open={showPackageDialog} onOpenChange={setShowPackageDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPackage ? 'Edit Package' : 'Add New Package'}
            </DialogTitle>
            <DialogDescription>
              {editingPackage
                ? 'Update package details'
                : `Create a new construction package for ${project.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {packageError && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {packageError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Package Code *</Label>
                <Input
                  name="code"
                  value={packageFormData.code}
                  onChange={handlePackageFormChange}
                  placeholder="e.g., C1"
                  disabled={!!editingPackage}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={packageFormData.status || 'Active'}
                  onValueChange={(v) =>
                    setPackageFormData((prev) => ({
                      ...prev,
                      status: v as 'Active' | 'Inactive',
                    }))
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
                name="name"
                value={packageFormData.name}
                onChange={handlePackageFormChange}
                placeholder="e.g., Vadodara Corridor"
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                name="location"
                value={packageFormData.location || ''}
                onChange={handlePackageFormChange}
                placeholder="e.g., Vadodara, Gujarat"
              />
            </div>
            <div className="space-y-2">
              <Label>Contractor Name</Label>
              <Input
                name="contractorName"
                value={packageFormData.contractorName || ''}
                onChange={handlePackageFormChange}
                placeholder="e.g., L&T Construction"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                name="description"
                value={packageFormData.description || ''}
                onChange={handlePackageFormChange}
                placeholder="Package description..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPackageDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePackageSubmit}
              disabled={createPackageMutation.isPending || updatePackageMutation.isPending}
            >
              {createPackageMutation.isPending || updatePackageMutation.isPending
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
