import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ocnwpbzrmpiniocmasny.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jbndwYnpybXBpbmlvY21hc255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MjE2MzksImV4cCI6MjEwMTI5NzYzOX0.3XVU2sAbXCK2-EHdjcQgd-s1PtCGYo10-ocJHKiWbYc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const STORAGE_URL = `${supabaseUrl}/storage/v1/object/public/product-images`;
