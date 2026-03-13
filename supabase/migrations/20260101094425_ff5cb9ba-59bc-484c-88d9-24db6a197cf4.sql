-- Make the ad-media bucket public so Meta can download files
UPDATE storage.buckets SET public = true WHERE id = 'ad-media';

-- Add public read access policy for ad-media bucket
CREATE POLICY "Public read access for ad media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'ad-media');