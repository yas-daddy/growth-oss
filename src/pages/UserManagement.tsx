import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Users, Mail, Shield, UserPlus, Trash2, Clock, LogOut, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAllUsers, useUserInvitations, useUserRole, AppRole } from '@/hooks/useUserRole';
import { useAffiliates } from '@/hooks/useAffiliates';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function UserManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { data: users = [], isLoading: usersLoading } = useAllUsers();
  const { data: invitations = [], isLoading: invitationsLoading } = useUserInvitations();
  const { data: affiliates = [] } = useAffiliates();
  const queryClient = useQueryClient();

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>('user');
  const [inviteAffiliateId, setInviteAffiliateId] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<{ id: string; name: string; email: string } | null>(null);

  // Redirect non-admins
  if (!roleLoading && !isAdmin) {
    navigate('/');
    return null;
  }

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role, affiliateId }: { email: string; role: AppRole; affiliateId?: string }) => {
      // First create the invitation record
      const { error: insertError } = await supabase
        .from('user_invitations')
        .insert({
          email,
          role,
          affiliate_id: role === 'affiliate' ? affiliateId : null,
          invited_by: user!.id,
        });
      
      if (insertError) throw insertError;

      // Get inviter name and affiliate name for the email
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user!.id)
        .single();

      let affiliateName: string | undefined;
      if (role === 'affiliate' && affiliateId) {
        const affiliate = affiliates.find(a => a.id === affiliateId);
        affiliateName = affiliate?.name;
      }

      // Send the invitation email
      const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: {
          email,
          role,
          inviterName: profile?.full_name,
          affiliateName,
        },
      });

      if (emailError) {
        console.error('Failed to send invite email:', emailError);
        // Don't throw - invitation is created, email just didn't send
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
      toast.success('Invitation sent successfully');
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('user');
      setInviteAffiliateId('');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('This email has already been invited');
      } else {
        toast.error(`Failed to send invitation: ${error.message}`);
      }
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('user_invitations')
        .delete()
        .eq('id', invitationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
      toast.success('Invitation cancelled');
    },
    onError: (error: any) => {
      toast.error(`Failed to cancel invitation: ${error.message}`);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      // First delete existing role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      // Then insert new role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('Role updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to update role: ${error.message}`);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-user-management', {
        body: { action: 'delete', targetUserId: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('User deleted and all sessions invalidated');
      setDeleteDialogOpen(false);
      setTargetUser(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete user: ${error.message}`);
    },
  });

  const revokeSessionsMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-user-management', {
        body: { action: 'revoke_sessions', targetUserId: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('All user sessions have been revoked');
      setRevokeDialogOpen(false);
      setTargetUser(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to revoke sessions: ${error.message}`);
    },
  });

  const handleInvite = () => {
    if (!inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }
    if (inviteRole === 'affiliate' && !inviteAffiliateId) {
      toast.error('Please select an affiliate partner');
      return;
    }
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole, affiliateId: inviteAffiliateId });
  };

  const getRoleBadge = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-primary/10 text-primary border-primary/30">Admin</Badge>;
      case 'user':
        return <Badge variant="secondary">User</Badge>;
      case 'affiliate':
        return <Badge className="bg-accent/10 text-accent border-accent/30">Affiliate</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const isLoading = roleLoading || usersLoading || invitationsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const pendingInvitations = invitations.filter(i => !i.accepted_at);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users & Access</h1>
          <p className="text-muted-foreground">
            Manage user access levels and invitations
          </p>
        </div>
        
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
              <DialogDescription>
                Send an invitation email with OTP verification
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Access Level</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin - Full access</SelectItem>
                    <SelectItem value="user">User - Read-only, no settings</SelectItem>
                    <SelectItem value="affiliate">Affiliate - Partner specific access</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {inviteRole === 'affiliate' && (
                <div className="space-y-2">
                  <Label htmlFor="affiliate">Affiliate Partner</Label>
                  <Select value={inviteAffiliateId} onValueChange={setInviteAffiliateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select partner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {affiliates.map(affiliate => (
                        <SelectItem key={affiliate.id} value={affiliate.id}>
                          {affiliate.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Access Level Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Admin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Full access to all features, settings, and user management
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              View all dashboards and data, cannot change settings or sync
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-accent" />
              Affiliate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Access only to their specific affiliate partner dashboard
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              Users who haven't accepted their invitation yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation: any) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>{getRoleBadge(invitation.role)}</TableCell>
                    <TableCell>
                      {invitation.affiliates?.name || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Active Users */}
      <Card>
        <CardHeader>
          <CardTitle>Active Users</CardTitle>
          <CardDescription>
            All users with access to the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No users found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Affiliate Access</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userRow: any) => {
                  const currentRole = userRow.roles?.[0]?.role || 'viewer';
                  const isCurrentUser = userRow.user_id === user?.id;
                  
                  return (
                    <TableRow key={userRow.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{userRow.full_name || 'User'}</p>
                          <p className="text-xs text-muted-foreground">{userRow.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(currentRole)}</TableCell>
                      <TableCell>
                        {userRow.affiliateAccess?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {userRow.affiliateAccess.map((access: any) => (
                              <Badge key={access.id} variant="outline" className="text-xs">
                                {access.affiliates?.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {userRow.last_login_at 
                          ? formatDistanceToNow(new Date(userRow.last_login_at), { addSuffix: true })
                          : <span className="text-muted-foreground/50">Never</span>
                        }
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(userRow.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isCurrentUser && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <div className="w-full">
                                  <Select
                                    value={currentRole}
                                    onValueChange={(newRole) => 
                                      updateRoleMutation.mutate({ userId: userRow.user_id, newRole: newRole as AppRole })
                                    }
                                  >
                                    <SelectTrigger className="w-full border-0 shadow-none h-auto p-0 focus:ring-0">
                                      <SelectValue placeholder="Change role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="user">User</SelectItem>
                                      <SelectItem value="affiliate">Affiliate</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setTargetUser({ id: userRow.user_id, name: userRow.full_name || 'User', email: userRow.email });
                                  setRevokeDialogOpen(true);
                                }}
                              >
                                <LogOut className="h-4 w-4 mr-2" />
                                Revoke All Sessions
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  setTargetUser({ id: userRow.user_id, name: userRow.full_name || 'User', email: userRow.email });
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {isCurrentUser && (
                          <span className="text-xs text-muted-foreground">You</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{targetUser?.name}</strong> ({targetUser?.email})?
              This will remove their account and invalidate all active sessions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTargetUser(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => targetUser && deleteUserMutation.mutate(targetUser.id)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Sessions Confirmation Dialog */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke All Sessions</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke all sessions for <strong>{targetUser?.name}</strong> ({targetUser?.email})?
              This will immediately log them out of all devices and invalidate all their tokens. They will need to sign in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTargetUser(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => targetUser && revokeSessionsMutation.mutate(targetUser.id)}
              disabled={revokeSessionsMutation.isPending}
            >
              {revokeSessionsMutation.isPending ? 'Revoking...' : 'Revoke Sessions'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
