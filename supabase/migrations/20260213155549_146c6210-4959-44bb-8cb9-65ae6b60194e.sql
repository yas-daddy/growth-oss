ALTER TABLE public.email_campaign_settings
  ADD COLUMN mock_first_name text NOT NULL DEFAULT 'John',
  ADD COLUMN mock_net_deposits text NOT NULL DEFAULT '500';