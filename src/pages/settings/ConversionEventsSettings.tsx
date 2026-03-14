import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Star, Pencil, Trash2, Loader2, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useConversionEvents, useCreateConversionEvent, useUpdateConversionEvent, useDeleteConversionEvent } from '@/hooks/useConversionEvents';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export default function ConversionEventsSettings() {
  const { isOrgAdmin } = useOrganization();
  const { data: events, isLoading } = useConversionEvents();
  const createEvent = useCreateConversionEvent();
  const updateEvent = useUpdateConversionEvent();
  const deleteEvent = useDeleteConversionEvent();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventLabel, setEventLabel] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setEventName('');
    setEventLabel('');
    setIsPrimary(!events?.length); // First event defaults to primary
    setDialogOpen(true);
  };

  const openEdit = (event: { id: string; event_name: string; event_label: string; is_primary: boolean }) => {
    setEditingId(event.id);
    setEventName(event.event_name);
    setEventLabel(event.event_label);
    setIsPrimary(event.is_primary);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!eventName.trim() || !eventLabel.trim()) {
      toast.error('Please fill in both fields');
      return;
    }

    try {
      if (editingId) {
        await updateEvent.mutateAsync({ id: editingId, event_name: eventName.trim(), event_label: eventLabel.trim(), is_primary: isPrimary });
        toast.success('Event updated');
      } else {
        await createEvent.mutateAsync({ event_name: eventName.trim(), event_label: eventLabel.trim(), is_primary: isPrimary });
        toast.success('Event created');
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteEvent.mutateAsync(deleteConfirm);
      toast.success('Event deleted');
      setDeleteConfirm(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await updateEvent.mutateAsync({ id, is_primary: true });
      toast.success('Primary event updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Conversion Events</h1>
          <p className="text-muted-foreground">Define the events that represent conversions for CPA tracking</p>
        </div>
        {isOrgAdmin && (
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Event
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Conversion Events</CardTitle>
          <CardDescription>
            The primary event (★) is used for CPA calculations across all dashboards and reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !events?.length ? (
            <div className="text-center py-8">
              <Target className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No conversion events defined yet</p>
              {isOrgAdmin && (
                <Button onClick={openCreate} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add your first event
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {events.map(event => (
                <div
                  key={event.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    event.is_primary ? 'border-primary/30 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {event.is_primary ? (
                      <Star className="h-4 w-4 text-primary fill-primary" />
                    ) : (
                      <button
                        onClick={() => isOrgAdmin && handleSetPrimary(event.id)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Set as primary"
                        disabled={!isOrgAdmin}
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{event.event_label}</span>
                        {event.is_primary && (
                          <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30">Primary</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{event.event_name}</span>
                    </div>
                  </div>
                  {isOrgAdmin && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(event)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(event.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit' : 'Add'} Conversion Event</DialogTitle>
            <DialogDescription>
              Define an event from your analytics provider that represents a conversion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Event Name (technical)</Label>
              <Input
                placeholder="e.g. purchase, signup, subscription_start"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">Must match the event name in your analytics provider</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Display Label</Label>
              <Input
                placeholder="e.g. Purchase, Sign Up"
                value={eventLabel}
                onChange={(e) => setEventLabel(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Set as primary (used for CPA calculations)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createEvent.isPending || updateEvent.isPending}>
              {(createEvent.isPending || updateEvent.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversion Event</DialogTitle>
            <DialogDescription>This will remove the event. Any reports using it will need to be reconfigured.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteEvent.isPending}>
              {deleteEvent.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
