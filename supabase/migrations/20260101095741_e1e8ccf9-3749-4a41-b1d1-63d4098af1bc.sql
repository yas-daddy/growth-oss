-- Update ad_defaults table to support multiple primary texts and headlines (up to 5 each)
ALTER TABLE public.ad_defaults
ADD COLUMN primary_texts text[] DEFAULT '{}',
ADD COLUMN headlines text[] DEFAULT '{}';

-- Migrate existing single values to arrays
UPDATE public.ad_defaults
SET 
  primary_texts = CASE WHEN primary_text IS NOT NULL THEN ARRAY[primary_text] ELSE '{}' END,
  headlines = CASE WHEN headline IS NOT NULL THEN ARRAY[headline] ELSE '{}' END;

-- Update ad_drafts table as well
ALTER TABLE public.ad_drafts
ADD COLUMN primary_texts text[] DEFAULT '{}',
ADD COLUMN headlines text[] DEFAULT '{}';