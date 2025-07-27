import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://clbynlnvmistczaocdib.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsYnlubG52bWlzdGN6YW9jZGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNjgxNTYsImV4cCI6MjA2ODk0NDE1Nn0.d-qWPRwZkMzppA3MS9E-6iWl6U0hqcwZaWskne7whi8';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;