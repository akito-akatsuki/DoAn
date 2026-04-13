import { supabaseAdmin } from "../lib/supabaseAdmin.js";

export const isMutualFollow = async (user1, user2) => {
  const { data } = await supabaseAdmin
    .from("follows")
    .select("*")
    .or(
      `and(follower_id.eq.${user1},following_id.eq.${user2}),and(follower_id.eq.${user2},following_id.eq.${user1})`,
    );

  return data?.length === 2;
};
