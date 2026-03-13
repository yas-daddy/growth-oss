import { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Image, Video, Check, RefreshCw, Database, ExternalLink, Search, Instagram, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type MediaLibraryItem, type ExistingPostsData } from '@/hooks/useMetaAdCreation';
import { formatDistanceToNow } from 'date-fns';

interface MediaLibraryData {
  bucket: MediaLibraryItem[];
  meta: {
    images: MediaLibraryItem[];
    videos: MediaLibraryItem[];
  };
}

interface MediaLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaLibrary: MediaLibraryData | undefined;
  existingPosts?: ExistingPostsData;
  isLoading: boolean;
  isLoadingPosts?: boolean;
  onRefresh: () => void;
  onRefreshPosts?: () => void;
  onSelectMedia: (items: MediaLibraryItem[]) => void;
}

// Video thumbnail component with hover-to-play preview
function VideoThumbnail({ item, getThumbnailUrl }: { item: MediaLibraryItem; getThumbnailUrl: (item: MediaLibraryItem) => string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  const handleMouseEnter = () => {
    setIsHovering(true);
    if (videoRef.current && item.source === 'bucket') {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };
  
  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  // For bucket videos, show actual video with play on hover
  if (item.source === 'bucket' && item.url && !hasError) {
    return (
      <div 
        className="w-full h-full relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <video 
          ref={videoRef}
          src={item.url}
          className="w-full h-full object-cover"
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setHasError(true)}
          onLoadedData={(e) => {
            (e.target as HTMLVideoElement).currentTime = 0.5;
          }}
        />
        {/* Play indicator when not hovering */}
        {!isHovering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full bg-black/50 p-2">
              <Video className="h-4 w-4 text-white" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // For Meta videos or fallback, show thumbnail image
  const thumbnailUrl = getThumbnailUrl(item);
  if (thumbnailUrl) {
    return (
      <>
        <img 
          src={thumbnailUrl} 
          alt={item.name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rounded-full bg-black/50 p-2">
            <Video className="h-4 w-4 text-white" />
          </div>
        </div>
      </>
    );
  }

  // Fallback icon
  return (
    <div className="w-full h-full flex items-center justify-center">
      <Video className="h-8 w-8 text-muted-foreground" />
    </div>
  );
}

// Get media type badge text
function getMediaTypeBadge(mediaType?: string): string {
  switch (mediaType) {
    case 'REELS': return 'Reel';
    case 'VIDEO': return 'Video';
    case 'IMAGE': return 'Image';
    case 'CAROUSEL_ALBUM': return 'Carousel';
    default: return 'Post';
  }
}

export function MediaLibraryDialog({
  open,
  onOpenChange,
  mediaLibrary,
  existingPosts,
  isLoading,
  isLoadingPosts,
  onRefresh,
  onRefreshPosts,
  onSelectMedia,
}: MediaLibraryDialogProps) {
  const [selectedItems, setSelectedItems] = useState<MediaLibraryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'bucket' | 'meta' | 'posts'>('bucket');
  const [searchQuery, setSearchQuery] = useState('');

  const bucketItems = mediaLibrary?.bucket || [];
  const metaItems = [
    ...(mediaLibrary?.meta?.images || []),
    ...(mediaLibrary?.meta?.videos || []),
  ];

  // Convert Instagram posts to MediaLibraryItem format
  const postItems: MediaLibraryItem[] = useMemo(() => {
    if (!existingPosts?.instagram) return [];
    return existingPosts.instagram.map(post => ({
      id: post.id,
      name: post.caption 
        ? (post.caption.length > 50 ? post.caption.substring(0, 50) + '...' : post.caption)
        : `Post ${post.id.slice(-6)}`,
      url: post.media_url,
      thumbnailUrl: post.thumbnail_url || post.media_url,
      type: (post.media_type === 'IMAGE' ? 'image' : 'video') as 'image' | 'video',
      source: 'existing_post' as const,
      sourceInstagramMediaId: post.id,
      caption: post.caption || undefined,
      permalink: post.permalink,
      mediaType: post.media_type,
      created_at: post.timestamp,
    }));
  }, [existingPosts]);

  // Filter items by search query
  const filteredBucketItems = useMemo(() => {
    if (!searchQuery.trim()) return bucketItems;
    const query = searchQuery.toLowerCase();
    return bucketItems.filter(item => item.name.toLowerCase().includes(query));
  }, [bucketItems, searchQuery]);

  const filteredMetaItems = useMemo(() => {
    if (!searchQuery.trim()) return metaItems;
    const query = searchQuery.toLowerCase();
    return metaItems.filter(item => item.name?.toLowerCase().includes(query));
  }, [metaItems, searchQuery]);

  const filteredPostItems = useMemo(() => {
    if (!searchQuery.trim()) return postItems;
    const query = searchQuery.toLowerCase();
    return postItems.filter(item => 
      item.name?.toLowerCase().includes(query) ||
      item.caption?.toLowerCase().includes(query)
    );
  }, [postItems, searchQuery]);

  const toggleItem = (item: MediaLibraryItem) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.filter(i => i.id !== item.id);
      }
      return [...prev, item];
    });
  };

  const isSelected = (item: MediaLibraryItem) => {
    return selectedItems.some(i => i.id === item.id);
  };

  const handleConfirm = () => {
    onSelectMedia(selectedItems);
    setSelectedItems([]);
    setSearchQuery('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedItems([]);
    setSearchQuery('');
    onOpenChange(false);
  };

  const handleRefresh = () => {
    onRefresh();
    if (onRefreshPosts) {
      onRefreshPosts();
    }
  };

  // Get thumbnail URL - for bucket items use the actual URL, for meta use thumbnail
  const getThumbnailUrl = (item: MediaLibraryItem) => {
    if (item.source === 'bucket') {
      // For videos in bucket, we can't easily get thumbnails, so use the URL
      // For images, use the URL directly
      return item.url;
    }
    return item.thumbnailUrl || item.url;
  };

  // Get filename without extension for display
  const getDisplayName = (name: string) => {
    if (!name) return 'Untitled';
    const lastDotIndex = name.lastIndexOf('.');
    if (lastDotIndex === -1) return name;
    return name.substring(0, lastDotIndex);
  };

  const renderMediaGrid = (items: MediaLibraryItem[], emptyMessage: string, loading?: boolean) => {
    if (loading) {
      return (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square rounded-lg" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Database className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm text-center px-4">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1">
        {items.map((item) => (
          <button
            key={item.id}
            className={cn(
              "relative flex flex-col rounded-lg overflow-hidden bg-muted border-2 transition-all text-left",
              isSelected(item) 
                ? "border-primary ring-2 ring-primary/20" 
                : "border-transparent hover:border-muted-foreground/30"
            )}
            onClick={() => toggleItem(item)}
          >
            {/* Thumbnail */}
            <div className="aspect-square relative bg-muted-foreground/10">
              {item.type === 'image' ? (
                <img 
                  src={getThumbnailUrl(item)} 
                  alt={item.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <VideoThumbnail item={item} getThumbnailUrl={getThumbnailUrl} />
              )}

              {/* Selection indicator */}
              {isSelected(item) && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <div className="rounded-full bg-primary p-1">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
              )}

              {/* Type badge */}
              <Badge 
                variant="secondary" 
                className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0"
              >
                {item.source === 'existing_post' ? (
                  <span className="flex items-center gap-0.5">
                    {getMediaTypeBadge(item.mediaType)}
                  </span>
                ) : item.type === 'image' ? (
                  <Image className="h-3 w-3" />
                ) : (
                  <Video className="h-3 w-3" />
                )}
              </Badge>

              {/* Source indicator */}
              {item.source === 'meta' && (
                <Badge 
                  variant="outline" 
                  className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0 bg-background/80"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                </Badge>
              )}
              {item.source === 'existing_post' && (
                <Badge 
                  variant="outline" 
                  className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0 bg-background/80"
                >
                  <Instagram className="h-2.5 w-2.5" />
                </Badge>
              )}
            </div>

            {/* Filename / Caption */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="px-2 py-1.5 bg-background">
                    <p className="text-xs text-muted-foreground truncate">
                      {item.source === 'existing_post' 
                        ? (item.caption || `Post ${item.id.slice(-6)}`)
                        : getDisplayName(item.name)
                      }
                    </p>
                    {item.source === 'existing_post' && item.created_at && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[300px]">
                  <p className="text-xs break-all">
                    {item.source === 'existing_post' 
                      ? (item.caption || item.name)
                      : item.name
                    }
                  </p>
                  {item.permalink && (
                    <a 
                      href={item.permalink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on Instagram <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Media Library</DialogTitle>
              <DialogDescription>
                Select media from your library, Meta ad account, or existing posts
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isLoadingPosts}
            >
              <RefreshCw className={cn("h-4 w-4 mr-1", (isLoading || isLoadingPosts) && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        {/* Search input */}
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by filename or caption..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'bucket' | 'meta' | 'posts')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="bucket" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              My Library
              {filteredBucketItems.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {filteredBucketItems.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="meta" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Meta Library
              {filteredMetaItems.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {filteredMetaItems.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <Instagram className="h-4 w-4" />
              Existing Posts
              {isLoadingPosts ? (
                <Loader2 className="h-3 w-3 animate-spin ml-1" />
              ) : filteredPostItems.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {filteredPostItems.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-[350px]">
              <TabsContent value="bucket" className="mt-0">
                {renderMediaGrid(filteredBucketItems, "No media in your library yet. Files you upload when creating ads will appear here.", isLoading)}
              </TabsContent>
              <TabsContent value="meta" className="mt-0">
                {renderMediaGrid(filteredMetaItems, "No media found in your Meta ad account.", isLoading)}
              </TabsContent>
              <TabsContent value="posts" className="mt-0">
                {renderMediaGrid(filteredPostItems, "No Instagram posts found. Make sure your Instagram account is connected.", isLoadingPosts)}
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>

        {/* Footer with selection count and confirm button */}
        <div className="flex items-center justify-between pt-4 border-t flex-shrink-0">
          <p className="text-sm text-muted-foreground">
            {selectedItems.length > 0 
              ? `${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''} selected`
              : 'Click to select media'
            }
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={selectedItems.length === 0}
            >
              Add Selected
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
