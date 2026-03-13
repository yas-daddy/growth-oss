import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CreativeEnhancements {
  id: string;
  user_id: string;
  // Translation enhancements
  translate_voiceover: boolean;
  translate_text: boolean;
  // Text enhancements
  text_generation: boolean;
  // Layout enhancements
  site_extensions: boolean;
  // Visual enhancements
  image_touchups: boolean;
  adapt_to_placement: boolean;
  image_animation: boolean;
  image_expansion: boolean;
  // Video enhancements
  video_filters: boolean;
  music_generation: boolean;
  // Display enhancements
  show_summary: boolean;
  inline_comment: boolean;
  enhance_cta: boolean;
  reveal_details_over_time: boolean;
  show_spotlights: boolean;
  created_at: string;
  updated_at: string;
}

// Default values when no settings exist
export const DEFAULT_ENHANCEMENTS: Omit<CreativeEnhancements, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  translate_voiceover: true,
  translate_text: true,
  text_generation: true,
  site_extensions: true,
  image_touchups: true,
  adapt_to_placement: true,
  image_animation: true,
  image_expansion: true,
  video_filters: true,
  music_generation: true,
  show_summary: true,
  inline_comment: true,
  enhance_cta: true,
  reveal_details_over_time: true,
  show_spotlights: true,
};

// Enhancement metadata for UI
export const ENHANCEMENT_CONFIG = {
  translate_voiceover: {
    label: 'Translate voiceover',
    description: 'Automatically translate voiceover to match viewer language',
    category: 'translation',
  },
  translate_text: {
    label: 'Translate text',
    description: 'Automatically translate text overlays to match viewer language',
    category: 'translation',
  },
  text_generation: {
    label: 'Text improvements',
    description: 'Optimize text for better engagement',
    category: 'text',
  },
  site_extensions: {
    label: 'Add details to ad layout',
    description: 'Add additional context and details from your website',
    category: 'layout',
  },
  image_touchups: {
    label: 'Visual touch-ups',
    description: 'Apply visual enhancements to images',
    category: 'visual',
  },
  adapt_to_placement: {
    label: 'Adapt to placement',
    description: 'Adjust aspect ratio and cropping for different placements',
    category: 'visual',
  },
  image_animation: {
    label: 'Image animation',
    description: 'Add subtle animations to static images',
    category: 'visual',
  },
  image_expansion: {
    label: 'Image expansion',
    description: 'Expand images to fill available space',
    category: 'visual',
  },
  video_filters: {
    label: 'Add video effects',
    description: 'Apply visual effects and filters to videos',
    category: 'video',
  },
  music_generation: {
    label: 'Music',
    description: 'Add AI-generated background music to videos',
    category: 'video',
  },
  show_summary: {
    label: 'Show summaries',
    description: 'Display key information summaries',
    category: 'display',
  },
  inline_comment: {
    label: 'Relevant comments',
    description: 'Show relevant comments on the ad',
    category: 'display',
  },
  enhance_cta: {
    label: 'Enhance CTA',
    description: 'Optimize call-to-action presentation',
    category: 'display',
  },
  reveal_details_over_time: {
    label: 'Reveal details over time',
    description: 'Progressively reveal information as video plays',
    category: 'display',
  },
  show_spotlights: {
    label: 'Show spotlights',
    description: 'Highlight key product features',
    category: 'display',
  },
} as const;

export type EnhancementKey = keyof typeof ENHANCEMENT_CONFIG;

export function useCreativeEnhancements() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['creative-enhancements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_creative_enhancements')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as CreativeEnhancements | null;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (enhancements: Partial<CreativeEnhancements>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const existing = query.data;
      
      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('ad_creative_enhancements')
          .update({
            ...enhancements,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('ad_creative_enhancements')
          .insert({
            user_id: user.id,
            ...enhancements,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creative-enhancements'] });
      toast({
        title: 'Settings saved',
        description: 'Your Advantage+ Creative settings have been saved as defaults.',
      });
    },
    onError: (error) => {
      console.error('Error saving enhancements:', error);
      toast({
        title: 'Error saving settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  // Get current values, falling back to defaults
  const currentEnhancements = query.data 
    ? {
        translate_voiceover: query.data.translate_voiceover,
        translate_text: query.data.translate_text,
        text_generation: query.data.text_generation,
        site_extensions: query.data.site_extensions,
        image_touchups: query.data.image_touchups,
        adapt_to_placement: query.data.adapt_to_placement,
        image_animation: query.data.image_animation,
        image_expansion: query.data.image_expansion,
        video_filters: query.data.video_filters,
        music_generation: query.data.music_generation,
        show_summary: query.data.show_summary,
        inline_comment: query.data.inline_comment,
        enhance_cta: query.data.enhance_cta,
        reveal_details_over_time: query.data.reveal_details_over_time,
        show_spotlights: query.data.show_spotlights,
      }
    : DEFAULT_ENHANCEMENTS;

  return {
    enhancements: currentEnhancements,
    isLoading: query.isLoading,
    error: query.error,
    saveEnhancements: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}
