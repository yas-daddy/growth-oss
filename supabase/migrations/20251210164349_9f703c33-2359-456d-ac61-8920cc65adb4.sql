-- Add monthly_cap column to affiliates table
ALTER TABLE public.affiliates 
ADD COLUMN monthly_cap numeric DEFAULT 0;