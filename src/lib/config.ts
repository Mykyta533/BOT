export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ocnwpbzrmpiniocmasny.supabase.co';
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  'sb_publishable_eF7pxeFUMcyBT2I6_dNGcQ_a-DxuBbu';
export const FN_URL = `${SUPABASE_URL}/functions/v1/telegram-bot`;
