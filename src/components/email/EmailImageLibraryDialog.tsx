import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Database, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface StorageImage {
  name: string;
  url: string;
}

interface EmailImageLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
}

export function EmailImageLibraryDialog({ open, onOpenChange, onSelect }: EmailImageLibraryDialogProps) {
  const [images, setImages] = useState<StorageImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('email-assets')
        .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });

      if (error) throw error;

      const imageFiles = (data || []).filter(f =>
        /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name)
      );

      const items: StorageImage[] = imageFiles.map(f => {
        const { data: urlData } = supabase.storage.from('email-assets').getPublicUrl(f.name);
        return { name: f.name, url: urlData.publicUrl };
      });

      setImages(items);
    } catch (err) {
      console.error('Failed to load email images:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchImages();
      setSelectedUrl(null);
      setSearchQuery('');
    }
  }, [open]);

  const filtered = searchQuery.trim()
    ? images.filter(img => img.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : images;

  const handleConfirm = () => {
    if (selectedUrl) {
      onSelect(selectedUrl);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Header Image Library</DialogTitle>
              <DialogDescription>Select a previously uploaded header image</DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchImages} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1 min-h-0 h-[350px]">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Database className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">
                {images.length === 0
                  ? 'No images uploaded yet. Images you upload for campaigns will appear here.'
                  : 'No images match your search.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1">
              {filtered.map((img) => (
                <button
                  key={img.name}
                  className={cn(
                    "relative flex flex-col rounded-lg overflow-hidden bg-muted border-2 transition-all text-left",
                    selectedUrl === img.url
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/30"
                  )}
                  onClick={() => setSelectedUrl(img.url)}
                >
                  <div className="aspect-video relative bg-muted-foreground/10">
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {selectedUrl === img.url && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="rounded-full bg-primary p-1">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-1.5 bg-background">
                    <p className="text-xs text-muted-foreground truncate">
                      {img.name.replace(/\.[^/.]+$/, '')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t flex-shrink-0">
          <p className="text-sm text-muted-foreground">
            {selectedUrl ? '1 image selected' : 'Click to select an image'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={!selectedUrl}>Use Selected</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
