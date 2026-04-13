import express from "express";
import { supabase } from "../lib/supabase.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = express.Router();

/* ======================
   GET FEED (PUBLIC)
====================== */
router.get("/feed", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || null;

    const { data, error } = await supabase
      .from("posts")
      .select(
        `
        id,
        content,
        image_url,
        created_at,
        user_id,
        users!posts_user_id_fkey (
          name,
          avatar_url
        ),
        likes:likes(user_id),
        comments:comments(id)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.log("FEED ERROR:", error);
      return res.status(500).json(error);
    }

    const formatted = data.map((p) => ({
      ...p,
      likes_count: p.likes?.length || 0,
      comments_count: p.comments?.length || 0,
      is_liked: userId ? p.likes?.some((l) => l.user_id === userId) : false,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   CREATE POST
====================== */
router.post("/", async (req, res) => {
  try {
    const { content, image_url, user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    const { data, error } = await supabaseAdmin
      .from("posts")
      .insert({
        user_id,
        content,
        image_url,
      })
      .select(
        `
        *,
        users!posts_user_id_fkey (
          name,
          avatar_url
        )
      `,
      )
      .single();

    if (error) {
      console.log("CREATE POST ERROR:", error);
      return res.status(500).json(error);
    }

    res.json({
      ...data,
      likes_count: 0,
      comments_count: 0,
      is_liked: false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   LIKE TOGGLE
====================== */
router.put("/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    const { data: existing } = await supabase
      .from("likes")
      .select("*")
      .eq("post_id", id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("likes")
        .delete()
        .eq("post_id", id)
        .eq("user_id", user_id);
    } else {
      await supabaseAdmin.from("likes").insert({
        post_id: id,
        user_id,
      });
    }

    const { count } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", id);

    res.json({
      likes: count || 0,
      is_liked: !existing,
    });
  } catch (err) {
    console.log("LIKE ERROR:", err);
    res.status(500).json({ error: "server error" });
  }
});

export default router;
