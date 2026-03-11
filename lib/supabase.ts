import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL = 'https://cetljriwbhtrargoomou.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNldGxqcml3Ymh0cmFyZ29vbW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTk5NTMsImV4cCI6MjA4ODczNTk1M30.V-QhoV7FgSwREJQaNQkKYKQWH-rjk67xXDDUOZozM6k';

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export type { User, Session } from '@supabase/supabase-js';
