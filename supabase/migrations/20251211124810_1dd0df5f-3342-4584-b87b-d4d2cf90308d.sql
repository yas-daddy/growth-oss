-- Make mixpanel_events.user_id nullable
ALTER TABLE mixpanel_events ALTER COLUMN user_id DROP NOT NULL;