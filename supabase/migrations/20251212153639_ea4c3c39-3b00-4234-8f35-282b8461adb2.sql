-- Add unique constraint on review_id for app_store_reviews
ALTER TABLE app_store_reviews ADD CONSTRAINT app_store_reviews_review_id_key UNIQUE (review_id);