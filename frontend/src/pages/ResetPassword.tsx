import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authService } from '@/services/auth.service';

/**
 * Public page reached from the password-reset email link:
 *   /reset-password?token=...
 * Lets a logged-out user set a new password. Must NOT sit behind the auth guard
 * (the whole point is that the user is locked out).
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      await authService.resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'This reset link is invalid or has expired. Please request a new one from the login page.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
            P
          </div>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>Choose a new password for your account</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="space-y-4">
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                This reset link is missing its token. Please open the link directly from your
                email, or request a new one from the login page.
              </div>
              <Button className="w-full" onClick={() => navigate('/login')}>
                Back to Login
              </Button>
            </div>
          ) : success ? (
            <div className="space-y-4">
              <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
                Your password has been reset. You can now sign in with your new password.
              </div>
              <Button className="w-full" onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm New Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Re-enter your new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Resetting...' : 'Reset Password'}
              </Button>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full text-center text-sm text-primary hover:underline"
              >
                Back to Login
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            &copy; 2026 PROTECTHER - Safety Audit Management
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
