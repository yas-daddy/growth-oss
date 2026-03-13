-- Create affiliate status enum
CREATE TYPE public.affiliate_status AS ENUM ('active', 'paused', 'inactive');

-- Create affiliates table
CREATE TABLE public.affiliates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  cpa DECIMAL(10,2) NOT NULL DEFAULT 0,
  ftds INTEGER NOT NULL DEFAULT 0,
  status affiliate_status NOT NULL DEFAULT 'active',
  contact_email TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own affiliates
CREATE POLICY "Users can view their own affiliates"
ON public.affiliates
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own affiliates"
ON public.affiliates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own affiliates"
ON public.affiliates
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own affiliates"
ON public.affiliates
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_affiliates_updated_at
BEFORE UPDATE ON public.affiliates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();