import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TemplateElement {
  id: string;
  type: 'home_team_icon' | 'away_team_icon' | 'match_time' | 'vs_text' | 'odds_display' | 'custom_image' | 'custom_text' | 'terms';
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontColor?: string;
  text?: string;
  format?: string;
  imageUrl?: string;
}

export interface AdTemplate {
  id: string;
  name: string;
  background_image_url: string | null;
  width: number;
  height: number;
  elements: TemplateElement[];
  terms_text: string | null;
  cta_text: string | null;
  destination_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useAdTemplates() {
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['ad-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map the raw data to our interface, parsing elements JSON
      return (data || []).map(item => ({
        ...item,
        elements: (item.elements as unknown as TemplateElement[]) || [],
      })) as AdTemplate[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (template: Omit<AdTemplate, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('ad_templates')
        .insert({
          name: template.name,
          background_image_url: template.background_image_url,
          width: template.width,
          height: template.height,
          elements: JSON.parse(JSON.stringify(template.elements)),
          terms_text: template.terms_text,
          cta_text: template.cta_text,
          destination_url: template.destination_url,
          is_active: template.is_active,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-templates'] });
    },
    onError: (error: Error) => {
      toast.error("Failed to create template: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...template }: Partial<AdTemplate> & { id: string }) => {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      
      if (template.name !== undefined) updateData.name = template.name;
      if (template.background_image_url !== undefined) updateData.background_image_url = template.background_image_url;
      if (template.width !== undefined) updateData.width = template.width;
      if (template.height !== undefined) updateData.height = template.height;
      if (template.elements !== undefined) updateData.elements = JSON.parse(JSON.stringify(template.elements));
      if (template.terms_text !== undefined) updateData.terms_text = template.terms_text;
      if (template.cta_text !== undefined) updateData.cta_text = template.cta_text;
      if (template.destination_url !== undefined) updateData.destination_url = template.destination_url;
      if (template.is_active !== undefined) updateData.is_active = template.is_active;

      const { data, error } = await supabase
        .from('ad_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-templates'] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update template: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ad_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-templates'] });
    },
    onError: (error: Error) => {
      toast.error("Failed to delete template: " + error.message);
    },
  });

  return {
    templates,
    isLoading,
    createTemplate: createMutation.mutateAsync,
    updateTemplate: updateMutation.mutateAsync,
    deleteTemplate: deleteMutation.mutateAsync,
  };
}
