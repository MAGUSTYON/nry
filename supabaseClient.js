// js/supabaseClient.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://pxjnrkkkaznebjtxmuqp.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4am5ya2trYXpuZWJqdHhtdXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MjIyNDcsImV4cCI6MjA4NjA5ODI0N30.w88N_rvPaLT7Eii0JC8AvgOlDNt-X8HjqCP6bq4w44o"
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
