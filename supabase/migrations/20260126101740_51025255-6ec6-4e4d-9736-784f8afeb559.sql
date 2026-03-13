-- Add impression share columns to apple_keywords table
ALTER TABLE public.apple_keywords
ADD COLUMN impression_share_low integer,
ADD COLUMN impression_share_high integer,
ADD COLUMN impression_rank integer,
ADD COLUMN search_popularity integer;

-- Add impression share columns to daily_apple_keyword_spend table
ALTER TABLE public.daily_apple_keyword_spend
ADD COLUMN impression_share_low integer,
ADD COLUMN impression_share_high integer,
ADD COLUMN impression_rank integer,
ADD COLUMN search_popularity integer;

-- Add comments for documentation
COMMENT ON COLUMN public.apple_keywords.impression_share_low IS 'Lower bound of impression share percentage range (0-100)';
COMMENT ON COLUMN public.apple_keywords.impression_share_high IS 'Upper bound of impression share percentage range (0-100)';
COMMENT ON COLUMN public.apple_keywords.impression_rank IS 'Competitive rank (1-5, where 1 is best, 6 means >5)';
COMMENT ON COLUMN public.apple_keywords.search_popularity IS 'Keyword popularity score (1-5, where 5 is most popular)';

COMMENT ON COLUMN public.daily_apple_keyword_spend.impression_share_low IS 'Lower bound of impression share percentage range (0-100)';
COMMENT ON COLUMN public.daily_apple_keyword_spend.impression_share_high IS 'Upper bound of impression share percentage range (0-100)';
COMMENT ON COLUMN public.daily_apple_keyword_spend.impression_rank IS 'Competitive rank (1-5, where 1 is best, 6 means >5)';
COMMENT ON COLUMN public.daily_apple_keyword_spend.search_popularity IS 'Keyword popularity score (1-5, where 5 is most popular)';