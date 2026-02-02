import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format as formatDate } from 'date-fns';
import { User, Mail, Phone, Shield, Building2, Clock, Save, Key } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export function ProfilePage() {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Fetch profile
  const { data: profileData, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => settingsService.getProfile(),
  });

  // Set form values when profile data loads
  useEffect(() => {
    if (profileData?.data) {
      setName(profileData.data.name);
      setPhone(profileData.data.phone || '');
    }
  }, [profileData]);

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; phone?: string }) => settingsService.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setHasChanges(false);
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      settingsService.changePassword(data),
    onSuccess: () => {
      setShowPasswordDialog(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    },
    onError: (error: any) => {
      setPasswordError(error.response?.data?.message || 'Failed to change password');
    },
  });

  const handleNameChange = (value: string) => {
    setName(value);
    setHasChanges(value !== profileData?.data.name || phone !== (profileData?.data.phone || ''));
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    setHasChanges(name !== profileData?.data.name || value !== (profileData?.data.phone || ''));
  };

  const handleSave = () => {
    updateMutation.mutate({ name, phone: phone || undefined });
  };

  const handleChangePassword = () => {
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const profile = profileData?.data;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Profile Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle>{profile?.name}</CardTitle>
              <CardDescription>{profile?.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Role</div>
                <Badge variant="outline">{profile?.role.name}</Badge>
              </div>
            </div>
            {profile?.package && (
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Package</div>
                  <div className="font-medium">
                    {profile.package.code} - {profile.package.name}
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Last Login</div>
                <div className="font-medium">
                  {profile?.lastLogin
                    ? formatDate(new Date(profile.lastLogin), 'dd MMM yyyy HH:mm')
                    : 'Never'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Account Created</div>
                <div className="font-medium">
                  {profile?.createdAt
                    ? formatDate(new Date(profile.createdAt), 'dd MMM yyyy')
                    : '-'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Input value={profile?.email || ''} disabled className="bg-muted" />
            </div>
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>
          <div className="space-y-2">
            <Label>Full Name</Label>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Your full name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <Input
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="Your phone number"
              />
            </div>
          </div>
          <Button onClick={handleSave} disabled={!hasChanges || updateMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Manage your password and security settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Password</div>
              <div className="text-sm text-muted-foreground">
                Change your password to keep your account secure
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>
              <Key className="mr-2 h-4 w-4" />
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new password
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {passwordError && (
              <div className="text-sm text-red-500 bg-red-50 p-3 rounded">{passwordError}</div>
            )}
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProfilePage;
