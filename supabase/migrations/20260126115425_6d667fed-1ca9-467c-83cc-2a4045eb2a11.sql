-- Create apple_search_terms table for storing search term breakdown data per keyword
CREATE TABLE public.apple_search_terms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  keyword_id text NOT NULL,
  search_term_text text NOT NULL,
  search_term_source text,
  match_type text,
  date date NOT NULL,
  impressions integer DEFAULT 0,
  taps integer DEFAULT 0,
  installs integer DEFAULT 0,
  spend numeric DEFAULT 0,
  impression_share_low integer,
  impression_share_high integer,
  impression_rank integer,
  search_popularity integer,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicates on re-sync
CREATE UNIQUE INDEX apple_search_terms_unique_idx 
ON public.apple_search_terms (keyword_id, search_term_text, date);

-- Enable Row Level Security
ALTER TABLE public.apple_search_terms ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users
CREATE POLICY "Users can view their own search terms"
ON public.apple_search_terms
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own search terms"
ON public.apple_search_terms
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own search terms"
ON public.apple_search_terms
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own search terms"
ON public.apple_search_terms
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for efficient querying by keyword_id and date range
CREATE INDEX apple_search_terms_keyword_date_idx 
ON public.apple_search_terms (keyword_id, date);

-- Add index for user queries
CREATE INDEX apple_search_terms_user_idx 
ON public.apple_search_terms (user_id);