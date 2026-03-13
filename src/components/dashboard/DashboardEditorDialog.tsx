import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { GripVertical, Plus, X, Check, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useReportDefinitions, ReportDefinition } from '@/hooks/useReportDefinitions';
import { useDashboardConfig, useUpdateDashboardConfig } from '@/hooks/useDashboardConfig';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface DashboardEditorDialogProps {
  dashboardSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigChange?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  acquisition: 'Acquisition',
  revenue: 'Revenue',
  channels: 'Channels',
  affiliates: 'Affiliates',
  ratings: 'Ratings',
  funnel: 'Funnel',
  performance: 'Performance',
};

const CATEGORY_ORDER = ['acquisition', 'revenue', 'channels', 'affiliates', 'ratings', 'funnel', 'performance'];

export function DashboardEditorDialog({ 
  dashboardSlug, 
  open, 
  onOpenChange, 
  onConfigChange 
}: DashboardEditorDialogProps) {
  const { data: config, isLoading: configLoading } = useDashboardConfig(dashboardSlug);
  const { data: allReports, isLoading: reportsLoading } = useReportDefinitions();
  const updateConfig = useUpdateDashboardConfig();
  
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER));

  useEffect(() => {
    if (config?.report_slugs) {
      setSelectedSlugs(config.report_slugs);
    }
  }, [config]);

  // Reset search when dialog opens
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setExpandedCategories(new Set(CATEGORY_ORDER));
    }
  }, [open]);

  const selectedReports = selectedSlugs
    .map(slug => allReports?.find(r => r.slug === slug))
    .filter((r): r is ReportDefinition => !!r);

  const availableReports = allReports?.filter(r => !selectedSlugs.includes(r.slug)) || [];

  // Filter and group available reports
  const groupedAvailableReports = useMemo(() => {
    const filtered = availableReports.filter(report => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        report.name.toLowerCase().includes(query) ||
        report.category.toLowerCase().includes(query) ||
        report.report_type.toLowerCase().includes(query)
      );
    });

    const grouped: Record<string, ReportDefinition[]> = {};
    filtered.forEach(report => {
      const category = report.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(report);
    });

    // Sort categories by predefined order
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
      const aIndex = CATEGORY_ORDER.indexOf(a);
      const bIndex = CATEGORY_ORDER.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    return { grouped, sortedCategories, totalCount: filtered.length };
  }, [availableReports, searchQuery]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSlugs = [...selectedSlugs];
    const [removed] = newSlugs.splice(draggedIndex, 1);
    newSlugs.splice(index, 0, removed);
    setSelectedSlugs(newSlugs);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleAddReport = (slug: string) => {
    setSelectedSlugs([...selectedSlugs, slug]);
  };

  const handleRemoveReport = (slug: string) => {
    setSelectedSlugs(selectedSlugs.filter(s => s !== slug));
  };

  const handleSave = async () => {
    await updateConfig.mutateAsync({ dashboardSlug, reportSlugs: selectedSlugs });
    onConfigChange?.();
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedSlugs(config?.report_slugs || []);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Configure Dashboard</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 mt-4">
          {/* Selected Reports */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Active Reports ({selectedReports.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-[350px]">
                {configLoading || reportsLoading ? (
                  <div className="text-sm text-muted-foreground p-2">Loading...</div>
                ) : selectedReports.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2">No reports added</div>
                ) : (
                  <div className="space-y-1">
                    {selectedReports.map((report, index) => (
                      <div
                        key={report.slug}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-2 p-2 rounded-md bg-muted/50 cursor-move group ${
                          draggedIndex === index ? 'opacity-50' : ''
                        }`}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{report.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {report.report_type}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveReport(report.slug)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Available Reports */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Available Reports ({groupedAvailableReports.totalCount})</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-2">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              
              <ScrollArea className="h-[310px]">
                {reportsLoading ? (
                  <div className="text-sm text-muted-foreground p-2">Loading...</div>
                ) : groupedAvailableReports.totalCount === 0 ? (
                  <div className="text-sm text-muted-foreground p-2">
                    {searchQuery ? 'No matching reports found' : 'All reports added'}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {groupedAvailableReports.sortedCategories.map((category) => (
                      <Collapsible
                        key={category}
                        open={expandedCategories.has(category)}
                        onOpenChange={() => toggleCategory(category)}
                      >
                        <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-muted/50 text-left">
                          {expandedCategories.has(category) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium">
                            {CATEGORY_LABELS[category] || category}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {groupedAvailableReports.grouped[category].length}
                          </span>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-4">
                          {groupedAvailableReports.grouped[category].map((report) => (
                            <div
                              key={report.slug}
                              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{report.name}</div>
                                <div className="text-xs text-muted-foreground capitalize">
                                  {report.report_type}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleAddReport(report.slug)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateConfig.isPending} className="gap-2">
            <Check className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}