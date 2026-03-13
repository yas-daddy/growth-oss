-- Create table to store generated affiliate links
CREATE TABLE public.affiliate_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  short_url text NOT NULL,
  long_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;

-- Admins can manage all affiliate links
CREATE POLICY "Admins can manage affiliate links"
ON public.affiliate_links
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Affiliates can view their own links
CREATE POLICY "Affiliates can view their own links"
ON public.affiliate_links
FOR SELECT
USING (affiliate_id = ANY (get_user_affiliate_ids(auth.uid())));

-- Affiliates can create links for their assigned affiliates
CREATE POLICY "Affiliates can create their own links"
ON public.affiliate_links
FOR INSERT
WITH CHECK (affiliate_id = ANY (get_user_affiliate_ids(auth.uid())));