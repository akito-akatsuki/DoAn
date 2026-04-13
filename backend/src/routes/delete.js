import express from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = express.Router();

/* =========================
   DELETE POST
========================= */
router.delete("/:postId", async (req, res) => {
  try {
    const { postId } = req.params;

    if (!postId) {
      return res.status(400).json({ error: "missing postId" });
    }

    // 1. delete comments first (FK safety)
    const { error: commentError } = await supabaseAdmin
      .from("comments")
      .delete()
      .eq("post_id", postId);

    if (commentError) {
      console.log("DELETE COMMENTS ERROR:", commentError);
      return res.status(500).json({ error: commentError.message });
    }

    // 2. delete likes
    const { error: likeError } = await supabaseAdmin
      .from("likes")
      .delete()
      .eq("post_id", postId);

    if (likeError) {
      console.log("DELETE LIKES ERROR:", likeError);
      return res.status(500).json({ error: likeError.message });
    }

    // 3. delete post
    const { error: postError } = await supabaseAdmin
      .from("posts")
      .delete()
      .eq("id", postId);

    if (postError) {
      console.log("DELETE POST ERROR:", postError);
      return res.status(500).json({ error: postError.message });
    }

    res.json({ success: true });
  } catch (err) {
    console.log("SERVER ERROR:", err);
    res.status(500).json({ error: "server error" });
  }
});

export default router;
