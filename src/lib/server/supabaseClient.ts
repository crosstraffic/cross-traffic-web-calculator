// Connect to Supabase
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_PROJECT_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

// Validate environment variables
if (!PUBLIC_SUPABASE_PROJECT_URL || !PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Supabase URL or Anon Key is not set. Check your environment variables.');
}

export const supabase = createClient(PUBLIC_SUPABASE_PROJECT_URL!, PUBLIC_SUPABASE_ANON_KEY!);

type SupabaseQueryResult = (functionName: string, param?: Record<string, any[]>) => Promise<any>
export const query: SupabaseQueryResult = async (functionName, param = {}) => {

    // Execute the raw SQL query
    // TODO: This should be replaced when calling password
    const { data, error } = await supabase.rpc(functionName, param)
    if (error) {
        throw new Error(`Failed to execute RPC: ${error.message}`);
    }
    return data
}