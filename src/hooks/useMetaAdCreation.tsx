import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  adsets: MetaAdset[];
}

export interface MetaAdset {
  id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  targeting?: {
    user_os?: string[];
    [key: string]: any;
  };
  iosUrl?: string;
  androidUrl?: string;
}

export interface UploadedMedia {
  file: File | null;  // null for existing posts
  previewUrl: string;
  type: 'image' | 'video';
  storageUrl?: string;
  metaHash?: string;
  metaVideoId?: string;
  sourceInstagramMediaId?: string;  // For existing Instagram posts
  caption?: string;  // Original caption for existing Instagram posts
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
}

export interface CreateAdParams {
  adsetIds: string[];
  adName: string;
  primaryTexts: string[];
  headlines: string[];
  description?: string;
  callToAction: string;
  destinationUrl: string;
  urlParameters?: string;
  media: Array<{
    type: 'image' | 'video';
    hash?: string;
    videoId?: string;
  }>;
  startPaused?: boolean;
  campaignObjective?: string;
}

export interface MediaLibraryItem {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  type: 'image' | 'video';
  source: 'bucket' | 'meta' | 'existing_post';
  hash?: string;
  videoId?: string;
  created_at?: string;
  // Fields for existing Instagram posts
  sourceInstagramMediaId?: string;
  caption?: string;
  permalink?: string;
  mediaType?: string;  // IMAGE, VIDEO, REELS, CAROUSEL_ALBUM
}

export interface InstagramPost {
  id: string;
  caption: string | null;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS';
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  is_eligible: boolean;
  ineligibility_reason?: string;
}

export interface ExistingPostsData {
  instagram: InstagramPost[];
}

export function useMetaCampaigns() {
  return useQuery({
    queryKey: ['meta-campaigns-adsets'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-fetch-campaigns-adsets');
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data.campaigns as MetaCampaign[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUploadMediaToMeta() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ mediaUrl, mediaType, fileName }: { 
      mediaUrl: string; 
      mediaType: 'image' | 'video';
      fileName: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('meta-upload-media', {
        body: { mediaUrl, mediaType, fileName },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data as { 
        success: boolean; 
        type: 'image' | 'video';
        hash?: string;
        videoId?: string;
        url?: string;
      };
    },
    onError: (error) => {
      console.error('Error uploading to Meta:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload media to Meta',
        variant: 'destructive',
      });
    },
  });
}

export function useCreateMetaAd() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateAdParams) => {
      const { data, error } = await supabase.functions.invoke('meta-create-ad', {
        body: params,
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meta-campaigns'] });
      
      if (data.summary.totalCreated > 0) {
        toast({
          title: 'Ads created successfully',
          description: `Created ${data.summary.totalCreated} ad(s)${data.summary.totalErrors > 0 ? ` with ${data.summary.totalErrors} error(s)` : ''}`,
        });
      }
    },
    onError: (error) => {
      console.error('Error creating ads:', error);
      toast({
        title: 'Failed to create ads',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}

export function useUploadToStorage() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ file, fileName, onProgress, upsert = false }: { 
      file: File; 
      fileName: string;
      onProgress?: (progress: number) => void;
      upsert?: boolean;
    }) => {
      // Start progress
      onProgress?.(5);
      
      const { data, error } = await supabase.storage
        .from('ad-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: upsert,
        });
      
      if (error) throw error;
      
      // Complete progress
      onProgress?.(100);
      
      // Get public URL - bucket is now public so Meta can download
      const { data: urlData } = supabase.storage
        .from('ad-media')
        .getPublicUrl(data.path);
      
      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }
      
      return { path: data.path, url: urlData.publicUrl };
    },
    onError: (error) => {
      console.error('Error uploading to storage:', error);
      // Don't show toast here - let the caller handle it for duplicate detection
    },
  });
}

// Check if a file exists in the bucket
export function useCheckFileExists() {
  return useMutation({
    mutationFn: async (fileName: string) => {
      const { data } = await supabase.storage
        .from('ad-media')
        .list('', { search: fileName });
      
      const exists = data?.some(f => f.name === fileName) ?? false;
      
      if (exists) {
        const { data: urlData } = supabase.storage
          .from('ad-media')
          .getPublicUrl(fileName);
        return { exists: true, url: urlData.publicUrl };
      }
      
      return { exists: false, url: null };
    },
  });
}

export function useMediaLibrary() {
  return useQuery({
    queryKey: ['media-library'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-list-media');
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data as {
        bucket: MediaLibraryItem[];
        meta: {
          images: MediaLibraryItem[];
          videos: MediaLibraryItem[];
        };
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useExistingPosts() {
  return useQuery({
    queryKey: ['existing-posts'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-fetch-existing-posts');
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data as ExistingPostsData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
