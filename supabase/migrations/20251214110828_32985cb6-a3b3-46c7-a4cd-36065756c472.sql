-- Create table to track sync function execution logs
CREATE TABLE public.sync_function_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name text NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'running', -- 'running', 'success', 'error'
  duration_ms integer,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_sync_function_logs_function_name ON public.sync_function_logs(function_name);
CREATE INDEX idx_sync_function_logs_started_at ON public.sync_function_logs(started_at DESC);

-- Enable RLS
ALTER TABLE public.sync_function_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view logs
CREATE POLICY "Authenticated users can view sync logs" 
ON public.sync_function_logs 
FOR SELECT 
USING (true);

-- Allow admins to manage logs
CREATE POLICY "Admins can manage sync logs" 
ON public.sync_function_logs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));