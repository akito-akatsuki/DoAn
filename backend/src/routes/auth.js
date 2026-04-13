import express from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = express.Router();

router.post("/sync", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    const { data } = await supabaseAdmin.auth.getUser(token);
    const user = data.user;

    if (!user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const googleId = user.id;

    let { data: profile } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", googleId)
      .single();

    if (!profile) {
      const { data: newUser, error } = await supabaseAdmin
        .from("users")
        .insert({
          id: googleId,
          email: user.email,
          name: user.user_metadata?.name || user.email,
          avatar_url: user.user_metadata?.avatar_url,
        })
        .select()
        .single();

      if (error) return res.status(500).json(error);

      profile = newUser;
    }

    return res.json(profile);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
