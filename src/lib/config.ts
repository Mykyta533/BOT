export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ocnwpbzrmpiniocmasny.supabase.co';
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jbndwYnpybXBpbmlvY21hc255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MjE2MzksImV4cCI6MjEwMTI5NzYzOX0.3XVU2sAbXCK2-EHdjcQgd-s1PtCGYo10-ocJHKiWbYc';
export const FN_URL = `${SUPABASE_URL}/functions/v1/telegram-bot`;
