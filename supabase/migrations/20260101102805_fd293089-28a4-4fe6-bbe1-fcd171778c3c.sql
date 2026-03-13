-- Create ad_creative_enhancements table for storing Advantage+ Creative settings
CREATE TABLE public.ad_creative_enhancements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  
  -- Translation enhancements
  translate_voiceover boolean NOT NULL DEFAULT true,
  translate_text boolean NOT NULL DEFAULT true,
  
  -- Text enhancements
  text_generation boolean NOT NULL DEFAULT true,
  
  -- Layout enhancements
  site_extensions boolean NOT NULL DEFAULT true,
  
  -- Visual enhancements
  image_touchups boolean NOT NULL DEFAULT true,
  adapt_to_placement boolean NOT NULL DEFAULT true,
  image_animation boolean NOT NULL DEFAULT true,
  image_expansion boolean NOT NULL DEFAULT true,
  
  -- Video enhancements
  video_filters boolean NOT NULL DEFAULT true,
  music_generation boolean NOT NULL DEFAULT true,
  
  -- Display enhancements
  show_summary boolean NOT NULL DEFAULT true,
  inline_comment boolean NOT NULL DEFAULT true,
  enhance_cta boolean NOT NULL DEFAULT true,
  reveal_details_over_time boolean NOT NULL DEFAULT true,
  show_spotlights boolean NOT NULL DEFAULT true,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ad_creative_enhancements ENABLE ROW LEVEL SECURITY;

-- Create policy for admins
CREATE POLICY "Admins can manage ad creative enhancements" 
ON public.ad_creative_enhancements 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add unique constraint on user_id to ensure one settings row per user
CREATE UNIQUE INDEX ad_creative_enhancements_user_id_key ON public.ad_creative_enhancements(user_id);