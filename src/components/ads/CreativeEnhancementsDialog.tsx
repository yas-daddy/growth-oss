import { useState, useEffect, useRef } from 'react';
import { Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useCreativeEnhancements, ENHANCEMENT_CONFIG, EnhancementKey, DEFAULT_ENHANCEMENTS } from '@/hooks/useCreativeEnhancements';

interface CreativeEnhancementsDialogProps {
  trigger?: React.ReactNode;
}

const CATEGORY_LABELS: Record<string, string> = {
  translation: 'Translation',
  text: 'Text',
  layout: 'Layout',
  visual: 'Visual',
  video: 'Video',
  display: 'Display',
};

const CATEGORY_ORDER = ['translation', 'text', 'layout', 'visual', 'video', 'display'];

export function CreativeEnhancementsDialog({ trigger }: CreativeEnhancementsDialogProps) {
  const { enhancements, isLoading, saveEnhancements, isSaving } = useCreativeEnhancements();
  const [open, setOpen] = useState(false);
  const [localEnhancements, setLocalEnhancements] = useState(enhancements);
  const initializedRef = useRef(false);

  // Sync local state when enhancements load (only once after initial load)
  useEffect(() => {
    if (!isLoading && !initializedRef.current) {
      setLocalEnhancements(enhancements);
      initializedRef.current = true;
    }
  }, [isLoading, enhancements]);

  const handleToggle = (key: EnhancementKey) => {
    setLocalEnhancements(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = () => {
    saveEnhancements(localEnhancements);
  };

  const handleResetToDefaults = () => {
    setLocalEnhancements(DEFAULT_ENHANCEMENTS);
  };

  // Group enhancements by category
  const groupedEnhancements = CATEGORY_ORDER.map(category => ({
    category,
    label: CATEGORY_LABELS[category],
    items: (Object.entries(ENHANCEMENT_CONFIG) as [EnhancementKey, typeof ENHANCEMENT_CONFIG[EnhancementKey]][])
      .filter(([_, config]) => config.category === category)
      .map(([key, config]) => ({ key, ...config })),
  })).filter(group => group.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings2 className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Advantage+ Creative Settings</DialogTitle>
          <DialogDescription>
            Configure which Meta Advantage+ Creative enhancements to enable by default for your ads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading settings...</div>
          ) : (
            groupedEnhancements.map((group, groupIndex) => (
              <div key={group.category}>
                {groupIndex > 0 && <Separator className="mb-4" />}
                <h4 className="text-sm font-medium mb-3">{group.label}</h4>
                <div className="space-y-3">
                  {group.items.map(item => (
                    <div key={item.key} className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={item.key} className="text-sm font-normal cursor-pointer">
                          {item.label}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </p>
                      </div>
                      <Switch
                        id={item.key}
                        checked={localEnhancements[item.key]}
                        onCheckedChange={() => handleToggle(item.key)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleResetToDefaults}
            disabled={isSaving}
          >
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save as default'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
