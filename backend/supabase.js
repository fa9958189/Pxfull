import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  "https://gklpjwjzluqsnavwhwxf.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE
);

export const supabaseAuth = createClient(
  "https://gklpjwjzluqsnavwhwxf.supabase.co",
  process.env.SUPABASE_ANON_KEY
);

// Mantém compatibilidade com importações existentes
export const supabase = supabaseAdmin;
