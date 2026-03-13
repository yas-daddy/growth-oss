import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Upload, X, Image, Video, Loader2, Check, AlertCircle, Rocket, Save, RefreshCw, ChevronsUpDown, Apple, Smartphone, Plus, FolderOpen, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useMetaCampaigns, useUploadToStorage, useCheckFileExists, useUploadMediaToMeta, useCreateMetaAd, useMediaLibrary, useExistingPosts, type UploadedMedia, type MetaAdset, type MediaLibraryItem } from '@/hooks/useMetaAdCreation';
import { useAdDefaults } from '@/hooks/useAdDefaults';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MediaLibraryDialog } from '@/components/ads/MediaLibraryDialog';
import { AdLaunchHistory } from '@/components/ads/AdLaunchHistory';
import { useCreateAdLaunchHistory, useUpdateAdLaunchHistory } from '@/hooks/useAdLaunchHistory';
import { CreativeEnhancementsDialog } from '@/components/ads/CreativeEnhancementsDialog';
import { useCreativeEnhancements } from '@/hooks/useCreativeEnhancements';
import { useUserPreference } from '@/hooks/useUserPreferences';
import { useComplianceRules } from '@/hooks/useComplianceRules';
import { useMediaComplianceCheck } from '@/hooks/useMediaComplianceCheck';
import { MediaComplianceDialog } from '@/components/ads/MediaComplianceDialog';

