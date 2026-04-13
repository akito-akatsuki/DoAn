import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

export const getUserFromToken = async (token) => {
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    return null;
  }

  return data.user;
};

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
