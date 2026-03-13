-- Add unique constraint on review_id only (not user_id,review_id)
-- First drop any existing constraint if present
ALTER TABLE trustpilot_reviews DROP CONSTRAINT IF EXISTS trustpilot_reviews_review_id_key;
ALTER TABLE google_play_reviews DROP CONSTRAINT IF EXISTS google_play_reviews_review_id_key;

-- Add unique constraints on review_id alone
ALTER TABLE trustpilot_reviews ADD CONSTRAINT trustpilot_reviews_review_id_key UNIQUE (review_id);
ALTER TABLE google_play_reviews ADD CONSTRAINT google_play_reviews_review_id_key UNIQUE (review_id);