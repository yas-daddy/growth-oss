import { useState, useEffect } from 'react';
import { Plus, Trash2, LayoutDashboard, Target, DollarSign, BarChart3, Users, TrendingUp, Calendar, Star, Shield, Megaphone, CalendarDays, PieChart, LineChart, Activity, GripVertical } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAllDashboards, useCreateDashboard, useDeleteDashboard, useReorderDashboards, DashboardConfig } from '@/hooks/useDashboardConfig';
import { cn } from '@/lib/utils';

const AVAILABLE_ICONS = [
  { name: 'LayoutDashboard', icon: LayoutDashboard },
  { name: 'Target', icon: Target },
  { name: 'DollarSign', icon: DollarSign },
  { name: 'BarChart3', icon: BarChart3 },
  { name: 'Users', icon: Users },
  { name: 'TrendingUp', icon: TrendingUp },
  { name: 'Calendar', icon: Calendar },
  { name: 'Star', icon: Star },
  { name: 'Shield', icon: Shield },
  { name: 'Megaphone', icon: Megaphone },
  { name: 'CalendarDays', icon: CalendarDays },
  { name: 'PieChart', icon: PieChart },
  { name: 'LineChart', icon: LineChart },
  { name: 'Activity', icon: Activity },
];

export function getIconComponent(iconName: string | null) {
  const found = AVAILABLE_ICONS.find(i => i.name === iconName);
  return found?.icon || LayoutDashboard;
}

interface DashboardManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DashboardManagerDialog({ open, onOpenChange }: DashboardManagerDialogProps) {
  const { data: dashboards = [], isLoading } = useAllDashboards();
  const createDashboard = useCreateDashboard();
  const deleteDashboard = useDeleteDashboard();
  const reorderDashboards = useReorderDashboards();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('LayoutDashboard');
  const [deleteTarget, setDeleteTarget] = useState<DashboardConfig | null>(null);
  const [localDashboards, setLocalDashboards] = useState<DashboardConfig[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Sync local state with fetched data
  useEffect(() => {
    setLocalDashboards(dashboards);
  }, [dashboards]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    
    await createDashboard.mutateAsync({ name: newName.trim(), icon: selectedIcon });
    setNewName('');
    setSelectedIcon('LayoutDashboard');
    setIsCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDashboard.mutateAsync(deleteTarget.dashboard_slug);
    setDeleteTarget(null);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...localDashboards];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, removed);
    setLocalDashboards(newItems);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null) {
      const orderedSlugs = localDashboards.map(d => d.dashboard_slug);
      reorderDashboards.mutate(orderedSlugs);
    }
    setDraggedIndex(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Dashboards</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Existing dashboards */}
            <div className="space-y-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : localDashboards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dashboards yet</p>
              ) : (
                localDashboards.map((dashboard, index) => {
                  const IconComponent = getIconComponent(dashboard.icon);
                  return (
                    <div
                      key={dashboard.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border bg-card cursor-move group",
                        draggedIndex === index && "opacity-50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <IconComponent className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{dashboard.name || dashboard.dashboard_slug}</span>
                      </div>
                      {dashboard.is_deletable !== false && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(dashboard)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Create new dashboard */}
            {isCreating ? (
              <div className="space-y-4 p-4 rounded-lg border bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="dashboard-name">Dashboard Name</Label>
                  <Input
                    id="dashboard-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Performance"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label>Icon</Label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setSelectedIcon(name)}
                        className={cn(
                          "p-2 rounded-md border transition-colors",
                          selectedIcon === name
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsCreating(false);
                      setNewName('');
                      setSelectedIcon('LayoutDashboard');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreate}
                    disabled={!newName.trim() || createDashboard.isPending}
                  >
                    {createDashboard.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsCreating(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Dashboard
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dashboard?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name || deleteTarget?.dashboard_slug}" and all its configuration. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
