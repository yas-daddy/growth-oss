-- Create daily_affiliate_spend table to track FTD-based spend per affiliate per day
CREATE TABLE public.daily_affiliate_spend (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  ftds INTEGER NOT NULL DEFAULT 0,
  spend NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, affiliate_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_affiliate_spend ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own affiliate spend"
ON public.daily_affiliate_spend
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own affiliate spend"
ON public.daily_affiliate_spend
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own affiliate spend"
ON public.daily_affiliate_spend
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own affiliate spend"
ON public.daily_affiliate_spend
FOR DELETE
USING (auth.uid() = user_id);