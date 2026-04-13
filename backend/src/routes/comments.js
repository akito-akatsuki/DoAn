import express from "express";
import { supabase } from "../lib/supabase.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = express.Router();

/* =========================
   GET COMMENTS BY POST
========================= */
router.get("/:postId", async (req, res) => {
  try {
    const { postId } = req.params;

    const { data, error } = await supabase
      .from("comments")
      .select(
        `
  id,
  content,
  created_at,
  user_id,
  users (
    id,
    name,
    avatar_url
  )
`,
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      console.log("GET COMMENTS ERROR:", error);
      return res.status(500).json({ error });
    }

    res.json(data || []);
  } catch (err) {
    console.log("SERVER ERROR:", err);
    res.status(500).json({ error: "server error" });
  }
});

/* =========================
   CREATE COMMENT
========================= */
router.post("/:postId", async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, user_id } = req.body;

    if (!content || !user_id) {
      return res.status(400).json({ error: "missing data" });
    }

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("id, name, avatar_url")
      .eq("id", user_id)
      .single();

    if (!profile) {
      return res.status(400).json({ error: "Profile not found" });
    }

    const { data, error } = await supabaseAdmin
      .from("comments")
      .insert({
        post_id: postId,
        user_id,
        content,
      })
      .select(
        `
  id,
  content,
  created_at,
  user_id,
  users (
    id,
    name,
    avatar_url
  )
`,
      )
      .single();

    if (error) {
      console.log("INSERT COMMENT ERROR:", error);
      return res.status(500).json({ error });
    }

    res.json(data);
  } catch (err) {
    console.log("SERVER ERROR:", err);
    res.status(500).json({ error: "server error" });
  }
});

export default router;
