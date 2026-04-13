import express from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = express.Router();

/* =========================
   CREATE OR GET CONVERSATION
========================= */
router.post("/conversation", async (req, res) => {
  try {
    const { user1, user2 } = req.body;

    if (!user1 || !user2) {
      return res.status(400).json({ error: "Missing users" });
    }

    // tìm conversation đã tồn tại
    const { data: existing } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .or(
        `and(user1_id.eq.${user1},user2_id.eq.${user2}),and(user1_id.eq.${user2},user2_id.eq.${user1})`,
      )
      .maybeSingle();

    if (existing) {
      return res.json({ conversationId: existing.id });
    }

    // create conversation
    const { data: conv, error } = await supabaseAdmin
      .from("conversations")
      .insert({ user1_id: user1, user2_id: user2 })
      .select()
      .single();

    if (error)
      return res
        .status(500)
        .json({ error: error.message || "Internal Server Error" });

    return res.json({ conversationId: conv.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET MESSAGES
========================= */
router.get("/messages/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || id === "undefined") {
      return res.status(400).json({ error: "Invalid conversationId" });
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (error)
      return res
        .status(400)
        .json({ error: error.message || "Failed to fetch messages" });

    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* =========================
   SEND MESSAGE (ONLY 1 ROUTE - FIXED)
========================= */
router.post("/messages", async (req, res) => {
  try {
    const { conversationId, senderId, content } = req.body;

    if (!conversationId || !senderId || !content) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
      })
      .select()
      .single();

    if (error)
      return res
        .status(400)
        .json({ error: error.message || "Failed to send message" });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
