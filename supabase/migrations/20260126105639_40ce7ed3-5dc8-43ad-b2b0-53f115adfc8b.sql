-- Step 1: Delete duplicate keywords, keeping only the most recent record per keyword_id
DELETE FROM apple_keywords a
USING (
  SELECT keyword_id, MAX(synced_at) as latest_sync
  FROM apple_keywords
  GROUP BY keyword_id
  HAVING COUNT(*) > 1
) dups
WHERE a.keyword_id = dups.keyword_id
  AND a.synced_at < dups.latest_sync;

-- Step 2: Drop the old constraint that includes user_id
ALTER TABLE apple_keywords DROP CONSTRAINT IF EXISTS apple_keywords_user_id_keyword_id_key;

-- Step 3: Add new unique constraint on keyword_id only
ALTER TABLE apple_keywords ADD CONSTRAINT apple_keywords_keyword_id_key UNIQUE (keyword_id);