import express from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = express.Router();

/* =========================
   GET USER FROM TOKEN
========================= */
const getUserFromToken = async (token) => {
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) return null;

  return data.user;
};

/* =========================
   GET FEED
========================= */
router.get("/feed", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user = token ? await getUserFromToken(token) : null;

    const { data, error } = await supabaseAdmin
      .from("posts")
      .select(
        `
        id,
        content,
        image_url,
        created_at,
        user_id,
        users (
          id,
          name,
          avatar_url
        ),
        likes (
          user_id
        ),
        comments (
          id
        )
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
      is_liked: user ? p.likes?.some((l) => l.user_id === user.id) : false,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   CREATE POST
========================= */
router.post("/", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { content, image_url } = req.body;

    const { data, error } = await supabaseAdmin
      .from("posts")
      .insert({
        user_id: user.id,
        content,
        image_url,
      })
      .select(
        `
        id,
        content,
        image_url,
        created_at,
        user_id,
        users (
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

/* =========================
   TOGGLE LIKE
========================= */
router.put("/:id/like", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user_id = user.id;
    const post_id = req.params.id;

    const { data: existing } = await supabaseAdmin
      .from("likes")
      .select("*")
      .eq("post_id", post_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("likes")
        .delete()
        .eq("post_id", post_id)
        .eq("user_id", user_id);
    } else {
      await supabaseAdmin.from("likes").insert({
        post_id,
        user_id,
      });
    }

    const { count } = await supabaseAdmin
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", post_id);

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
