import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  useComplianceRules,
  useUpdateComplianceRule,
  useCreateComplianceRule,
  useDeleteComplianceRule,
  ComplianceRule,
} from '@/hooks/useComplianceRules';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, GripVertical, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ComplianceSettings() {
  const { data: rules = [], isLoading } = useComplianceRules();
  const updateRule = useUpdateComplianceRule();
  const createRule = useCreateComplianceRule();
  const deleteRule = useDeleteComplianceRule();

  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newContentTypes, setNewContentTypes] = useState<string[]>(['email', 'image', 'video']);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const handleToggle = (rule: ComplianceRule) => {
    updateRule.mutate(
      { id: rule.id, enabled: !rule.enabled },
      {
        onError: () => toast({ title: 'Failed to update rule', variant: 'destructive' }),
      }
    );
  };

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    const maxOrder = rules.reduce((max, r) => Math.max(max, r.sort_order), 0);
    createRule.mutate(
      {
        label: newLabel.trim(),
        description: newDescription.trim(),
        content_types: newContentTypes,
        sort_order: maxOrder + 1,
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          setNewLabel('');
          setNewDescription('');
          setNewContentTypes(['email', 'image', 'video']);
          toast({ title: 'Rule added' });
        },
        onError: () => toast({ title: 'Failed to add rule', variant: 'destructive' }),
      }
    );
  };

  const handleSaveEdit = (id: string) => {
    updateRule.mutate(
      { id, label: editLabel, description: editDescription },
      {
        onSuccess: () => {
          setEditingId(null);
          toast({ title: 'Rule updated' });
        },
        onError: () => toast({ title: 'Failed to update rule', variant: 'destructive' }),
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteRule.mutate(id, {
      onSuccess: () => toast({ title: 'Rule deleted' }),
      onError: () => toast({ title: 'Failed to delete rule', variant: 'destructive' }),
    });
  };

  const startEdit = (rule: ComplianceRule) => {
    setEditingId(rule.id);
    setEditLabel(rule.label);
    setEditDescription(rule.description);
  };

  const toggleContentType = (type: string) => {
    setNewContentTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compliance Rules</h1>
          <p className="text-muted-foreground text-sm">
            Configure the rules the AI checks content against
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="py-4">
                {editingId === rule.id ? (
                  <div className="space-y-3">
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Rule label"
                    />
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description (used as AI guidance)"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveEdit(rule.id)}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{rule.label}</p>
                        <div className="flex gap-1">
                          {rule.content_types.map((ct) => (
                            <Badge key={ct} variant="outline" className="text-[10px] px-1 py-0 h-4">
                              {ct}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {rule.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => startEdit(rule)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => handleToggle(rule)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" className="w-full" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Custom Rule
          </Button>
        </div>
      )}

      {/* Add Rule Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Compliance Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rule Label</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. No alcohol references"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (AI guidance)</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Describe what the AI should check for..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Applies to</Label>
              <div className="flex gap-4">
                {['email', 'image', 'video'].map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newContentTypes.includes(type)}
                      onCheckedChange={() => toggleContentType(type)}
                    />
                    <span className="capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!newLabel.trim() || createRule.isPending}>
              {createRule.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
