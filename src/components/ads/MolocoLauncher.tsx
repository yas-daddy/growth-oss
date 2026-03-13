import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Upload, X, Image, Video, Loader2, Check, AlertCircle, Rocket, RefreshCw, ChevronsUpDown, FolderOpen } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useUploadToStorage, useCheckFileExists, useMediaLibrary, type UploadedMedia, type MediaLibraryItem } from '@/hooks/useMetaAdCreation';
import { useMolocoTrackingLinks, useMolocoCampaignsAndAdGroups, useUploadMolocoCreative, useCreateMolocoCreativeGroup, useAttachToMolocoAdGroup, type MolocoAdGroup } from '@/hooks/useMolocoAdCreation';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { MediaLibraryDialog } from '@/components/ads/MediaLibraryDialog';
import { useCreateAdLaunchHistory, useUpdateAdLaunchHistory } from '@/hooks/useAdLaunchHistory';

interface MolocoLauncherProps {
  onBack?: () => void;
}

export function MolocoLauncher({ onBack }: MolocoLauncherProps) {
  const { toast } = useToast();
  
  // Moloco data hooks
  const { data: trackingLinks, isLoading: trackingLinksLoading, refetch: refetchTrackingLinks } = useMolocoTrackingLinks();
  const { data: campaignsData, isLoading: campaignsLoading, refetch: refetchCampaigns } = useMolocoCampaignsAndAdGroups();
  const { data: mediaLibrary, isLoading: mediaLibraryLoading, refetch: refetchMediaLibrary } = useMediaLibrary();
  
  // Mutations
  const uploadToStorage = useUploadToStorage();
  const checkFileExists = useCheckFileExists();
  const uploadMolocoCreative = useUploadMolocoCreative();
  const createCreativeGroup = useCreateMolocoCreativeGroup();
  const attachToAdGroup = useAttachToMolocoAdGroup();
  const createLaunchHistory = useCreateAdLaunchHistory();
  const updateLaunchHistory = useUpdateAdLaunchHistory();
  
  // Form state
  const [mediaFiles, setMediaFiles] = useState<(UploadedMedia & { uploadProgress?: number; molocoCreativeId?: string })[]>([]);
  const [selectedAdGroups, setSelectedAdGroups] = useState<MolocoAdGroup[]>([]);
  const [adGroupSearchOpen, setAdGroupSearchOpen] = useState(false);
  const [adGroupSearchQuery, setAdGroupSearchQuery] = useState('');
  const [selectedTrackingLinkId, setSelectedTrackingLinkId] = useState<string>('');
  const [creativeName, setCreativeName] = useState('');
  const [startPaused, setStartPaused] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  
  // Duplicate file dialog state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateFile, setDuplicateFile] = useState<{ file: File; fileName: string; existingUrl: string; index: number } | null>(null);

  // Flatten all ad groups
  const allAdGroups = useMemo<MolocoAdGroup[]>(() => {
    if (!campaignsData?.adGroups) return [];
    return campaignsData.adGroups;
  }, [campaignsData]);

  const filteredAdGroups = useMemo(() => {
    let filtered = allAdGroups;
    
    if (showActiveOnly) {
      filtered = filtered.filter(ag => ag.status === 'ACTIVE');
    }
    
    if (adGroupSearchQuery.trim()) {
      const query = adGroupSearchQuery.toLowerCase();
      filtered = filtered.filter(ag => 
        ag.title.toLowerCase().includes(query) || 
        ag.campaign_title.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [allAdGroups, showActiveOnly, adGroupSearchQuery]);

  // Generate creative name from first uploaded file
  const autoCreativeName = useMemo(() => {
    if (mediaFiles.length === 0) return '';
    const firstFile = mediaFiles[0].file;
    return firstFile.name.replace(/\.[^/.]+$/, '');
  }, [mediaFiles]);

  // Upload a single file to storage
  const uploadFileToStorage = useCallback(async (file: File, index: number, upsert: boolean = false) => {
    const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    setMediaFiles(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], uploadStatus: 'uploading', uploadProgress: 0 };
      }
      return updated;
    });

    try {
      if (!upsert) {
        const existsResult = await checkFileExists.mutateAsync(fileName);
        if (existsResult.exists && existsResult.url) {
          setDuplicateFile({ file, fileName, existingUrl: existsResult.url, index });
          setDuplicateDialogOpen(true);
          return;
        }
      }
      
      const result = await uploadToStorage.mutateAsync({
        file,
        fileName,
        upsert,
        onProgress: (progress) => {
          setMediaFiles(prev => {
            const updated = [...prev];
            if (updated[index]) {
              updated[index] = { ...updated[index], uploadProgress: progress };
            }
            return updated;
          });
        },
      });

      setMediaFiles(prev => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { 
            ...updated[index], 
            uploadStatus: 'uploaded',
            uploadProgress: 100,
            storageUrl: result.url,
          };
        }
        return updated;
      });

      toast({
        title: 'Upload complete',
        description: `${file.name} uploaded successfully`,
      });

    } catch (err) {
      setMediaFiles(prev => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { 
            ...updated[index], 
            uploadStatus: 'error',
            error: err instanceof Error ? err.message : 'Upload failed',
          };
        }
        return updated;
      });
      
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Failed to upload file',
        variant: 'destructive',
      });
    }
  }, [uploadToStorage, checkFileExists, toast]);

  // Handle duplicate file actions
  const handleDuplicateReplace = useCallback(() => {
    if (duplicateFile) {
      setDuplicateDialogOpen(false);
      uploadFileToStorage(duplicateFile.file, duplicateFile.index, true);
      setDuplicateFile(null);
    }
  }, [duplicateFile, uploadFileToStorage]);

  const handleDuplicateUseExisting = useCallback(() => {
    if (duplicateFile) {
      setMediaFiles(prev => {
        const updated = [...prev];
        if (updated[duplicateFile.index]) {
          updated[duplicateFile.index] = { 
            ...updated[duplicateFile.index], 
            uploadStatus: 'uploaded',
            uploadProgress: 100,
            storageUrl: duplicateFile.existingUrl,
          };
        }
        return updated;
      });
      toast({
        title: 'Using existing file',
        description: `${duplicateFile.file.name} already exists in your library`,
      });
      setDuplicateDialogOpen(false);
      setDuplicateFile(null);
    }
  }, [duplicateFile, toast]);

  const handleDuplicateCancel = useCallback(() => {
    if (duplicateFile) {
      setMediaFiles(prev => prev.filter((_, i) => i !== duplicateFile.index));
      setDuplicateDialogOpen(false);
      setDuplicateFile(null);
    }
  }, [duplicateFile]);

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const newMedia: (UploadedMedia & { uploadProgress?: number })[] = [];
    const filesToUpload: { file: File; startIndex: number }[] = [];
    const currentLength = mediaFiles.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      if (!isImage && !isVideo) {
        toast({
          title: 'Invalid file type',
          description: `${file.name} is not a supported image or video file`,
          variant: 'destructive',
        });
        continue;
      }

      newMedia.push({
        file,
        previewUrl: URL.createObjectURL(file),
        type: isImage ? 'image' : 'video',
        uploadStatus: 'uploading',
        uploadProgress: 0,
      });
      
      filesToUpload.push({ file, startIndex: currentLength + newMedia.length - 1 });
    }

    setMediaFiles(prev => [...prev, ...newMedia]);
    filesToUpload.forEach(({ file, startIndex }) => {
      uploadFileToStorage(file, startIndex);
    });
  }, [toast, mediaFiles.length, uploadFileToStorage]);

  // Handle selecting media from library
  const handleSelectFromLibrary = useCallback((items: MediaLibraryItem[]) => {
    const newMedia: (UploadedMedia & { uploadProgress?: number })[] = items.map(item => ({
      file: new File([], item.name),
      previewUrl: item.thumbnailUrl || item.url,
      type: item.type,
      uploadStatus: 'uploaded' as const,
      uploadProgress: 100,
      storageUrl: item.source === 'bucket' ? item.url : undefined,
    }));

    setMediaFiles(prev => [...prev, ...newMedia]);
  }, []);

  const removeMedia = (index: number) => {
    setMediaFiles(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].previewUrl);
      updated.splice(index, 1);
      return updated;
    });
  };

  const addAdGroup = (adGroup: MolocoAdGroup) => {
    if (!selectedAdGroups.find(ag => ag.id === adGroup.id)) {
      setSelectedAdGroups(prev => [...prev, adGroup]);
    }
    setAdGroupSearchOpen(false);
    setAdGroupSearchQuery('');
  };

  const removeAdGroup = (adGroupId: string) => {
    setSelectedAdGroups(prev => prev.filter(ag => ag.id !== adGroupId));
  };

  // Check if all files are uploaded
  const allFilesUploaded = mediaFiles.length > 0 && mediaFiles.every(m => m.uploadStatus === 'uploaded' && m.storageUrl);
  const hasUploadingFiles = mediaFiles.some(m => m.uploadStatus === 'uploading');

  const canPublish = allFilesUploaded && 
    selectedAdGroups.length > 0 && 
    selectedTrackingLinkId;

  // Publish to Moloco
  const handlePublish = async () => {
    setConfirmDialogOpen(false);
    setIsPublishing(true);
    
    const startTime = Date.now();
    let historyId: string | undefined;
    const finalCreativeName = creativeName.trim() || autoCreativeName;

    try {
      // Create history entry
      const historyEntry = await createLaunchHistory.mutateAsync({
        ad_name: finalCreativeName,
        media_urls: mediaFiles.map(m => m.storageUrl || m.previewUrl),
        adset_ids: selectedAdGroups.map(ag => ag.id),
        adset_names: selectedAdGroups.map(ag => ag.title),
        campaign_name: selectedAdGroups[0]?.campaign_title || 'Moloco',
        ads_count: mediaFiles.length,
        adsets_count: selectedAdGroups.length,
      });
      historyId = historyEntry.id;

      // Step 1: Upload all media to Moloco
      const creativeIds: string[] = [];
      
      for (let i = 0; i < mediaFiles.length; i++) {
        const media = mediaFiles[i];
        
        if (!media.storageUrl) {
          throw new Error(`File ${media.file.name} not uploaded to storage`);
        }

        // Update status
        setMediaFiles(prev => {
          const updated = [...prev];
          updated[i] = { ...updated[i], uploadStatus: 'uploading', uploadProgress: 60 };
          return updated;
        });

        const result = await uploadMolocoCreative.mutateAsync({
          mediaUrl: media.storageUrl,
          fileName: media.file.name,
          creativeName: mediaFiles.length > 1 
            ? `${finalCreativeName}_${i + 1}` 
            : finalCreativeName,
        });

        creativeIds.push(result.creative_id);

        setMediaFiles(prev => {
          const updated = [...prev];
          updated[i] = { 
            ...updated[i], 
            uploadStatus: 'uploaded',
            uploadProgress: 100,
            molocoCreativeId: result.creative_id,
          };
          return updated;
        });
      }

      // Step 2: Create creative group
      const creativeGroup = await createCreativeGroup.mutateAsync({
        creativeIds,
        trackingLinkId: selectedTrackingLinkId,
        groupName: finalCreativeName,
        startPaused,
      });

      // Step 3: Attach to each ad group
      for (const adGroup of selectedAdGroups) {
        await attachToAdGroup.mutateAsync({
          adGroupId: adGroup.id,
          creativeGroupId: creativeGroup.creative_group_id,
        });
      }

      // Update history as success
      if (historyId) {
        await updateLaunchHistory.mutateAsync({
          id: historyId,
          status: 'success',
          meta_ad_ids: creativeIds, // Using this field for Moloco creative IDs
          duration_ms: Date.now() - startTime,
        });
      }

      toast({
        title: 'Published to Moloco!',
        description: `Created ${creativeIds.length} creative(s) attached to ${selectedAdGroups.length} ad group(s)`,
      });

      // Reset form
      setMediaFiles([]);

    } catch (err) {
      console.error('Moloco publish error:', err);
      
      if (historyId) {
        await updateLaunchHistory.mutateAsync({
          id: historyId,
          status: 'failed',
          duration_ms: Date.now() - startTime,
          error_message: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      toast({
        title: 'Publish failed',
        description: err instanceof Error ? err.message : 'Failed to publish to Moloco',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Media */}
        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Media</CardTitle>
              <CardDescription>
                Upload images or videos for your Moloco creative.
                {mediaFiles.length > 1 && (
                  <span className="text-primary font-medium"> All files will be in one creative group.</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col space-y-4">
              {/* Media upload zone */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg flex-1 min-h-[400px] cursor-pointer transition-colors relative",
                  "hover:border-primary/50 hover:bg-muted/50",
                  "border-border"
                )}
                onClick={() => document.getElementById('moloco-file-input')?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileSelect(e.dataTransfer.files);
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                {mediaFiles.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                    <Upload className="h-12 w-12 mb-4 text-muted-foreground" />
                    <p className="text-lg text-muted-foreground">
                      Drag & drop or click to upload
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      JPG, PNG, GIF, MP4, MOV
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMediaLibraryOpen(true);
                      }}
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Browse Media Library
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 h-full">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm">
                        {mediaFiles.length} file{mediaFiles.length !== 1 ? 's' : ''}
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMediaLibraryOpen(true);
                        }}
                      >
                        <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                        Library
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {mediaFiles.map((media, index) => (
                        <div 
                          key={index} 
                          className="relative group aspect-square rounded-lg overflow-hidden bg-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {media.type === 'image' ? (
                            <img 
                              src={media.previewUrl} 
                              alt={`Preview ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <video 
                              src={media.previewUrl} 
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              onLoadedData={(e) => {
                                (e.target as HTMLVideoElement).currentTime = 0.1;
                              }}
                            />
                          )}
                          
                          {/* Status overlay */}
                          <div className={cn(
                            "absolute inset-0 flex flex-col items-center justify-center",
                            media.uploadStatus === 'uploading' && "bg-black/60",
                            media.uploadStatus === 'uploaded' && "bg-green-500/20",
                            media.uploadStatus === 'error' && "bg-red-500/20",
                          )}>
                            {media.uploadStatus === 'uploading' && (
                              <div className="w-full px-3 space-y-2">
                                <Loader2 className="h-5 w-5 text-white animate-spin mx-auto" />
                                <Progress value={media.uploadProgress || 0} className="h-1.5" />
                                <span className="text-[10px] text-white text-center block">
                                  {Math.round(media.uploadProgress || 0)}%
                                </span>
                              </div>
                            )}
                            {media.uploadStatus === 'uploaded' && (
                              <Check className="h-6 w-6 text-green-500" />
                            )}
                            {media.uploadStatus === 'error' && (
                              <AlertCircle className="h-6 w-6 text-red-500" />
                            )}
                          </div>

                          {/* Remove button */}
                          <button
                            className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeMedia(index);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </button>

                          {/* Filename tooltip */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-[10px] px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                            {media.file.name.replace(/\.[^/.]+$/, '')}
                          </div>

                          {/* Type badge */}
                          <Badge 
                            variant="secondary" 
                            className="absolute top-1 left-1 text-[10px]"
                          >
                            {media.type === 'image' ? <Image className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                          </Badge>
                        </div>
                      ))}
                      
                      {/* Add more tile */}
                      <div 
                        className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 hover:bg-muted/30 transition-colors"
                      >
                        <Upload className="h-6 w-6 mb-1" />
                        <span className="text-xs">Add more</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <input
                  id="moloco-file-input"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/gif,video/mp4,video/quicktime"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
              </div>

              {/* Publish section */}
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Start as paused</Label>
                    <p className="text-xs text-muted-foreground">Review before going live</p>
                  </div>
                  <Switch 
                    checked={startPaused}
                    onCheckedChange={setStartPaused}
                  />
                </div>
                
                <Button 
                  className="w-full" 
                  size="lg"
                  disabled={!canPublish || isPublishing || hasUploadingFiles}
                  onClick={() => setConfirmDialogOpen(true)}
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Publishing to Moloco...
                    </>
                  ) : hasUploadingFiles ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading files...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4 mr-2" />
                      Publish to Moloco
                    </>
                  )}
                </Button>
                
                {!canPublish && (
                  <p className="text-xs text-muted-foreground text-center">
                    Add media, select ad groups, and choose a tracking link to publish
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Ad Group & Tracking Link Selection */}
        <div className="space-y-6">
          {/* Tracking Link Selection */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Tracking Link</CardTitle>
                <CardDescription>Select the AppsFlyer tracking link for attribution</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetchTrackingLinks()}
                disabled={trackingLinksLoading}
              >
                <RefreshCw className={cn("h-4 w-4", trackingLinksLoading && "animate-spin")} />
              </Button>
            </CardHeader>
            <CardContent>
              <Select value={selectedTrackingLinkId} onValueChange={setSelectedTrackingLinkId}>
                <SelectTrigger>
                  <SelectValue placeholder={trackingLinksLoading ? "Loading..." : "Select tracking link"} />
                </SelectTrigger>
                <SelectContent>
                  {trackingLinks?.map(link => (
                    <SelectItem key={link.id} value={link.id}>
                      <div className="flex items-center gap-2">
                        <span>{link.title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {link.device_os}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Ad Group Selection */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Ad Groups</CardTitle>
                <CardDescription>Select ad groups to attach your creatives</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Switch 
                    id="moloco-active-only"
                    checked={showActiveOnly}
                    onCheckedChange={setShowActiveOnly}
                  />
                  <Label htmlFor="moloco-active-only" className="text-sm">Active only</Label>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => refetchCampaigns()}
                  disabled={campaignsLoading}
                >
                  <RefreshCw className={cn("h-4 w-4", campaignsLoading && "animate-spin")} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ad Group Search Combobox */}
              <Popover open={adGroupSearchOpen} onOpenChange={setAdGroupSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={adGroupSearchOpen}
                    className="w-full justify-between"
                    disabled={campaignsLoading}
                  >
                    {campaignsLoading ? "Loading ad groups..." : "Search ad groups..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Search by ad group or campaign name..." 
                      value={adGroupSearchQuery}
                      onValueChange={setAdGroupSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No ad groups found.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-y-auto">
                        {filteredAdGroups.slice(0, 50).map((adGroup) => {
                          const isSelected = selectedAdGroups.some(ag => ag.id === adGroup.id);
                          return (
                            <CommandItem
                              key={adGroup.id}
                              value={adGroup.id}
                              onSelect={() => addAdGroup(adGroup)}
                              disabled={isSelected}
                              className={cn(isSelected && "opacity-50")}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{adGroup.title}</p>
                                  <p className="text-xs text-muted-foreground truncate">{adGroup.campaign_title}</p>
                                </div>
                                <Badge 
                                  variant={adGroup.status === 'ACTIVE' ? 'default' : 'secondary'}
                                  className="text-[10px]"
                                >
                                  {adGroup.status}
                                </Badge>
                              </div>
                              {isSelected && <Check className="h-4 w-4 ml-2" />}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Selected Ad Groups */}
              {selectedAdGroups.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Ad Groups ({selectedAdGroups.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedAdGroups.map(adGroup => (
                      <Badge 
                        key={adGroup.id} 
                        variant="secondary"
                        className="flex items-center gap-1 pr-1"
                      >
                        <span className="max-w-[200px] truncate">{adGroup.title}</span>
                        <button
                          className="ml-1 p-0.5 rounded-full hover:bg-muted"
                          onClick={() => removeAdGroup(adGroup.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedAdGroups([])}
                    className="text-xs"
                  >
                    Clear all
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Creative Name */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Creative Details</CardTitle>
              <CardDescription>Name your creative group</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="creative-name">Creative Name (optional)</Label>
                <Input
                  id="creative-name"
                  value={creativeName}
                  onChange={(e) => setCreativeName(e.target.value)}
                  placeholder={autoCreativeName || "Auto: from filename"}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to use filename
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish to Moloco?</AlertDialogTitle>
            <AlertDialogDescription>
              This will upload {mediaFiles.length} creative(s) and attach them to {selectedAdGroups.length} ad group(s).
              {startPaused 
                ? " The creative group will be created as PAUSED."
                : " The creative group will be ACTIVE immediately."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish}>
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate File Dialog */}
      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>File Already Exists</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{duplicateFile?.fileName}</span> already exists in your media library. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleDuplicateCancel}>Cancel Upload</AlertDialogCancel>
            <AlertDialogAction className="bg-secondary text-secondary-foreground hover:bg-secondary/80" onClick={handleDuplicateUseExisting}>
              Use Existing
            </AlertDialogAction>
            <AlertDialogAction onClick={handleDuplicateReplace}>
              Replace File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Media Library Dialog */}
      <MediaLibraryDialog
        open={mediaLibraryOpen}
        onOpenChange={setMediaLibraryOpen}
        mediaLibrary={mediaLibrary}
        isLoading={mediaLibraryLoading}
        onRefresh={() => refetchMediaLibrary()}
        onSelectMedia={handleSelectFromLibrary}
      />
    </>
  );
}
