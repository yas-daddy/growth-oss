-- Enable RLS on user_ftd_dates table (internal lookup table - read-only via RPC)
ALTER TABLE user_ftd_dates ENABLE ROW LEVEL SECURITY;

-- Only allow service role to manage this table (populated by backend functions)
CREATE POLICY "Service role can manage user_ftd_dates"
ON user_ftd_dates
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');