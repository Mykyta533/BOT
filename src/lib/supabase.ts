import { createClient } from '@supabase/supabase-js';

import { SUPABASE_URL as supabaseUrl, SUPABASE_ANON_KEY as supabaseAnonKey } from '@/lib/config';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const STORAGE_URL = `${supabaseUrl}/storage/v1/object/public/product-images`;
