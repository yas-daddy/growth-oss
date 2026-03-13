import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Mail, MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useEmailCampaignList } from '@/hooks/useEmailCampaigns';

export default function EmailCampaigns() {
  const navigate = useNavigate();
  const { campaigns, isLoading, createCampaign, deleteCampaign, renameCampaign } = useEmailCampaignList();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCanvasId, setNewCanvasId] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');

  const handleCreate = () => {
    if (!newName || !newCanvasId) return;
    createCampaign.mutate({ name: newName, canvas_id: newCanvasId }, {
      onSuccess: () => {
        setNewName('');
        setNewCanvasId('');
        setCreateOpen(false);
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Canvas Scheduler</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">No campaigns yet.</p>
              <p className="text-xs mt-1">Click "New Campaign" to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Canvas ID</TableHead>
                  <TableHead>Last Send</TableHead>
                  <TableHead>Next Send</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/email-campaigns/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{c.canvas_id || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.last_send ? format(new Date(c.last_send), 'dd MMM yyyy HH:mm') : '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.next_send ? format(new Date(c.next_send), 'dd MMM yyyy HH:mm') : '—'}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameName(c.name);
                              setRenameId(c.id);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Delete this campaign and all its broadcasts?')) {
                                deleteCampaign.mutate(c.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
            <DialogDescription>Create a new email campaign with its own Canvas ID and settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Campaign Name</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Free Bet Reward" className="mt-1" />
            </div>
            <div>
              <Label>Canvas ID</Label>
              <Input value={newCanvasId} onChange={e => setNewCanvasId(e.target.value)} placeholder="Braze Canvas ID" className="mt-1 font-mono" />
            </div>
            <Button onClick={handleCreate} disabled={!newName || !newCanvasId || createCampaign.isPending} className="w-full">
              {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameId} onOpenChange={(open) => { if (!open) setRenameId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Campaign</DialogTitle>
            <DialogDescription>Enter a new name for this campaign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Campaign Name</Label>
              <Input value={renameName} onChange={e => setRenameName(e.target.value)} placeholder="Campaign name" className="mt-1" />
            </div>
            <Button
              onClick={() => {
                if (renameId && renameName) {
                  renameCampaign.mutate({ id: renameId, name: renameName }, {
                    onSuccess: () => setRenameId(null),
                  });
                }
              }}
              disabled={!renameName || renameCampaign.isPending}
              className="w-full"
            >
              {renameCampaign.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