function existingPostAdName(caption?: string, id?: string): string {
  if (!caption) return `Post_${(id || '').slice(-8)}`;
  const stripped = caption.replace(/\s/g, '').slice(0, 12);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${stripped}_${rand}`;
}

// CTA options by campaign type
const APP_INSTALL_CTA_OPTIONS = [
  { value: 'INSTALL_MOBILE_APP', label: 'Install App' },
  { value: 'DOWNLOAD', label: 'Download' },
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'SHOP_NOW', label: 'Shop Now' },
  { value: 'SIGN_UP', label: 'Sign Up' },
];

const AWARENESS_CTA_OPTIONS = [
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'WATCH_MORE', label: 'Watch More' },
  { value: 'SEE_MORE', label: 'See More' },
  { value: 'NO_BUTTON', label: 'No Button' },
];

const TRAFFIC_CTA_OPTIONS = [
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'SHOP_NOW', label: 'Shop Now' },
  { value: 'SIGN_UP', label: 'Sign Up' },
  { value: 'BOOK_NOW', label: 'Book Now' },
  { value: 'GET_OFFER', label: 'Get Offer' },
];

const EXISTING_POST_CTA_OPTIONS = [
  { value: 'NO_BUTTON', label: 'No Button' },
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'SHOP_NOW', label: 'Shop Now' },
  { value: 'SIGN_UP', label: 'Sign Up' },
  { value: 'BOOK_NOW', label: 'Book Now' },
];

// Campaign objectives compatible with existing Instagram post ads
const EXISTING_POST_COMPATIBLE_OBJECTIVES = new Set([
  'BRAND_AWARENESS', 'OUTCOME_AWARENESS', 'REACH',
  'LINK_CLICKS', 'OUTCOME_TRAFFIC',
  'POST_ENGAGEMENT', 'OUTCOME_ENGAGEMENT',
  'APP_INSTALLS', 'OUTCOME_APP_PROMOTION',
  'VIDEO_VIEWS', 'LEAD_GENERATION', 'OUTCOME_LEADS',
  'MESSAGES', 'CONVERSIONS', 'OUTCOME_SALES',
]);

// Extend the MetaAdset type to include campaign info and platform
interface AdsetWithCampaign extends MetaAdset {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  campaignObjective: string | null;
  platform?: 'ios' | 'android' | 'both' | 'unknown';
}

export default function LaunchAds() {
  const { toast } = useToast();
  const { data: campaigns, isLoading: campaignsLoading, error: campaignsError, refetch: refetchCampaigns } = useMetaCampaigns();
  const { defaults, saveDefaults, isSaving } = useAdDefaults();
  const uploadToStorage = useUploadToStorage();
  const checkFileExists = useCheckFileExists();
  const uploadToMeta = useUploadMediaToMeta();
  const createAd = useCreateMetaAd();

  // Form state
  const [mediaFiles, setMediaFiles] = useState<(UploadedMedia & { uploadProgress?: number })[]>([]);
  const [selectedAdsets, setSelectedAdsets] = useState<AdsetWithCampaign[]>([]);
  const [adsetSearchOpen, setAdsetSearchOpen] = useState(false);
  const [adsetSearchQuery, setAdsetSearchQuery] = useState('');
  const [primaryTexts, setPrimaryTexts] = useState<string[]>(['']);
  const [headlines, setHeadlines] = useState<string[]>(['']);
  const [description, setDescription] = useState('');
  const [callToAction, setCallToAction] = useState('INSTALL_MOBILE_APP');
  const [iosDestinationUrl, setIosDestinationUrl] = useState('');
  const [androidDestinationUrl, setAndroidDestinationUrl] = useState('');
  const [urlParameters, setUrlParameters] = useState('');
  const [startPaused, setStartPaused] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const { data: mediaLibrary, isLoading: mediaLibraryLoading, refetch: refetchMediaLibrary } = useMediaLibrary();
  const { data: existingPosts, isLoading: existingPostsLoading, refetch: refetchExistingPosts } = useExistingPosts();
  
  // Compliance pre-flight check
  const { data: complianceRules } = useComplianceRules();
  const { complianceStates, getComplianceForIndex, retryCheck } = useMediaComplianceCheck(mediaFiles, complianceRules);
  const [complianceDialogIndex, setComplianceDialogIndex] = useState<number | null>(null);
  const [complianceWarningOpen, setComplianceWarningOpen] = useState(false);

  // Duplicate file dialog state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateFile, setDuplicateFile] = useState<{ file: File; fileName: string; existingUrl: string; index: number } | null>(null);
  
  // Persist ad set selection
  const { value: savedAdsetIds, setValue: setSavedAdsetIds } = useUserPreference<string[]>('launch-ads-adsets', []);

  // Load defaults on mount
  useEffect(() => {
    if (defaults) {
      // Use new array fields if available, fall back to legacy single values
      if (defaults.primary_texts?.length) {
        setPrimaryTexts(defaults.primary_texts);
      } else if (defaults.primary_text) {
        setPrimaryTexts([defaults.primary_text]);
      }
      if (defaults.headlines?.length) {
        setHeadlines(defaults.headlines);
      } else if (defaults.headline) {
        setHeadlines([defaults.headline]);
      }
      if (defaults.description) setDescription(defaults.description);
      if (defaults.call_to_action) setCallToAction(defaults.call_to_action);
      if (defaults.url_parameters) setUrlParameters(defaults.url_parameters);
    }
  }, [defaults]);

  // Flatten all adsets from all campaigns with campaign info
  const allAdsets = useMemo<AdsetWithCampaign[]>(() => {
    if (!campaigns) return [];
    
    const adsets: AdsetWithCampaign[] = [];
    for (const campaign of campaigns) {
      for (const adset of campaign.adsets) {
        // Determine platform from targeting if available
        let platform: 'ios' | 'android' | 'both' | 'unknown' = 'unknown';
        if (adset.targeting) {
          const targeting = adset.targeting;
          const userOs = targeting.user_os;
          if (userOs) {
            const hasIos = userOs.some((os: string) => os.toLowerCase().includes('ios'));
            const hasAndroid = userOs.some((os: string) => os.toLowerCase().includes('android'));
            if (hasIos && hasAndroid) {
              platform = 'both';
            } else if (hasIos) {
              platform = 'ios';
            } else if (hasAndroid) {
              platform = 'android';
            }
          }
        }
        
        adsets.push({
          ...adset,
          campaignId: campaign.id,
          campaignName: campaign.name,
          campaignStatus: campaign.status,
          campaignObjective: campaign.objective || null,
          platform,
        });
      }
    }
    return adsets;
  }, [campaigns]);

  // Restore saved adset selection when campaigns load
  useEffect(() => {
    if (allAdsets.length > 0 && savedAdsetIds.length > 0 && selectedAdsets.length === 0) {
      const restoredAdsets = allAdsets.filter(a => savedAdsetIds.includes(a.id));
      if (restoredAdsets.length > 0) {
        setSelectedAdsets(restoredAdsets);
      }
    }
  }, [allAdsets, savedAdsetIds, selectedAdsets.length]);

  // Save adset selection when it changes
  useEffect(() => {
    if (selectedAdsets.length > 0) {
      const ids = selectedAdsets.map(a => a.id);
      // Only save if different from current saved value
      if (JSON.stringify(ids) !== JSON.stringify(savedAdsetIds)) {
        setSavedAdsetIds(ids);
      }
    }
  }, [selectedAdsets, savedAdsetIds, setSavedAdsetIds]);

  // Detect existing post mode
  const hasExistingPosts = useMemo(() => 
    mediaFiles.some(m => !!m.sourceInstagramMediaId), 
    [mediaFiles]
  );

  const filteredAdsets = useMemo(() => {
    let filtered = allAdsets;
    
    if (showActiveOnly) {
      filtered = filtered.filter(a => a.status === 'ACTIVE');
    }

    // Filter by existing post compatible objectives
    if (hasExistingPosts) {
      filtered = filtered.filter(a => 
        !a.campaignObjective || EXISTING_POST_COMPATIBLE_OBJECTIVES.has(a.campaignObjective)
      );
    }
    
    if (adsetSearchQuery.trim()) {
      const query = adsetSearchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(query) || 
        a.campaignName.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [allAdsets, showActiveOnly, adsetSearchQuery, hasExistingPosts]);

  // Determine which platforms are selected
  const selectedPlatforms = useMemo(() => {
    const platforms = new Set<string>();
    for (const adset of selectedAdsets) {
      if (!adset) continue;
      if (adset.platform === 'ios' || adset.platform === 'both') {
        platforms.add('ios');
      }
      if (adset.platform === 'android' || adset.platform === 'both') {
        platforms.add('android');
      }
      if (adset.platform === 'unknown') {
        platforms.add('unknown');
      }
    }
    return {
      hasIos: platforms.has('ios') || platforms.has('unknown'),
      hasAndroid: platforms.has('android') || platforms.has('unknown'),
      hasUnknown: platforms.has('unknown'),
    };
  }, [selectedAdsets]);

  // Detect campaign type from selected adsets
  const campaignTypeInfo = useMemo(() => {
    const objectives = new Set(selectedAdsets.filter(Boolean).map(a => a.campaignObjective).filter(Boolean));
    
    const isAwareness = Array.from(objectives).some(obj => 
      ['REACH', 'BRAND_AWARENESS', 'OUTCOME_AWARENESS'].includes(obj as string)
    );
    
    const isTraffic = Array.from(objectives).some(obj => 
      ['LINK_CLICKS', 'TRAFFIC', 'OUTCOME_TRAFFIC'].includes(obj as string)
    );
    
    const isAppInstall = Array.from(objectives).some(obj => 
      ['APP_INSTALLS', 'OUTCOME_APP_PROMOTION'].includes(obj as string)
    );
    
    // Determine if multiple objective types are selected
    const hasMixedObjectives = [isAwareness, isTraffic, isAppInstall].filter(Boolean).length > 1;
    
    return {
      isAwareness,
      isTraffic,
      isAppInstall,
      hasMixedObjectives,
      primaryType: isAwareness ? 'awareness' : isTraffic ? 'traffic' : 'app_install',
    };
  }, [selectedAdsets]);




  // Get the caption from the first existing post for display
  const existingPostCaption = useMemo(() => {
    const post = mediaFiles.find(m => m.sourceInstagramMediaId);
    return post?.caption || null;
  }, [mediaFiles]);

  // Get available CTAs based on campaign type and existing post mode
  const availableCTAs = useMemo(() => {
    if (hasExistingPosts) {
      return EXISTING_POST_CTA_OPTIONS;
    }
    if (campaignTypeInfo.isAwareness) {
      return AWARENESS_CTA_OPTIONS;
    }
    if (campaignTypeInfo.isTraffic) {
      return TRAFFIC_CTA_OPTIONS;
    }
    return APP_INSTALL_CTA_OPTIONS;
  }, [campaignTypeInfo, hasExistingPosts]);

  // Auto-remove incompatible ad sets when existing posts are selected
  useEffect(() => {
    if (!hasExistingPosts || selectedAdsets.length === 0) return;
    const incompatible = selectedAdsets.filter(a => 
      a.campaignObjective && !EXISTING_POST_COMPATIBLE_OBJECTIVES.has(a.campaignObjective)
    );
    if (incompatible.length > 0) {
      const compatible = selectedAdsets.filter(a => 
        !a.campaignObjective || EXISTING_POST_COMPATIBLE_OBJECTIVES.has(a.campaignObjective)
      );
      setSelectedAdsets(compatible);
      toast({
        title: 'Incompatible ad sets removed',
        description: `Removed ${incompatible.length} ad set(s) with campaign objectives not supported for existing post ads`,
      });
    }
  }, [hasExistingPosts]);

  // Auto-reset CTA when switching to awareness campaigns or existing posts
  useEffect(() => {
    if (hasExistingPosts) {
      const allowedValues = EXISTING_POST_CTA_OPTIONS.map(o => o.value);
      if (!allowedValues.includes(callToAction)) {
        setCallToAction('NO_BUTTON');
      }
    } else if (campaignTypeInfo.isAwareness && 
        ['DOWNLOAD', 'INSTALL_MOBILE_APP'].includes(callToAction)) {
      setCallToAction('LEARN_MORE');
    }
  }, [campaignTypeInfo.isAwareness, callToAction, hasExistingPosts]);

  // Auto-populate destination URLs from selected adsets
  useEffect(() => {
    if (selectedAdsets.length === 0) return;
    
    // Find first adset with iOS URL
    const iosAdset = selectedAdsets.find(a => a.iosUrl);
    if (iosAdset?.iosUrl && !iosDestinationUrl) {
      setIosDestinationUrl(iosAdset.iosUrl);
    }
    
    // Find first adset with Android URL
    const androidAdset = selectedAdsets.find(a => a.androidUrl);
    if (androidAdset?.androidUrl && !androidDestinationUrl) {
      setAndroidDestinationUrl(androidAdset.androidUrl);
    }
  }, [selectedAdsets, iosDestinationUrl, androidDestinationUrl]);

  // Generate ad name from first uploaded file (keep underscores)
  const adName = useMemo(() => {
    if (mediaFiles.length === 0) return '';
    const firstFile = mediaFiles[0];
    // Handle existing posts (no file) - use sourceInstagramMediaId
    if (!firstFile.file && firstFile.sourceInstagramMediaId) {
      return existingPostAdName(firstFile.caption, firstFile.sourceInstagramMediaId);
    }
    if (!firstFile.file) return '';
    // Remove extension only, preserve underscores
    return firstFile.file.name.replace(/\.[^/.]+$/, '');
  }, [mediaFiles]);

  // Upload a single file to storage (with optional upsert for replacements)
  const uploadFileToStorage = useCallback(async (file: File, index: number, upsert: boolean = false) => {
    // Use sanitized original filename without timestamp prefix
    const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Mark as uploading
    setMediaFiles(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], uploadStatus: 'uploading', uploadProgress: 0 };
      }
      return updated;
    });

    try {
      // Check if file already exists (only if not upserting)
      if (!upsert) {
        const existsResult = await checkFileExists.mutateAsync(fileName);
        if (existsResult.exists && existsResult.url) {
          // File exists - show dialog
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

      // Mark as uploaded
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

  // Handle duplicate file dialog actions
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
      // Remove the file from the list
      setMediaFiles(prev => prev.filter((_, i) => i !== duplicateFile.index));
      setDuplicateDialogOpen(false);
      setDuplicateFile(null);
    }
  }, [duplicateFile]);

  // Handle file drop/select - immediately upload to storage
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const newMedia: (UploadedMedia & { uploadProgress?: number })[] = [];
    const filesToUpload: { file: File; startIndex: number }[] = [];
    
    // Get current length to calculate correct indices
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

    // Add files to state immediately
    setMediaFiles(prev => [...prev, ...newMedia]);
    
    // Start uploading each file
    filesToUpload.forEach(({ file, startIndex }) => {
      uploadFileToStorage(file, startIndex);
    });
  }, [toast, mediaFiles.length, uploadFileToStorage]);

  // Handle selecting media from library
  const handleSelectFromLibrary = useCallback((items: MediaLibraryItem[]) => {
    const newMedia: (UploadedMedia & { uploadProgress?: number })[] = items.map(item => {
      // Handle existing Instagram posts
      if (item.source === 'existing_post') {
        return {
          file: null,  // No file for existing posts
          previewUrl: item.thumbnailUrl || item.url,
          type: item.type,
          uploadStatus: 'uploaded' as const,
          uploadProgress: 100,
          storageUrl: item.url,  // Use the media URL
          sourceInstagramMediaId: item.sourceInstagramMediaId,
          caption: item.caption || undefined,
        };
      }
      
      // Handle bucket and meta library items
      return {
        file: new File([], item.name),
        previewUrl: item.thumbnailUrl || item.url,
        type: item.type,
        uploadStatus: 'uploaded' as const, // Already in storage or Meta
        uploadProgress: 100,
        storageUrl: item.source === 'bucket' ? item.url : undefined,
        metaHash: item.hash,
        metaVideoId: item.videoId,
      };
    });

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

  const addAdset = (adset: AdsetWithCampaign) => {
    if (!selectedAdsets.find(a => a.id === adset.id)) {
      setSelectedAdsets(prev => [...prev, adset]);
    }
    setAdsetSearchOpen(false);
    setAdsetSearchQuery('');
  };

  const removeAdset = (adsetId: string) => {
    setSelectedAdsets(prev => prev.filter(a => a.id !== adsetId));
  };

  const handleSaveDefaults = () => {
    const destinationUrl = iosDestinationUrl || androidDestinationUrl;
    saveDefaults({
      primary_text: primaryTexts[0] || '',
      headline: headlines[0] || '',
      primary_texts: primaryTexts.filter(t => t.trim()),
      headlines: headlines.filter(h => h.trim()),
      description,
      call_to_action: callToAction,
      destination_url: destinationUrl,
      url_parameters: urlParameters,
    });
  };

  const needsIosUrl = selectedPlatforms.hasIos && !campaignTypeInfo.isAwareness;
  const needsAndroidUrl = selectedPlatforms.hasAndroid && !campaignTypeInfo.isAwareness;

  // Check if all files are uploaded to storage (or are existing posts)
  const allFilesUploaded = mediaFiles.length > 0 && mediaFiles.every(m => 
    m.uploadStatus === 'uploaded' && (m.storageUrl || m.sourceInstagramMediaId)
  );
  const hasUploadingFiles = mediaFiles.some(m => m.uploadStatus === 'uploading');

  const canPublish = allFilesUploaded && 
    selectedAdsets.length > 0 && 
    adName.trim() && 
    (hasExistingPosts || primaryTexts.some(t => t.trim())) && 
    (hasExistingPosts || headlines.some(h => h.trim())) && 
    callToAction && 
    (campaignTypeInfo.isAwareness 
      ? websiteUrl.trim() 
      : ((needsIosUrl && iosDestinationUrl.trim()) || !needsIosUrl) &&
        ((needsAndroidUrl && androidDestinationUrl.trim()) || !needsAndroidUrl));

  const createLaunchHistory = useCreateAdLaunchHistory();
  const updateLaunchHistory = useUpdateAdLaunchHistory();

  const handlePublish = async () => {
    setConfirmDialogOpen(false);
    setIsPublishing(true);
    
    const startTime = Date.now();
    let historyId: string | undefined;

    try {
      // Create history entry
      const historyEntry = await createLaunchHistory.mutateAsync({
        ad_name: adName,
        media_urls: mediaFiles.map(m => m.storageUrl || m.previewUrl),
        adset_ids: selectedAdsets.map(a => a.id),
        adset_names: selectedAdsets.map(a => a.name),
        campaign_name: selectedAdsets[0]?.campaignName || 'Meta',
        campaign_names: [...new Set(selectedAdsets.map(a => a.campaignName))],
        ads_count: mediaFiles.length,
        adsets_count: selectedAdsets.length,
        primary_text: primaryTexts.find(t => t.trim()),
        headline: headlines.find(h => h.trim()),
        call_to_action: callToAction,
      });
      historyId = historyEntry.id;
      // Step 1: Upload all media to Meta (files are already in storage) or use existing posts
      const uploadedMedia: Array<{ type: 'image' | 'video'; hash?: string; videoId?: string; fileName?: string; sourceInstagramMediaId?: string }> = [];

      for (let i = 0; i < mediaFiles.length; i++) {
        const media = mediaFiles[i];
        
        // Handle existing Instagram posts - no upload needed
        if (media.sourceInstagramMediaId) {
          uploadedMedia.push({
            type: media.type,
            sourceInstagramMediaId: media.sourceInstagramMediaId,
            fileName: existingPostAdName(media.caption, media.sourceInstagramMediaId),
          });
          continue;
        }
        
        // Skip if already uploaded to Meta
        if (media.metaHash || media.metaVideoId) {
          uploadedMedia.push({
            type: media.type,
            hash: media.metaHash,
            videoId: media.metaVideoId,
            fileName: media.file?.name || 'unknown',
          });
          continue;
        }

        // Must have storage URL at this point
        if (!media.storageUrl) {
          throw new Error(`File ${media.file?.name || 'unknown'} not uploaded to storage`);
        }

        const fileName = media.file?.name || 'unknown';

        // Show uploading to Meta status
        setMediaFiles(prev => {
          const updated = [...prev];
          updated[i] = { ...updated[i], uploadStatus: 'uploading', uploadProgress: 50 };
          return updated;
        });

        try {
          // Upload to Meta from storage URL
          const metaResult = await uploadToMeta.mutateAsync({
            mediaUrl: media.storageUrl,
            mediaType: media.type,
            fileName: fileName,
          });

          uploadedMedia.push({
            type: media.type,
            hash: metaResult.hash,
            videoId: metaResult.videoId,
            fileName: fileName,
          });

          // Update status to fully uploaded
          setMediaFiles(prev => {
            const updated = [...prev];
            updated[i] = { 
              ...updated[i], 
              uploadStatus: 'uploaded',
              uploadProgress: 100,
              metaHash: metaResult.hash,
              metaVideoId: metaResult.videoId,
            };
            return updated;
          });

        } catch (err) {
          setMediaFiles(prev => {
            const updated = [...prev];
            updated[i] = { 
              ...updated[i], 
              uploadStatus: 'error',
              error: err instanceof Error ? err.message : 'Meta upload failed',
            };
            return updated;
          });
          throw err;
        }
      }

      // Step 2: Create the ads
      // For awareness campaigns, use website URL; for app campaigns, split by platform
      const destinationUrl = campaignTypeInfo.isAwareness 
        ? websiteUrl 
        : (iosDestinationUrl || androidDestinationUrl);
      
      const allCreatedAdIds: string[] = [];
      let totalErrors = 0;
      let lastErrorMessage = '';

      if (campaignTypeInfo.isAwareness) {
        // Awareness campaigns: all adsets use the same website URL
        const validPrimaryTexts = primaryTexts.filter(t => t.trim());
        const validHeadlines = headlines.filter(h => h.trim());
        
        const result = await createAd.mutateAsync({
          adsetIds: selectedAdsets.map(a => a.id),
          adName,
          primaryTexts: validPrimaryTexts,
          headlines: validHeadlines,
          description: description || undefined,
          callToAction,
          destinationUrl: websiteUrl,
          urlParameters: urlParameters || undefined,
          media: uploadedMedia,
          startPaused,
          campaignObjective: selectedAdsets[0]?.campaignObjective || undefined,
        });
        
        if (result?.summary?.ads) {
          allCreatedAdIds.push(...result.summary.ads.map((a: any) => a.adId));
        }
        if (result?.summary) {
          totalErrors += result.summary.totalErrors || 0;
        }
        if (result?.summary?.errors?.length > 0) {
          lastErrorMessage = result.summary.errors[0].error;
        }
      } else {
        // App campaigns: split by platform
        const iosAdsetIds = selectedAdsets
          .filter(a => a.platform === 'ios' || a.platform === 'unknown')
          .map(a => a.id);
        const androidAdsetIds = selectedAdsets
          .filter(a => a.platform === 'android')
          .map(a => a.id);
        const bothPlatformAdsetIds = selectedAdsets
          .filter(a => a.platform === 'both')
          .map(a => a.id);

        const primaryDestinationUrl = iosDestinationUrl || androidDestinationUrl;
        const allAdsetIds = [...iosAdsetIds, ...bothPlatformAdsetIds];
        
        if (allAdsetIds.length > 0) {
          const validPrimaryTexts = primaryTexts.filter(t => t.trim());
          const validHeadlines = headlines.filter(h => h.trim());
          
          const result = await createAd.mutateAsync({
            adsetIds: allAdsetIds,
            adName,
            primaryTexts: validPrimaryTexts,
            headlines: validHeadlines,
            description: description || undefined,
            callToAction,
            destinationUrl: iosDestinationUrl || primaryDestinationUrl,
            urlParameters: urlParameters || undefined,
            media: uploadedMedia,
            startPaused,
            campaignObjective: selectedAdsets[0]?.campaignObjective || undefined,
          });
          
          if (result?.summary?.ads) {
            allCreatedAdIds.push(...result.summary.ads.map((a: any) => a.adId));
          }
          if (result?.summary) {
            totalErrors += result.summary.totalErrors || 0;
          }
          if (result?.summary?.errors?.length > 0) {
            lastErrorMessage = result.summary.errors[0].error;
          }
        }

        // Create separate ads for Android-only adsets if different URL
        if (androidAdsetIds.length > 0 && androidDestinationUrl && androidDestinationUrl !== iosDestinationUrl) {
          const validPrimaryTexts = primaryTexts.filter(t => t.trim());
          const validHeadlines = headlines.filter(h => h.trim());
          
          const result = await createAd.mutateAsync({
            adsetIds: androidAdsetIds,
            adName,
            primaryTexts: validPrimaryTexts,
            headlines: validHeadlines,
            description: description || undefined,
            callToAction,
            destinationUrl: androidDestinationUrl,
            urlParameters: urlParameters || undefined,
            media: uploadedMedia,
            startPaused,
            campaignObjective: selectedAdsets[0]?.campaignObjective || undefined,
          });
          
          if (result?.summary?.ads) {
            allCreatedAdIds.push(...result.summary.ads.map((a: any) => a.adId));
          }
          if (result?.summary) {
            totalErrors += result.summary.totalErrors || 0;
          }
          if (result?.summary?.errors?.length > 0 && !lastErrorMessage) {
            lastErrorMessage = result.summary.errors[0].error;
          }
        } else if (androidAdsetIds.length > 0) {
          const validPrimaryTexts = primaryTexts.filter(t => t.trim());
          const validHeadlines = headlines.filter(h => h.trim());
          
          // Same URL, include with main batch
          const result = await createAd.mutateAsync({
            adsetIds: androidAdsetIds,
            adName,
            primaryTexts: validPrimaryTexts,
            headlines: validHeadlines,
            description: description || undefined,
            callToAction,
            destinationUrl: androidDestinationUrl || primaryDestinationUrl,
            urlParameters: urlParameters || undefined,
            media: uploadedMedia,
            startPaused,
            campaignObjective: selectedAdsets[0]?.campaignObjective || undefined,
          });
          
          if (result?.summary?.ads) {
            allCreatedAdIds.push(...result.summary.ads.map((a: any) => a.adId));
          }
          if (result?.summary) {
            totalErrors += result.summary.totalErrors || 0;
          }
          if (result?.summary?.errors?.length > 0 && !lastErrorMessage) {
            lastErrorMessage = result.summary.errors[0].error;
          }
        }
      }

      // Update history based on actual results
      if (historyId) {
        const actuallySucceeded = allCreatedAdIds.length > 0;
        await updateLaunchHistory.mutateAsync({
          id: historyId,
          status: actuallySucceeded ? 'success' : 'failed',
          meta_ad_ids: allCreatedAdIds,
          duration_ms: Date.now() - startTime,
          error_message: !actuallySucceeded ? (lastErrorMessage || 'No ads were created') : undefined,
        });
        
        if (!actuallySucceeded) {
          throw new Error(lastErrorMessage || 'Failed to create any ads');
        }
      }

      toast({
        title: 'Ads published!',
        description: 'Your ads have been created in Meta Ads.',
      });

      // Reset form
      setMediaFiles([]);

    } catch (err) {
      console.error('Publish error:', err);
      
      // Update history as failed
      if (historyId) {
        await updateLaunchHistory.mutateAsync({
          id: historyId,
          status: 'failed',
          duration_ms: Date.now() - startTime,
          error_message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    } finally {
      setIsPublishing(false);
    }
  };

  

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Launch Ads</h1>
            <p className="text-muted-foreground">
              Create and publish ads to Meta with one click
            </p>
          </div>
        </div>

        {(
        <>
        {/* 50/50 Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Ad Sets & Media & Publish */}
          <div className="space-y-6">
            {/* Ad Set Selection */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Ad Sets</CardTitle>
                  <CardDescription>Search and select ad sets from any campaign</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Switch 
                      id="active-only"
                      checked={showActiveOnly}
                      onCheckedChange={setShowActiveOnly}
                    />
                    <Label htmlFor="active-only" className="text-sm">Active only</Label>
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
                {campaignsError && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    {campaignsError instanceof Error ? campaignsError.message : 'Failed to load campaigns'}
                  </div>
                )}

                {hasExistingPosts && (
                  <Alert className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Showing only ad sets with campaign objectives compatible with existing post ads
                    </AlertDescription>
                  </Alert>
                )}

                {/* Adset Search Combobox */}
                <Popover open={adsetSearchOpen} onOpenChange={setAdsetSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={adsetSearchOpen}
                      className="w-full justify-between"
                      disabled={campaignsLoading}
                    >
                      {campaignsLoading ? "Loading ad sets..." : "Search ad sets..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Search by ad set or campaign name..." 
                        value={adsetSearchQuery}
                        onValueChange={setAdsetSearchQuery}
                      />
                      <CommandList>
                        <CommandEmpty>No ad sets found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-y-auto">
                          {filteredAdsets.slice(0, 50).map((adset) => {
                            const isSelected = selectedAdsets.some(a => a.id === adset.id);
                            return (
                              <CommandItem
                                key={adset.id}
                                value={adset.id}
                                onSelect={() => addAdset(adset)}
                                disabled={isSelected}
                                className={cn(isSelected && "opacity-50")}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{adset.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{adset.campaignName}</p>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {adset.campaignObjective && (
                                      <Badge variant="outline" className="text-[10px]">
                                        {adset.campaignObjective === 'REACH' && 'Reach'}
                                        {adset.campaignObjective === 'BRAND_AWARENESS' && 'Awareness'}
                                        {adset.campaignObjective === 'OUTCOME_AWARENESS' && 'Awareness'}
                                        {adset.campaignObjective === 'APP_INSTALLS' && 'App Install'}
                                        {adset.campaignObjective === 'OUTCOME_APP_PROMOTION' && 'App Install'}
                                        {adset.campaignObjective === 'LINK_CLICKS' && 'Traffic'}
                                        {adset.campaignObjective === 'TRAFFIC' && 'Traffic'}
                                        {adset.campaignObjective === 'OUTCOME_TRAFFIC' && 'Traffic'}
                                        {adset.campaignObjective === 'CONVERSIONS' && 'Conversions'}
                                      </Badge>
                                    )}
                                    {adset.platform === 'ios' && (
                                      <Badge variant="outline" className="text-[10px] gap-0.5">
                                        <Apple className="h-3 w-3" /> iOS
                                      </Badge>
                                    )}
                                    {adset.platform === 'android' && (
                                      <Badge variant="outline" className="text-[10px] gap-0.5">
                                        <Smartphone className="h-3 w-3" /> Android
                                      </Badge>
                                    )}
                                    {adset.platform === 'both' && (
                                      <Badge variant="outline" className="text-[10px]">Both</Badge>
                                    )}
                                    <Badge 
                                      variant={adset.status === 'ACTIVE' ? 'default' : 'secondary'}
                                      className="text-[10px]"
                                    >
                                      {adset.status}
                                    </Badge>
                                  </div>
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

                {/* Selected Adsets */}
                {selectedAdsets.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Ad Sets ({selectedAdsets.length})</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedAdsets.filter(Boolean).map(adset => (
                        <Badge 
                          key={adset.id} 
                          variant="secondary"
                          className="flex items-center gap-1 pr-1"
                        >
                          {adset.platform === 'ios' && <Apple className="h-3 w-3" />}
                          {adset.platform === 'android' && <Smartphone className="h-3 w-3" />}
                          <span className="max-w-[200px] truncate">{adset.name}</span>
                          <button
                            className="ml-1 p-0.5 rounded-full hover:bg-muted"
                            onClick={() => removeAdset(adset.id)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setSelectedAdsets([]);
                        setSavedAdsetIds([]);
                      }}
                      className="text-xs"
                    >
                      Clear all
                    </Button>
                    
                    {/* Mixed campaign type warning */}
                    {campaignTypeInfo.hasMixedObjectives && (
                      <Alert className="mt-3">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          You've selected ad sets from different campaign types (e.g., app install and awareness). 
                          This may cause some ads to fail. Consider separating them.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Awareness campaign info */}
                    {campaignTypeInfo.isAwareness && !campaignTypeInfo.hasMixedObjectives && (
                      <p className="text-xs text-muted-foreground mt-2">
                        ℹ️ Awareness campaigns require website URLs and specific CTAs
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Media Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Media</CardTitle>
                <CardDescription>
                  Upload images or videos for your ad. 
                  {mediaFiles.length > 1 && (
                    <span className="text-primary font-medium"> Each file creates a separate ad.</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Media upload zone - contains both drop area and previews */}
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg cursor-pointer transition-colors relative",
                    "hover:border-primary/50 hover:bg-muted/50",
                    "border-border",
                    mediaFiles.length === 0 ? "min-h-[200px]" : ""
                  )}
                  onClick={() => document.getElementById('file-input')?.click()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFileSelect(e.dataTransfer.files);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {mediaFiles.length === 0 ? (
                    // Empty state - show upload instructions
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                      <Upload className="h-12 w-12 mb-4 text-muted-foreground" />
                      <p className="text-lg text-muted-foreground">
                        Drag & drop or click to upload
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        JPG, PNG, GIF, MP4, MOV (max 4GB for videos)
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
                    // Has files - show previews grid with add more option
                    <div className="p-4 h-full">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-sm">
                          {mediaFiles.length} file{mediaFiles.length !== 1 ? 's' : ''} → {mediaFiles.length * Math.max(selectedAdsets.length, 1)} ad{mediaFiles.length * Math.max(selectedAdsets.length, 1) !== 1 ? 's' : ''}
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

                            {/* Filename tooltip on hover */}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-[10px] px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                              {media.file ? media.file.name.replace(/\.[^/.]+$/, '') : (media.sourceInstagramMediaId ? `IG Post ${media.sourceInstagramMediaId.slice(-8)}` : 'Unknown')}
                            </div>

                            {/* Type badge */}
                            <Badge 
                              variant="secondary" 
                              className="absolute top-1 left-1 text-[10px]"
                            >
                              {media.type === 'image' ? <Image className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                            </Badge>

                            {/* Compliance score badge */}
                            {!media.sourceInstagramMediaId && (() => {
                              const compliance = getComplianceForIndex(index);
                              if (!compliance) return null;
                              if (compliance.status === 'checking') {
                                return (
                                  <div className="absolute bottom-1 right-1 h-7 w-7 rounded-full bg-muted border flex items-center justify-center">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                  </div>
                                );
                              }
                              if (compliance.status === 'error') {
                                return (
                                  <button
                                    className="absolute bottom-1 right-1 h-7 w-7 rounded-full bg-destructive/90 border flex items-center justify-center"
                                    onClick={(e) => { e.stopPropagation(); retryCheck(index); }}
                                    title="Retry compliance check"
                                  >
                                    <AlertCircle className="h-3.5 w-3.5 text-destructive-foreground" />
                                  </button>
                                );
                              }
                              if (compliance.status === 'done' && compliance.score !== undefined) {
                                const bg = compliance.score >= 90
                                  ? 'bg-green-600 dark:bg-green-500'
                                  : compliance.score >= 50
                                    ? 'bg-amber-500 dark:bg-amber-400'
                                    : 'bg-destructive';
                                return (
                                  <button
                                    className={`absolute bottom-1 right-1 h-7 min-w-7 px-1 rounded-full ${bg} text-white text-[10px] font-bold flex items-center justify-center border border-white/20`}
                                    onClick={(e) => { e.stopPropagation(); setComplianceDialogIndex(index); }}
                                    title="View compliance details"
                                  >
                                    {compliance.score}%
                                  </button>
                                );
                              }
                              return null;
                            })()}
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
                    id="file-input"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/gif,video/mp4,video/quicktime"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                  />
                </div>

                {/* Publish section at bottom of media card */}
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
                    onClick={() => {
                      // Check if any media has compliance score < 50%
                      let hasLowCompliance = false;
                      for (const [, state] of complianceStates) {
                        if (state.status === 'done' && state.score !== undefined && state.score < 50) {
                          hasLowCompliance = true;
                          break;
                        }
                      }
                      if (hasLowCompliance) {
                        setComplianceWarningOpen(true);
                      } else {
                        setConfirmDialogOpen(true);
                      }
                    }}
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Publishing...
                      </>
                    ) : hasUploadingFiles ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading files...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4 mr-2" />
                        Publish to Meta
                      </>
                    )}
                  </Button>
                  
                  {!canPublish && (
                    <p className="text-xs text-muted-foreground text-center">
                      Add media, select ad sets, and fill in required fields to publish
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Ad Copy */}
          <div className="space-y-6">
            {/* Ad Copy */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Ad Copy</CardTitle>
                  <CardDescription>
                    {hasExistingPosts 
                      ? 'Using original Instagram post content' 
                      : 'Write your ad text'}
                  </CardDescription>
                </div>
                {!hasExistingPosts && (
                  <div className="flex items-center gap-1">
                    <CreativeEnhancementsDialog 
                      trigger={
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-auto px-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
                        >
                          <span className="inline-flex items-center justify-center px-3 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white shadow-sm shadow-fuchsia-500/30">
                            Advantage+
                          </span>
                        </Button>
                      }
                    />
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleSaveDefaults}
                      disabled={isSaving}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Save as default
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {hasExistingPosts ? (
                  <>
                    {/* Read-only caption from existing post */}
                    <div className="space-y-2">
                      <Label>Caption</Label>
                      <div className="rounded-md border border-border bg-muted/50 p-3">
                        <p className="text-sm whitespace-pre-wrap">
                          {existingPostCaption || <span className="text-muted-foreground italic">No caption</span>}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Caption from original Instagram post (cannot be changed)
                      </p>
                    </div>

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Headlines and descriptions are not used for existing post ads. The original post content will be shown as-is.
                      </AlertDescription>
                    </Alert>
                  </>
                ) : (
                  <>
                    {/* Primary Texts - up to 5 */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label>Primary Text(s)</Label>
                        <span className="text-xs text-muted-foreground">
                          {primaryTexts.length}/5 options • Meta will test these
                        </span>
                      </div>
                      {primaryTexts.map((text, index) => (
                        <div key={index} className="flex gap-2">
                          <div className="flex-1 relative">
                            <Textarea
                              value={text}
                              onChange={(e) => {
                                const newTexts = [...primaryTexts];
                                newTexts[index] = e.target.value;
                                setPrimaryTexts(newTexts);
                              }}
                              placeholder={index === 0 ? "The main text that appears above your ad" : `Option ${index + 1}`}
                              rows={2}
                            />
                            <span className={`absolute right-2 bottom-2 text-[10px] ${text.length > 125 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                              {text.length} {text.length > 125 && '(may truncate)'}
                            </span>
                          </div>
                          {index > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPrimaryTexts(primaryTexts.filter((_, i) => i !== index))}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {primaryTexts.length < 5 && (
                        <button
                          type="button"
                          onClick={() => setPrimaryTexts([...primaryTexts, ''])}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          + Add alternative
                        </button>
                      )}
                    </div>

                    {/* Headlines - up to 5 */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label>Headline(s)</Label>
                        <span className="text-xs text-muted-foreground">
                          {headlines.length}/5 options
                        </span>
                      </div>
                      {headlines.map((text, index) => (
                        <div key={index} className="flex gap-2">
                          <div className="flex-1 relative">
                            <Input
                              value={text}
                              onChange={(e) => {
                                const newHeadlines = [...headlines];
                                newHeadlines[index] = e.target.value;
                                setHeadlines(newHeadlines);
                              }}
                              placeholder={index === 0 ? "Catchy headline" : `Option ${index + 1}`}
                              maxLength={40}
                            />
                            <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] ${text.length > 35 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                              {text.length}/40
                            </span>
                          </div>
                          {index > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setHeadlines(headlines.filter((_, i) => i !== index))}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {headlines.length < 5 && (
                        <button
                          type="button"
                          onClick={() => setHeadlines([...headlines, ''])}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          + Add alternative
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description (optional)</Label>
                      <Input
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Additional details"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Call to Action</Label>
                  <Select value={callToAction} onValueChange={setCallToAction}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCTAs.map(cta => (
                        <SelectItem key={cta.value} value={cta.value}>
                          {cta.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasExistingPosts && (
                    <p className="text-xs text-muted-foreground">
                      Limited CTAs available for existing post ads
                    </p>
                  )}
                  {!hasExistingPosts && campaignTypeInfo.isAwareness && (
                    <p className="text-xs text-muted-foreground">
                      CTAs adjusted for awareness campaigns
                    </p>
                  )}
                </div>

                <Separator />

                {/* Dynamic Destination URLs based on campaign type */}
                <div className="space-y-3">
                  <Label>Destination URL</Label>
                  
                  {campaignTypeInfo.isAwareness ? (
                    // Website URL for awareness campaigns
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="website-url" className="text-sm">Website URL</Label>
                        <Badge variant="outline" className="text-[10px]">Required for awareness</Badge>
                      </div>
                      <Input
                        id="website-url"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://yoursite.com/landing-page"
                      />
                      <p className="text-xs text-muted-foreground">
                        Awareness campaigns require a website URL (not app store)
                      </p>
                    </div>
                  ) : (
                    // App store URLs for non-awareness campaigns
                    <>
                      {(needsIosUrl || selectedAdsets.length === 0) && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="ios-destination-url" className="text-sm">iOS App Store</Label>
                            {selectedAdsets.some(a => a.iosUrl) && (
                              <Badge variant="outline" className="text-[10px]">Auto-filled</Badge>
                            )}
                          </div>
                          <Input
                            id="ios-destination-url"
                            value={iosDestinationUrl}
                            onChange={(e) => setIosDestinationUrl(e.target.value)}
                            placeholder="https://apps.apple.com/app/..."
                          />
                        </div>
                      )}
                      
                      {(needsAndroidUrl || selectedAdsets.length === 0) && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="android-destination-url" className="text-sm">Google Play Store</Label>
                            {selectedAdsets.some(a => a.androidUrl) && (
                              <Badge variant="outline" className="text-[10px]">Auto-filled</Badge>
                            )}
                          </div>
                          <Input
                            id="android-destination-url"
                            value={androidDestinationUrl}
                            onChange={(e) => setAndroidDestinationUrl(e.target.value)}
                            placeholder="https://play.google.com/store/apps/..."
                          />
                        </div>
                      )}
                      
                      {selectedAdsets.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          URLs auto-populated from ad set configuration when available
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="url-params">URL Parameters (optional)</Label>
                  <Input
                    id="url-params"
                    value={urlParameters}
                    onChange={(e) => setUrlParameters(e.target.value)}
                    placeholder="utm_source=meta&utm_medium=paid"
                  />
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Launch History */}
        <AdLaunchHistory />
        </>
        )}
      </div>

      {/* Compliance Warning Dialog */}
      <AlertDialog open={complianceWarningOpen} onOpenChange={setComplianceWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Compliance Issues Detected
            </AlertDialogTitle>
            <AlertDialogDescription>
              One or more ads have a compliance score below 50%. Are you sure you want to publish?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setComplianceWarningOpen(false);
              setConfirmDialogOpen(true);
            }}>
              Yes, I'm sure
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Ads to Meta?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create {mediaFiles.length} ad(s) in {selectedAdsets.length} ad set(s).
              {startPaused 
                ? " Ads will be created as PAUSED."
                : " Ads will go LIVE immediately."}
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
        existingPosts={existingPosts}
        isLoading={mediaLibraryLoading}
        isLoadingPosts={existingPostsLoading}
        onRefresh={() => refetchMediaLibrary()}
        onRefreshPosts={() => refetchExistingPosts()}
        onSelectMedia={handleSelectFromLibrary}
      />
      <MediaComplianceDialog
        open={complianceDialogIndex !== null}
        onOpenChange={(open) => { if (!open) setComplianceDialogIndex(null); }}
        previewUrl={complianceDialogIndex !== null ? mediaFiles[complianceDialogIndex]?.previewUrl : undefined}
        mediaType={complianceDialogIndex !== null ? mediaFiles[complianceDialogIndex]?.type : undefined}
        score={complianceDialogIndex !== null ? getComplianceForIndex(complianceDialogIndex)?.score : undefined}
        results={complianceDialogIndex !== null ? getComplianceForIndex(complianceDialogIndex)?.results : undefined}
        rules={complianceRules}
      />
    </>
  );
}
