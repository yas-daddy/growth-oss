import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface SyncLog {
  id: string;
  function_name: string;
  started_at: string;
}

// Clean up stale "running" logs older than 1 hour (likely timed out)
async function cleanupStaleLogs(functionName: string): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    await supabase
      .from('sync_function_logs')
      .update({
        status: 'error',
        completed_at: new Date().toISOString(),
        error_message: 'Function timed out or was interrupted',
      })
      .eq('function_name', functionName)
      .eq('status', 'running')
      .lt('started_at', oneHourAgo);
  } catch (err) {
    console.error('Error cleaning up stale logs:', err);
  }
}

export async function startSyncLog(functionName: string): Promise<SyncLog | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Clean up any stale "running" logs first
    await cleanupStaleLogs(functionName);

    const { data, error } = await supabase
      .from('sync_function_logs')
      .insert({
        function_name: functionName,
        status: 'running',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating sync log:', error);
      return null;
    }

    return data as SyncLog;
  } catch (err) {
    console.error('Error in startSyncLog:', err);
    return null;
  }
}

export async function completeSyncLog(
  logId: string | null,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  if (!logId) return;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the log to calculate duration
    const { data: log } = await supabase
      .from('sync_function_logs')
      .select('started_at')
      .eq('id', logId)
      .single();

    const durationMs = log 
      ? Date.now() - new Date(log.started_at).getTime()
      : null;

    const { error } = await supabase
      .from('sync_function_logs')
      .update({
        status: success ? 'success' : 'error',
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        error_message: errorMessage || null,
      })
      .eq('id', logId);
    
    if (error) {
      console.error('Error completing sync log:', error);
    }
  } catch (err) {
    console.error('Error in completeSyncLog:', err);
  }
}
