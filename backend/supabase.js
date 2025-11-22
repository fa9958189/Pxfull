import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://gklpjwjzluqsnavwhwxf.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE
);
