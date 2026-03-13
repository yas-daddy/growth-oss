import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateAffiliate, useUpdateAffiliate, Affiliate, AffiliateStatus } from '@/hooks/useAffiliates';
import { useAppsFlyerCampaigns } from '@/hooks/useAppsFlyerCampaigns';
import { Loader2 } from 'lucide-react';

interface AffiliateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  affiliate?: Affiliate | null;
}

export function AffiliateDialog({ open, onOpenChange, affiliate }: AffiliateDialogProps) {
  const createAffiliate = useCreateAffiliate();
  const updateAffiliate = useUpdateAffiliate();
  const { data: campaigns } = useAppsFlyerCampaigns();
  const isEditing = !!affiliate;

  const [formData, setFormData] = useState({
    name: '',
    channel: '',
    cpa: '',
    monthly_cap: '',
    status: 'active' as AffiliateStatus,
    contact_email: '',
    notes: '',
  });

  // Get unique media sources from AppsFlyer campaigns
  const availableChannels = campaigns
    ? [...new Set(campaigns.map(c => c.media_source))].sort()
    : [];

  useEffect(() => {
    if (affiliate) {
      setFormData({
        name: affiliate.name,
        channel: affiliate.channel,
        cpa: affiliate.cpa.toString(),
        monthly_cap: (affiliate.monthly_cap || 0).toString(),
        status: affiliate.status,
        contact_email: affiliate.contact_email || '',
        notes: affiliate.notes || '',
      });
    } else {
      setFormData({
        name: '',
        channel: '',
        cpa: '',
        monthly_cap: '',
        status: 'active',
        contact_email: '',
        notes: '',
      });
    }
  }, [affiliate, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      name: formData.name.trim(),
      channel: formData.channel,
      cpa: parseFloat(formData.cpa) || 0,
      monthly_cap: parseFloat(formData.monthly_cap) || 0,
      status: formData.status,
      contact_email: formData.contact_email.trim() || null,
      notes: formData.notes.trim() || null,
    };

    try {
      if (isEditing) {
        await updateAffiliate.mutateAsync({ id: affiliate.id, ...payload });
      } else {
        await createAffiliate.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isPending = createAffiliate.isPending || updateAffiliate.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Affiliate' : 'Add New Affiliate'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update affiliate partner details.' : 'Add a new affiliate partner to track.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Partner Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., AffPartner Pro"
              required
            />
          </div>
          
          <div className="space-y-2">
           <Label htmlFor="channel">Channel (Media Source) *</Label>
            <Input
              id="channel"
              value={formData.channel}
              onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
              list="channel-suggestions"
              placeholder="Type a name or pick from AppsFlyer"
              required
            />
            <datalist id="channel-suggestions">
              {availableChannels.map((ch) => (
                <option key={ch} value={ch} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpa">CPA (£)</Label>
              <Input
                id="cpa"
                type="number"
                step="0.01"
                min="0"
                value={formData.cpa}
                onChange={(e) => setFormData({ ...formData, cpa: e.target.value })}
                placeholder="25.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly_cap">Monthly Cap (£)</Label>
              <Input
                id="monthly_cap"
                type="number"
                step="0.01"
                min="0"
                value={formData.monthly_cap}
                onChange={(e) => setFormData({ ...formData, monthly_cap: e.target.value })}
                placeholder="10000.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: AffiliateStatus) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">Contact Email</Label>
            <Input
              id="contact_email"
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              placeholder="partner@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Affiliate'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
